import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { env } from '../common/env';
import { AgentConfig } from './agent.schema';
import { AgentService } from './agent.service';

const TICK_MS = 5 * 60_000;

/**
 * Hands-off mode. While the API is running, every few minutes it looks for users who switched the agent on
 * (not paused, not manual, autoRun) and whose interval has elapsed, then does a live run with fresh job discovery.
 * Every normal limit still applies: score thresholds, daily/company caps, run window, verified recipient, send gate.
 * Turn it off globally with AGENT_AUTORUN=false.
 */
@Injectable()
export class AgentScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('AgentScheduler');
  private timer?: NodeJS.Timeout;
  private readonly busy = new Set<string>();

  constructor(@InjectModel(AgentConfig.name) private readonly cfg: Model<AgentConfig>, private readonly agent: AgentService, private readonly audit: AuditService) {}

  onModuleInit() {
    if (!env.autoRunEnabled) { this.log.log('Auto-run disabled (AGENT_AUTORUN=false)'); return; }
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  inWindow(c: { windowStartHour: number; windowEndHour: number }, h: number) {
    return c.windowStartHour <= c.windowEndHour ? h >= c.windowStartHour && h < c.windowEndHour : h >= c.windowStartHour || h < c.windowEndHour;
  }

  async tick(now = new Date()) {
    const due = await this.cfg.find({ paused: false, autoRun: true, mode: { $ne: 'manual' } }).lean();
    for (const c of due) {
      const uid = String(c.userId);
      if (this.busy.has(uid) || !this.inWindow(c, now.getHours())) continue;
      if (c.lastAutoRunAt && now.getTime() - c.lastAutoRunAt.getTime() < (c.autoRunEveryMin ?? 120) * 60_000) continue;
      this.busy.add(uid);
      try {
        await this.cfg.updateOne({ userId: c.userId }, { $set: { lastAutoRunAt: now } }); // set first so a crash cannot cause a rapid re-run loop
        await this.agent.run(uid, false, { discover: true, actor: 'agent' });
      } catch (e: any) {
        this.log.warn(`auto-run failed for a user: ${String(e?.message ?? e).slice(0, 160)}`);
        await this.audit.record({ userId: uid, actor: 'agent', action: 'agent.auto_run_failed', entityType: 'agent', entityId: uid, result: 'failure', detail: String(e?.message ?? 'error').slice(0, 200) }).catch(() => undefined);
      } finally { this.busy.delete(uid); }
    }
  }
}

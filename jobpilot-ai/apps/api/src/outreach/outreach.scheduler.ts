import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutreachService } from './outreach.service';

/** Checks every few seconds for a running campaign whose next send time has come. One email per campaign per check. */
@Injectable()
export class OutreachScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout; private running = false;
  constructor(private readonly svc: OutreachService) {}
  onModuleInit() { this.timer = setInterval(() => { if (this.running) return; this.running = true; void this.svc.tick().finally(() => { this.running = false; }); }, 10_000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}

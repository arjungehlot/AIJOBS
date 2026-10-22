import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { env } from '../common/env';
import { AI_PROVIDER, AiProvider } from './ai.provider';
import { AiSetting } from './ai-settings.schema';

export const SetModelDto = z.object({ model: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{2,80}$/i, 'Invalid model id') });

@Injectable()
export class AiSettingsService {
  private models: { at: number; list: Awaited<ReturnType<AiProvider['listModels']>> } | null = null;
  constructor(
    @InjectModel(AiSetting.name) private readonly settings: Model<AiSetting>,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly audit: AuditService,
  ) {}

  /** The model this user's AI calls use: their choice, else the server default. */
  async modelFor(userId: string): Promise<string | undefined> {
    if (this.ai.name === 'mock') return undefined;
    const s = await this.settings.findOne({ userId }).lean();
    return s?.model || env.geminiDefaultModel;
  }

  private async catalog() {
    if (!this.models || Date.now() - this.models.at > 10 * 60_000) this.models = { at: Date.now(), list: await this.ai.listModels() };
    return this.models.list;
  }

  async status(userId: string, refresh = false) {
    if (refresh) this.models = null;
    const configured = this.ai.name !== 'mock';
    const [list, chosen] = await Promise.all([this.catalog().catch(() => []), this.settings.findOne({ userId }).lean()]);
    return {
      provider: this.ai.name, configured, keyPresent: this.ai.name === 'gemini' ? !!env.geminiKey : false,
      defaultModel: configured ? env.geminiDefaultModel : null, model: configured ? chosen?.model || env.geminiDefaultModel : null,
      models: list,
      note: configured ? null : 'AI is off (offline demo mode). Add GEMINI_API_KEY to the server .env file and restart the API.',
    };
  }

  async setModel(userId: string, model: string) {
    if (this.ai.name === 'mock') throw new BadRequestException('AI is not configured on the server');
    const list = await this.catalog();
    // The list comes from Google for this key. If it was unavailable we accept a well-formed id and let "Test" confirm it.
    if (list.length && !list.some((m) => m.id === model) && !/^gemini-/.test(model)) throw new BadRequestException('Unknown model');
    await this.settings.findOneAndUpdate({ userId }, { $set: { model } }, { upsert: true });
    await this.audit.record({ userId, actor: 'user', action: 'ai.model_changed', entityType: 'ai', entityId: userId, result: 'success', meta: { model } });
    return this.status(userId);
  }

  async test(userId: string) {
    const model = await this.modelFor(userId);
    return { provider: this.ai.name, ...(await this.ai.ping({ model })) };
  }
}

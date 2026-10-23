import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { toBuffer } from '../domain/bytes';
import { AuditService } from '../audit/audit.service';
import { env } from '../common/env';
import { AI_PROVIDER, AiProvider } from './ai.provider';
import { AiSetting } from './ai-settings.schema';
import { EmailAttachment } from './email-attachment.schema';

export const SetModelDto = z.object({ model: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{2,80}$/i, 'Invalid model id') });

export const DefaultsDto = z.object({
  signature: z.string().max(3000).optional(),
  defaultResumeId: z.string().regex(/^[a-f0-9]{24}$/i).nullable().optional(),
});
const ATT_MIME: Record<string, string> = { 'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'image/png': 'png', 'image/jpeg': 'jpg', 'text/plain': 'txt' };
export const AttachmentUploadDto = z.object({
  filename: z.string().trim().min(1).max(160),
  mime: z.enum(Object.keys(ATT_MIME) as [string, ...string[]]),
  base64: z.string().min(20),
});
const MAX_ATT_BYTES = 4 * 1024 * 1024; const MAX_ATT_FILES = 3;
export const SignatureDto = z.object({ signature: z.string().max(3000) });

@Injectable()
export class AiSettingsService {
  private models: { at: number; list: Awaited<ReturnType<AiProvider['listModels']>> } | null = null;
  constructor(
    @InjectModel(AiSetting.name) private readonly settings: Model<AiSetting>,
    @InjectModel(EmailAttachment.name) private readonly atts: Model<EmailAttachment>,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly audit: AuditService,
  ) {}

  /**
   * The model this user's AI calls use: their saved choice, else the server default, but only if Google still offers it to this key.
   * Models get retired; when the wanted one is gone we fall back to the best available Flash model instead of failing.
   */
  async modelFor(userId: string): Promise<string | undefined> {
    if (this.ai.name === 'mock') return undefined;
    const s = await this.settings.findOne({ userId }).lean();
    return this.resolve(s?.model);
  }

  private async resolve(saved?: string): Promise<string> {
    const list = await this.catalog().catch(() => []);
    const ids = new Set(list.map((m) => m.id));
    if (!ids.size) return saved || env.geminiDefaultModel;
    if (saved && ids.has(saved)) return saved;
    if (ids.has(env.geminiDefaultModel)) return env.geminiDefaultModel;
    const flash = list.map((m) => m.id).filter((id) => /^gemini-\d+(\.\d+)?-flash$/.test(id)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    return flash[0] ?? list[0].id;
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
      keys: this.ai.keyStatus?.() ?? [],
      defaultModel: configured ? await this.resolve(undefined) : null, model: configured ? await this.resolve(chosen?.model) : null,
      savedModelUnavailable: configured && !!chosen?.model && chosen.model !== (await this.resolve(chosen.model)),
      models: list,
      note: configured ? null : process.env.AI_PROVIDER === 'off'
        ? 'AI is switched off by AI_PROVIDER=off in the server .env. Remove that line and restart the API.'
        : `The server did not find GEMINI_API_KEY. Env files it read: ${env.envFilesLoaded.length ? env.envFilesLoaded.join(' | ') : 'none (no .env found)'}. Put GEMINI_API_KEY=your-key in one of them, save, and fully restart the API (stop it and run npm run dev again).`,
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

  async signatureFor(userId: string): Promise<string> { return ((await this.settings.findOne({ userId }).lean())?.signature ?? '').trim(); }

  async setSignature(userId: string, signature: string) {
    await this.settings.findOneAndUpdate({ userId }, { $set: { signature: signature.trim() } }, { upsert: true });
    await this.audit.record({ userId, actor: 'user', action: 'ai.signature_changed', entityType: 'ai', entityId: userId, result: 'success' });
    return { signature: signature.trim() };
  }

  /** Everything set once: signature, default resume, extra files. Never returns file bytes. */
  async defaults(userId: string) {
    const [s, files] = await Promise.all([this.settings.findOne({ userId }).lean(), this.atts.find({ userId }).select('filename mime size createdAt').sort({ createdAt: 1 }).lean()]);
    return { signature: s?.signature ?? '', defaultResumeId: s?.defaultResumeId ? String(s.defaultResumeId) : null, attachments: files.map((f: any) => ({ id: String(f._id), filename: f.filename, mime: f.mime, size: f.size })) };
  }

  async setDefaults(userId: string, dto: z.infer<typeof DefaultsDto>) {
    const set: Record<string, unknown> = {}; const unset: Record<string, ''> = {};
    if (dto.signature !== undefined) set.signature = dto.signature.trim();
    if (dto.defaultResumeId) set.defaultResumeId = dto.defaultResumeId; else if (dto.defaultResumeId === null) unset.defaultResumeId = '';
    await this.settings.findOneAndUpdate({ userId }, { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) }, { upsert: true });
    await this.audit.record({ userId, actor: 'user', action: 'ai.defaults_changed', entityType: 'ai', entityId: userId, result: 'success' });
    return this.defaults(userId);
  }

  async addAttachment(userId: string, dto: z.infer<typeof AttachmentUploadDto>) {
    const bytes = Buffer.from(dto.base64, 'base64');
    if (bytes.length > MAX_ATT_BYTES) throw new BadRequestException('File is larger than 4 MB');
    if (dto.mime === 'application/pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') throw new BadRequestException('This file is not a valid PDF');
    if ((await this.atts.countDocuments({ userId })) >= MAX_ATT_FILES) throw new BadRequestException(`You can keep up to ${MAX_ATT_FILES} extra attachments. Remove one first.`);
    const filename = dto.filename.replace(/[^\w.\- ()]+/g, '_');
    await this.atts.create({ userId, filename, mime: dto.mime, size: bytes.length, data: bytes });
    await this.audit.record({ userId, actor: 'user', action: 'email.attachment_added', entityType: 'ai', entityId: userId, result: 'success', meta: { bytes: bytes.length } });
    return this.defaults(userId);
  }

  async removeAttachment(userId: string, id: string) {
    await this.atts.deleteOne({ _id: id, userId });
    return this.defaults(userId);
  }

  async defaultResumeId(userId: string): Promise<string | undefined> { const s = await this.settings.findOne({ userId }).lean(); return s?.defaultResumeId ? String(s.defaultResumeId) : undefined; }

  /** The extra files for every email, with bytes, ready to attach. */
  async extraAttachments(userId: string) {
    const rows = await this.atts.find({ userId }).select('+data filename mime').sort({ createdAt: 1 }).lean();
    return rows.map((r: any) => ({ filename: r.filename as string, mime: r.mime as string, data: toBuffer(r.data) }));
  }
}

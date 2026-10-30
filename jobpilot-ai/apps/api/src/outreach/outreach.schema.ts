import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'outreach_campaigns' })
export class OutreachCampaign {
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 120 }) name: string;
  @Prop({ required: true, trim: true, maxlength: 300 }) subject: string;
  /** Template text. {{name}}, {{first_name}} and {{company}} are filled per recipient. */
  @Prop({ required: true, maxlength: 8000 }) body: string;
  @Prop({ type: Types.ObjectId }) resumeId?: Types.ObjectId;
  @Prop({ default: true }) includeExtraFiles: boolean;
  /** Base seconds between two emails (random jitter is added on top). */
  @Prop({ default: 45 }) gapSec: number;
  @Prop({ default: 'draft', enum: ['draft', 'running', 'paused', 'done', 'cancelled'] }) status: string;
  @Prop() nextAt?: Date;
  @Prop() startedAt?: Date;
  @Prop() finishedAt?: Date;
  @Prop() note?: string;
}
export const OutreachCampaignSchema = SchemaFactory.createForClass(OutreachCampaign);
OutreachCampaignSchema.index({ status: 1, nextAt: 1 });

@Schema({ timestamps: true, collection: 'outreach_recipients' })
export class OutreachRecipient {
  @Prop({ type: Types.ObjectId, required: true }) campaignId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, lowercase: true, trim: true }) email: string;
  @Prop() name?: string;
  @Prop() company?: string;
  @Prop({ required: true }) order: number;
  @Prop({ default: 'queued', enum: ['queued', 'sending', 'sent', 'failed', 'skipped'] }) status: string;
  @Prop() error?: string;
  @Prop({ required: true }) key: string; // idempotency key, also the Message-ID, so a doubtful send can be found in Sent
  @Prop() sentAt?: Date;
  @Prop() messageId?: string;
  @Prop() threadId?: string;
}
export const OutreachRecipientSchema = SchemaFactory.createForClass(OutreachRecipient);
OutreachRecipientSchema.index({ campaignId: 1, email: 1 }, { unique: true });
OutreachRecipientSchema.index({ campaignId: 1, status: 1, order: 1 });
OutreachRecipientSchema.index({ userId: 1, email: 1, status: 1, sentAt: -1 });

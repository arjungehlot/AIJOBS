import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'mail_accounts' })
export class MailAccount {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true, enum: ['gmail'] }) provider: string;
  @Prop({ required: true, lowercase: true }) email: string;
  /** AES-256-GCM encrypted. Never returned by any API and never logged. */
  @Prop({ required: true }) refreshTokenEnc: string;
  @Prop({ type: [String], default: [] }) scopes: string[];
  @Prop({ default: 'active', enum: ['active', 'revoked', 'error'] }) status: string;
  @Prop() lastError?: string;
  @Prop() lastSyncAt?: Date;
}
export const MailAccountSchema = SchemaFactory.createForClass(MailAccount);
MailAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

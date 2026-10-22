import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class Recipient {
  @Prop({ required: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true, enum: ['verified', 'source_reported', 'inferred', 'unverified'] }) confidence: string;
  @Prop() name?: string;
  @Prop({ default: false }) confirmedByUser: boolean;
}

export const RecipientSchema = SchemaFactory.createForClass(Recipient);

@Schema({ timestamps: true, collection: 'applications' })
export class Application {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) jobId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) careerProfileId: Types.ObjectId;
  @Prop({ type: RecipientSchema, required: true }) recipient: Recipient;
  @Prop({ required: true, maxlength: 300 }) subject: string;
  @Prop({ required: true, maxlength: 10000 }) body: string;
  @Prop({ required: true, default: 'draft' }) status: string;
  @Prop({ type: Types.ObjectId }) resumeId?: Types.ObjectId;
  @Prop() matchScore?: number;
  @Prop() sentAt?: Date;
  @Prop() providerMessageId?: string;
  @Prop() providerThreadId?: string;
  @Prop() lastError?: string;
  @Prop({ default: 0 }) sendAttempts: number;
  @Prop({ default: 1 }) schemaVersion: number;
}
export type ApplicationDoc = HydratedDocument<Application>;
export const ApplicationSchema = SchemaFactory.createForClass(Application);
// One application per job per user: blocks duplicates even under concurrent requests.
ApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });
ApplicationSchema.index({ userId: 1, status: 1, updatedAt: -1 });
ApplicationSchema.index({ userId: 1, sentAt: -1 });

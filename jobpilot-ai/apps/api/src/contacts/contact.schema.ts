import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'hr_contacts' })
export class Contact {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 120 }) name: string;
  @Prop({ lowercase: true, trim: true }) email?: string;
  @Prop({ trim: true }) title?: string;
  @Prop({ required: true, trim: true, maxlength: 200 }) company: string;
  @Prop({ default: 'manual', enum: ['manual', 'job_post', 'public_site', 'import'] }) source: string;
  @Prop({ default: 'unverified', enum: ['verified', 'source_reported', 'inferred', 'unverified'] }) verification: string;
  @Prop({ default: 10 }) confidence: number;
  @Prop() linkedinUrl?: string;
  @Prop() lastVerifiedAt?: Date;
  @Prop({ default: false }) suppressed: boolean;
  @Prop() notes?: string;
}
export const ContactSchema = SchemaFactory.createForClass(Contact);
ContactSchema.index({ userId: 1, company: 1 });
// Same address cannot be stored twice per user.
ContactSchema.index({ userId: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

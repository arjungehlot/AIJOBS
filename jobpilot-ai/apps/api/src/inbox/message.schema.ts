import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'inbound_messages' })
export class InboundMessage {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId }) applicationId?: Types.ObjectId;
  @Prop({ default: 'pasted', enum: ['pasted', 'gmail', 'outlook'] }) source: string;
  @Prop() gmailMessageId?: string;
  @Prop({ trim: true, maxlength: 320 }) fromEmail?: string;
  @Prop({ required: true, maxlength: 300 }) subject: string;
  @Prop({ required: true, maxlength: 20000 }) body: string;
  @Prop({ required: true }) receivedAt: Date;
  @Prop({ type: Object, required: true }) analysis: Record<string, any>;
  @Prop({ default: 'new', enum: ['new', 'handled'] }) state: string;
  @Prop() appliedStatus?: string;
}
export const InboundMessageSchema = SchemaFactory.createForClass(InboundMessage);
InboundMessageSchema.index({ userId: 1, receivedAt: -1 });
InboundMessageSchema.index({ userId: 1, applicationId: 1 });
// A Gmail message can be imported only once per user, even if sync runs twice at the same time.
InboundMessageSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true, partialFilterExpression: { gmailMessageId: { $type: 'string' } } });

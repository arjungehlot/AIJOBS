import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'follow_up_tasks' })
export class FollowUp {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId }) applicationId?: Types.ObjectId;
  @Prop({ required: true, enum: ['follow_up', 'deadline', 'interview', 'custom'] }) kind: string;
  @Prop({ required: true, maxlength: 200 }) title: string;
  @Prop({ required: true }) dueAt: Date;
  @Prop({ default: 'pending', enum: ['pending', 'done', 'cancelled'] }) status: string;
  @Prop({ default: 'user', enum: ['user', 'system'] }) createdBy: string;
  @Prop() note?: string;
  @Prop() cancelReason?: string;
}
export const FollowUpSchema = SchemaFactory.createForClass(FollowUp);
FollowUpSchema.index({ userId: 1, status: 1, dueAt: 1 });
FollowUpSchema.index({ userId: 1, applicationId: 1, status: 1 });

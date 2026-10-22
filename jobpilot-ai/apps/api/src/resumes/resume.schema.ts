import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'resumes' })
export class Resume {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 120 }) title: string;
  @Prop({ trim: true, maxlength: 120 }) targetRole?: string;
  @Prop({ required: true, maxlength: 60000 }) text: string;
  @Prop({ type: [String], default: [] }) skills: string[];
  @Prop({ default: 'original', enum: ['original', 'tailored'] }) kind: string;
  @Prop({ type: Types.ObjectId }) sourceResumeId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId }) jobId?: Types.ObjectId;
  @Prop({ default: 1 }) version: number;
}
export const ResumeSchema = SchemaFactory.createForClass(Resume);
ResumeSchema.index({ userId: 1, createdAt: -1 });

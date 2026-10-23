import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'ai_settings' })
export class AiSetting {
  @Prop({ type: Types.ObjectId, required: true, unique: true }) userId: Types.ObjectId;
  @Prop({ trim: true, maxlength: 80 }) model?: string;
  /** Closing block appended to every application email: name, links, highlights. */
  @Prop({ maxlength: 3000 }) signature?: string;
  /** The resume PDF attached to every email unless another is chosen. */
  @Prop({ type: Types.ObjectId }) defaultResumeId?: Types.ObjectId;
}
export const AiSettingSchema = SchemaFactory.createForClass(AiSetting);

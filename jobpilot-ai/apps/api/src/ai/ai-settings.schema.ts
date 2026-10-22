import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'ai_settings' })
export class AiSetting {
  @Prop({ type: Types.ObjectId, required: true, unique: true }) userId: Types.ObjectId;
  @Prop({ trim: true, maxlength: 80 }) model?: string;
}
export const AiSettingSchema = SchemaFactory.createForClass(AiSetting);

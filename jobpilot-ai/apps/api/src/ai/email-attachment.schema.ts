import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** A file the user wants on every application email (cover letter, portfolio PDF...). The resume is chosen separately. */
@Schema({ timestamps: true, collection: 'email_attachments' })
export class EmailAttachment {
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true }) filename: string;
  @Prop({ required: true }) mime: string;
  @Prop({ required: true }) size: number;
  @Prop({ type: Buffer, required: true, select: false }) data: Buffer;
}
export const EmailAttachmentSchema = SchemaFactory.createForClass(EmailAttachment);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type Actor = 'user' | 'agent' | 'workflow' | 'integration' | 'system' | 'admin';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, enum: ['user', 'agent', 'workflow', 'integration', 'system', 'admin'] }) actor: string;
  @Prop({ required: true }) action: string;
  @Prop({ required: true }) entityType: string;
  @Prop({ type: Types.ObjectId, required: true }) entityId: Types.ObjectId;
  @Prop({ required: true, enum: ['success', 'failure', 'blocked'] }) result: string;
  @Prop() detail?: string;
  @Prop({ type: Object }) meta?: Record<string, unknown>;
}
export type AuditDoc = HydratedDocument<AuditLog>;
export const AuditSchema = SchemaFactory.createForClass(AuditLog);
AuditSchema.index({ userId: 1, entityType: 1, entityId: 1, createdAt: -1 });

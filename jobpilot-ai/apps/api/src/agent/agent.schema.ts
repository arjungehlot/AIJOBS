import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'agent_configs' })
export class AgentConfig {
  @Prop({ type: Types.ObjectId, required: true, unique: true }) userId: Types.ObjectId;
  @Prop({ default: 'manual', enum: ['manual', 'copilot', 'autonomous'] }) mode: string;
  @Prop({ default: true }) paused: boolean; // starts paused: the user must turn it on
  @Prop({ default: 70, min: 0, max: 100 }) minScore: number;
  @Prop({ default: 85, min: 0, max: 100 }) autoSendMinScore: number;
  @Prop({ default: 5, min: 0, max: 50 }) maxPerDay: number;
  @Prop({ default: 1, min: 0, max: 10 }) maxPerCompany30d: number;
  @Prop({ default: false }) autoSendEnabled: boolean;
  @Prop({ default: 9, min: 0, max: 23 }) windowStartHour: number;
  @Prop({ default: 18, min: 0, max: 24 }) windowEndHour: number;
  @Prop({ type: Types.ObjectId }) careerProfileId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId }) resumeId?: Types.ObjectId;
}
export const AgentConfigSchema = SchemaFactory.createForClass(AgentConfig);

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'agent_runs' })
export class AgentRun {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true, enum: ['dry_run', 'live'] }) kind: string;
  @Prop({ required: true }) mode: string;
  @Prop({ type: [Object], default: [] }) decisions: Record<string, any>[];
  @Prop({ type: Object, default: {} }) summary: Record<string, number>;
}
export const AgentRunSchema = SchemaFactory.createForClass(AgentRun);
AgentRunSchema.index({ userId: 1, createdAt: -1 });

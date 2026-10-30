import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true }) passwordHash: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ default: 'user', enum: ['user', 'admin', 'super_admin'] }) role: string;
  @Prop({ default: 'free', enum: ['free', 'pro', 'premium_agent', 'teams'] }) plan: string;
  @Prop({ default: 'active', enum: ['active', 'suspended'] }) status: string;
  @Prop() picture?: string; // Google profile photo URL
  @Prop() avatar?: string; // uploaded photo as a small data URL; wins over picture
  @Prop() lastLoginAt?: Date;
  @Prop({ default: 1 }) schemaVersion: number;
}
export type UserDoc = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

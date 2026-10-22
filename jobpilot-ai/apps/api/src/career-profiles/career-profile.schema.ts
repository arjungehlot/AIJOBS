import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'career_profiles' })
export class CareerProfile {
  @Prop({ type: Types.ObjectId, required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ type: [String], default: [] }) targetTitles: string[];
  @Prop({ type: [String], default: [] }) skills: string[];
  @Prop({ default: 0 }) yearsExperience: number;
  @Prop({ type: [String], default: [] }) workModes: string[];
  @Prop({ type: [String], default: [] }) locations: string[];
  @Prop({ type: [String], default: [] }) employmentTypes: string[];
  @Prop() minSalary?: number;
  @Prop({ default: 'INR' }) currency: string;
  @Prop({ type: [String], default: [] }) excludedCompanies: string[];
  @Prop({ type: [String], default: [] }) excludedKeywords: string[];
  @Prop({ default: 70, min: 0, max: 100 }) minMatchScore: number;
  @Prop({ default: 10, min: 0, max: 200 }) maxDailyApplications: number;
}
export type CareerProfileDoc = HydratedDocument<CareerProfile>;
export const CareerProfileSchema = SchemaFactory.createForClass(CareerProfile);
CareerProfileSchema.index({ userId: 1, name: 1 }, { unique: true });

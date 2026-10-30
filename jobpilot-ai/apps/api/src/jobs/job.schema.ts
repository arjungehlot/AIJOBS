import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ required: true }) dedupeKey: string;
  @Prop({ default: 'manual' }) source: string;
  @Prop() providerJobId?: string;
  @Prop({ required: true, trim: true }) company: string;
  @Prop({ required: true, trim: true }) title: string;
  @Prop() description?: string;
  @Prop() location?: string;
  @Prop({ enum: ['remote', 'hybrid', 'onsite'] }) workMode?: string;
  @Prop() employmentType?: string;
  @Prop({ type: [String], default: [] }) requiredSkills: string[];
  @Prop({ type: [String], default: [] }) preferredSkills: string[];
  @Prop() experienceMin?: number;
  @Prop() experienceMax?: number;
  @Prop() salaryMin?: number;
  @Prop() salaryMax?: number;
  @Prop() currency?: string;
  @Prop() applicationUrl?: string;
  @Prop() applicationEmail?: string;
  @Prop() contactPhone?: string; // from the posting, or added by the user
  @Prop({ default: 'active', enum: ['active', 'expired', 'closed'] }) status: string;
  @Prop({ default: false }) shortlisted: boolean;
  @Prop({ default: () => new Date() }) firstSeenAt: Date;
  @Prop({ default: () => new Date() }) lastSeenAt: Date;
  @Prop({ default: 1 }) schemaVersion: number;
}
export type JobDoc = HydratedDocument<Job>;
export const JobSchema = SchemaFactory.createForClass(Job);
JobSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
JobSchema.index({ userId: 1, createdAt: -1 });
JobSchema.index({ userId: 1, company: 1, title: 1 });

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'job_matches' })
export class JobMatch {
  @Prop({ type: Types.ObjectId, required: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) jobId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) careerProfileId: Types.ObjectId;
  @Prop({ required: true }) score: number;
  @Prop({ required: true }) recommendation: string;
  @Prop({ type: Object, required: true }) report: Record<string, unknown>;
  @Prop({ default: 'scoring@1' }) engineVersion: string;
}
export const JobMatchSchema = SchemaFactory.createForClass(JobMatch);
JobMatchSchema.index({ userId: 1, jobId: 1, careerProfileId: 1, createdAt: -1 });

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Application, ApplicationSchema } from '../applications/application.schema';
import { CareerProfile, CareerProfileSchema } from '../career-profiles/career-profile.schema';
import { Job, JobSchema } from '../jobs/job.schema';
import { Resume, ResumeSchema } from '../resumes/resume.schema';
import { AgentConfig, AgentConfigSchema, AgentRun, AgentRunSchema } from './agent.schema';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: AgentConfig.name, schema: AgentConfigSchema }, { name: AgentRun.name, schema: AgentRunSchema },
    { name: Job.name, schema: JobSchema }, { name: Application.name, schema: ApplicationSchema },
    { name: CareerProfile.name, schema: CareerProfileSchema }, { name: Resume.name, schema: ResumeSchema },
  ])],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}

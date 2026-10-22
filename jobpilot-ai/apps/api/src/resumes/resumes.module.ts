import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../jobs/job.schema';
import { User, UserSchema } from '../users/user.schema';
import { Resume, ResumeSchema } from './resume.schema';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Resume.name, schema: ResumeSchema }, { name: Job.name, schema: JobSchema }, { name: User.name, schema: UserSchema }])],
  controllers: [ResumesController],
  providers: [ResumesService],
  exports: [MongooseModule, ResumesService],
})
export class ResumesModule {}

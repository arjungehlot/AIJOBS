import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareerProfilesModule } from '../career-profiles/career-profiles.module';
import { Job, JobMatch, JobMatchSchema, JobSchema } from './job.schema';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    CareerProfilesModule,
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }, { name: JobMatch.name, schema: JobMatchSchema }]),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [MongooseModule],
})
export class JobsModule {}

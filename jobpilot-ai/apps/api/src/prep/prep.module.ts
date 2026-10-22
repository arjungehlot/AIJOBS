import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobMatch, JobMatchSchema, JobSchema } from '../jobs/job.schema';
import { PrepController } from './prep.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }, { name: JobMatch.name, schema: JobMatchSchema }])],
  controllers: [PrepController],
})
export class PrepModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareerProfile, CareerProfileSchema } from '../career-profiles/career-profile.schema';
import { Job, JobMatch, JobMatchSchema, JobSchema } from '../jobs/job.schema';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }, { name: JobMatch.name, schema: JobMatchSchema }, { name: CareerProfile.name, schema: CareerProfileSchema }])],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}

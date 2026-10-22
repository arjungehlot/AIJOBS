import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareerProfilesModule } from '../career-profiles/career-profiles.module';
import { FollowUpsModule } from '../followups/followups.module';
import { ResumesModule } from '../resumes/resumes.module';
import { JobsModule } from '../jobs/jobs.module';
import { User, UserSchema } from '../users/user.schema';
import { Application, ApplicationSchema } from './application.schema';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [
    CareerProfilesModule, JobsModule, FollowUpsModule, ResumesModule,
    MongooseModule.forFeature([{ name: Application.name, schema: ApplicationSchema }, { name: User.name, schema: UserSchema }]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

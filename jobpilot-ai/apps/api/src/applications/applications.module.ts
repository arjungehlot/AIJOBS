import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareerProfilesModule } from '../career-profiles/career-profiles.module';
import { JobsModule } from '../jobs/jobs.module';
import { User, UserSchema } from '../users/user.schema';
import { Application, ApplicationSchema } from './application.schema';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [
    CareerProfilesModule, JobsModule,
    MongooseModule.forFeature([{ name: Application.name, schema: ApplicationSchema }, { name: User.name, schema: UserSchema }]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}

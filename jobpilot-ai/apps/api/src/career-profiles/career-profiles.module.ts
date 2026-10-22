import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/user.schema';
import { CareerProfile, CareerProfileSchema } from './career-profile.schema';
import { CareerProfilesController } from './career-profiles.controller';
import { CareerProfilesService } from './career-profiles.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: CareerProfile.name, schema: CareerProfileSchema },
    { name: User.name, schema: UserSchema },
  ])],
  controllers: [CareerProfilesController],
  providers: [CareerProfilesService],
  exports: [MongooseModule],
})
export class CareerProfilesModule {}

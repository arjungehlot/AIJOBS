import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FollowUp, FollowUpSchema } from './followup.schema';
import { FollowUpsController } from './followups.controller';
import { FollowUpsService } from './followups.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: FollowUp.name, schema: FollowUpSchema }])],
  controllers: [FollowUpsController],
  providers: [FollowUpsService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}

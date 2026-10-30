import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ResumesModule } from '../resumes/resumes.module';
import { User, UserSchema } from '../users/user.schema';
import { OutreachController } from './outreach.controller';
import { OutreachCampaign, OutreachCampaignSchema, OutreachRecipient, OutreachRecipientSchema } from './outreach.schema';
import { OutreachScheduler } from './outreach.scheduler';
import { OutreachService } from './outreach.service';

@Module({
  imports: [ResumesModule, MongooseModule.forFeature([{ name: OutreachCampaign.name, schema: OutreachCampaignSchema }, { name: OutreachRecipient.name, schema: OutreachRecipientSchema }, { name: User.name, schema: UserSchema }])],
  controllers: [OutreachController],
  providers: [OutreachService, OutreachScheduler],
})
export class OutreachModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Application, ApplicationSchema } from '../applications/application.schema';
import { CareerProfile, CareerProfileSchema } from '../career-profiles/career-profile.schema';
import { Contact, ContactSchema } from '../contacts/contact.schema';
import { FollowUp, FollowUpSchema } from '../followups/followup.schema';
import { InboundMessage, InboundMessageSchema } from '../inbox/message.schema';
import { Job, JobMatch, JobMatchSchema, JobSchema } from '../jobs/job.schema';
import { MailAccount, MailAccountSchema } from '../mail/mail-account.schema';
import { OutreachCampaign, OutreachCampaignSchema, OutreachRecipient, OutreachRecipientSchema } from '../outreach/outreach.schema';
import { Resume, ResumeSchema } from '../resumes/resume.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Application.name, schema: ApplicationSchema }, { name: CareerProfile.name, schema: CareerProfileSchema },
    { name: Contact.name, schema: ContactSchema }, { name: FollowUp.name, schema: FollowUpSchema },
    { name: InboundMessage.name, schema: InboundMessageSchema }, { name: Job.name, schema: JobSchema }, { name: JobMatch.name, schema: JobMatchSchema },
    { name: MailAccount.name, schema: MailAccountSchema }, { name: OutreachCampaign.name, schema: OutreachCampaignSchema },
    { name: OutreachRecipient.name, schema: OutreachRecipientSchema }, { name: Resume.name, schema: ResumeSchema },
  ])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

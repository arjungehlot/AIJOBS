import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Application, ApplicationSchema } from '../applications/application.schema';
import { AuditLog, AuditSchema } from '../audit/audit.schema';
import { Contact, ContactSchema } from '../contacts/contact.schema';
import { InboundMessage, InboundMessageSchema } from '../inbox/message.schema';
import { Job, JobSchema } from '../jobs/job.schema';
import { MailAccount, MailAccountSchema } from '../mail/mail-account.schema';
import { Resume, ResumeSchema } from '../resumes/resume.schema';
import { User, UserSchema } from '../users/user.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminSeed } from './super-admin.seed';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema }, { name: Job.name, schema: JobSchema }, { name: Application.name, schema: ApplicationSchema },
    { name: AuditLog.name, schema: AuditSchema }, { name: InboundMessage.name, schema: InboundMessageSchema }, { name: Contact.name, schema: ContactSchema },
    { name: Resume.name, schema: ResumeSchema }, { name: MailAccount.name, schema: MailAccountSchema },
  ])],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminSeed],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from './ai/ai.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/auth';
import { env } from './common/env';
import { CareerProfilesModule } from './career-profiles/career-profiles.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { MailModule } from './mail/mail.module';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ContactsModule } from './contacts/contacts.module';
import { FollowUpsModule } from './followups/followups.module';
import { InboxModule } from './inbox/inbox.module';
import { PrepModule } from './prep/prep.module';
import { ResumesModule } from './resumes/resumes.module';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongoUri),
    AuditModule, AiModule, MailModule,
    AuthModule, CareerProfilesModule, JobsModule, ApplicationsModule,
    ContactsModule, ResumesModule, InboxModule, FollowUpsModule, AgentModule, AnalyticsModule, PrepModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

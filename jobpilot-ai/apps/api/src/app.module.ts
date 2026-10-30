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
import { AdminModule } from './admin/admin.module';
import { User, UserSchema } from './users/user.schema';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ContactsModule } from './contacts/contacts.module';
import { FollowUpsModule } from './followups/followups.module';
import { InboxModule } from './inbox/inbox.module';
import { PrepModule } from './prep/prep.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { OutreachModule } from './outreach/outreach.module';
import { DemoModule } from './demo/demo.module';
import { ResumesModule } from './resumes/resumes.module';

@Module({
  imports: [
    MongooseModule.forRoot(env.mongoUri),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AdminModule,
    AuditModule, AiModule, MailModule,
    AuthModule, CareerProfilesModule, JobsModule, ApplicationsModule,
    ContactsModule, ResumesModule, InboxModule, FollowUpsModule, AgentModule, AnalyticsModule, PrepModule, DiscoveryModule, DemoModule, OutreachModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}

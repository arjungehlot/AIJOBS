import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Application, ApplicationSchema } from '../applications/application.schema';
import { ApplicationsModule } from '../applications/applications.module';
import { FollowUpsModule } from '../followups/followups.module';
import { InboundMessage, InboundMessageSchema } from './message.schema';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [ApplicationsModule, FollowUpsModule, MongooseModule.forFeature([{ name: InboundMessage.name, schema: InboundMessageSchema }, { name: Application.name, schema: ApplicationSchema }])],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}

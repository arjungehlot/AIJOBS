import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Application, ApplicationSchema } from '../applications/application.schema';
import { InboundMessage, InboundMessageSchema } from '../inbox/message.schema';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { MailAccount, MailAccountSchema } from './mail-account.schema';
import { MAIL_PROVIDER } from './mail.provider';
import { MockMailProvider } from './mock-mail.provider';
import { RoutingMailProvider } from './routing-mail.provider';

@Global()
@Module({
  imports: [MongooseModule.forFeature([
    { name: MailAccount.name, schema: MailAccountSchema },
    { name: InboundMessage.name, schema: InboundMessageSchema },
    { name: Application.name, schema: ApplicationSchema },
  ])],
  controllers: [GmailController],
  providers: [GmailService, MockMailProvider, RoutingMailProvider, { provide: MAIL_PROVIDER, useExisting: RoutingMailProvider }],
  exports: [MAIL_PROVIDER, GmailService],
})
export class MailModule {}

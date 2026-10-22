import { Injectable } from '@nestjs/common';
import { env } from '../common/env';
import { GmailService } from './gmail.service';
import { MailProvider, MailRejectedError, OutgoingMail, SentMail } from './mail.provider';
import { MockMailProvider } from './mock-mail.provider';

/**
 * MAIL_PROVIDER=mock  -> never sends real email (default).
 * MAIL_PROVIDER=gmail -> sends through the user's own connected Gmail account; refuses if none is connected.
 */
@Injectable()
export class RoutingMailProvider implements MailProvider {
  constructor(private readonly gmail: GmailService, private readonly mock: MockMailProvider) {}
  get name() { return env.mailProvider; }

  send(m: OutgoingMail): Promise<SentMail> {
    if (env.mailProvider === 'gmail') return this.gmail.send(m.userId, m);
    if (env.mailProvider === 'mock') return this.mock.send(m);
    throw new MailRejectedError(`Mail provider "${env.mailProvider}" is not supported`);
  }
  findSent(key: string, userId: string): Promise<SentMail | null> {
    return env.mailProvider === 'gmail' ? this.gmail.findSent(userId, key) : this.mock.findSent(key);
  }
}

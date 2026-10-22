import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MailOutcomeUnknownError, MailProvider, MailRejectedError, OutgoingMail, SentMail } from './mail.provider';

/**
 * Never sends real email. MAIL_MOCK_MODE=ok|reject|unknown lets you exercise
 * the failure paths: "unknown" stores the message but throws a timeout.
 */
@Injectable()
export class MockMailProvider implements MailProvider {
  readonly name = 'mock';
  private readonly sent = new Map<string, SentMail>();

  async send(m: OutgoingMail): Promise<SentMail> {
    const mode = process.env.MAIL_MOCK_MODE ?? 'ok';
    if (mode === 'reject') throw new MailRejectedError('Mock provider rejected the message');
    const existing = this.sent.get(m.idempotencyKey);
    if (existing) return existing; // provider-side idempotency
    const rec = { messageId: `mock-${randomUUID()}`, threadId: `thread-${randomUUID()}` };
    this.sent.set(m.idempotencyKey, rec);
    console.log(JSON.stringify({ evt: 'mock_mail_sent', to: m.to, subject: m.subject }));
    if (mode === 'unknown') throw new MailOutcomeUnknownError('Mock timeout after send');
    return rec;
  }

  async findSent(key: string, _userId?: string) { return this.sent.get(key) ?? null; }
}

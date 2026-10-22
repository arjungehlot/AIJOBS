export interface OutgoingMail {
  userId: string;
  idempotencyKey: string;
  from: string; to: string; subject: string; body: string;
  attachments?: { filename: string; mime: string; data: Buffer }[];
}
export interface SentMail { messageId: string; threadId?: string }

/** Outcome is unknown (timeout, dropped connection). The caller must reconcile, not retry. */
export class MailOutcomeUnknownError extends Error {}
/** The provider definitely did not send it. Safe to retry later. */
export class MailRejectedError extends Error {}

export interface MailProvider {
  readonly name: string;
  send(m: OutgoingMail): Promise<SentMail>;
  /** Looks in the provider's sent mail for a message carrying this idempotency key. */
  findSent(idempotencyKey: string, userId: string): Promise<SentMail | null>;
}
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export type AppStatus =
  | 'draft' | 'awaiting_approval' | 'approved' | 'sending' | 'applied'
  | 'send_failed' | 'send_unknown' | 'bounced' | 'hr_replied'
  | 'interview' | 'assessment' | 'rejected' | 'offer' | 'accepted' | 'withdrawn' | 'closed';

const T: Record<AppStatus, AppStatus[]> = {
  draft: ['awaiting_approval', 'closed'],
  awaiting_approval: ['approved', 'draft', 'closed'],
  approved: ['sending', 'awaiting_approval', 'closed'],
  sending: ['applied', 'send_failed', 'send_unknown'],
  send_unknown: ['applied', 'send_failed'],
  send_failed: ['approved', 'closed'],
  applied: ['hr_replied', 'bounced', 'withdrawn', 'closed'],
  hr_replied: ['interview', 'assessment', 'rejected', 'offer', 'closed'],
  assessment: ['interview', 'rejected', 'closed'],
  interview: ['assessment', 'offer', 'rejected', 'closed'],
  offer: ['accepted', 'rejected', 'withdrawn', 'closed'],
  bounced: ['closed'],
  rejected: ['closed'],
  accepted: ['closed'],
  withdrawn: ['closed'],
  closed: [],
};

/** Statuses only the send pipeline may set; a user cannot jump into them. */
export const SYSTEM_ONLY: AppStatus[] = ['sending', 'applied', 'send_failed', 'send_unknown', 'bounced'];

export function canTransition(from: AppStatus, to: AppStatus): boolean {
  return T[from]?.includes(to) ?? false;
}

export function assertTransition(from: AppStatus, to: AppStatus, actor: 'user' | 'system'): void {
  if (!canTransition(from, to)) throw new Error(`Illegal status change ${from} -> ${to}`);
  if (actor === 'user' && SYSTEM_ONLY.includes(to)) {
    throw new Error(`Status ${to} can only be set by the send pipeline`);
  }
}

/** Decides what the agent may do with one job. Pure, so every decision can be explained and tested. */
export type AgentMode = 'manual' | 'copilot' | 'autonomous';
export interface AgentRules {
  mode: AgentMode; paused: boolean; minScore: number; autoSendMinScore: number;
  maxPerDay: number; maxPerCompany30d: number; autoSendEnabled: boolean;
  windowStartHour: number; windowEndHour: number;
}
export interface JobContext {
  score: number; recommendation: 'apply' | 'consider' | 'skip'; mandatoryFailures: string[];
  alreadyApplied: boolean; sentToday: number; sentToCompany30d: number;
  recipient?: { email: string; confidence: 'verified' | 'source_reported' | 'inferred' | 'unverified' };
  hasResume: boolean; hourNow: number; jobActive: boolean;
}
export type Action = 'recommend' | 'draft' | 'auto_send' | 'hold' | 'skip';
export interface Decision { action: Action; reasons: string[] }

export function decide(r: AgentRules, c: JobContext): Decision {
  const skip = (...reasons: string[]): Decision => ({ action: 'skip', reasons });
  if (!c.jobActive) return skip('Job is no longer active.');
  if (c.alreadyApplied) return skip('You already have an application for this job.');
  if (c.mandatoryFailures.length) return skip(...c.mandatoryFailures);
  if (c.score < r.minScore) return skip(`Score ${c.score} is below your minimum of ${r.minScore}.`);

  if (r.paused) return { action: 'hold', reasons: ['Agent is paused.'] };
  if (r.mode === 'manual') return { action: 'recommend', reasons: [`Score ${c.score} qualifies. Manual mode never prepares or sends anything.`] };

  const holds: string[] = [];
  if (!c.hasResume) holds.push('No resume saved yet.');
  if (!c.recipient) holds.push('No recipient address on the job. Add a contact or application email.');
  if (c.sentToCompany30d >= r.maxPerCompany30d) holds.push(`Already sent ${c.sentToCompany30d} to this company in 30 days (limit ${r.maxPerCompany30d}).`);
  if (holds.length) return { action: 'hold', reasons: holds };

  if (r.mode === 'copilot') return { action: 'draft', reasons: [`Score ${c.score} qualifies. A draft is prepared and waits for your approval.`] };

  // Autonomous: every extra condition must pass, otherwise it falls back to a draft for approval.
  const why: string[] = [];
  if (!r.autoSendEnabled) why.push('Auto-send is switched off.');
  if (c.score < r.autoSendMinScore) why.push(`Score ${c.score} is below the auto-send threshold of ${r.autoSendMinScore}.`);
  if (!c.recipient || !['verified', 'source_reported'].includes(c.recipient.confidence)) why.push('Recipient is not verified.');
  if (c.sentToday >= r.maxPerDay) why.push(`Daily limit of ${r.maxPerDay} reached.`);
  const inWindow = r.windowStartHour <= r.windowEndHour
    ? c.hourNow >= r.windowStartHour && c.hourNow < r.windowEndHour
    : c.hourNow >= r.windowStartHour || c.hourNow < r.windowEndHour;
  if (!inWindow) why.push(`Outside your run window (${r.windowStartHour}:00 to ${r.windowEndHour}:00).`);
  if (why.length) return { action: 'draft', reasons: ['Would not auto-send, so it becomes a draft for approval:', ...why] };
  return { action: 'auto_send', reasons: ['All auto-send conditions pass.'] };
}

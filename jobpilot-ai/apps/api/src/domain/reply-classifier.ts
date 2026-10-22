/**
 * Rule-based classification of recruiter replies. Deterministic and offline.
 * It only reads the text: instructions inside an email can never trigger an action.
 */
export type ReplyCategory =
  | 'interview_invitation' | 'recruiter_screening' | 'assessment' | 'info_request' | 'rejection'
  | 'application_confirmation' | 'salary_discussion' | 'offer' | 'follow_up_required' | 'unrelated' | 'uncertain';

export interface ReplyInput { subject: string; body: string; from?: string }
export interface ReplyAnalysis {
  category: ReplyCategory;
  confidence: number; // 0..1
  signals: string[];
  extracted: { meetingLink?: string; whenText?: string; dateISO?: string; deadlineText?: string; requestedDocs: string[]; recruiterName?: string };
  nextAction: string;
}

const RULES: { cat: ReplyCategory; weight: number; re: RegExp }[] = [
  { cat: 'offer', weight: 4, re: /\b(offer letter|pleased to offer|we(?:'| a)re delighted to offer|extend (?:you )?an offer|job offer)\b/i },
  { cat: 'rejection', weight: 4, re: /\b(unfortunately|regret to inform|not (?:be )?moving forward|will not be proceeding|decided to (?:move|proceed) with (?:other|another)|other candidates|not selected)\b/i },
  { cat: 'interview_invitation', weight: 3, re: /\b(invite you to (?:an? )?interview|schedule (?:an? |your )?(?:technical |final |onsite |on-site )?interview|interview (?:is )?(?:scheduled|confirmed)|interview invitation|interview slot|panel interview)\b/i },
  { cat: 'recruiter_screening', weight: 3, re: /\b(intro(?:ductory)? call|screening call|phone screen|quick chat|brief call|recruiter call|connect for a call)\b/i },
  { cat: 'assessment', weight: 3, re: /\b(assessment|coding (?:test|challenge|exercise)|take-?home|hackerrank|codility|online test|technical test)\b/i },
  { cat: 'salary_discussion', weight: 3, re: /\b(expected (?:ctc|salary|compensation)|current (?:ctc|salary)|salary expectations?|compensation (?:range|expectations?)|notice period)\b/i },
  { cat: 'info_request', weight: 2, re: /\b(please (?:share|send|provide|confirm)|could you (?:share|send|provide)|kindly (?:share|send|provide)|additional (?:information|documents?)|portfolio|references?)\b/i },
  { cat: 'application_confirmation', weight: 3, re: /\b(received your application|thank you for applying|application (?:has been )?received|we have received your|successfully submitted)\b/i },
  { cat: 'follow_up_required', weight: 2, re: /\b(following up|any update|checking in|gentle reminder)\b/i },
];
const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const MONTH_IDX: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const TIME = '\\d{1,2}(?::\\d{2})?\\s?(?:am|pm|AM|PM)?(?:\\s?(?:IST|UTC|GMT|PST|EST|CET))?';
const DATE_RES = [
  new RegExp(`\\b((?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?(?:\\s*(?:,|at|@)\\s*${TIME})?)`, 'i'),
  new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})[a-z]*\\.?(?:,?\\s+\\d{4})?(?:\\s*(?:,|at|@)\\s*${TIME})?)`, 'i'),
  /\b(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?)\b/,
];
const LINK_RE = /https?:\/\/(?:[\w-]+\.)?(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com)\/\S+/i;
const DOC_RE = /\b(resume|cv|portfolio|references?|cover letter|id proof|certificates?|transcripts?|salary slips?|github)\b/gi;

export function classifyReply(input: ReplyInput): ReplyAnalysis {
  const text = `${input.subject}\n${input.body}`;
  const score = new Map<ReplyCategory, number>();
  const signals: string[] = [];
  for (const r of RULES) {
    const m = text.match(r.re);
    if (m) { score.set(r.cat, (score.get(r.cat) ?? 0) + r.weight); signals.push(`${r.cat}: "${m[0]}"`); }
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  let category: ReplyCategory;
  let confidence: number;
  if (!ranked.length) {
    category = text.trim().length < 15 ? 'uncertain' : 'unrelated'; confidence = 0.3;
  } else {
    const [top, second] = [ranked[0], ranked[1]];
    const margin = top[1] - (second?.[1] ?? 0);
    category = margin >= 2 || !second ? top[0] : 'uncertain'; // too close to call: ask the user
    confidence = category === 'uncertain' ? 0.35 : Math.min(0.95, 0.55 + margin * 0.1 + top[1] * 0.04);
  }
  // A rejection that also mentions "interview" is still a rejection; an offer wins over a screening mention.
  const link = text.match(LINK_RE)?.[0]?.replace(/[).,;]+$/, '');
  let whenText: string | undefined;
  for (const re of DATE_RES) { const m = text.match(re); if (m) { whenText = m[1].trim(); break; } }
  const deadline = text.match(/\b(?:by|before|within|due(?: on)?|deadline(?: is)?)\s+([^.\n]{3,50})/i)?.[1]?.trim();
  const docs = category === 'info_request' || category === 'assessment' || category === 'interview_invitation'
    ? [...new Set((text.match(DOC_RE) ?? []).map((d) => d.toLowerCase()))] : [];
  const name = (input.body.match(/(?:regards|thanks|sincerely|best|cheers)[,\s]*\n+\s*([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i) ?? [])[1];

  return {
    category, confidence: Number(confidence.toFixed(2)), signals,
    extracted: { meetingLink: link, whenText, dateISO: toISODate(whenText), deadlineText: deadline, requestedDocs: docs, recruiterName: name },
    nextAction: NEXT[category],
  };
}

const NEXT: Record<ReplyCategory, string> = {
  interview_invitation: 'Confirm the slot, add it to your calendar and open the interview prep kit.',
  recruiter_screening: 'Reply with your availability and prepare a 60-second introduction.',
  assessment: 'Note the deadline, block time to complete it and confirm receipt.',
  info_request: 'Send the requested items. Review anything personal before sharing it.',
  rejection: 'Mark the application as rejected. Consider asking for feedback.',
  application_confirmation: 'No action needed. A follow-up reminder is already scheduled.',
  salary_discussion: 'Decide your range before replying. This is a binding-adjacent topic, so it will never be sent automatically.',
  offer: 'Review the terms carefully. Offers are never accepted automatically.',
  follow_up_required: 'Reply to the recruiter with an update.',
  unrelated: 'Not recognized as a job reply. Link it manually if it matters.',
  uncertain: 'The signals conflict. Read the email and choose a category yourself.',
};

/** Date-only ISO string when a day and month are present. Year defaults to the reference year. */
export function toISODate(s?: string, refYear = new Date().getUTCFullYear()): string | undefined {
  if (!s) return undefined;
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const mon = s.match(new RegExp(`(${MONTHS})[a-z]*`, 'i'));
  const day = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (!mon || !day) return undefined;
  const y = s.match(/\b(20\d{2})\b/)?.[1] ?? String(refYear);
  const m = MONTH_IDX[mon[1].toLowerCase()];
  const d = Number(day[1]);
  if (!m || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

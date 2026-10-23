import type { DraftContext } from './ai.provider';

/**
 * Offline email in a fixed, professional structure. Used when no AI is configured or the AI is out of quota,
 * so the apply flow never stops. Only states facts we hold: matched skills and years the candidate entered.
 */
export function templateDraft(c: DraftContext): { subject: string; body: string } {
  const skills = c.matchedSkills.slice(0, 6).join(', ');
  const exp = c.yearsExperience > 0 ? `I have ${c.yearsExperience} year${c.yearsExperience === 1 ? '' : 's'} of hands-on experience` : 'I have hands-on experience';
  const gap = c.missingRequiredSkills.length
    ? ` I am still building depth in ${c.missingRequiredSkills.slice(0, 3).join(', ')} and am keen to grow in these areas.`
    : '';
  const body = [
    `Dear ${c.recruiterName ?? 'Hiring Team'},`,
    'I hope you are doing well.',
    `I am writing to express my interest in the ${c.jobTitle} position at ${c.company}.`,
    `${exp}${skills ? ` working with ${skills}` : ''}, and I enjoy turning requirements into reliable, well-tested solutions.${gap}`,
    `I would be glad to contribute my technical knowledge and problem-solving skills to the ${c.company} team.`,
    c.resumeAttached ? 'Please find my updated resume attached for your consideration. I would appreciate the opportunity to discuss my suitability for this role.' : 'I would appreciate the opportunity to discuss my suitability for this role.',
    'Thank you for your time and consideration. I look forward to hearing from you.',
  ].join('\n\n');
  return { subject: `Application for ${c.jobTitle} – ${c.candidateName}`, body };
}

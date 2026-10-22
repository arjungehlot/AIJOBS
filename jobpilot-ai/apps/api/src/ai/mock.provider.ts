import { Injectable } from '@nestjs/common';
import { AiProvider, DraftContext, JobInput } from './ai.provider';
import { ExtractedJob, ExtractedJobSchema } from './extraction.schema';

const KNOWN_SKILLS = ['node.js', 'react', 'typescript', 'javascript', 'python', 'java', 'go', 'postgresql', 'mongodb',
  'docker', 'kubernetes', 'aws', 'graphql', 'redis', 'terraform', 'next.js', 'nestjs', 'sql'];

/** Offline heuristic provider for local development and tests. Not an AI. */
@Injectable()
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async extractJob(input: JobInput): Promise<ExtractedJob> {
    if (input.kind === 'image') {
      // The mock cannot read pixels; return nothing rather than invent data.
      return ExtractedJobSchema.parse({});
    }
    const t = input.text;
    const line = (label: RegExp) => t.match(label)?.[1]?.trim();
    const lower = t.toLowerCase();
    const skills = KNOWN_SKILLS.filter((s) => lower.includes(s));
    const years = t.match(/(\d+)\s*(?:\+|-\s*\d+)?\s*years/i);
    const email = t.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
    const url = t.match(/https?:\/\/\S+/)?.[0];
    return ExtractedJobSchema.parse({
      company: line(/^\s*company\s*[:\-]\s*(.+)$/im),
      title: line(/^\s*(?:title|role|position)\s*[:\-]\s*(.+)$/im),
      location: line(/^\s*location\s*[:\-]\s*(.+)$/im),
      workMode: /\bremote\b/i.test(t) ? 'remote' : /\bhybrid\b/i.test(t) ? 'hybrid' : /\bon-?site\b/i.test(t) ? 'onsite' : null,
      description: t.slice(0, 20000),
      requiredSkills: skills,
      experienceMin: years ? Number(years[1]) : null,
      applicationEmail: email ?? null,
      applicationUrl: url ?? null,
    });
  }

  async draftEmail(c: DraftContext) {
    const skills = c.matchedSkills.slice(0, 5).join(', ');
    const gap = c.missingRequiredSkills.length
      ? `\n\nI have not yet worked with ${c.missingRequiredSkills.join(', ')} in production and would be glad to discuss how I would close that gap.`
      : '';
    return {
      subject: `Application: ${c.jobTitle} - ${c.candidateName}`,
      body: `Hello ${c.recruiterName ?? 'Hiring Team'},\n\nI am applying for the ${c.jobTitle} role at ${c.company}. ` +
        `I have ${c.yearsExperience} years of experience${skills ? ` with ${skills}` : ''}.${gap}\n\nMy resume is attached.\n\nKind regards,\n${c.candidateName}`,
    };
  }
}

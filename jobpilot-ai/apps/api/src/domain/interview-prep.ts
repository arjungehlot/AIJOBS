/** Deterministic interview prep built from the job's skills and your known gaps. A question bank, not AI. */
const BANK: Record<string, string[]> = {
  'node.js': ['How does the Node.js event loop work, and what blocks it?', 'How would you handle a CPU-heavy task in a Node service?'],
  react: ['When does a React component re-render, and how do you prevent needless renders?', 'Explain how you would structure state for a large form.'],
  typescript: ['What problems do generics solve? Give an example from your work.', 'When would you use unknown instead of any?'],
  postgresql: ['How do you decide which columns to index?', 'Explain a transaction isolation problem you have seen or could face.'],
  mongodb: ['When would you embed a document versus reference it?', 'How do compound indexes affect query plans?'],
  docker: ['What is the difference between an image and a container?', 'How do you keep images small and builds fast?'],
  kubernetes: ['What happens when you apply a Deployment? Walk through it.', 'How do readiness and liveness probes differ?'],
  aws: ['How would you design a secure, low-cost file upload flow?', 'What is the difference between IAM roles and users?'],
  graphql: ['How do you prevent the N+1 problem in GraphQL?'],
  redis: ['Where would a cache help you, and how do you invalidate it?'],
  python: ['How do generators work and when do you use them?'],
  java: ['Explain how garbage collection affects latency.'],
  sql: ['Write a query for the second-highest salary per department and explain it.'],
  terraform: ['How do you manage state safely across a team?'],
};
const BEHAVIORAL = [
  'Tell me about a time you disagreed with a teammate. What did you do and what was the outcome?',
  'Describe a project where you had to learn something quickly. How did you approach it?',
  'Tell me about a mistake that reached production and how you handled it.',
  'Describe the most impactful thing you shipped in the last year.',
];

export interface PrepKit {
  technical: { skill: string; questions: string[] }[];
  gaps: { skill: string; talkingPoint: string }[];
  behavioral: string[];
  star: { situation: string; task: string; action: string; result: string };
  askThem: string[];
}

export function buildPrep(opts: { title: string; company: string; required: string[]; preferred: string[]; missingRequired: string[] }): PrepKit {
  const order = [...opts.required, ...opts.preferred].map((s) => s.toLowerCase());
  const technical = [...new Set(order)].filter((s) => BANK[s]).slice(0, 6).map((skill) => ({ skill, questions: BANK[skill] }));
  const gaps = opts.missingRequired.map((skill) => ({
    skill,
    talkingPoint: `Be upfront that you have not used ${skill} in production. Name the closest thing you have done, and say how you would get productive in your first weeks.`,
  }));
  return {
    technical, gaps, behavioral: BEHAVIORAL,
    star: {
      situation: 'One or two sentences of context. Where, when, what was at stake.',
      task: 'What you personally were responsible for.',
      action: 'The specific steps you took. Use "I", not "we".',
      result: 'The measurable outcome, and what you learned. Only state numbers you can defend.',
    },
    askThem: [
      `What does success look like in the first 90 days for this ${opts.title} role?`,
      `How does the team at ${opts.company} handle on-call and releases?`,
      'What is the interview process from here, and how long does it usually take?',
    ],
  };
}

/** Clearly-labelled sample data for previewing the dashboard. Never mixed with real records. */
const days = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
  return d.toISOString().slice(0, 10);
});

export function sampleOverview() {
  return {
    kpis: { jobsDiscovered: 412, jobsAnalyzed: 268, suitableJobs: 74, shortlisted: 41, applicationsSent: 36, awaitingResponse: 24, hrReplies: 9, interviews: 3, offers: 1, responseRate: 25 },
    funnel: [
      { stage: 'Discovered', count: 412 }, { stage: 'Analyzed', count: 268 }, { stage: 'Shortlisted', count: 41 }, { stage: 'Drafted', count: 38 },
      { stage: 'Applied', count: 36 }, { stage: 'HR replied', count: 9 }, { stage: 'Interview', count: 3 }, { stage: 'Offer', count: 1 },
    ],
    byStatus: { applied: 24, hr_replied: 5, interview: 3, offer: 1, rejected: 3, draft: 2 },
  };
}

export function sampleTrends() {
  const d = days(14);
  const sent = [1, 2, 0, 3, 4, 2, 1, 3, 5, 4, 2, 0, 3, 6];
  const found = [12, 18, 9, 22, 30, 14, 10, 26, 34, 28, 16, 8, 24, 38];
  return {
    days: d, sent, discovered: found,
    scoreBuckets: [{ label: '0–39', count: 62 }, { label: '40–54', count: 48 }, { label: '55–69', count: 84 }, { label: '70–84', count: 51 }, { label: '85+', count: 23 }],
  };
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application } from '../applications/application.schema';
import { averageDays, groupRates, rate, scoreBucket } from '../domain/stats';
import { Job } from '../jobs/job.schema';

const REPLIED = ['hr_replied', 'interview', 'assessment', 'offer', 'accepted', 'rejected'];
const INTERVIEWED = ['interview', 'offer', 'accepted'];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Application.name) private readonly apps: Model<Application>,
    @InjectModel(Job.name) private readonly jobs: Model<Job>,
  ) {}

  /** Every rate carries its sample size and a lowSample flag, so the UI can refuse to overstate. */
  async insights(userId: string) {
    const sent = await this.apps.find({ userId, sentAt: { $exists: true } }).populate('jobId', 'company workMode location source').lean();
    const replied = (a: any) => REPLIED.includes(a.status);
    const jobOf = (a: any) => a.jobId ?? {};
    const byScore = groupRates(sent, (a: any) => scoreBucket(a.matchScore), replied);
    const byMode = groupRates(sent, (a: any) => jobOf(a).workMode ?? 'Unknown', replied);
    const bySource = groupRates(sent, (a: any) => jobOf(a).source ?? 'Unknown', replied);
    const byDow = groupRates(sent, (a: any) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(a.sentAt).getUTCDay()], replied);
    const byCompany = groupRates(sent, (a: any) => jobOf(a).company ?? 'Unknown', replied).slice(0, 8);

    const days = averageDays(sent.filter(replied).map((a: any) => ({ from: a.sentAt, to: a.updatedAt })));
    const overall = rate(sent.filter(replied).length, sent.length);
    const interview = rate(sent.filter((a: any) => INTERVIEWED.includes(a.status)).length, sent.length);
    const rejected = rate(sent.filter((a: any) => a.status === 'rejected').length, sent.length);

    const notes: string[] = [];
    if (sent.length < 20) notes.push(`Only ${sent.length} applications sent. Percentages below are shown but flagged: they say little until you have 20 or more per group.`);
    const best = byScore.filter((g) => !g.rate.lowSample && g.rate.pct !== null).sort((a, b) => (b.rate.pct! - a.rate.pct!))[0];
    if (best) notes.push(`Applications in the ${best.key} score band got the highest response rate (${best.rate.pct}% of ${best.rate.d}).`);

    return {
      totals: { sent: sent.length, overall, interview, rejected, avgDaysToReply: days },
      byScore, byMode, bySource, byDow, byCompany, notes,
      disclaimer: 'Correlation from your own history, not a promise about future results.',
    };
  }

  async pipelineValue(userId: string) {
    const open = await this.apps.countDocuments({ userId, status: { $in: ['applied', 'hr_replied', 'interview', 'assessment', 'offer'] } });
    return { openApplications: open };
  }
}

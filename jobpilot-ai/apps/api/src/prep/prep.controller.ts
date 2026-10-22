import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser, CurrentUser } from '../common/auth';
import { ObjectIdPipe } from '../common/object-id.pipe';
import { buildPrep } from '../domain/interview-prep';
import { Job, JobMatch } from '../jobs/job.schema';

@Controller('prep')
export class PrepController {
  constructor(@InjectModel(Job.name) private readonly jobs: Model<Job>, @InjectModel(JobMatch.name) private readonly matches: Model<JobMatch>) {}

  /** Prep kit for a job, using gaps from your latest match when one exists. */
  @Get(':jobId')
  async kit(@CurrentUser() u: AuthUser, @Param('jobId', ObjectIdPipe) jobId: string) {
    const job = await this.jobs.findOne({ _id: jobId, userId: u.id }).lean();
    if (!job) throw new NotFoundException('Job not found');
    const m: any = await this.matches.findOne({ userId: u.id, jobId }).sort({ createdAt: -1 }).lean();
    const kit = buildPrep({ title: job.title, company: job.company, required: job.requiredSkills, preferred: job.preferredSkills, missingRequired: m?.report?.missingRequired ?? [] });
    return { job: { id: jobId, title: job.title, company: job.company }, basedOnMatch: !!m, ...kit };
  }
}

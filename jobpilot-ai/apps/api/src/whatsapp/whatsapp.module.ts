import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../jobs/job.schema';
import { ResumesModule } from '../resumes/resumes.module';
import { User, UserSchema } from '../users/user.schema';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [ResumesModule, MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }, { name: User.name, schema: UserSchema }])],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}

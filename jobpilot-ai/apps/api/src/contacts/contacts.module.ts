import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationSchema, Application } from '../applications/application.schema';
import { Job, JobSchema } from '../jobs/job.schema';
import { Contact, ContactSchema } from './contact.schema';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Contact.name, schema: ContactSchema }, { name: Job.name, schema: JobSchema }, { name: Application.name, schema: ApplicationSchema }])],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [MongooseModule, ContactsService],
})
export class ContactsModule {}

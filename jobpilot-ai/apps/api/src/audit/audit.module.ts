import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditSchema, AuditLog } from './audit.schema';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditSchema }])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

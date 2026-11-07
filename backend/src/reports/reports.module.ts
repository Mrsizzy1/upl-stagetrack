import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuditController, ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AttendanceModule],
  controllers: [ReportsController, AuditController],
  providers: [ReportsService],
})
export class ReportsModule {}

import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { AttendanceController, SchedulesController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ClosureService } from './closure.service';
import { MeController } from './me.controller';
import { ScanService } from './scan.service';
import { SchedulesService } from './schedules.service';
import { SessionsService } from './sessions.service';

@Module({
  imports: [StudentsModule],
  controllers: [AttendanceController, SchedulesController, MeController],
  providers: [SchedulesService, SessionsService, ScanService, ClosureService, AttendanceService],
  exports: [SchedulesService, ClosureService],
})
export class AttendanceModule {}

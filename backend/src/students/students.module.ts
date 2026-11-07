import { Module } from '@nestjs/common';
import { QrService } from '../qr/qr.service';
import { ReferenceController } from '../reference/reference.controller';
import { UsersModule } from '../users/users.module';
import { PhotoStorageService } from './photo-storage.service';
import { StudentImportService } from './student-import.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [UsersModule],
  controllers: [StudentsController, ReferenceController],
  providers: [StudentsService, StudentImportService, PhotoStorageService, QrService],
  exports: [StudentsService, PhotoStorageService, QrService],
})
export class StudentsModule {}

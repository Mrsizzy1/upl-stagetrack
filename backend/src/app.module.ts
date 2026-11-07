import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './common/audit/audit.service';
import { AuthGuard } from './common/auth/auth.guard';
import { ClockModule } from './common/clock/clock.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { StudentsModule } from './students/students.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => validateEnv(raw) as unknown as Record<string, unknown>,
    }),
    // Limite globale par adresse IP ; limites plus strictes sur la connexion et le scan.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 240 }]),
    ScheduleModule.forRoot(),
    ClockModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    UsersModule,
    StudentsModule,
    AttendanceModule,
    ReportsModule,
  ],
  providers: [
    // Ordre : limitation de débit, puis authentification et rôles (refus par défaut).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

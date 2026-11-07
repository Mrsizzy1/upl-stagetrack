import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { toLocal } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';

/**
 * État de l'API et heure officielle du serveur.
 * Public et sans donnée personnelle : utilisé par l'écran de pointage pour afficher
 * l'heure de référence, et par la supervision.
 */
@ApiTags('Santé')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'API et base de données disponibles' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Base de données injoignable' });
    }
    const now = this.clock.now();
    const timeZone = this.config.getOrThrow<string>('APP_TIMEZONE');
    const local = toLocal(now, timeZone);
    return {
      status: 'ok',
      database: 'up',
      serverTime: now.toISOString(),
      timeZone,
      localDate: local.date,
      localTime: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:${String(local.second).padStart(2, '0')}`,
    };
  }
}

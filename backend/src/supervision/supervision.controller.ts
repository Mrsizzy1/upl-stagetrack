import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth/auth.decorators';
import { UpdateSettingsDto } from './supervision.dto';
import { SupervisionService } from './supervision.service';

@ApiTags('Supervision et Paramètres')
@Controller()
export class SupervisionController {
  constructor(private readonly supervisionService: SupervisionService) {}

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN', 'FACULTY_ADMIN')
  @Get('supervision/overview')
  getOverview() {
    return this.supervisionService.getOverview();
  }

  @Public()
  @Get('settings')
  getSettings() {
    return this.supervisionService.getSettings();
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('settings')
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.supervisionService.updateSettings(dto, actor, req.ip ?? null);
  }
}


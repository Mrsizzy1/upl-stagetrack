import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth/auth.decorators';
import {
  CreateInterventionDto,
  CreateMachineDto,
  DeleteAllMachinesDto,
  PerformControlDto,
  ReportIssueDto,
  UpdateInterventionDto,
  UpdateMachineDto,
} from './machines.dto';
import { MachinesService } from './machines.service';

@ApiTags('Machines et Interventions')
@Controller()
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  // --------------------------------------------------------------------------
  // CONSULTATION PUBLIQUE DU QR CODE : /m/:publicToken et /public/machines/:publicToken
  // Lecture de la fiche publique et possibilité de signaler un incident
  // --------------------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get(['m/:publicToken', 'public/machines/:publicToken'])
  getPublicByToken(@Param('publicToken', ParseUUIDPipe) publicToken: string) {
    return this.machinesService.getPublicByToken(publicToken);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(['m/:publicToken/report', 'public/machines/:publicToken/report'])
  reportIssue(
    @Param('publicToken', ParseUUIDPipe) publicToken: string,
    @Body() dto: ReportIssueDto,
    @Req() req: Request,
  ) {
    return this.machinesService.reportPublicIssue(publicToken, dto, req.ip ?? null);
  }

  // --------------------------------------------------------------------------
  // ROUTES PRIVÉES : GESTION DES MACHINES
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Post('machines')
  create(
    @Body() dto: CreateMachineDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.machinesService.create(dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Delete('machines')
  deleteAll(
    @Body() dto: DeleteAllMachinesDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.machinesService.deleteAll(dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN', 'FACULTY_ADMIN')
  @Get('machines/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.machinesService.get(id);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Patch('machines/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMachineDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.machinesService.update(id, dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Get('machines/:id/qr-png')
  async qrPng(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const pngBuffer = await this.machinesService.generateQrPng(id);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr-machine-${id.slice(0, 8)}.png"`);
    res.send(pngBuffer);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Post('machines/:id/control')
  @HttpCode(200)
  performControl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PerformControlDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.machinesService.performControl(id, dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Get('machines/:id/controls')
  getControlHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.machinesService.getControlHistory(id);
  }

  // --------------------------------------------------------------------------
  // ROUTES PRIVÉES : INTERVENTIONS TECHNIQUES
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN', 'FACULTY_ADMIN')
  @Get('interventions')
  listInterventions(@Query() query: any) {
    return this.machinesService.listInterventions(query);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Post('interventions')
  createIntervention(
    @Body() dto: CreateInterventionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.machinesService.createIntervention(dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Patch('interventions/:id')
  updateIntervention(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInterventionDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.machinesService.updateIntervention(id, dto, actor, req.ip ?? null);
  }
}


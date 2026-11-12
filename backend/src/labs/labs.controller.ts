import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth/auth.decorators';
import { CreateLabDto, CreateRowDto, UpdateLabDto, UpdateRowDto } from './labs.dto';
import { LabsService } from './labs.service';

@ApiTags('Laboratoires')
@ApiBearerAuth()
@Controller('labs')
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN', 'FACULTY_ADMIN', 'SUPERVISOR')
  @Get()
  list() {
    return this.labsService.list();
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Post()
  create(@Body() dto: CreateLabDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.labsService.create(dto, actor, req.ip ?? null);
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN', 'FACULTY_ADMIN', 'SUPERVISOR')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.labsService.get(id);
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.labsService.update(id, dto, actor, req.ip ?? null);
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Post(':id/rows')
  addRow(@Param('id', ParseUUIDPipe) labId: string, @Body() dto: CreateRowDto) {
    return this.labsService.addRow(labId, dto);
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Patch('rows/:rowId')
  updateRow(@Param('rowId', ParseUUIDPipe) rowId: string, @Body() dto: UpdateRowDto) {
    return this.labsService.updateRow(rowId, dto);
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Delete('rows/:rowId')
  deleteRow(@Param('rowId', ParseUUIDPipe) rowId: string) {
    return this.labsService.deleteRow(rowId);
  }

  @Roles('IT_TECHNICIAN', 'SUPER_ADMIN', 'ADMIN')
  @Get(':id/stickers-pdf')
  async stickersPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const pdfBuffer = await this.labsService.generateStickersPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="etiquettes-qr-${id.slice(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  }
}


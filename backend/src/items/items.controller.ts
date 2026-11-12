import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth/auth.decorators';
import {
  ClaimItemDto,
  ConfirmReturnDto,
  DeclareItemDto,
  ListPublicItemsQueryDto,
  ReviewClaimDto,
  UpdateItemStatusDto,
} from './items.dto';
import { ItemsService } from './items.service';

@ApiTags('Objets perdus et retrouvés')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  // --------------------------------------------------------------------------
  // ROUTES PUBLIQUES (AUCUNE AUTHENTIFICATION REQUISE)
  // --------------------------------------------------------------------------

  @Public()
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @Get('public')
  listPublic(@Query() query: ListPublicItemsQueryDto) {
    return this.itemsService.listPublic(query);
  }

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Get('public/:id')
  getPublicItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.getPublicItem(id);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('public/declare')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  declarePublic(
    @Body() dto: DeclareItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.itemsService.declarePublic(dto, file?.buffer);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('public/:id/claim')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  claimPublic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.itemsService.claimPublic(id, dto, file?.buffer);
  }

  @Public()
  @Get('photos/:filename')
  async getPhoto(@Param('filename') filename: string, @Res() res: Response) {
    const { buffer, contentType } = await this.itemsService.getPhoto(filename);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(buffer);
  }

  // --------------------------------------------------------------------------
  // ROUTES D'ADMINISTRATION
  // --------------------------------------------------------------------------

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN')
  @Get('admin')
  listAdmin(@Query() query: any) {
    return this.itemsService.listAdmin(query);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN')
  @Patch('admin/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.itemsService.updateStatus(id, dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN')
  @Get('admin/:id/claims')
  listClaims(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.listClaims(id);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN')
  @Post('admin/claims/:claimId/review')
  @HttpCode(200)
  reviewClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: ReviewClaimDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.itemsService.reviewClaim(claimId, dto, actor, req.ip ?? null);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'SUPER_ADMIN', 'FACULTY_ADMIN')
  @Post('admin/:id/return')
  @HttpCode(200)
  confirmReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmReturnDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.itemsService.confirmReturn(id, dto, actor, req.ip ?? null);
  }
}


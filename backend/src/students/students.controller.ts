import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthUser, CurrentUser, Roles } from '../common/auth/auth.decorators';
import { QrService } from '../qr/qr.service';
import { UsersService } from '../users/users.service';
import { MAX_PHOTO_BYTES } from './photo-storage.service';
import { IMPORT_TEMPLATE_CSV, MAX_IMPORT_BYTES, StudentImportService } from './student-import.service';
import {
  ChangeStatusDto,
  CreateStudentDto,
  InternshipDto,
  ListStudentsQueryDto,
  ReasonDto,
  StudentAccountDto,
  UpdateStudentDto,
} from './students.dto';
import { StudentsService } from './students.service';

const ip = (req: Request) => req.ip ?? null;

@ApiTags('Étudiants')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly importer: StudentImportService,
    private readonly qr: QrService,
    private readonly users: UsersService,
  ) {}

  @Roles('ADMIN', 'SUPERVISOR')
  @Get()
  list(@Query() query: ListStudentsQueryDto) {
    return this.students.list(query);
  }

  @Roles('ADMIN')
  @Get('import/template.csv')
  template(@Res({ passthrough: true }) res: Response) {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="modele-import-etudiants.csv"' });
    return IMPORT_TEMPLATE_CSV;
  }

  @Roles('ADMIN')
  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }))
  import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('dryRun', new ParseBoolPipe({ optional: true })) dryRun: boolean | undefined,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Fichier manquant' });
    return this.importer.run(file, dryRun ?? true, actor, ip(req));
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.get(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateStudentDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.students.create(dto, actor, ip(req));
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.students.update(id, dto, actor, ip(req));
  }

  @Roles('ADMIN')
  @Patch(':id/status')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.students.changeStatus(id, dto, actor, ip(req));
  }

  @Roles('ADMIN')
  @Post(':id/photo')
  @HttpCode(204)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  async setPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    if (!file) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Photo manquante' });
    await this.students.setPhoto(id, file.buffer, actor, ip(req));
  }

  @Roles('ADMIN')
  @Delete(':id/photo')
  @HttpCode(204)
  async removePhoto(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @Req() req: Request): Promise<void> {
    await this.students.removePhoto(id, actor, ip(req));
  }

  @Roles('ADMIN', 'SUPERVISOR', 'SCAN_AGENT')
  @Get(':id/photo')
  async photo(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const { buffer, contentType } = await this.students.photo(id);
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' });
    return new StreamableFile(buffer);
  }

  @Roles('ADMIN')
  @Post(':id/internships')
  addInternship(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InternshipDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.students.addInternship(id, dto, actor, ip(req));
  }

  @Roles('ADMIN')
  @Patch(':id/internships/:internshipId')
  updateInternship(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('internshipId', ParseUUIDPipe) internshipId: string,
    @Body() dto: InternshipDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.updateInternship(id, internshipId, dto, actor, ip(req));
  }

  @Roles('ADMIN')
  @Delete(':id/internships/:internshipId')
  deleteInternship(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('internshipId', ParseUUIDPipe) internshipId: string,
    @CurrentUser() actor: AuthUser,
    @Req() req: Request,
  ) {
    return this.students.deleteInternship(id, internshipId, actor, ip(req));
  }

  @Roles('ADMIN', 'SUPERVISOR')
  @Get(':id/qr')
  qrHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.qr.history(id);
  }

  @Roles('ADMIN')
  @Get(':id/qr.png')
  async qrPng(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const png = await this.qr.png(id);
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    return new StreamableFile(png);
  }

  @Roles('ADMIN')
  @Get(':id/card.pdf')
  async card(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const pdf = await this.qr.card(id);
    res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="carte-stagiaire.pdf"' });
    return new StreamableFile(pdf);
  }

  @Roles('ADMIN')
  @Post(':id/qr/regenerate')
  @HttpCode(204)
  async regenerate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    await this.qr.regenerate(id, dto.reason, actor, ip(req));
  }

  @Roles('ADMIN')
  @Post(':id/qr/revoke')
  @HttpCode(204)
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    await this.qr.revoke(id, dto.reason, actor, ip(req));
  }

  @Roles('ADMIN')
  @Post(':id/account')
  createAccount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StudentAccountDto, @CurrentUser() actor: AuthUser, @Req() req: Request) {
    return this.users.createStudentAccount(id, dto.temporaryPassword, actor, ip(req));
  }
}

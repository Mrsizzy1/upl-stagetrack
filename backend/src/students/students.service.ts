import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { fromDbDate, toDbDate } from '../common/dates';
import { paginate, Paginated } from '../common/http/pagination.dto';
import { toLocal } from '../domain/time/zoned-time';
import { PrismaService } from '../prisma/prisma.service';
import { QrService } from '../qr/qr.service';
import { PhotoStorageService } from './photo-storage.service';
import { ChangeStatusDto, CreateStudentDto, InternshipDto, ListStudentsQueryDto, UpdateStudentDto } from './students.dto';

const listSelect = {
  id: true,
  matricule: true,
  lastName: true,
  middleName: true,
  firstName: true,
  status: true,
  photoPath: true,
  faculty: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
  promotion: { select: { id: true, code: true, label: true } },
  internships: { orderBy: { startDate: 'desc' }, take: 1, select: { startDate: true, endDate: true } },
} satisfies Prisma.StudentSelect;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly qr: QrService,
    private readonly photos: PhotoStorageService,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  private today(): string {
    return toLocal(this.clock.now(), this.config.getOrThrow<string>('APP_TIMEZONE')).date;
  }

  async list(query: ListStudentsQueryDto): Promise<Paginated<unknown>> {
    const words = (query.search ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
    const where: Prisma.StudentWhereInput = {
      facultyId: query.facultyId,
      departmentId: query.departmentId,
      promotionId: query.promotionId,
      status: query.status,
      AND: words.map((word) => ({
        OR: [
          { matricule: { contains: word, mode: 'insensitive' } },
          { lastName: { contains: word, mode: 'insensitive' } },
          { middleName: { contains: word, mode: 'insensitive' } },
          { firstName: { contains: word, mode: 'insensitive' } },
        ],
      })),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: listSelect,
        orderBy: [{ lastName: 'asc' }, { middleName: 'asc' }, { firstName: 'asc' }],
        ...paginate(query),
      }),
      this.prisma.student.count({ where }),
    ]);
    return {
      items: items.map((s) => ({
        ...s,
        hasPhoto: Boolean(s.photoPath),
        photoPath: undefined,
        currentInternship: s.internships[0]
          ? { startDate: fromDbDate(s.internships[0].startDate), endDate: fromDbDate(s.internships[0].endDate) }
          : null,
        internships: undefined,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string) {
    const s = await this.prisma.student.findUnique({
      where: { id },
      include: {
        faculty: true,
        department: true,
        promotion: true,
        user: { select: { id: true, username: true, isActive: true, lastLoginAt: true } },
        internships: { orderBy: { startDate: 'desc' }, include: { supervisor: { select: { id: true, fullName: true } } } },
        credentials: { where: { status: 'ACTIVE' }, select: { issuedAt: true } },
      },
    });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    return {
      id: s.id,
      matricule: s.matricule,
      lastName: s.lastName,
      middleName: s.middleName,
      firstName: s.firstName,
      email: s.email,
      phone: s.phone,
      status: s.status,
      enrolledAt: fromDbDate(s.enrolledAt),
      createdAt: s.createdAt,
      hasPhoto: Boolean(s.photoPath),
      faculty: { id: s.faculty.id, code: s.faculty.code, name: s.faculty.name },
      department: { id: s.department.id, code: s.department.code, name: s.department.name },
      promotion: { id: s.promotion.id, code: s.promotion.code, label: s.promotion.label },
      account: s.user,
      activeQrIssuedAt: s.credentials[0]?.issuedAt ?? null,
      internships: s.internships.map((i) => ({
        id: i.id,
        startDate: fromDbDate(i.startDate),
        endDate: fromDbDate(i.endDate),
        hostService: i.hostService,
        supervisor: i.supervisor,
      })),
    };
  }

  async create(dto: CreateStudentDto, actor: AuthUser, ip: string | null) {
    await this.assertAffiliation(dto.facultyId, dto.departmentId, dto.promotionId);
    if (dto.internship) this.assertInternshipDates(dto.internship);
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            matricule: dto.matricule,
            lastName: dto.lastName,
            middleName: dto.middleName,
            firstName: dto.firstName,
            facultyId: dto.facultyId,
            departmentId: dto.departmentId,
            promotionId: dto.promotionId,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            enrolledAt: toDbDate(dto.enrolledAt),
          },
        });
        if (dto.internship) await this.createInternshipTx(tx, student.id, dto.internship);
        await this.qr.issue(tx, student.id, actor.id);
        await this.audit.log(
          { actorId: actor.id, action: 'STUDENT_CREATED', entityType: 'Student', entityId: student.id, after: dto, ip },
          tx,
        );
        return student.id;
      });
      return this.get(id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ code: 'MATRICULE_TAKEN', message: 'Ce matricule est déjà enregistré' });
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateStudentDto, actor: AuthUser, ip: string | null) {
    const before = await this.prisma.student.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    await this.assertAffiliation(
      dto.facultyId ?? before.facultyId,
      dto.departmentId ?? before.departmentId,
      dto.promotionId ?? before.promotionId,
    );
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.student.update({
        where: { id },
        data: {
          lastName: dto.lastName,
          middleName: dto.middleName,
          firstName: dto.firstName,
          facultyId: dto.facultyId,
          departmentId: dto.departmentId,
          promotionId: dto.promotionId,
          email: dto.email,
          phone: dto.phone,
          enrolledAt: dto.enrolledAt ? toDbDate(dto.enrolledAt) : undefined,
        },
      });
      await this.audit.log({ actorId: actor.id, action: 'STUDENT_UPDATED', entityType: 'Student', entityId: id, before, after, ip }, tx);
    });
    return this.get(id);
  }

  /** Suspension, fin de stage ou réactivation. Une suspension prend effet au scan suivant. */
  async changeStatus(id: string, dto: ChangeStatusDto, actor: AuthUser, ip: string | null) {
    const before = await this.prisma.student.findUnique({ where: { id } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    if (before.status === dto.status) {
      throw new BadRequestException({ code: 'STATUS_UNCHANGED', message: "L'étudiant a déjà ce statut" });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: { status: dto.status } });
      await this.audit.log(
        {
          actorId: actor.id,
          action: 'STUDENT_STATUS_CHANGED',
          entityType: 'Student',
          entityId: id,
          before: { status: before.status },
          after: { status: dto.status, reason: dto.reason },
          ip,
        },
        tx,
      );
    });
    return this.get(id);
  }

  async setPhoto(id: string, buffer: Buffer, actor: AuthUser, ip: string | null) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    const path = await this.photos.save(id, buffer);
    await this.prisma.student.update({ where: { id }, data: { photoPath: path } });
    await this.audit.log({ actorId: actor.id, action: 'STUDENT_PHOTO_SET', entityType: 'Student', entityId: id, ip });
  }

  async removePhoto(id: string, actor: AuthUser, ip: string | null) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    if (student.photoPath) await this.photos.remove(student.photoPath);
    await this.prisma.student.update({ where: { id }, data: { photoPath: null } });
    await this.audit.log({ actorId: actor.id, action: 'STUDENT_PHOTO_REMOVED', entityType: 'Student', entityId: id, ip });
  }

  async photo(id: string) {
    const student = await this.prisma.student.findUnique({ where: { id }, select: { photoPath: true } });
    if (!student?.photoPath) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Aucune photo' });
    return this.photos.read(student.photoPath);
  }

  async addInternship(studentId: string, dto: InternshipDto, actor: AuthUser, ip: string | null) {
    const exists = await this.prisma.student.count({ where: { id: studentId } });
    if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    this.assertInternshipDates(dto);
    await this.prisma.$transaction(async (tx) => {
      const internship = await this.createInternshipTx(tx, studentId, dto);
      await this.audit.log(
        { actorId: actor.id, action: 'INTERNSHIP_CREATED', entityType: 'Internship', entityId: internship.id, after: dto, ip },
        tx,
      );
    });
    return this.get(studentId);
  }

  async updateInternship(studentId: string, internshipId: string, dto: InternshipDto, actor: AuthUser, ip: string | null) {
    const before = await this.prisma.internship.findFirst({ where: { id: internshipId, studentId } });
    if (!before) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage introuvable' });
    this.assertInternshipDates(dto);
    // Un stage commencé ne peut pas être « recommencé » plus tard : sinon il deviendrait supprimable
    // et ses jours déjà pointés sortiraient de toute période de stage.
    const today = this.today();
    if (fromDbDate(before.startDate) <= today && dto.startDate > today) {
      throw new BadRequestException({
        code: 'INTERNSHIP_STARTED',
        message: "Ce stage a déjà commencé : sa date de début ne peut pas être reportée après aujourd'hui.",
      });
    }
    await this.assertSupervisor(dto.supervisorId);
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.internship.update({
        where: { id: internshipId },
        data: {
          startDate: toDbDate(dto.startDate),
          endDate: toDbDate(dto.endDate),
          hostService: dto.hostService ?? null,
          supervisorId: dto.supervisorId ?? null,
        },
      });
      await this.audit.log(
        { actorId: actor.id, action: 'INTERNSHIP_UPDATED', entityType: 'Internship', entityId: internshipId, before, after, ip },
        tx,
      );
    });
    return this.get(studentId);
  }

  /** Seul un stage qui n'a pas encore commencé peut être supprimé : l'historique des présences reste cohérent. */
  async deleteInternship(studentId: string, internshipId: string, actor: AuthUser, ip: string | null) {
    const internship = await this.prisma.internship.findFirst({ where: { id: internshipId, studentId } });
    if (!internship) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Stage introuvable' });
    if (fromDbDate(internship.startDate) <= this.today()) {
      throw new BadRequestException({
        code: 'INTERNSHIP_STARTED',
        message: 'Un stage déjà commencé ne peut pas être supprimé ; modifiez sa date de fin.',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.internship.delete({ where: { id: internshipId } });
      await this.audit.log(
        { actorId: actor.id, action: 'INTERNSHIP_DELETED', entityType: 'Internship', entityId: internshipId, before: internship, ip },
        tx,
      );
    });
    return this.get(studentId);
  }

  private async createInternshipTx(tx: Prisma.TransactionClient, studentId: string, dto: InternshipDto) {
    await this.assertSupervisor(dto.supervisorId);
    return tx.internship.create({
      data: {
        studentId,
        startDate: toDbDate(dto.startDate),
        endDate: toDbDate(dto.endDate),
        hostService: dto.hostService ?? null,
        supervisorId: dto.supervisorId ?? null,
      },
    });
  }

  private assertInternshipDates(dto: InternshipDto): void {
    try {
      toDbDate(dto.startDate);
      toDbDate(dto.endDate);
    } catch {
      throw new BadRequestException({ code: 'INVALID_DATE', message: 'Date de stage invalide' });
    }
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({ code: 'INVALID_PERIOD', message: 'La fin du stage précède son début' });
    }
  }

  private async assertSupervisor(supervisorId: string | null | undefined): Promise<void> {
    if (!supervisorId) return;
    const ok = await this.prisma.user.count({ where: { id: supervisorId, isActive: true, role: { code: { in: ['SUPERVISOR', 'ADMIN'] } } } });
    if (!ok) throw new BadRequestException({ code: 'INVALID_SUPERVISOR', message: 'Responsable de stage introuvable ou inactif' });
  }

  private async assertAffiliation(facultyId: string, departmentId: string, promotionId: string): Promise<void> {
    const [department, promotion] = await Promise.all([
      this.prisma.department.findUnique({ where: { id: departmentId } }),
      this.prisma.promotion.count({ where: { id: promotionId } }),
    ]);
    if (!department || department.facultyId !== facultyId) {
      throw new BadRequestException({ code: 'INVALID_DEPARTMENT', message: "Ce département n'appartient pas à la faculté choisie" });
    }
    if (!promotion) throw new BadRequestException({ code: 'INVALID_PROMOTION', message: 'Promotion introuvable' });
  }
}

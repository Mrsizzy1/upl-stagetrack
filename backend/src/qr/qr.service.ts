import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth/auth.decorators';
import { Clock } from '../common/clock/clock';
import { drawLogo, renderPdf, SYSTEM_NAME, UNIVERSITY_NAME, UPL_BLUE, UPL_GOLD, UPL_INK } from '../common/pdf';
import {
  encodeQrPayload,
  generateToken,
  hashToken,
  openToken,
  parseQrPayload,
  sealToken,
} from '../domain/qr/qr-token';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoStorageService } from '../students/photo-storage.service';

const studentForScan = {
  id: true,
  matricule: true,
  lastName: true,
  middleName: true,
  firstName: true,
  status: true,
  photoPath: true,
  faculty: { select: { name: true, code: true } },
  department: { select: { name: true } },
  promotion: { select: { label: true } },
} satisfies Prisma.StudentSelect;

export type ScanStudent = Prisma.StudentGetPayload<{ select: typeof studentForScan }>;

export type QrResolution =
  | { kind: 'INVALID' }
  | { kind: 'REVOKED'; credentialId: string; student: ScanStudent }
  | { kind: 'ACTIVE'; credentialId: string; student: ScanStudent };

@Injectable()
export class QrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly clock: Clock,
    private readonly photos: PhotoStorageService,
  ) {}

  private get key(): Buffer {
    return this.config.getOrThrow<Buffer>('QR_TOKEN_ENCRYPTION_KEY');
  }

  /** Crée un QR actif pour un étudiant, dans la transaction de l'appelant. */
  async issue(tx: Prisma.TransactionClient, studentId: string, actorId: string): Promise<void> {
    const token = generateToken();
    await tx.qRCodeCredential.create({
      data: { studentId, tokenHash: hashToken(token), tokenSealed: sealToken(token, this.key), issuedById: actorId },
    });
  }

  /** Remplace le QR actif (l'ancien devient invalide immédiatement) ou en crée un s'il n'y en a pas. */
  async regenerate(studentId: string, reason: string, actor: AuthUser, ip: string | null): Promise<void> {
    await this.ensureStudent(studentId);
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const replaced = await tx.qRCodeCredential.updateMany({
        where: { studentId, status: 'ACTIVE' },
        data: { status: 'REPLACED', activeSlot: null, revokedAt: now, revokedById: actor.id, revokeReason: reason },
      });
      await this.issue(tx, studentId, actor.id);
      await this.audit.log(
        { actorId: actor.id, action: 'QR_REGENERATED', entityType: 'Student', entityId: studentId, after: { reason, replaced: replaced.count }, ip },
        tx,
      );
    });
  }

  async revoke(studentId: string, reason: string, actor: AuthUser, ip: string | null): Promise<void> {
    await this.ensureStudent(studentId);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.qRCodeCredential.updateMany({
        where: { studentId, status: 'ACTIVE' },
        data: { status: 'REVOKED', activeSlot: null, revokedAt: this.clock.now(), revokedById: actor.id, revokeReason: reason },
      });
      if (result.count === 0) throw new BadRequestException({ code: 'NO_ACTIVE_QR', message: "Cet étudiant n'a pas de QR Code actif" });
      await this.audit.log({ actorId: actor.id, action: 'QR_REVOKED', entityType: 'Student', entityId: studentId, after: { reason }, ip }, tx);
    });
  }

  async history(studentId: string) {
    return this.prisma.qRCodeCredential.findMany({
      where: { studentId },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        status: true,
        issuedAt: true,
        revokedAt: true,
        revokeReason: true,
        issuedBy: { select: { fullName: true } },
        revokedBy: { select: { fullName: true } },
      },
    });
  }

  async png(studentId: string): Promise<Buffer> {
    return QRCode.toBuffer(await this.activePayload(studentId), {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#0B2545', light: '#FFFFFF' },
    });
  }

  /** Carte imprimable au format carte bancaire (85,6 × 54 mm). */
  async card(studentId: string): Promise<Buffer> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: studentForScan });
    if (!student) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
    const qr = await QRCode.toBuffer(await this.activePayload(studentId), { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 300 });
    const photo = student.photoPath ? await this.photos.read(student.photoPath).catch(() => null) : null;
    const mm = (v: number) => (v * 72) / 25.4;

    return renderPdf({ size: [mm(85.6), mm(54)], margin: 0, info: { Title: `Carte StageTrack ${student.matricule}` } }, (doc) => {
      const w = mm(85.6);
      // En-tête : logo officiel sur fond blanc, nom de l'université, filets bleu et or.
      const logoWidth = drawLogo(doc, mm(3), mm(1.4), mm(8.6));
      const headX = mm(3) + logoWidth + mm(2);
      doc.fillColor(UPL_BLUE).font('Helvetica-Bold').fontSize(6.6)
        .text(UNIVERSITY_NAME.toUpperCase(), headX, mm(3), { width: w - headX - mm(3), lineBreak: false });
      doc.fillColor(UPL_INK).font('Helvetica').fontSize(5.8).text(`Carte de stagiaire · ${SYSTEM_NAME}`, headX, mm(6.4), { lineBreak: false });
      doc.rect(0, mm(11), w, mm(0.7)).fill(UPL_BLUE);
      doc.rect(0, mm(11.7), w, mm(0.5)).fill(UPL_GOLD);

      const top = mm(14.5);
      let textX = mm(4);
      if (photo) {
        doc.image(photo.buffer, mm(4), top, { fit: [mm(18), mm(23)], align: 'center' }); // haut par défaut dans pdfkit
        textX = mm(24);
      }
      const textWidth = mm(85.6 - 33) - textX;
      doc.fillColor(UPL_BLUE).font('Helvetica-Bold').fontSize(8)
        .text(`${student.lastName} ${student.middleName}`.toUpperCase(), textX, top, { width: textWidth });
      doc.font('Helvetica').fontSize(8).text(student.firstName, { width: textWidth });
      doc.moveDown(0.4).fontSize(6.5).fillColor('#333333')
        .text(`Matricule : ${student.matricule}`, { width: textWidth })
        .text(student.faculty.name, { width: textWidth })
        .text(`${student.department.name} · ${student.promotion.label}`, { width: textWidth });

      doc.image(qr, mm(85.6 - 31), mm(14), { width: mm(28) });
      doc.fontSize(5).fillColor('#666666').text('Présenter ce code à l’agent de pointage', mm(85.6 - 32), mm(43), { width: mm(30), align: 'center' });
    });
  }

  /** Identifie le QR scanné. Le texte vient de la caméra de l'agent : il n'est jamais considéré comme fiable. */
  async resolve(text: string): Promise<QrResolution> {
    const token = parseQrPayload(text);
    if (!token) return { kind: 'INVALID' };
    const credential = await this.prisma.qRCodeCredential.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, status: true, student: { select: studentForScan } },
    });
    if (!credential) return { kind: 'INVALID' };
    return credential.status === 'ACTIVE'
      ? { kind: 'ACTIVE', credentialId: credential.id, student: credential.student }
      : { kind: 'REVOKED', credentialId: credential.id, student: credential.student };
  }

  async findStudentByMatricule(matricule: string): Promise<ScanStudent | null> {
    return this.prisma.student.findUnique({ where: { matricule: matricule.trim().toUpperCase() }, select: studentForScan });
  }

  private async activePayload(studentId: string): Promise<string> {
    const credential = await this.prisma.qRCodeCredential.findFirst({ where: { studentId, status: 'ACTIVE' } });
    if (!credential) throw new NotFoundException({ code: 'NO_ACTIVE_QR', message: "Cet étudiant n'a pas de QR Code actif" });
    return encodeQrPayload(openToken(credential.tokenSealed, this.key));
  }

  private async ensureStudent(studentId: string): Promise<void> {
    const exists = await this.prisma.student.count({ where: { id: studentId } });
    if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Étudiant introuvable' });
  }
}

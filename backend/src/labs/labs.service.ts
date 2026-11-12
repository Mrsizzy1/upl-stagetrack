import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth/auth.decorators';
import {
  drawLogo,
  renderPdf,
  UNIVERSITY_NAME,
  UPL_BLUE,
  UPL_GOLD,
  UPL_INK,
} from '../common/pdf';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabDto, CreateRowDto, UpdateLabDto, UpdateRowDto } from './labs.dto';

@Injectable()
export class LabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const labs = await this.prisma.laboratory.findMany({
      orderBy: { code: 'asc' },
      include: {
        manager: { select: { id: true, fullName: true, username: true } },
        rows: {
          select: { id: true, code: true, name: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        machines: {
          select: { id: true, generalStatus: true },
        },
        _count: { select: { machines: true, rows: true } },
      },
    });

    return labs.map((lab) => {
      const stats = {
        total: lab.machines.length,
        functional: lab.machines.filter((m) => m.generalStatus === 'FUNCTIONAL').length,
        toCheck: lab.machines.filter((m) => m.generalStatus === 'TO_CHECK').length,
        defective: lab.machines.filter((m) => m.generalStatus === 'DEFECTIVE').length,
        maintenance: lab.machines.filter((m) => m.generalStatus === 'MAINTENANCE').length,
        outOfService: lab.machines.filter((m) => m.generalStatus === 'OUT_OF_SERVICE').length,
      };
      const { machines, ...rest } = lab;
      return { ...rest, stats };
    });
  }

  async get(id: string) {
    const lab = await this.prisma.laboratory.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, fullName: true, username: true } },
        rows: {
          orderBy: { sortOrder: 'asc' },
          include: {
            machines: {
              orderBy: { positionInRow: 'asc' },
              include: {
                components: {
                  include: { componentType: true },
                  orderBy: { componentType: { sortOrder: 'asc' } },
                },
                _count: { select: { interventions: { where: { status: { not: 'CLOSED' } } } } },
              },
            },
          },
        },
      },
    });

    if (!lab) {
      throw new NotFoundException({ code: 'LAB_NOT_FOUND', message: 'Laboratoire introuvable' });
    }

    const allMachines = lab.rows.flatMap((r) => r.machines);
    const stats = {
      total: allMachines.length,
      functional: allMachines.filter((m) => m.generalStatus === 'FUNCTIONAL').length,
      toCheck: allMachines.filter((m) => m.generalStatus === 'TO_CHECK').length,
      defective: allMachines.filter((m) => m.generalStatus === 'DEFECTIVE').length,
      maintenance: allMachines.filter((m) => m.generalStatus === 'MAINTENANCE').length,
      outOfService: allMachines.filter((m) => m.generalStatus === 'OUT_OF_SERVICE').length,
    };

    return { ...lab, stats };
  }

  async create(dto: CreateLabDto, actor: AuthUser, ip?: string | null) {
    const existing = await this.prisma.laboratory.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException({ code: 'CODE_EXISTS', message: 'Un laboratoire avec ce code existe déjà' });
    }

    const lab = await this.prisma.laboratory.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        building: dto.building.trim(),
        location: dto.location.trim(),
        description: dto.description?.trim(),
        managerId: dto.managerId,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'LAB_CREATED',
      entityType: 'Laboratory',
      entityId: lab.id,
      after: { code: lab.code, name: lab.name },
      ip: ip ?? null,
    });

    return this.get(lab.id);
  }

  async update(id: string, dto: UpdateLabDto, actor: AuthUser, ip?: string | null) {
    await this.prisma.laboratory.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.laboratory.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.building ? { building: dto.building.trim() } : {}),
        ...(dto.location ? { location: dto.location.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.managerId !== undefined ? { managerId: dto.managerId } : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'LAB_UPDATED',
      entityType: 'Laboratory',
      entityId: id,
      after: dto,
      ip: ip ?? null,
    });

    return updated;
  }

  async addRow(labId: string, dto: CreateRowDto) {
    await this.prisma.laboratory.findUniqueOrThrow({ where: { id: labId } });

    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.laboratoryRow.findUnique({
      where: { laboratoryId_code: { laboratoryId: labId, code } },
    });
    if (existing) {
      throw new ConflictException({ code: 'ROW_CODE_EXISTS', message: 'Cette rangée existe déjà dans ce laboratoire' });
    }

    const maxSort = await this.prisma.laboratoryRow.findFirst({
      where: { laboratoryId: labId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.laboratoryRow.create({
      data: {
        laboratoryId: labId,
        code,
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? (maxSort?.sortOrder ? maxSort.sortOrder + 1 : 1),
      },
    });
  }

  async updateRow(rowId: string, dto: UpdateRowDto) {
    return this.prisma.laboratoryRow.update({
      where: { id: rowId },
      data: {
        ...(dto.code ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deleteRow(rowId: string) {
    const row = await this.prisma.laboratoryRow.findUniqueOrThrow({
      where: { id: rowId },
      include: { _count: { select: { machines: true } } },
    });

    if (row._count.machines > 0) {
      throw new BadRequestException({
        code: 'ROW_NOT_EMPTY',
        message: 'Impossible de supprimer une rangée contenant encore des machines',
      });
    }

    return this.prisma.laboratoryRow.delete({ where: { id: rowId } });
  }

  /**
   * Génération de planches d'étiquettes QR Codes permanents au format PDF A4.
   * Grille de 2 colonnes × 4 étiquettes par page, prêtes à l'impression.
   */
  async generateStickersPdf(labId: string): Promise<Buffer> {
    const lab = await this.prisma.laboratory.findUniqueOrThrow({
      where: { id: labId },
      include: {
        rows: {
          orderBy: { sortOrder: 'asc' },
          include: {
            machines: {
              orderBy: { positionInRow: 'asc' },
            },
          },
        },
      },
    });

    const machines = lab.rows.flatMap((r) =>
      r.machines.map((m) => ({ ...m, rowName: r.name, rowCode: r.code })),
    );

    if (machines.length === 0) {
      throw new BadRequestException({ code: 'NO_MACHINES', message: 'Aucune machine dans ce laboratoire' });
    }

    // Pré-génération des images QR codes en mémoire (PNG buffers avec URL absolue)
    const qrBuffers = new Map<string, Buffer>();
    const baseUrl =
      process.env.APP_BASE_URL ??
      (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',')[0].trim() : 'http://localhost:5173');

    for (const m of machines) {
      const publicUrl = `${baseUrl}/m/${m.publicToken}`;
      const pngBuf = await QRCode.toBuffer(publicUrl, {
        width: 300,
        margin: 1,
        color: { dark: UPL_INK, light: '#FFFFFF' },
      });
      qrBuffers.set(m.id, pngBuf);
    }

    return renderPdf({ size: 'A4', margin: 20 }, (doc) => {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 20;

      const cols = 2;
      const rows = 4;
      const cardWidth = (pageWidth - margin * 2 - 15) / cols;
      const cardHeight = (pageHeight - margin * 2 - 25) / rows;

      machines.forEach((m, idx) => {
        if (idx > 0 && idx % (cols * rows) === 0) {
          doc.addPage();
        }

        const pageIndex = idx % (cols * rows);
        const col = pageIndex % cols;
        const row = Math.floor(pageIndex / cols);

        const x = margin + col * (cardWidth + 15);
        const y = margin + row * (cardHeight + 8);

        // Boîte de l'étiquette avec bordure soignée
        doc.roundedRect(x, y, cardWidth, cardHeight, 6).lineWidth(1).strokeColor('#CBD5E1').stroke();

        // En-tête bandeau bleu officiel UPL
        const headerHeight = 22;
        doc.roundedRect(x, y, cardWidth, headerHeight, 5).fillColor(UPL_BLUE).fill();
        drawLogo(doc, x + 6, y + 3, 16);

        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#FFFFFF')
          .text('UNIVERSITÉ PROTESTANTE DE LUBUMBASHI', x + 26, y + 4, { width: cardWidth - 30, ellipsis: true });
        doc
          .font('Helvetica-Bold')
          .fontSize(6)
          .fillColor(UPL_GOLD)
          .text('PARC INFORMATIQUE • POSTE DE TRAVAIL', x + 26, y + 13, { width: cardWidth - 30, ellipsis: true });

        // QR Code bien dimensionné à gauche (carré 100 pt, aéré)
        const qrBuf = qrBuffers.get(m.id);
        const qrSize = 98;
        const qrX = x + 8;
        const qrY = y + headerHeight + (cardHeight - headerHeight - 16 - qrSize) / 2;
        if (qrBuf) {
          doc.image(qrBuf, qrX, qrY, { width: qrSize, height: qrSize });
        }

        // Zone d'information droite (largeur élargie à 140 pt pour éviter tout retour à la ligne)
        const textX = qrX + qrSize + 12;
        const textWidth = cardWidth - (qrSize + 28);
        const contentStartY = y + headerHeight + 12;

        // Label d'inventaire discret
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#64748B')
          .text('CODE DU POSTE', textX, contentStartY);

        // Code machine en très grand et net
        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#0A1A6B')
          .text(m.code, textX, contentStartY + 10, { width: textWidth, ellipsis: true });

        // Salle et rangée sur deux lignes distinctes bien espacées (aucun chevauchement possible)
        doc
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .fillColor('#1E293B')
          .text(lab.name, textX, contentStartY + 32, { width: textWidth, ellipsis: true });

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#64748B')
          .text(`${m.rowName} • Poste N°${m.positionInRow}`, textX, contentStartY + 45, { width: textWidth, ellipsis: true });

        // Bouton / Pill d'action clair et concis
        doc.roundedRect(textX, contentStartY + 64, textWidth, 18, 4).fillColor('#F1F5F9').strokeColor('#E2E8F0').lineWidth(0.8).fillAndStroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#0F172A')
          .text('Scannez pour signaler', textX, contentStartY + 70, { width: textWidth, align: 'center' });

        // Pied de sticker sobre
        doc
          .font('Helvetica')
          .fontSize(5.5)
          .fillColor('#94A3B8')
          .text('UPL • Faculté des Sciences Informatiques', x, y + cardHeight - 10, {
            width: cardWidth,
            align: 'center',
          });
      });
    });
  }
}

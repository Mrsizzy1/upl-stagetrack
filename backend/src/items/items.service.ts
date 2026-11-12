import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ItemStatus, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { ItemStorageService } from './item-storage.service';
import {
  ClaimItemDto,
  ConfirmReturnDto,
  DeclareItemDto,
  ListPublicItemsQueryDto,
  ReviewClaimDto,
  UpdateItemStatusDto,
} from './items.dto';

@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ItemStorageService,
    private readonly audit: AuditService,
  ) {}

  /** Consultation publique : objets publiés uniquement, données de contact masquées. */
  async listPublic(query: ListPublicItemsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const where: Prisma.ItemDeclarationWhereInput = {
      status: ItemStatus.PUBLISHED,
      ...(query.type ? { type: query.type } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}),
      ...(query.from || query.to
        ? {
            eventDate: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59Z`) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { location: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.itemDeclaration.count({ where }),
      this.prisma.itemDeclaration.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          category: true,
          description: true,
          photoPath: true,
          eventDate: true,
          location: true,
          status: true,
          createdAt: true,
        },
        orderBy: { eventDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }

  /** Fiche publique d'un objet (données de contact exclues). */
  async getPublicItem(id: string) {
    const item = await this.prisma.itemDeclaration.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        title: true,
        category: true,
        description: true,
        photoPath: true,
        eventDate: true,
        location: true,
        status: true,
        createdAt: true,
      },
    });
    if (!item || (item.status !== ItemStatus.PUBLISHED && item.status !== ItemStatus.CLAIM_REQUESTED)) {
      throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Objet introuvable ou non publié' });
    }
    return item;
  }

  /** Déclaration publique d'un objet perdu ou retrouvé. */
  async declarePublic(dto: DeclareItemDto, photoBuffer?: Buffer, user?: AuthUser) {
    let photoPath: string | undefined = undefined;
    if (photoBuffer) {
      photoPath = await this.storage.save(photoBuffer);
    }

    const item = await this.prisma.itemDeclaration.create({
      data: {
        type: dto.type,
        title: dto.title.trim(),
        category: dto.category,
        description: dto.description.trim(),
        photoPath: photoPath ?? dto.photoPath,
        eventDate: new Date(`${dto.eventDate}T00:00:00Z`),
        location: dto.location.trim(),
        contactName: dto.contactName?.trim(),
        contactPhone: dto.contactPhone?.trim(),
        contactEmail: dto.contactEmail?.trim(),
        status: ItemStatus.PENDING,
        createdById: user?.id,
      },
    });

    return {
      id: item.id,
      title: item.title,
      type: item.type,
      status: item.status,
      message: 'Votre déclaration a bien été enregistrée et sera examinée par l’administration avant publication.',
    };
  }

  /** Dépôt public d'une demande de récupération d'un objet. */
  async claimPublic(declarationId: string, dto: ClaimItemDto, proofBuffer?: Buffer) {
    const declaration = await this.prisma.itemDeclaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration || (declaration.status !== ItemStatus.PUBLISHED && declaration.status !== ItemStatus.CLAIM_REQUESTED)) {
      throw new BadRequestException({
        code: 'INVALID_CLAIM',
        message: 'Cet objet ne peut pas faire l’objet d’une réclamation dans son état actuel',
      });
    }

    let proofPhotoPath: string | undefined = undefined;
    if (proofBuffer) {
      proofPhotoPath = await this.storage.save(proofBuffer);
    }

    const claim = await this.prisma.$transaction(async (tx) => {
      const c = await tx.itemClaim.create({
        data: {
          declarationId,
          claimantName: dto.claimantName.trim(),
          claimantPhone: dto.claimantPhone.trim(),
          claimantEmail: dto.claimantEmail?.trim(),
          proofDescription: dto.proofDescription.trim(),
          proofPhotoPath,
        },
      });

      if (declaration.status === ItemStatus.PUBLISHED) {
        await tx.itemDeclaration.update({
          where: { id: declarationId },
          data: { status: ItemStatus.CLAIM_REQUESTED },
        });
      }

      return c;
    });

    return {
      claimId: claim.id,
      message: 'Votre demande de récupération a été transmise au service administratif.',
    };
  }

  /** Espace Administration : liste complète des déclarations avec filtres de gestion. */
  async listAdmin(params: {
    status?: ItemStatus;
    type?: string;
    category?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where: Prisma.ItemDeclarationWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.type ? { type: params.type as any } : {}),
      ...(params.category ? { category: params.category as any } : {}),
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' } },
              { description: { contains: params.q, mode: 'insensitive' } },
              { contactName: { contains: params.q, mode: 'insensitive' } },
              { contactPhone: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.itemDeclaration.count({ where }),
      this.prisma.itemDeclaration.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true, username: true } },
          approvedBy: { select: { id: true, fullName: true } },
          _count: { select: { claims: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }

  /** Modération d'une déclaration par un administrateur. */
  async updateStatus(id: string, dto: UpdateItemStatusDto, actor: AuthUser, ip?: string | null) {
    const current = await this.prisma.itemDeclaration.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.itemDeclaration.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: dto.rejectionReason,
        ...(dto.status === ItemStatus.PUBLISHED || dto.status === ItemStatus.APPROVED
          ? { approvedById: actor.id }
          : {}),
      },
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'ITEM_STATUS_UPDATED',
      entityType: 'ItemDeclaration',
      entityId: id,
      before: { status: current.status },
      after: { status: updated.status, reason: dto.rejectionReason },
      ip: ip ?? null,
    });

    return updated;
  }

  /** Liste des réclamations déposées pour un objet. */
  async listClaims(declarationId: string) {
    return this.prisma.itemClaim.findMany({
      where: { declarationId },
      include: {
        reviewedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Examen et validation/rejet d'une réclamation. */
  async reviewClaim(claimId: string, dto: ReviewClaimDto, actor: AuthUser, ip?: string | null) {
    const claim = await this.prisma.itemClaim.findUniqueOrThrow({
      where: { id: claimId },
      include: { declaration: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const reviewed = await tx.itemClaim.update({
        where: { id: claimId },
        data: {
          status: dto.status,
          reviewNotes: dto.reviewNotes,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });

      if (dto.status === 'APPROVED') {
        await tx.itemDeclaration.update({
          where: { id: claim.declarationId },
          data: { status: ItemStatus.APPROVED },
        });
      }

      return reviewed;
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'ITEM_CLAIM_REVIEWED',
      entityType: 'ItemClaim',
      entityId: claimId,
      before: { status: claim.status },
      after: { status: updated.status, notes: dto.reviewNotes },
      ip: ip ?? null,
    });

    return updated;
  }

  /** Confirmation certifiée de restitution d'un objet. */
  async confirmReturn(declarationId: string, dto: ConfirmReturnDto, actor: AuthUser, ip?: string | null) {
    const item = await this.prisma.itemDeclaration.findUniqueOrThrow({
      where: { id: declarationId },
    });

    if (item.status === ItemStatus.RETURNED || item.status === ItemStatus.CLOSED) {
      throw new BadRequestException({ code: 'ALREADY_RETURNED', message: 'Cet objet a déjà été restitué ou clôturé' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const itemReturn = await tx.itemReturn.create({
        data: {
          declarationId,
          claimId: dto.claimId,
          returnedToName: dto.returnedToName.trim(),
          returnedToIdNumber: dto.returnedToIdNumber?.trim(),
          confirmedById: actor.id,
          notes: dto.notes,
        },
      });

      const updated = await tx.itemDeclaration.update({
        where: { id: declarationId },
        data: { status: ItemStatus.RETURNED },
      });

      return { itemReturn, updated };
    });

    await this.audit.log({
      actorId: actor.id,
      action: 'ITEM_RETURN_CONFIRMED',
      entityType: 'ItemDeclaration',
      entityId: declarationId,
      after: {
        returnedTo: dto.returnedToName,
        confirmedBy: actor.fullName,
      },
      ip: ip ?? null,
    });

    return result;
  }

  /** Lecture sécurisée d'une photo d'objet. */
  async getPhoto(filename: string) {
    return this.storage.read(filename);
  }
}

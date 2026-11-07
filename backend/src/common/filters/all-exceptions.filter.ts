/**
 * Format d'erreur unique de l'API :
 *   { statusCode, code, message, details? }
 * `code` est stable et lisible par le frontend ; aucune trace technique n'est renvoyée au client.
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'TOO_MANY_REQUESTS',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erreurs');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const body = this.toBody(exception);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        // Erreurs de ValidationPipe : `message` est une liste.
        if (Array.isArray(p.message)) {
          return { statusCode: status, code: 'VALIDATION_ERROR', message: 'Données invalides', details: p.message };
        }
        return {
          statusCode: status,
          code: typeof p.code === 'string' ? p.code : (STATUS_CODES[status] ?? 'ERROR'),
          message: typeof p.message === 'string' ? p.message : exception.message,
          ...(p.details !== undefined ? { details: p.details } : {}),
        };
      }
      return { statusCode: status, code: STATUS_CODES[status] ?? 'ERROR', message: String(payload) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return { statusCode: HttpStatus.CONFLICT, code: 'CONFLICT', message: 'Cette valeur existe déjà' };
      }
      if (exception.code === 'P2025') {
        return { statusCode: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Élément introuvable' };
      }
      if (exception.code === 'P2003') {
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'IN_USE',
          message: 'Suppression impossible : cet élément est utilisé ailleurs',
        };
      }
    }

    // Contraintes PostgreSQL écrites hors de Prisma (CHECK, exclusion) : message lisible.
    const text = exception instanceof Error ? exception.message : '';
    if (text.includes('Internship_no_overlap')) {
      return { statusCode: HttpStatus.CONFLICT, code: 'INTERNSHIP_OVERLAP', message: 'Ce stage chevauche un autre stage de cet étudiant' };
    }
    if (text.includes('violates check constraint')) {
      return { statusCode: HttpStatus.BAD_REQUEST, code: 'CONSTRAINT_VIOLATION', message: 'Données refusées par une règle de la base' };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur' };
  }
}

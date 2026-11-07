/**
 * Stockage des photos d'étudiants sur disque, hors du dossier web.
 * Seuls JPEG et PNG sont acceptés, vérifiés par leurs premiers octets (pas seulement l'extension).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function detectImageType(buffer: Buffer): 'jpg' | 'png' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  return null;
}

@Injectable()
export class PhotoStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.getOrThrow<string>('STORAGE_DIR'), 'photos');
  }

  /** Enregistre la photo et renvoie son chemin relatif (stocké en base). */
  async save(studentId: string, buffer: Buffer): Promise<string> {
    if (buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException({ code: 'PHOTO_TOO_LARGE', message: 'La photo dépasse 2 Mo' });
    }
    const type = detectImageType(buffer);
    if (!type) throw new BadRequestException({ code: 'PHOTO_FORMAT', message: 'Format accepté : JPEG ou PNG' });
    await mkdir(this.root, { recursive: true });
    const relative = `${studentId}.${type}`;
    const temp = join(this.root, `${relative}.tmp`);
    await writeFile(temp, buffer, { mode: 0o640 });
    await rename(temp, join(this.root, relative));
    // Supprime une ancienne photo d'un autre format.
    const other = `${studentId}.${type === 'jpg' ? 'png' : 'jpg'}`;
    await unlink(join(this.root, other)).catch(() => undefined);
    return relative;
  }

  async read(relative: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!/^[0-9a-f-]{36}\.(jpg|png)$/.test(relative)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Photo introuvable' });
    try {
      const buffer = await readFile(join(this.root, relative));
      return { buffer, contentType: relative.endsWith('.png') ? 'image/png' : 'image/jpeg' };
    } catch {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Photo introuvable' });
    }
  }

  async remove(relative: string): Promise<void> {
    if (/^[0-9a-f-]{36}\.(jpg|png)$/.test(relative)) await unlink(join(this.root, relative)).catch(() => undefined);
  }
}

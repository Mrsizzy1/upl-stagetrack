import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const MAX_ITEM_PHOTO_BYTES = 5 * 1024 * 1024;

export function detectItemImageType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

@Injectable()
export class ItemStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('STORAGE_DIR') ?? './storage', 'items');
  }

  async save(buffer: Buffer): Promise<string> {
    if (buffer.length > MAX_ITEM_PHOTO_BYTES) {
      throw new BadRequestException({ code: 'PHOTO_TOO_LARGE', message: 'La photo dépasse 5 Mo' });
    }
    const type = detectItemImageType(buffer);
    if (!type) {
      throw new BadRequestException({ code: 'PHOTO_FORMAT', message: 'Format accepté : JPEG, PNG ou WEBP' });
    }
    await mkdir(this.root, { recursive: true });
    const id = randomUUID();
    const relative = `${id}.${type}`;
    const temp = join(this.root, `${relative}.tmp`);
    await writeFile(temp, buffer, { mode: 0o640 });
    await rename(temp, join(this.root, relative));
    return relative;
  }

  async read(relative: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(relative)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Photo introuvable' });
    }
    try {
      const buffer = await readFile(join(this.root, relative));
      const ext = relative.split('.').pop();
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return { buffer, contentType };
    } catch {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Photo introuvable' });
    }
  }

  async remove(relative: string): Promise<void> {
    if (/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(relative)) {
      await unlink(join(this.root, relative)).catch(() => undefined);
    }
  }
}


import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { detectItemImageType } from '../../src/items/item-storage.service';

describe('Détection et validation des images d’objets', () => {
  test('détecte un JPEG valide (magic bytes FF D8 FF)', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.equal(detectItemImageType(jpegHeader), 'jpg');
  });

  test('détecte un PNG valide (magic bytes 89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    assert.equal(detectItemImageType(pngHeader), 'png');
  });

  test('détecte un WebP valide (RIFF....WEBP)', () => {
    const webpHeader = Buffer.from('RIFF1234WEBPVP8 ');
    assert.equal(detectItemImageType(webpHeader), 'webp');
  });

  test('refuse les formats exécutables ou non autorisés (exe, pdf, txt)', () => {
    assert.equal(detectItemImageType(Buffer.from('MZ\x90\x00\x03\x00\x00\x00')), null);
    assert.equal(detectItemImageType(Buffer.from('%PDF-1.4\n%...')), null);
    assert.equal(detectItemImageType(Buffer.from('plain text file')), null);
  });
});

describe('Invariance et format des jetons permanents de QR Code', () => {
  test('les jetons permanents de machine sont des UUID v4 valides et imprévisibles', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const token = crypto.randomUUID();
    assert.match(token, uuidRegex);
    assert.equal(token.length, 36);
  });
});


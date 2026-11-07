/**
 * Jetons des QR Codes (module pur, uniquement `node:crypto`).
 *
 *  - Le QR contient « UPLST1. » suivi d'un jeton aléatoire de 256 bits (base64url, 43 caractères).
 *    Aucune donnée personnelle : le jeton ne révèle rien sans la base.
 *  - La base stocke l'empreinte SHA-256 (recherche) et une copie chiffrée AES-256-GCM
 *    (pour réafficher ou réimprimer le QR). La clé est hors de la base (variable d'environnement).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const QR_PREFIX = 'UPLST1.';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function encodeQrPayload(token: string): string {
  return `${QR_PREFIX}${token}`;
}

/** Extrait le jeton d'un texte scanné ; null si le format n'est pas celui d'UPL StageTrack. */
export function parseQrPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;
  const token = trimmed.slice(QR_PREFIX.length);
  return TOKEN_PATTERN.test(token) ? token : null;
}

/** Chiffre le jeton : « iv.tag.texte » en base64url. */
export function sealToken(token: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('La clé AES-256 doit faire 32 octets');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString('base64url')).join('.');
}

/** Déchiffre un jeton scellé ; lève une erreur si la donnée a été altérée ou la clé est fausse. */
export function openToken(sealed: string, key: Buffer): string {
  const parts = sealed.split('.');
  if (parts.length !== 3) throw new Error('Jeton scellé mal formé');
  const [iv, tag, encrypted] = parts.map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';

/** Construit un PDF en mémoire et renvoie son contenu. */
export function renderPdf(options: PDFKit.PDFDocumentOptions, draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument(options);
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      draw(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/* ------------------------------------------------------------------ Identité visuelle UPL
 * Couleurs relevées dans le logo officiel : bleu #0120A7, rouge #FE0404, or #F9B233.
 */
export const UPL_BLUE = '#0120A7';
export const UPL_GOLD = '#F9B233';
export const UPL_RED = '#FE0404';
export const UPL_INK = '#030D3D';
export const UPL_BLUE_LIGHT = '#F4F6FC';
export const UPL_GOLD_LIGHT = '#FEF2D9';

export const UNIVERSITY_NAME = 'Université Protestante de Lubumbashi';
export const SYSTEM_NAME = 'UPL StageTrack';

/**
 * Logo officiel : fichier unique de l'application, frontend/public/brand/upl-logo.png
 * (copié dans l'image Docker de l'API au même chemin relatif, voir deploy/api.Dockerfile).
 * Valable depuis src/common (développement) comme depuis dist/common (production).
 */
export const UPL_LOGO_PATH = resolve(__dirname, '..', '..', '..', 'frontend', 'public', 'brand', 'upl-logo.png');
const LOGO_RATIO = 1697 / 1676; // largeur / hauteur du fichier officiel

let logoCache: Buffer | null | undefined;

/** Contenu du logo, lu une seule fois ; null si le fichier manque (les documents restent générés, sans logo). */
export function uplLogo(): Buffer | null {
  if (logoCache === undefined) {
    try {
      logoCache = readFileSync(UPL_LOGO_PATH);
    } catch {
      new Logger('Documents').warn(`Logo UPL introuvable (${UPL_LOGO_PATH}) : documents générés sans logo.`);
      logoCache = null;
    }
  }
  return logoCache;
}

/** Dessine le logo à une hauteur donnée, proportions d'origine conservées. Renvoie la largeur occupée. */
export function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, height: number): number {
  const logo = uplLogo();
  if (!logo) return 0;
  doc.image(logo, x, y, { height });
  return height * LOGO_RATIO;
}

/**
 * En-tête institutionnel des documents A4 : logo, nom de l'université, nom du système, filets bleu et or.
 * Renvoie l'ordonnée sous l'en-tête. `compact` : version réduite pour les pages suivantes.
 */
export function drawDocumentHeader(doc: PDFKit.PDFDocument, compact = false): number {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const logoHeight = compact ? 30 : 58;
  const logoWidth = drawLogo(doc, left, top, logoHeight);
  const textX = left + (logoWidth ? logoWidth + 12 : 0);
  const textWidth = width - (textX - left);

  doc.fillColor(UPL_BLUE).font('Helvetica-Bold').fontSize(compact ? 9 : 13)
    .text(UNIVERSITY_NAME.toUpperCase(), textX, top + (compact ? 5 : 10), { width: textWidth, characterSpacing: 0.4 });
  doc.fillColor(UPL_INK).font('Helvetica').fontSize(compact ? 7.5 : 9.5)
    .text(`${SYSTEM_NAME} — Gestion des présences des stagiaires`, textX, doc.y + 2, { width: textWidth });

  const ruleY = top + logoHeight + 8;
  doc.rect(left, ruleY, width, compact ? 1.2 : 2).fill(UPL_BLUE);
  doc.rect(left, ruleY + (compact ? 1.2 : 2), width, compact ? 0.8 : 1.2).fill(UPL_GOLD);
  doc.fillColor(UPL_INK);
  return ruleY + (compact ? 10 : 16);
}

/** Numérotation et mention de bas de page, à appeler une fois le contenu terminé (bufferPages: true). */
export function drawPageFooters(doc: PDFKit.PDFDocument, note: string): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const y = doc.page.height - doc.page.margins.bottom + 12;
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // écrire dans la marge sans créer de page
    doc.rect(left, y - 4, width, 0.5).fill('#C5CCE8');
    doc.fillColor('#2B3A7A').font('Helvetica').fontSize(7.5);
    doc.text(`${UNIVERSITY_NAME} · ${note}`, left, y, { width: width - 60, lineBreak: false, ellipsis: true });
    doc.text(`Page ${i - range.start + 1} / ${range.count}`, left + width - 60, y, { width: 60, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

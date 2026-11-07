/**
 * Lecture et contrôle des lignes d'un import d'étudiants (module pur).
 * Le fichier (CSV ou Excel) est d'abord converti en objets { entête: valeur } par le service ;
 * ce module normalise les entêtes, contrôle chaque ligne et produit un rapport ligne par ligne.
 *
 * Colonnes reconnues (entêtes insensibles à la casse et aux accents) :
 *   matricule*, nom*, postnom*, prenom*, faculte*, departement*, promotion*,
 *   email, telephone, date_inscription*, debut_stage, fin_stage, service_accueil
 * faculte / departement / promotion contiennent les CODES du référentiel.
 */

export const REQUIRED_COLUMNS = [
  'matricule',
  'nom',
  'postnom',
  'prenom',
  'faculte',
  'departement',
  'promotion',
  'date_inscription',
] as const;

const ALIASES: Record<string, string> = {
  prenoms: 'prenom',
  post_nom: 'postnom',
  faculty: 'faculte',
  departement_code: 'departement',
  department: 'departement',
  e_mail: 'email',
  courriel: 'email',
  tel: 'telephone',
  telephone_mobile: 'telephone',
  date_d_inscription: 'date_inscription',
  inscription: 'date_inscription',
  debut_du_stage: 'debut_stage',
  fin_du_stage: 'fin_stage',
  service: 'service_accueil',
};

export function normalizeHeader(header: string): string {
  const base = header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ALIASES[base] ?? base;
}

/** Colonnes obligatoires absentes des entêtes du fichier. */
export function missingColumns(headers: string[]): string[] {
  const present = new Set(headers.map(normalizeHeader));
  return REQUIRED_COLUMNS.filter((c) => !present.has(c));
}

/** Date au format AAAA-MM-JJ, JJ/MM/AAAA ou objet Date (Excel). null si vide, 'invalid' sinon. */
export function parseFlexibleDate(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'invalid';
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (text === '') return null;
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!match) return 'invalid';
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return 'invalid';
  return date.toISOString().slice(0, 10);
}

export interface ImportLookups {
  /** code faculté (majuscules) → id */
  faculties: Map<string, string>;
  /** « CODEFAC|CODEDEP » (majuscules) → id */
  departments: Map<string, string>;
  /** code promotion (majuscules) → id */
  promotions: Map<string, string>;
  /** matricules déjà en base (majuscules) */
  existingMatricules: Set<string>;
}

export interface ParsedStudentRow {
  line: number;
  matricule: string;
  lastName: string;
  middleName: string;
  firstName: string;
  facultyId: string;
  departmentId: string;
  promotionId: string;
  email: string | null;
  phone: string | null;
  enrolledAt: string;
  internship: { startDate: string; endDate: string; hostService: string | null } | null;
}

export interface ImportError {
  line: number;
  column: string;
  message: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ]{6,20}$/;

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

export function validateImportRows(
  rawRows: Record<string, unknown>[],
  lookups: ImportLookups,
): { rows: ParsedStudentRow[]; errors: ImportError[] } {
  const rows: ParsedStudentRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Map<string, number>();

  rawRows.forEach((raw, index) => {
    const line = index + 2; // ligne 1 = entêtes
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) r[normalizeHeader(k)] = v;

    // Ligne entièrement vide : ignorée.
    if (Object.values(r).every((v) => text(v) === '')) return;

    const lineErrors: ImportError[] = [];
    const err = (column: string, message: string) => lineErrors.push({ line, column, message });

    const matricule = text(r.matricule).toUpperCase();
    if (!matricule) err('matricule', 'Matricule manquant');
    else if (matricule.length > 30) err('matricule', 'Matricule trop long (30 caractères maximum)');
    else if (lookups.existingMatricules.has(matricule)) err('matricule', 'Étudiant déjà inscrit');
    else if (seen.has(matricule)) err('matricule', `Matricule en double (déjà ligne ${seen.get(matricule)})`);
    if (matricule) seen.set(matricule, seen.get(matricule) ?? line);

    const lastName = text(r.nom);
    const middleName = text(r.postnom);
    const firstName = text(r.prenom);
    if (!lastName) err('nom', 'Nom manquant');
    if (!middleName) err('postnom', 'Postnom manquant');
    if (!firstName) err('prenom', 'Prénom manquant');

    const facCode = text(r.faculte).toUpperCase();
    const depCode = text(r.departement).toUpperCase();
    const promoCode = text(r.promotion).toUpperCase();
    const facultyId = lookups.faculties.get(facCode);
    const departmentId = lookups.departments.get(`${facCode}|${depCode}`);
    const promotionId = lookups.promotions.get(promoCode);
    if (!facultyId) err('faculte', `Faculté inconnue : « ${facCode} »`);
    else if (!departmentId) err('departement', `Département « ${depCode} » inconnu dans la faculté ${facCode}`);
    if (!promotionId) err('promotion', `Promotion inconnue : « ${promoCode} »`);

    const email = text(r.email) || null;
    if (email && !EMAIL.test(email)) err('email', 'Adresse e-mail invalide');
    const phone = text(r.telephone) || null;
    if (phone && !PHONE.test(phone)) err('telephone', 'Numéro de téléphone invalide');

    const enrolledAt = parseFlexibleDate(r.date_inscription);
    if (enrolledAt === null) err('date_inscription', "Date d'inscription manquante");
    else if (enrolledAt === 'invalid') err('date_inscription', 'Date invalide (JJ/MM/AAAA ou AAAA-MM-JJ)');

    const start = parseFlexibleDate(r.debut_stage);
    const end = parseFlexibleDate(r.fin_stage);
    let internship: ParsedStudentRow['internship'] = null;
    if (start === 'invalid') err('debut_stage', 'Date invalide');
    if (end === 'invalid') err('fin_stage', 'Date invalide');
    if ((start === null) !== (end === null)) {
      err(start === null ? 'debut_stage' : 'fin_stage', 'Les dates de début et de fin de stage vont ensemble');
    } else if (start && end && start !== 'invalid' && end !== 'invalid') {
      if (end < start) err('fin_stage', 'La fin du stage précède son début');
      else internship = { startDate: start, endDate: end, hostService: text(r.service_accueil) || null };
    }

    if (lineErrors.length > 0) {
      errors.push(...lineErrors);
      return;
    }
    rows.push({
      line,
      matricule,
      lastName,
      middleName,
      firstName,
      facultyId: facultyId!,
      departmentId: departmentId!,
      promotionId: promotionId!,
      email,
      phone,
      enrolledAt: enrolledAt as string,
      internship,
    });
  });

  return { rows, errors };
}

/** Séparateur le plus fréquent de la première ligne (hors guillemets) parmi « ; », « , » et tabulation. */
export function detectCsvDelimiter(buffer: Buffer): string {
  const firstLine = buffer.toString('utf8', 0, Math.min(buffer.length, 4096)).split(/\r?\n/)[0] ?? '';
  const unquoted = firstLine.replace(/"[^"]*"/g, '');
  const candidates = [';', ',', '\t'];
  const counts = candidates.map((d) => unquoted.split(d).length - 1);
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] > 0 ? candidates[best] : ';';
}

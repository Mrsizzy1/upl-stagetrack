/** Règles pures de mise à jour des paramètres de l'institution (sans base ni framework). */

export interface SettingsUpdateInput {
  institutionName?: string | null;
  facultyName?: string | null;
  acronym?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  portalSubtitle?: string | null;
}

/** Champs obligatoires : une valeur vide est ignorée, l'ancienne est conservée. */
const REQUIRED = ['institutionName', 'facultyName', 'acronym'] as const;
/** Champs facultatifs : null ou une valeur vide efface le champ. */
const OPTIONAL = ['logoUrl', 'contactEmail', 'contactPhone', 'address', 'portalSubtitle'] as const;

export type SettingsUpdateData = Partial<Record<(typeof REQUIRED)[number], string>> &
  Partial<Record<(typeof OPTIONAL)[number], string | null>>;

/**
 * Traduit la demande en modification de base :
 *  - champ absent (undefined) : inchangé ;
 *  - champ obligatoire vide : inchangé (jamais effacé) ;
 *  - champ facultatif null ou vide : effacé (null) ;
 *  - sinon : valeur débarrassée de ses espaces de début et de fin.
 */
export function buildSettingsUpdate(input: SettingsUpdateInput): SettingsUpdateData {
  const data: SettingsUpdateData = {};
  for (const key of REQUIRED) {
    const value = input[key]?.trim();
    if (value) data[key] = value;
  }
  for (const key of OPTIONAL) {
    const raw = input[key];
    if (raw === undefined) continue;
    data[key] = raw?.trim() || null;
  }
  return data;
}

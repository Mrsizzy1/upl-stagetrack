/** Codes de résultat d'un scan et messages affichés à l'agent (module pur). */

export type ScanResultCode =
  | 'ACCEPTED'
  | 'ALREADY_RECORDED'
  | 'INVALID_QR'
  | 'REVOKED_QR'
  | 'UNKNOWN_MATRICULE'
  | 'STUDENT_SUSPENDED'
  | 'NOT_EXPECTED'
  | 'TOO_EARLY'
  | 'SESSION_CLOSED'
  | 'NO_SESSION'
  | 'FORBIDDEN';

export const SCAN_MESSAGES: Record<ScanResultCode, string> = {
  ACCEPTED: 'Présence enregistrée.',
  ALREADY_RECORDED: 'Étudiant déjà pointé pour cette session.',
  INVALID_QR: 'QR Code invalide.',
  REVOKED_QR: 'QR Code révoqué : il a été remplacé ou désactivé.',
  UNKNOWN_MATRICULE: 'Aucun étudiant avec ce matricule.',
  STUDENT_SUSPENDED: 'Étudiant suspendu : pointage refusé.',
  NOT_EXPECTED: "Étudiant non attendu aujourd'hui (stage terminé, pas commencé ou non déclaré).",
  TOO_EARLY: 'Pointage trop tôt.',
  SESSION_CLOSED: 'Session fermée.',
  NO_SESSION: "Aucune session de pointage aujourd'hui.",
  FORBIDDEN: "Ce compte n'est pas autorisé à enregistrer des pointages.",
};

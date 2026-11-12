import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Mise à jour partielle des paramètres de l'institution.
 * Un champ facultatif envoyé à null (ou vide) est effacé ; un champ absent est inchangé.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institutionName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  facultyName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  acronym?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  portalSubtitle?: string | null;
}

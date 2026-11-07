import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Identifiant (pour un étudiant : son matricule). */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MaxLength(128)
  newPassword!: string;
}

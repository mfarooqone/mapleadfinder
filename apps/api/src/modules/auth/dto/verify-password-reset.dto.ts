import { IsEmail, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class VerifyPasswordResetDto {
  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;

  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password: string;
}

import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class VerifySignupDto {
  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

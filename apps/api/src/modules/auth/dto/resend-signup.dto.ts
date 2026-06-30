import { IsEmail, MaxLength } from 'class-validator';

export class ResendSignupDto {
  @IsEmail()
  @MaxLength(120)
  email: string;
}

import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username can only contain letters, numbers, dots, underscores, and hyphens.',
  })
  username: string;

  @IsEmail()
  @MaxLength(120)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password: string;
}

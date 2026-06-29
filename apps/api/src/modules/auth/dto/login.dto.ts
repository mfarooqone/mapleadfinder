import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  login: string;

  @IsString()
  @MinLength(6)
  password: string;
}

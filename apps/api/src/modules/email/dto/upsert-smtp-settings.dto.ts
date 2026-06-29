import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertSmtpSettingsDto {
  @IsString()
  @MaxLength(255)
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsBoolean()
  secure: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  password?: string;

  @IsEmail()
  @MaxLength(255)
  fromEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  replyToEmail?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

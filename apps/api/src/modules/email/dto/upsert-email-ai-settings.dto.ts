import { EmailAiProvider } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertEmailAiSettingsDto {
  @IsEnum(EmailAiProvider)
  provider: EmailAiProvider;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  openaiModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mistralModel?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

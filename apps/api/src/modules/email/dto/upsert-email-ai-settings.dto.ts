import { EmailAiProvider } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function toStrictBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === 1 || value === '1') {
    return true;
  }
  if (value === 'false' || value === 0 || value === '0') {
    return false;
  }
  return Boolean(value);
}

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
  @Transform(({ value }) => toStrictBoolean(value))
  @IsBoolean()
  isActive?: boolean;
}

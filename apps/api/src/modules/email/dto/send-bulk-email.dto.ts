import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

export class SendBulkEmailDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  leadIds: string[];

  @IsString()
  @MaxLength(200)
  subjectTemplate: string;

  @IsString()
  @MaxLength(2_000_000)
  bodyTemplate: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaignName?: string;

  @IsOptional()
  @IsString()
  selectedTemplateId?: string;

  @IsOptional()
  @Transform(({ value }) => toStrictBoolean(value))
  @IsBoolean()
  aiPersonalizationEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(3600)
  minDelaySeconds: number;

  @IsInt()
  @Min(1)
  @Max(3600)
  maxDelaySeconds: number;
}

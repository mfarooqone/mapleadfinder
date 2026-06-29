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
  @MaxLength(5000)
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

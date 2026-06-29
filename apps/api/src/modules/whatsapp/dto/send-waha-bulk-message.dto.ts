import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class SendWahaBulkMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  whatsappAccountId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  leadIds: string[];

  @IsOptional()
  @IsIn(['text', 'voice'])
  messageType?: 'text' | 'voice';

  @ValidateIf((object) => (object.messageType ?? 'text') === 'text')
  @IsString()
  messageTemplate?: string;

  @ValidateIf((object) => (object.messageType ?? 'text') === 'voice')
  @IsOptional()
  @IsString()
  url?: string;

  @ValidateIf((object) => (object.messageType ?? 'text') === 'voice')
  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  mimetype?: string;

  @IsOptional()
  @IsBoolean()
  convert?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  messageVariants?: string[];

  @IsOptional()
  @IsBoolean()
  enableSeoResearch?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fallbackSeoPoint?: string;

  @IsInt()
  @Min(1)
  @Max(300)
  minDelaySeconds: number;

  @IsInt()
  @Min(1)
  @Max(300)
  maxDelaySeconds: number;

  @IsOptional()
  @IsBoolean()
  includePreviouslyContacted?: boolean;
}

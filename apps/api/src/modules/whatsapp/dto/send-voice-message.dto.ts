import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

/** Shared body for immediate and queued WAHA voice sends. */
export class SendVoiceMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @ValidateIf((object) => !object.data?.trim())
  @IsOptional()
  @IsString()
  url?: string;

  @ValidateIf((object) => !object.url?.trim())
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
}

export class QueueVoiceMessageDto extends SendVoiceMessageDto {
  @IsString()
  whatsappAccountId: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsISO8601()
  scheduleAt?: string;
}

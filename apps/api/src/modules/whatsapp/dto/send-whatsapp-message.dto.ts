import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class SendWhatsAppMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  whatsappAccountId: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsIn(['text', 'voice'])
  messageType?: 'text' | 'voice';

  @ValidateIf(
    (object) =>
      (object.messageType ?? 'text') === 'text' && !object.templateId,
  )
  @IsOptional()
  @IsString()
  message?: string;

  @ValidateIf(
    (object) => (object.messageType ?? 'text') === 'text' && !object.message,
  )
  @IsOptional()
  @IsString()
  templateId?: string;

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
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsISO8601()
  scheduleAt?: string;

  @IsOptional()
  @IsBoolean()
  outreachPreapproved?: boolean;
}

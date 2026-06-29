import { ProviderType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class ConnectWhatsAppAccountDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  phoneNumber: string;

  @IsEnum(ProviderType)
  provider: ProviderType;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsString()
  businessAccountId?: string;

  @IsOptional()
  @IsString()
  webhookVerifyToken?: string;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

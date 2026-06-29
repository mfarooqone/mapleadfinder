import { IsOptional, IsString } from 'class-validator';

export class BootstrapMetaTestingDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @IsString()
  businessPhoneNumber?: string;

  @IsOptional()
  @IsString()
  webhookBaseUrl?: string;
}

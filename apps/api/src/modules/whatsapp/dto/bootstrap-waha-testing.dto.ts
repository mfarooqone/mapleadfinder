import { IsOptional, IsString } from 'class-validator';

export class BootstrapWahaTestingDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionName?: string;

  @IsOptional()
  @IsString()
  webhookBaseUrl?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

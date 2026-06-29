import { IsOptional, IsString } from 'class-validator';

export class BootstrapTwilioTestingDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  fromPhoneNumber?: string;

  @IsOptional()
  @IsString()
  webhookBaseUrl?: string;
}

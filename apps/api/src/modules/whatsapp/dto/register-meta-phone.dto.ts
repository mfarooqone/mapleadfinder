import { IsOptional, IsString, Matches } from 'class-validator';

export class RegisterMetaPhoneDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  profile?: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Registration PIN must be exactly 6 digits.',
  })
  pin: string;

  @IsOptional()
  @IsString()
  businessPhoneNumber?: string;

  @IsOptional()
  @IsString()
  webhookBaseUrl?: string;
}

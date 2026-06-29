import { IsOptional, IsString } from 'class-validator';

export class BootstrapBaileysTestingDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

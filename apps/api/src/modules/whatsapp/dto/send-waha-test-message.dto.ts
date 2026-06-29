import { IsOptional, IsString } from 'class-validator';

export class SendWahaTestMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  whatsappAccountId?: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  message?: string;
}

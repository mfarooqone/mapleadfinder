import { IsOptional, IsString } from 'class-validator';

export class SendTwilioTestMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  message?: string;
}

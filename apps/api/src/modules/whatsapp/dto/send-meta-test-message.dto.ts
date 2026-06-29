import { IsOptional, IsString } from 'class-validator';

export class SendMetaTestMessageDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

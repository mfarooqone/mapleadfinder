import { IsOptional, IsString } from 'class-validator';

export class UploadLeadsDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  csv: string;
}

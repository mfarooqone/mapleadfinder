import { EmailFolder } from '@prisma/client';
import { IsBooleanString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListMailboxMessagesQueryDto {
  @IsOptional()
  @IsEnum(EmailFolder)
  folder?: EmailFolder;

  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

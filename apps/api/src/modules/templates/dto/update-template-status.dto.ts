import { TemplateStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTemplateStatusDto {
  @IsEnum(TemplateStatus)
  status: TemplateStatus;
}

import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class RequestMetaVerificationCodeDto {
  @IsOptional()
  @IsString()
  profile?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['SMS', 'VOICE'])
  codeMethod?: 'SMS' | 'VOICE';

  @IsOptional()
  @IsString()
  locale?: string;
}

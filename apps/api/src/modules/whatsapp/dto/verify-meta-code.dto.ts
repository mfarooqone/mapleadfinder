import { IsOptional, IsString, Matches } from 'class-validator';

export class VerifyMetaCodeDto {
  @IsOptional()
  @IsString()
  profile?: string;

  @IsString()
  @Matches(/^\d+$/, {
    message: 'Verification code must contain digits only.',
  })
  code: string;
}

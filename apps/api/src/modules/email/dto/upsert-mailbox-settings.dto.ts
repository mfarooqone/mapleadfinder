import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertMailboxSettingsDto {
  @IsString()
  @MaxLength(255)
  imapHost: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort: number;

  @IsBoolean()
  imapSecure: boolean;

  @IsString()
  @MaxLength(255)
  imapUsername: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imapPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  inboxFolder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sentFolder?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

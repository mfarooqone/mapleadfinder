import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsString,
} from 'class-validator';

export class BulkUpdateOptInDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  ids: string[];

  @IsBoolean()
  optIn: boolean;
}

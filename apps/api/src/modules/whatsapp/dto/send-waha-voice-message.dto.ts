import { IsOptional, IsString } from 'class-validator';
import { SendVoiceMessageDto } from './send-voice-message.dto';

export class SendWahaVoiceMessageDto extends SendVoiceMessageDto {
  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  whatsappAccountId?: string;
}

export class SendBaileysScriptVoiceMessageDto {
  @IsString()
  to: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  whatsappAccountId?: string;

  @IsOptional()
  @IsString()
  voice?: string;
}

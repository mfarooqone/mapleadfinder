import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResendSignupDto } from './dto/resend-signup.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifySignupDto } from './dto/verify-signup.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('google')
  google(@Body() dto: GoogleAuthDto) {
    return this.authService.google(dto);
  }

  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('signup/verify')
  verifySignup(@Body() dto: VerifySignupDto) {
    return this.authService.verifySignup(dto);
  }

  @Public()
  @Post('signup/resend')
  resendSignup(@Body() dto: ResendSignupDto) {
    return this.authService.resendSignup(dto);
  }

  @Public()
  @Post('password/forgot')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Post('password/reset')
  verifyPasswordReset(@Body() dto: VerifyPasswordResetDto) {
    return this.authService.verifyPasswordReset(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}

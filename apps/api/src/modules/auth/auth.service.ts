import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { resolveMx } from 'dns/promises';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResendSignupDto } from './dto/resend-signup.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifySignupDto } from './dto/verify-signup.dto';
import { VerifyPasswordResetDto } from './dto/verify-password-reset.dto';
import { AuthenticatedUser, LicenseStatus } from './auth.types';

type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  type: 'access';
  iat: number;
  exp: number;
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '0-mail.com',
  '0815.ru',
  '0wnd.net',
  '10mail.org',
  '10minutemail.co.uk',
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10minutemails.com',
  '10x9.com',
  '123-m.com',
  '1secmail.com',
  '1secmail.net',
  '1secmail.org',
  '20minutemail.com',
  '20minutemail.it',
  '2prong.com',
  '33mail.com',
  '4warding.com',
  '4warding.net',
  '4warding.org',
  '6paq.com',
  '7tags.com',
  '9ox.net',
  'abusemail.de',
  'airmail.cc',
  'anonaddy.com',
  'anonaddy.me',
  'anonymbox.com',
  'antichef.com',
  'armyspy.com',
  'binkmail.com',
  'bobmail.info',
  'boun.cr',
  'burnermail.io',
  'byom.de',
  'byom.men',
  'crazymailing.com',
  'cuvox.de',
  'dayrep.com',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'dispostable.com',
  'dodgit.com',
  'dodgit.org',
  'dontreg.com',
  'drdrb.net',
  'dropmail.me',
  'dump-email.info',
  'e4ward.com',
  'emailondeck.com',
  'emailtemporanea.com',
  'emailtemporanea.net',
  'emailtemporario.com.br',
  'emailthe.net',
  'emailtmp.com',
  'emkei.cz',
  'fake-mail.ml',
  'fakeinbox.com',
  'fakeinbox.info',
  'filzmail.com',
  'fleckens.hu',
  'frapmail.com',
  'getairmail.com',
  'getmails.eu',
  'getnada.com',
  'getonemail.com',
  'givmail.com',
  'gishpuppy.com',
  'goemailgo.com',
  'gotmail.com',
  'gowikimusic.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'haltospam.com',
  'harakirimail.com',
  'hidemail.de',
  'hmamail.com',
  'incognitomail.com',
  'incognitomail.net',
  'incognitomail.org',
  'inboxbear.com',
  'inboxclean.com',
  'inboxclean.org',
  'jetable.com',
  'jetable.net',
  'jetable.org',
  'kasmail.com',
  'kaspop.com',
  'killmail.com',
  'killmail.net',
  'klassmaster.com',
  'klzlk.com',
  'koszmail.pl',
  'kurzepost.de',
  'letthemeatspam.com',
  'lhsdv.com',
  'lifebyfood.com',
  'link2mail.net',
  'litedrop.com',
  'lookugly.com',
  'maboard.com',
  'mailcatch.com',
  'mailcatch.me',
  'maildrop.cc',
  'maildu.de',
  'maileater.com',
  'mailexpire.com',
  'mailforspam.com',
  'mailfreeonline.com',
  'mailinator.co.uk',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'mailinator2.com',
  'mailincubator.com',
  'mailismagic.com',
  'mailme.ir',
  'mailnesia.com',
  'mailnull.com',
  'mailorg.org',
  'mailpick.biz',
  'mailrock.biz',
  'mailsac.com',
  'mailscrap.com',
  'mailshell.com',
  'mailsiphon.com',
  'mailtemp.info',
  'mailtome.de',
  'mailtothis.com',
  'mailtrash.net',
  'mailzilla.com',
  'mintemail.com',
  'mohmal.com',
  'mohmal.im',
  'mohmal.tech',
  'mt2009.com',
  'mt2014.com',
  'my10minutemail.com',
  'mytemp.email',
  'mytrashmail.com',
  'neomailbox.com',
  'noclickemail.com',
  'nogmailspam.info',
  'nomail2me.com',
  'nospam4.us',
  'nowmymail.com',
  'objectmail.com',
  'oneoffemail.com',
  'onewaymail.com',
  'pookmail.com',
  'proxymail.eu',
  'punkass.com',
  'putthisinyourspamdatabase.com',
  'quickinbox.com',
  'rcpt.at',
  'reallymymail.com',
  'rhyta.com',
  'rmqkr.net',
  'rppkn.com',
  'safe-mail.net',
  'safetymail.info',
  'sandelf.de',
  'saynotospams.com',
  'selfdestructingmail.com',
  'sendspamhere.com',
  'sharklasers.com',
  'shiftmail.com',
  'shortmail.net',
  'sibmail.com',
  'skeefmail.com',
  'slaskpost.se',
  'smashmail.de',
  'smellfear.com',
  'snakemail.com',
  'sneakemail.com',
  'sofimail.com',
  'sofort-mail.de',
  'sogetthis.com',
  'spam.la',
  'spam.su',
  'spam4.me',
  'spambob.com',
  'spambob.net',
  'spambob.org',
  'spambog.com',
  'spambog.de',
  'spambog.ru',
  'spambox.info',
  'spamcannon.com',
  'spamcannon.net',
  'spamcon.org',
  'spamcorptastic.com',
  'spamcowboy.com',
  'spamcowboy.net',
  'spamcowboy.org',
  'spamday.com',
  'spamex.com',
  'spamfree24.com',
  'spamfree24.de',
  'spamfree24.eu',
  'spamfree24.info',
  'spamfree24.net',
  'spamfree24.org',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  'spamherelots.com',
  'spamhereplease.com',
  'spamhole.com',
  'spamify.com',
  'spaml.com',
  'spammotel.com',
  'spamobox.com',
  'spamspot.com',
  'spamthis.co.uk',
  'spamthisplease.com',
  'suremail.info',
  'tagyourself.com',
  'teewars.org',
  'teleworm.us',
  'temp-mail.io',
  'temp-mail.org',
  'temp-mail.ru',
  'tempe-mail.com',
  'tempail.com',
  'tempalias.com',
  'tempmail.co',
  'tempmail.com',
  'tempmail.net',
  'tempmail.org',
  'tempmail.plus',
  'tempmailaddress.com',
  'tempmailer.com',
  'tempomail.fr',
  'temporarily.de',
  'temporarioemail.com.br',
  'temporaryemail.net',
  'temporaryforwarding.com',
  'thankyou2010.com',
  'thisisnotmyrealemail.com',
  'throwawaymail.com',
  'tmail.ws',
  'tmailinator.com',
  'tradermail.info',
  'trash-amil.com',
  'trash-mail.at',
  'trash-mail.com',
  'trash-mail.de',
  'trash2009.com',
  'trashdevil.com',
  'trashdevil.de',
  'trashemail.de',
  'trashmail.at',
  'trashmail.com',
  'trashmail.de',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'trashmailer.com',
  'trashymail.com',
  'trashymail.net',
  'tyldd.com',
  'wegwerfemail.com',
  'wegwerfemail.de',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
  'wh4f.org',
  'whyspam.me',
  'willselfdestruct.com',
  'wuzup.net',
  'xagloo.com',
  'xemaps.com',
  'xents.com',
  'xmaily.com',
  'xoxy.net',
  'yep.it',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'zehnminutenmail.de',
  'zetmail.com',
  'zippymail.info',
  'zoemail.org',
]);

const DISPOSABLE_EMAIL_DOMAIN_PATTERNS = [
  /(^|[-.])10min(ute)?mail([-.]|$)/,
  /(^|[-.])20min(ute)?mail([-.]|$)/,
  /(^|[-.])1sec(mail)?([-.]|$)/,
  /(^|[-.])burner(mail)?([-.]|$)/,
  /(^|[-.])deadaddress([-.]|$)/,
  /(^|[-.])discard(mail)?([-.]|$)/,
  /(^|[-.])fake(inbox|mail)?([-.]|$)/,
  /(^|[-.])guerrilla(mail)?([-.]|$)/,
  /(^|[-.])mailinator([-.]|$)/,
  /(^|[-.])mohmal([-.]|$)/,
  /(^|[-.])spam(gourmet|box|free|mail)?([-.]|$)/,
  /(^|[-.])temp(ail|alias|mail|orary)?([-.]|$)/,
  /(^|[-.])throwaway(mail)?([-.]|$)/,
  /(^|[-.])trash(mail|ymail)?([-.]|$)/,
  /(^|[-.])wegwerf(mail|email)?([-.]|$)/,
  /(^|[-.])yopmail([-.]|$)/,
];

@Injectable()
export class AuthService {
  private readonly authSecret =
    process.env.AUTH_TOKEN_SECRET ?? 'dev-only-change-me';
  private readonly tokenTtlDays = this.parsePositiveInt(
    process.env.AUTH_TOKEN_TTL_DAYS,
    7,
  );
  private readonly signupCodeTtlMinutes = this.parsePositiveInt(
    process.env.SIGNUP_CODE_TTL_MINUTES,
    10,
  );
  private readonly passwordResetCodeTtlMinutes = this.parsePositiveInt(
    process.env.PASSWORD_RESET_CODE_TTL_MINUTES,
    10,
  );

  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto) {
    const email = this.normalizeEmail(dto.email);
    const name = dto.name?.trim() || this.getDefaultNameFromEmail(email);

    await this.assertSignupEmailAvailable(email);
    await this.assertEmailCanReceiveVerification(email);

    const code = this.generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + this.signupCodeTtlMinutes * 60 * 1000,
    );

    await this.prisma.signupVerification.upsert({
      where: { email },
      create: {
        email,
        name,
        passwordHash: this.hashPassword(dto.password),
        codeHash: this.hashVerificationCode(email, code, 'signup'),
        attempts: 0,
        expiresAt,
      },
      update: {
        name,
        passwordHash: this.hashPassword(dto.password),
        codeHash: this.hashVerificationCode(email, code, 'signup'),
        attempts: 0,
        expiresAt,
      },
    });

    await this.sendOtpEmail({
      email,
      code,
      subject: 'Your MapLeadFinder signup code',
      intro: 'Your MapLeadFinder signup verification code is',
      ttlMinutes: this.signupCodeTtlMinutes,
    });

    return {
      requiresVerification: true,
      email,
      expiresAt: expiresAt.toISOString(),
      note: `We sent a 6-digit verification code to ${email}.`,
    };
  }

  async verifySignup(dto: VerifySignupDto) {
    const email = this.normalizeEmail(dto.email);
    const code = dto.code.trim();

    const pending = await this.prisma.signupVerification.findUnique({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException('No pending signup verification was found.');
    }

    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.prisma.signupVerification.delete({ where: { email } });
      throw new BadRequestException('Verification code expired. Sign up again.');
    }

    if (pending.attempts >= 5) {
      await this.prisma.signupVerification.delete({ where: { email } });
      throw new BadRequestException('Too many incorrect attempts. Sign up again.');
    }

    if (!this.verifyCode(email, code, pending.codeHash, 'signup')) {
      await this.prisma.signupVerification.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    await this.assertSignupEmailAvailable(pending.email);

    const user = await this.createSignupUser({
      email: pending.email,
      name: pending.name || this.getDefaultNameFromEmail(pending.email),
      passwordHash: pending.passwordHash,
    });
    await this.prisma.signupVerification.delete({ where: { email } });

    return this.buildAuthResponse(user);
  }

  async resendSignup(dto: ResendSignupDto) {
    const email = this.normalizeEmail(dto.email);
    await this.assertSignupEmailAvailable(email);

    const pending = await this.prisma.signupVerification.findUnique({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException('No pending signup verification was found.');
    }

    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.prisma.signupVerification.delete({ where: { email } });
      throw new BadRequestException('Verification code expired. Sign up again.');
    }

    if (pending.attempts >= 5) {
      await this.prisma.signupVerification.delete({ where: { email } });
      throw new BadRequestException('Too many incorrect attempts. Sign up again.');
    }

    const code = this.generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + this.signupCodeTtlMinutes * 60 * 1000,
    );

    await this.prisma.signupVerification.update({
      where: { email },
      data: {
        codeHash: this.hashVerificationCode(email, code, 'signup'),
        attempts: 0,
        expiresAt,
      },
    });

    await this.sendOtpEmail({
      email,
      code,
      subject: 'Your MapLeadFinder signup code',
      intro: 'Your MapLeadFinder signup verification code is',
      ttlMinutes: this.signupCodeTtlMinutes,
    });

    return {
      requiresVerification: true,
      email,
      expiresAt: expiresAt.toISOString(),
      note: `We sent a new 6-digit verification code to ${email}.`,
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = this.normalizeEmail(dto.email);
    const response = this.buildPasswordResetRequestedResponse(email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        isActive: true,
        emailVerifiedAt: true,
        licenseExpiresAt: true,
      },
    });

    if (!user || !user.isActive || !user.emailVerifiedAt) {
      return response;
    }

    const code = this.generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + this.passwordResetCodeTtlMinutes * 60 * 1000,
    );

    await this.prisma.passwordResetVerification.upsert({
      where: { email },
      create: {
        email,
        codeHash: this.hashVerificationCode(email, code, 'password-reset'),
        attempts: 0,
        expiresAt,
      },
      update: {
        codeHash: this.hashVerificationCode(email, code, 'password-reset'),
        attempts: 0,
        expiresAt,
      },
    });

    await this.sendOtpEmail({
      email,
      code,
      subject: 'Your MapLeadFinder password reset code',
      intro: 'Your MapLeadFinder password reset code is',
      ttlMinutes: this.passwordResetCodeTtlMinutes,
    });

    return response;
  }

  async verifyPasswordReset(dto: VerifyPasswordResetDto) {
    const email = this.normalizeEmail(dto.email);
    const code = dto.code.trim();
    const pending = await this.prisma.passwordResetVerification.findUnique({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException('No pending password reset was found.');
    }

    if (pending.expiresAt.getTime() <= Date.now()) {
      await this.prisma.passwordResetVerification.delete({ where: { email } });
      throw new BadRequestException('Reset code expired. Request a new code.');
    }

    if (pending.attempts >= 5) {
      await this.prisma.passwordResetVerification.delete({ where: { email } });
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    if (!this.verifyCode(email, code, pending.codeHash, 'password-reset')) {
      await this.prisma.passwordResetVerification.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid reset code.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive || !user.emailVerifiedAt) {
      await this.prisma.passwordResetVerification.delete({ where: { email } });
      throw new BadRequestException('Password reset is not available for this account.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { email },
      data: {
        passwordHash: this.hashPassword(dto.password),
      },
    });
    await this.prisma.passwordResetVerification.delete({ where: { email } });

    return this.buildAuthResponse(updatedUser);
  }

  private async assertSignupEmailAvailable(email: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }
  }

  private async createSignupUser(input: {
    email: string;
    name: string;
    passwordHash: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          role: UserRole.USER,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    this.assertUserCanAccess(user);
    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account was not found.');
    }

    this.assertUserCanAccess(user);
    return this.toAuthenticatedUser(user);
  }

  async validateAccessToken(token: string) {
    const payload = this.verifyAccessToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User account was not found.');
    }

    this.assertUserCanAccess(user);
    return this.toAuthenticatedUser(user);
  }

  private buildAuthResponse(user: User) {
    const accessToken = this.signAccessToken(user);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: this.toAuthenticatedUser(user),
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    const licenseStatus = this.getLicenseStatus(user.licenseExpiresAt);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      licenseExpiresAt: user.licenseExpiresAt,
      licenseStatus,
      licenseExpired: licenseStatus === 'EXPIRED',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private assertUserCanAccess(user: User) {
    if (!user.isActive) {
      throw new UnauthorizedException('Your account is inactive.');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Verify your email before signing in.');
    }

    if (this.getLicenseStatus(user.licenseExpiresAt) === 'EXPIRED') {
      throw new UnauthorizedException('Your license has expired.');
    }
  }

  private getLicenseStatus(licenseExpiresAt: Date | null): LicenseStatus {
    if (!licenseExpiresAt) {
      return 'UNLIMITED';
    }

    return licenseExpiresAt.getTime() >= Date.now() ? 'ACTIVE' : 'EXPIRED';
  }

  private signAccessToken(user: User) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      type: 'access',
      iat: nowInSeconds,
      exp: nowInSeconds + this.tokenTtlDays * 24 * 60 * 60,
    };

    const encodedHeader = this.base64UrlEncode(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    );
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.signToken(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verifyAccessToken(token: string) {
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const signedValue = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.signToken(signedValue);

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid access token signature.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = JSON.parse(
        this.base64UrlDecode(encodedPayload).toString('utf8'),
      ) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid access token payload.');
    }

    if (payload.type !== 'access' || !payload.sub || !payload.exp) {
      throw new UnauthorizedException('Invalid access token payload.');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Access token has expired.');
    }

    return payload;
  }

  private signToken(value: string) {
    return createHmac('sha256', this.authSecret).update(value).digest('base64url');
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [salt, storedHash] = passwordHash.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const derivedHash = scryptSync(password, salt, 64).toString('hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const derivedBuffer = Buffer.from(derivedHash, 'hex');

    return (
      storedBuffer.length === derivedBuffer.length &&
      timingSafeEqual(storedBuffer, derivedBuffer)
    );
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private generateVerificationCode() {
    return String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
  }

  private hashVerificationCode(
    email: string,
    code: string,
    purpose: 'signup' | 'password-reset',
  ) {
    return createHmac('sha256', this.authSecret)
      .update(`${purpose}:${email}:${code}`)
      .digest('hex');
  }

  private verifyCode(
    email: string,
    code: string,
    codeHash: string,
    purpose: 'signup' | 'password-reset',
  ) {
    const expected = this.hashVerificationCode(email, code, purpose);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(codeHash, 'hex');

    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  }

  private async assertEmailCanReceiveVerification(email: string) {
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain) {
      throw new BadRequestException('Enter a valid email address.');
    }

    if (this.isDisposableEmailDomain(domain)) {
      throw new BadRequestException('Temporary email addresses are not allowed.');
    }

    const hasMailExchange = await this.hasMailExchange(domain);
    if (!hasMailExchange) {
      throw new BadRequestException('Email domain cannot receive mail.');
    }
  }

  private async hasMailExchange(domain: string) {
    try {
      const mxRecords = await resolveMx(domain);
      return mxRecords.length > 0;
    } catch {
      return false;
    }
  }

  private isDisposableEmailDomain(domain: string) {
    const normalizedDomain = domain.toLowerCase().replace(/\.$/, '');

    if (
      [...DISPOSABLE_EMAIL_DOMAINS].some(
        (blockedDomain) =>
          normalizedDomain === blockedDomain ||
          normalizedDomain.endsWith(`.${blockedDomain}`),
      )
    ) {
      return true;
    }

    return DISPOSABLE_EMAIL_DOMAIN_PATTERNS.some((pattern) =>
      pattern.test(normalizedDomain),
    );
  }

  private async sendOtpEmail(input: {
    email: string;
    code: string;
    subject: string;
    intro: string;
    ttlMinutes: number;
  }) {
    const host = process.env.SIGNUP_SMTP_HOST || process.env.SMTP_HOST;
    const port = this.parsePositiveInt(
      process.env.SIGNUP_SMTP_PORT || process.env.SMTP_PORT,
      587,
    );
    const secure = this.parseBoolean(
      process.env.SIGNUP_SMTP_SECURE || process.env.SMTP_SECURE,
      false,
    );
    const user = process.env.SIGNUP_SMTP_USER || process.env.SMTP_USER;
    const pass = process.env.SIGNUP_SMTP_PASS || process.env.SMTP_PASS;
    const from =
      process.env.SIGNUP_SMTP_FROM_EMAIL ||
      process.env.SMTP_FROM_EMAIL ||
      user;

    if (!host || !from) {
      throw new BadRequestException(
        'Email verification is not configured. Set SIGNUP_SMTP_HOST and SIGNUP_SMTP_FROM_EMAIL.',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to: input.email,
      subject: input.subject,
      text: `${input.intro} ${input.code}. It expires in ${input.ttlMinutes} minutes.`,
      html: `<p>${input.intro} <strong>${input.code}</strong>.</p><p>It expires in ${input.ttlMinutes} minutes.</p>`,
    });
  }

  private buildPasswordResetRequestedResponse(email: string) {
    return {
      requiresVerification: true,
      email,
      expiresInMinutes: this.passwordResetCodeTtlMinutes,
      note:
        'If this email belongs to an active account, we sent a password reset code.',
    };
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private getDefaultNameFromEmail(email: string) {
    return email.split('@')[0] || email;
  }

  private parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private parseBoolean(value: string | undefined, fallback: boolean) {
    if (typeof value !== 'string') {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  private base64UrlEncode(value: string) {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  private base64UrlDecode(value: string) {
    return Buffer.from(value, 'base64url');
  }
}

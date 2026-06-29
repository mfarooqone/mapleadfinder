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
import { SignupDto } from './dto/signup.dto';
import { VerifySignupDto } from './dto/verify-signup.dto';
import { AuthenticatedUser, LicenseStatus } from './auth.types';

type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  type: 'access';
  iat: number;
  exp: number;
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '20minutemail.com',
  '33mail.com',
  'anonaddy.com',
  'burnermail.io',
  'byom.de',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'maildrop.cc',
  'mailinator.com',
  'mohmal.com',
  'sharklasers.com',
  'tempmail.com',
  'tempmail.net',
  'temp-mail.org',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

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

  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto) {
    const username = this.normalizeLogin(dto.username);
    const email = this.normalizeLogin(dto.email);
    const name = dto.name?.trim() || username;

    await this.assertSignupIdentityAvailable(username, email);
    await this.assertEmailCanReceiveVerification(email);

    const code = this.generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + this.signupCodeTtlMinutes * 60 * 1000,
    );

    await this.prisma.signupVerification.upsert({
      where: { email },
      create: {
        username,
        email,
        name,
        passwordHash: this.hashPassword(dto.password),
        codeHash: this.hashVerificationCode(email, code),
        attempts: 0,
        expiresAt,
      },
      update: {
        username,
        name,
        passwordHash: this.hashPassword(dto.password),
        codeHash: this.hashVerificationCode(email, code),
        attempts: 0,
        expiresAt,
      },
    });

    await this.sendSignupVerificationEmail(email, code);

    return {
      requiresVerification: true,
      email,
      expiresAt: expiresAt.toISOString(),
      note: `We sent a 6-digit verification code to ${email}.`,
    };
  }

  async verifySignup(dto: VerifySignupDto) {
    const email = this.normalizeLogin(dto.email);
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

    if (!this.verifySignupCode(email, code, pending.codeHash)) {
      await this.prisma.signupVerification.update({
        where: { email },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code.');
    }

    await this.assertSignupIdentityAvailable(pending.username, pending.email);

    const user = await this.createSignupUser({
      username: pending.username,
      email: pending.email,
      name: pending.name || pending.username,
      passwordHash: pending.passwordHash,
    });
    await this.prisma.signupVerification.delete({ where: { email } });

    return this.buildAuthResponse(user);
  }

  private async assertSignupIdentityAvailable(username: string, email: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (existingUser?.username === username) {
      throw new ConflictException('Username is already taken.');
    }

    if (existingUser?.email === email) {
      throw new ConflictException('Email is already registered.');
    }
  }

  private async createSignupUser(input: {
    username: string;
    email: string;
    name: string;
    passwordHash: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          username: input.username,
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
        throw new ConflictException('Username or email is already registered.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const login = this.normalizeLogin(dto.login);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: login }, { email: login }],
      },
    });

    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid username or password.');
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
      username: user.username,
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

  private hashVerificationCode(email: string, code: string) {
    return createHmac('sha256', this.authSecret)
      .update(`${email}:${code}`)
      .digest('hex');
  }

  private verifySignupCode(email: string, code: string, codeHash: string) {
    const expected = this.hashVerificationCode(email, code);
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

    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
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

  private async sendSignupVerificationEmail(email: string, code: string) {
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
        'Signup email verification is not configured. Set SIGNUP_SMTP_HOST and SIGNUP_SMTP_FROM_EMAIL.',
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
      to: email,
      subject: 'Your Lead Outreach verification code',
      text: `Your verification code is ${code}. It expires in ${this.signupCodeTtlMinutes} minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in ${this.signupCodeTtlMinutes} minutes.</p>`,
    });
  }

  private normalizeLogin(login: string) {
    return login.trim().toLowerCase();
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

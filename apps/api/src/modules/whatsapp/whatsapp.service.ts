import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JobStatus,
  JobType,
  Lead,
  MessageStatus,
  Prisma,
  ProviderType,
} from '@prisma/client';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { sortLeadsByAreaCodeProximity } from '../../common/utils/outreach-area-code.util';
import {
  buildVoiceContentLabel,
  buildVoiceMessageMetadata,
  resolveOutgoingMessageType,
  resolveVoiceFile,
} from '../../common/utils/voice-message.util';
import {
  buildLeadTemplateVariables,
  renderTemplateContent,
} from '../../common/utils/template.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { JobsService } from '../jobs/jobs.service';
import { LeadsService } from '../leads/leads.service';
import { OutreachService } from '../outreach/outreach.service';
import { MessagesService } from '../messages/messages.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { TemplatesService } from '../templates/templates.service';
import { WhatsAppProviderRegistryService } from './providers/whatsapp-provider-registry.service';
import { BaileysSessionService } from './providers/baileys-session.service';
import { BootstrapBaileysTestingDto } from './dto/bootstrap-baileys-testing.dto';
import { BootstrapMetaTestingDto } from './dto/bootstrap-meta-testing.dto';
import { BootstrapTwilioTestingDto } from './dto/bootstrap-twilio-testing.dto';
import { BootstrapWahaTestingDto } from './dto/bootstrap-waha-testing.dto';
import { ConnectWhatsAppAccountDto } from './dto/connect-whatsapp-account.dto';
import { RegisterMetaPhoneDto } from './dto/register-meta-phone.dto';
import { RequestMetaVerificationCodeDto } from './dto/request-meta-verification-code.dto';
import { SendMetaTestMessageDto } from './dto/send-meta-test-message.dto';
import { SendWahaBulkMessageDto } from './dto/send-waha-bulk-message.dto';
import { SendTwilioTestMessageDto } from './dto/send-twilio-test-message.dto';
import { SendWahaTestMessageDto } from './dto/send-waha-test-message.dto';
import { QueueVoiceMessageDto } from './dto/send-voice-message.dto';
import {
  SendBaileysScriptVoiceMessageDto,
  SendWahaVoiceMessageDto,
} from './dto/send-waha-voice-message.dto';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { VerifyMetaCodeDto } from './dto/verify-meta-code.dto';
import {
  ProviderActionResult,
  RegisterPhonePayload,
  RequestVerificationCodePayload,
  VerificationCodeMethod,
  VerifyCodePayload,
  WhatsAppProviderAdapter,
} from './providers/types';

type MetaProfile = 'TEST' | 'LIVE';

type WahaConfig = {
  baseUrl: string;
  apiKey: string;
  sessionName: string;
  usesDedicatedBaseUrl: boolean;
  webhookSecret: string;
  userId?: string;
};

const WAHA_BULK_MESSAGE_DELAY_SECONDS = 120;
const SEO_RESEARCH_TIMEOUT_MS = 7000;
const execFileAsync = promisify(execFile);

type SeoResearchResult = {
  website: string | null;
  domain: string | null;
  title: string | null;
  description: string | null;
  h1: string | null;
  point: string;
  source: 'website' | 'website-unreachable' | 'no-website';
};

type MetaRegistrationProvider = WhatsAppProviderAdapter & {
  requestVerificationCode: (
    payload: RequestVerificationCodePayload,
  ) => Promise<ProviderActionResult>;
  verifyCode: (payload: VerifyCodePayload) => Promise<ProviderActionResult>;
  registerPhone: (
    payload: RegisterPhonePayload,
  ) => Promise<ProviderActionResult>;
};

@Injectable()
export class WhatsappService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly leadsService: LeadsService,
    private readonly messagesService: MessagesService,
    private readonly templatesService: TemplatesService,
    private readonly jobsService: JobsService,
    private readonly secretVaultService: SecretVaultService,
    private readonly providerRegistry: WhatsAppProviderRegistryService,
    private readonly baileysSessions: BaileysSessionService,
    private readonly outreachService: OutreachService,
  ) {}

  async getOutreachStats(userId: string, whatsappAccountId?: string) {
    const account = await this.resolveUserWhatsAppAccount(userId, {
      whatsappAccountId,
      provider: ProviderType.WAHA,
    });

    return this.outreachService.getDailyStats(account.id, userId);
  }

  async getMetaTestingStatus(userId?: string, profile?: string) {
    const metaAccount = userId
      ? await this.prisma.whatsAppAccount.findFirst({
          where: {
            userId,
            provider: ProviderType.META_CLOUD,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : null;

    const resolvedProfile = this.resolveMetaProfile(profile);
    const activeConfig = this.getMetaProfileConfig(resolvedProfile);
    const testConfig = this.getMetaProfileConfig('TEST');
    const liveConfig = this.getMetaProfileConfig('LIVE');
    const requiredConfig = {
      accessToken: Boolean(activeConfig.accessToken),
      phoneNumberId: Boolean(activeConfig.phoneNumberId),
      verifyToken: Boolean(activeConfig.verifyToken),
    };
    const businessPhoneNumber = Boolean(
      metaAccount?.phoneNumber || activeConfig.businessPhoneNumber,
    );
    const envReady = Object.values(requiredConfig).every(Boolean);

    return {
      recommendedProvider: ProviderType.META_CLOUD,
      testingMode: 'direct-meta-cloud-api',
      activeProfile: resolvedProfile,
      envReady,
      requiredConfig: {
        ...requiredConfig,
        businessPhoneNumber,
      },
      configuredProfiles: {
        test: {
          phoneNumber: testConfig.businessPhoneNumber || null,
          phoneNumberId: testConfig.phoneNumberId || null,
          ready: Boolean(
            testConfig.accessToken &&
            testConfig.phoneNumberId &&
            testConfig.verifyToken &&
            testConfig.businessPhoneNumber,
          ),
        },
        live: {
          phoneNumber: liveConfig.businessPhoneNumber || null,
          phoneNumberId: liveConfig.phoneNumberId || null,
          ready: Boolean(
            liveConfig.accessToken &&
            liveConfig.phoneNumberId &&
            liveConfig.verifyToken &&
            liveConfig.businessPhoneNumber,
          ),
        },
      },
      verificationMethods: ['SMS', 'VOICE'],
      webhookPath: '/webhooks/whatsapp/meta-cloud',
      connectedAccount: metaAccount ? this.sanitizeAccount(metaAccount) : null,
      registrationHint:
        'Meta sends number verification codes by SMS or voice call. The code does not arrive inside a WhatsApp chat.',
      nextStep: !envReady
        ? `Fill the active ${resolvedProfile.toLowerCase()} Meta profile values in .env first.`
        : metaAccount
          ? 'Call POST /whatsapp/testing/meta/send with the destination phone number.'
          : businessPhoneNumber
            ? `Call POST /whatsapp/meta/registration/request-code, then /verify-code, then /register. After that call POST /whatsapp/testing/meta/bootstrap to store the ${resolvedProfile.toLowerCase()} Meta account.`
            : `Set the active ${resolvedProfile.toLowerCase()} business phone in .env or pass businessPhoneNumber to the bootstrap/register endpoint.`,
    };
  }

  async getWahaTestingStatus(userId?: string, sessionName?: string) {
    const linkedAccount = userId
      ? await this.prisma.whatsAppAccount.findUnique({
          where: { userId },
        })
      : null;
    const wahaAccount =
      linkedAccount?.provider === ProviderType.WAHA ? linkedAccount : null;
    const config = this.getWahaConfig(userId);
    const resolvedSessionName = this.resolveWahaSessionName(
      userId,
      sessionName,
      config,
    );
    const envReady = Boolean(config.baseUrl);
    const session = envReady
      ? await this.getWahaSession(resolvedSessionName, config).catch(() => null)
      : null;
    const me = envReady
      ? await this.getWahaSessionMe(resolvedSessionName, config).catch(
          () => null,
        )
      : null;

    return {
      recommendedProvider: ProviderType.WAHA,
      testingMode: 'waha-self-hosted-web',
      envReady,
      requiredConfig: {
        baseUrl: Boolean(config.baseUrl),
        apiKey: Boolean(config.apiKey),
        sessionName: Boolean(resolvedSessionName),
      },
      sessionName: resolvedSessionName,
      webhookPath: '/webhooks/whatsapp/waha',
      connectedAccount: wahaAccount ? this.sanitizeAccount(wahaAccount) : null,
      wahaSession: session,
      me,
      qrHint:
        'If the session is waiting for QR, call GET /whatsapp/testing/waha/qr and scan the code with your WhatsApp app.',
      riskNote:
        'WAHA is a free self-hosted WhatsApp Web-style integration, not an official Meta API.',
      nextStep: !envReady
        ? 'Fill WAHA_BASE_URL in .env and run WAHA first.'
        : !session
          ? 'Call POST /whatsapp/testing/waha/bootstrap to create the WAHA session.'
          : !me
            ? 'Scan the QR, then call POST /whatsapp/testing/waha/bootstrap again so the linked phone can be saved in the backend.'
            : wahaAccount
              ? 'Call POST /whatsapp/testing/waha/send to send your first message.'
              : 'Call POST /whatsapp/testing/waha/bootstrap one more time to save the linked WAHA session as a backend account.',
    };
  }

  async getBaileysTestingStatus(userId?: string, sessionName?: string) {
    const baileysAccount = userId
      ? await this.prisma.whatsAppAccount.findFirst({
          where: {
            userId,
            provider: ProviderType.BAILEYS,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : null;
    const resolvedSessionName = this.getUserScopedSessionName(
      userId,
      sessionName,
      'baileys',
    );
    const session = await this.baileysSessions.getStatus(resolvedSessionName);

    return {
      recommendedProvider: ProviderType.BAILEYS,
      testingMode: 'baileys-whatsapp-web',
      envReady: true,
      requiredConfig: {
        sessionName: Boolean(session.sessionName),
      },
      sessionName: session.sessionName,
      connectedAccount: baileysAccount
        ? this.sanitizeAccount(baileysAccount)
        : null,
      baileysSession: session,
      qrHint:
        'Call GET /whatsapp/testing/baileys/qr and scan it from WhatsApp Linked Devices.',
      riskNote:
        'Baileys is a free unofficial WhatsApp Web integration. Keep volume low and use opted-in contacts.',
      nextStep: session.connected
        ? baileysAccount
          ? 'Call POST /whatsapp/testing/baileys/send-voice or POST /whatsapp/voice/send.'
          : 'Call POST /whatsapp/testing/baileys/bootstrap again to save the linked phone as an account.'
        : 'Call GET /whatsapp/testing/baileys/qr and scan the QR.',
    };
  }

  async getTwilioTestingStatus(userId?: string) {
    const twilioAccount = userId
      ? await this.prisma.whatsAppAccount.findFirst({
          where: {
            userId,
            provider: ProviderType.TWILIO,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : null;

    const config = this.getTwilioConfig();
    const fromPhoneNumber = config.fromPhoneNumber;
    const isSandbox = this.isTwilioSandboxNumber(fromPhoneNumber);
    const requiredConfig = {
      accountSid: Boolean(config.accountSid),
      authToken: Boolean(config.authToken),
      fromPhoneNumber: Boolean(fromPhoneNumber),
    };
    const envReady = Object.values(requiredConfig).every(Boolean);

    return {
      recommendedProvider: ProviderType.TWILIO,
      testingMode: isSandbox
        ? 'twilio-whatsapp-sandbox'
        : 'twilio-whatsapp-sender',
      envReady,
      requiredConfig,
      fromPhoneNumber: fromPhoneNumber || null,
      webhookPath: '/webhooks/whatsapp/twilio',
      connectedAccount: twilioAccount
        ? this.sanitizeAccount(twilioAccount)
        : null,
      sandboxJoin: isSandbox
        ? {
            sandboxNumber: '+14155238886',
            joinCode: config.sandboxJoinCode || null,
            instruction: config.sandboxJoinCode
              ? `From your WhatsApp app, send "join ${config.sandboxJoinCode}" to +14155238886. That opens the 24-hour service window for testing.`
              : 'Open the Twilio Console, copy your Sandbox join code, then send "join <code>" to +14155238886 from the phone you want to test with.',
          }
        : null,
      nextStep: !envReady
        ? 'Fill TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env first.'
        : twilioAccount
          ? isSandbox
            ? 'Make sure your test phone has joined the sandbox, then call POST /whatsapp/testing/twilio/send.'
            : 'Call POST /whatsapp/testing/twilio/send to send your first message from the registered sender.'
          : 'Call POST /whatsapp/testing/twilio/bootstrap to save the Twilio account in the backend.',
      productionUpgrade:
        'Later, register your own WhatsApp sender in Twilio Console using Self Sign-up, replace TWILIO_WHATSAPP_FROM with your UAE sender, then run the bootstrap route again.',
    };
  }

  async bootstrapMetaTesting(
    dto: BootstrapMetaTestingDto & { userId: string },
  ) {
    const resolvedProfile = this.resolveMetaProfile(dto.profile);
    const config = this.getMetaProfileConfig(resolvedProfile);
    const accessToken = config.accessToken;
    const appSecret = config.appSecret;
    const phoneNumberId = config.phoneNumberId;
    const verifyToken = config.verifyToken;
    const envBusinessPhone = config.businessPhoneNumber;

    if (!accessToken || !phoneNumberId || !verifyToken) {
      throw new BadRequestException(
        `The active ${resolvedProfile.toLowerCase()} Meta profile is missing access token, phone number id, or verify token.`,
      );
    }

    const { account, template } = await this.upsertConfiguredMetaAccount({
      userId: dto.userId,
      profile: resolvedProfile,
      accessToken,
      appSecret,
      phoneNumberId,
      verifyToken,
      businessPhoneNumber: dto.businessPhoneNumber ?? envBusinessPhone ?? '',
      webhookBaseUrl: dto.webhookBaseUrl,
      metadata: {
        mode: 'meta-testing',
      },
    });

    return {
      account,
      templateId: template.id,
      activeProfile: resolvedProfile,
      testingAdvice:
        'For first-send testing with Meta Cloud API, use the pre-approved hello_world template to a recipient allowed in your Meta app.',
    };
  }

  async bootstrapWahaTesting(
    dto: BootstrapWahaTestingDto & { userId: string },
  ) {
    const config = this.getWahaConfig(dto.userId);
    const sessionName = this.resolveWahaSessionName(
      dto.userId,
      dto.sessionName,
      config,
    );

    if (!config.baseUrl) {
      throw new BadRequestException(
        'WAHA_BASE_URL is missing. Start WAHA and set its base URL in .env first.',
      );
    }

    const existingSession = await this.getWahaSession(
      sessionName,
      config,
    ).catch(() => null);
    const session = existingSession
      ? await this.ensureWahaSessionStarted(
          sessionName,
          existingSession,
          config,
        )
      : await this.upsertWahaSession({
          sessionName,
          config,
          webhookBaseUrl: dto.webhookBaseUrl,
        });

    const me = await this.getWahaSessionMe(sessionName, config).catch(
      () => null,
    );
    const linkedPhoneNumber =
      dto.phoneNumber?.trim() || this.extractPhoneNumberFromWahaMe(me);

    if (!linkedPhoneNumber) {
      return {
        provider: ProviderType.WAHA,
        sessionName,
        session,
        me,
        accountSaved: false,
        nextStep:
          'Session is ready, but the phone number is not linked yet. Scan the QR, wait for session WORKING, then call this bootstrap route again.',
      };
    }

    const account = await this.connectAccount({
      userId: dto.userId,
      phoneNumber: linkedPhoneNumber,
      provider: ProviderType.WAHA,
      apiKey: config.apiKey,
      businessAccountId: sessionName,
      webhookUrl:
        this.buildWahaWebhookUrl(
          this.resolveWebhookBaseUrl(dto.webhookBaseUrl),
        ) ?? '/webhooks/whatsapp/waha',
      metadata: {
        baseUrl: config.baseUrl,
        sessionName,
        mode: 'waha-web',
      },
      isActive: true,
    });

    return {
      provider: ProviderType.WAHA,
      sessionName,
      session,
      me,
      accountSaved: true,
      account,
      nextStep:
        'WAHA session is saved. You can now call POST /whatsapp/testing/waha/send.',
    };
  }

  async disconnectWahaTesting(
    dto: BootstrapWahaTestingDto & { userId: string },
  ) {
    const config = this.getWahaConfig(dto.userId);
    const sessionName = this.resolveWahaSessionName(
      dto.userId,
      dto.sessionName,
      config,
    );

    if (!config.baseUrl) {
      throw new BadRequestException(
        'WAHA_BASE_URL is missing. Start WAHA and set its base URL in .env first.',
      );
    }

    const account = await this.prisma.whatsAppAccount.findUnique({
      where: { userId: dto.userId },
    });

    try {
      await this.fetchWahaJson(
        `/api/sessions/${encodeURIComponent(sessionName)}/logout`,
        { method: 'POST' },
        'WAHA session logout failed',
        config,
      );
    } catch {
      // Session may already be logged out or stopped.
    }

    if (account) {
      await this.prisma.outreachDailyStats.deleteMany({
        where: { whatsappAccountId: account.id },
      });
      await this.prisma.whatsAppAccount.delete({
        where: { id: account.id },
      });
    }

    await this.waitForWahaSessionStatuses(
      sessionName,
      ['SCAN_QR_CODE', 'STOPPED', 'FAILED'],
      20,
      1000,
      config,
    ).catch(() => null);

    try {
      await this.ensureWahaSessionStarted(sessionName, undefined, config);
    } catch {
      // Best effort — user can click Start connection after disconnect.
    }

    return {
      disconnected: true,
      sessionName,
      removedAccountPhone: account?.phoneNumber ?? null,
      nextStep:
        'Previous number removed. Click Start connection, then Load QR, and scan with the new phone.',
    };
  }

  async bootstrapBaileysTesting(
    dto: BootstrapBaileysTestingDto & { userId: string },
  ) {
    const sessionName = this.getUserScopedSessionName(
      dto.userId,
      dto.sessionName,
      'baileys',
    );
    const session = await this.baileysSessions.waitForConnected(
      sessionName,
      10_000,
    );
    const linkedPhoneNumber =
      dto.phoneNumber?.trim() || session.phoneNumber || null;

    if (!linkedPhoneNumber) {
      return {
        provider: ProviderType.BAILEYS,
        sessionName: session.sessionName,
        session,
        accountSaved: false,
        nextStep:
          'Baileys session started. Fetch the QR, scan it, then call bootstrap again to save the linked phone.',
      };
    }

    const account = await this.connectAccount({
      userId: dto.userId,
      phoneNumber: linkedPhoneNumber,
      provider: ProviderType.BAILEYS,
      apiKey: 'local-baileys-session',
      businessAccountId: session.sessionName,
      metadata: {
        sessionName: session.sessionName,
        mode: 'baileys-web',
      },
      isActive: true,
    });

    return {
      provider: ProviderType.BAILEYS,
      sessionName: session.sessionName,
      session,
      accountSaved: true,
      account,
      nextStep:
        'Baileys session is saved. You can now send voice notes with POST /whatsapp/voice/send.',
    };
  }

  async bootstrapTwilioTesting(
    dto: BootstrapTwilioTestingDto & { userId: string },
  ) {
    const config = this.getTwilioConfig();
    const accountSid = config.accountSid;
    const authToken = config.authToken;
    const fromPhoneNumber = dto.fromPhoneNumber ?? config.fromPhoneNumber;

    if (!accountSid || !authToken || !fromPhoneNumber) {
      throw new BadRequestException(
        'Twilio testing requires account SID, auth token, and WhatsApp sender phone number.',
      );
    }

    const account = await this.connectAccount({
      userId: dto.userId,
      phoneNumber: fromPhoneNumber,
      provider: ProviderType.TWILIO,
      apiKey: authToken,
      businessAccountId: accountSid,
      webhookUrl: dto.webhookBaseUrl
        ? `${dto.webhookBaseUrl.replace(/\/$/, '')}/webhooks/whatsapp/twilio`
        : '/webhooks/whatsapp/twilio',
      metadata: {
        fromPhoneNumber: normalizePhoneNumber(fromPhoneNumber),
        mode: this.isTwilioSandboxNumber(fromPhoneNumber)
          ? 'twilio-sandbox'
          : 'twilio-registered-sender',
      },
      isActive: true,
    });

    return {
      account,
      provider: ProviderType.TWILIO,
      senderType: this.isTwilioSandboxNumber(fromPhoneNumber)
        ? 'sandbox'
        : 'registered-sender',
      nextStep: this.isTwilioSandboxNumber(fromPhoneNumber)
        ? 'Join the Twilio WhatsApp Sandbox from your test phone, then call POST /whatsapp/testing/twilio/send.'
        : 'Your Twilio sender is saved. You can now call POST /whatsapp/testing/twilio/send.',
    };
  }

  async requestMetaVerificationCode(dto: RequestMetaVerificationCodeDto) {
    const { resolvedProfile, accessToken, phoneNumberId } =
      this.getRequiredMetaRegistrationConfig(dto.profile);
    const provider = this.getMetaRegistrationProvider();
    const codeMethod = dto.codeMethod ?? 'SMS';
    const locale = dto.locale?.trim() || 'en_US';

    const result = await provider.requestVerificationCode({
      phoneNumberId,
      accessToken,
      codeMethod,
      locale,
    });

    return {
      success: result.success,
      activeProfile: resolvedProfile,
      phoneNumberId,
      codeMethod,
      locale,
      deliveryHint:
        codeMethod === 'SMS'
          ? 'Meta should send the verification code by SMS.'
          : 'Meta should send the verification code by voice call.',
      note: 'Meta Cloud API number verification does not deliver the code inside the WhatsApp app chat.',
      raw: result.raw ?? null,
    };
  }

  async verifyMetaCode(dto: VerifyMetaCodeDto) {
    const { resolvedProfile, accessToken, phoneNumberId } =
      this.getRequiredMetaRegistrationConfig(dto.profile);
    const provider = this.getMetaRegistrationProvider();
    const result = await provider.verifyCode({
      phoneNumberId,
      accessToken,
      code: dto.code.trim(),
    });

    return {
      success: result.success,
      activeProfile: resolvedProfile,
      phoneNumberId,
      nextStep:
        'Call POST /whatsapp/meta/registration/register with your 6-digit two-step PIN.',
      raw: result.raw ?? null,
    };
  }

  async registerMetaPhone(dto: RegisterMetaPhoneDto) {
    const { resolvedProfile, config, accessToken, phoneNumberId } =
      this.getRequiredMetaRegistrationConfig(dto.profile);
    const provider = this.getMetaRegistrationProvider();
    const result = await provider.registerPhone({
      phoneNumberId,
      accessToken,
      pin: dto.pin.trim(),
    });

    const businessPhoneNumber =
      dto.businessPhoneNumber ?? config.businessPhoneNumber ?? '';
    const shouldStoreAccount = Boolean(dto.userId && businessPhoneNumber);
    const stored =
      dto.userId && businessPhoneNumber
        ? await this.upsertConfiguredMetaAccount({
            userId: dto.userId,
            profile: resolvedProfile,
            accessToken,
            appSecret: config.appSecret,
            phoneNumberId,
            verifyToken: config.verifyToken,
            businessPhoneNumber,
            webhookBaseUrl: dto.webhookBaseUrl,
            metadata: {
              mode: 'meta-registration',
            },
          })
        : null;

    return {
      success: result.success,
      activeProfile: resolvedProfile,
      phoneNumberId,
      storedAccount: stored?.account ?? null,
      templateId: stored?.template.id ?? null,
      nextStep: shouldStoreAccount
        ? 'Registration completed. You can now send a template test with POST /whatsapp/testing/meta/send.'
        : 'Registration completed. Provide userId and businessPhoneNumber if you want this backend to store the account automatically.',
      raw: result.raw ?? null,
    };
  }

  async connectAccount(dto: ConnectWhatsAppAccountDto & { userId: string }) {
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const metadata =
      dto.metadata && Object.keys(dto.metadata).length > 0
        ? dto.metadata
        : undefined;

    const existingByUser = await this.prisma.whatsAppAccount.findUnique({
      where: { userId: dto.userId },
    });
    const existingByPhone = await this.prisma.whatsAppAccount.findUnique({
      where: { phoneNumber },
    });

    if (existingByUser && existingByUser.phoneNumber !== phoneNumber) {
      throw new ConflictException(
        'This login account already has a WhatsApp number linked. Create a separate user account to link another number.',
      );
    }

    if (existingByPhone && existingByPhone.userId !== dto.userId) {
      throw new ConflictException(
        'This phone number is already linked to another login account.',
      );
    }

    const encryptedApiKey =
      this.secretVaultService.encrypt(dto.apiKey) ?? dto.apiKey;
    const encryptedApiSecret = this.secretVaultService.encrypt(dto.apiSecret);

    const account = existingByUser
      ? await this.prisma.whatsAppAccount.update({
          where: { id: existingByUser.id },
          data: {
            provider: dto.provider,
            apiKey: encryptedApiKey,
            apiSecret: encryptedApiSecret,
            businessAccountId: dto.businessAccountId,
            webhookVerifyToken: dto.webhookVerifyToken,
            webhookUrl: dto.webhookUrl,
            metadata,
            isActive: dto.isActive ?? true,
          },
        })
      : await this.prisma.whatsAppAccount.create({
          data: {
            userId: dto.userId,
            phoneNumber,
            provider: dto.provider,
            apiKey: encryptedApiKey,
            apiSecret: encryptedApiSecret,
            businessAccountId: dto.businessAccountId,
            webhookVerifyToken: dto.webhookVerifyToken,
            webhookUrl: dto.webhookUrl,
            metadata,
            isActive: dto.isActive ?? true,
          },
        });

    return this.sanitizeAccount(account);
  }

  async findAccount(userId: string) {
    const account = await this.prisma.whatsAppAccount.findUnique({
      where: { userId },
    });

    return account ? this.sanitizeAccount(account) : null;
  }

  async findAccounts(userId: string) {
    const account = await this.findAccount(userId);
    return account ? [account] : [];
  }

  private async resolveUserWhatsAppAccount(
    userId: string,
    options?: {
      whatsappAccountId?: string;
      provider?: ProviderType;
    },
  ) {
    if (options?.whatsappAccountId) {
      const account = await this.prisma.whatsAppAccount.findFirst({
        where: {
          id: options.whatsappAccountId,
          userId,
          ...(options.provider ? { provider: options.provider } : {}),
          isActive: true,
        },
      });

      if (!account) {
        throw new NotFoundException(
          `WhatsApp account ${options.whatsappAccountId} not found for this user.`,
        );
      }

      return account;
    }

    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        userId,
        ...(options?.provider ? { provider: options.provider } : {}),
        isActive: true,
      },
    });

    if (!account) {
      throw new NotFoundException(
        options?.provider === ProviderType.BAILEYS
          ? 'Baileys account not found. Open the voice page, scan QR, then save the Baileys session first.'
          : options?.provider === ProviderType.WAHA
            ? 'WAHA account not found. Run POST /whatsapp/testing/waha/bootstrap first.'
            : 'No WhatsApp number linked to this account yet.',
      );
    }

    return account;
  }

  async sendMetaTestMessage(dto: SendMetaTestMessageDto & { userId: string }) {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        userId: dto.userId,
        provider: ProviderType.META_CLOUD,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!account) {
      throw new NotFoundException(
        'Meta Cloud account not found. Run POST /whatsapp/testing/meta/bootstrap first.',
      );
    }

    const phone = normalizePhoneNumber(dto.to);
    const conversation = await this.conversationsService.findOrCreate({
      userId: dto.userId,
      whatsappAccountId: account.id,
      phone,
      lastMessageAt: new Date(),
    });

    const templateName = dto.templateName?.trim() || 'hello_world';
    const language = dto.language?.trim() || 'en_US';
    const provider = this.providerRegistry.get(ProviderType.META_CLOUD);
    const credentials = {
      apiKey: this.secretVaultService.decrypt(account.apiKey) ?? '',
      apiSecret: this.secretVaultService.decrypt(account.apiSecret),
    };

    if (!credentials.apiKey) {
      throw new BadRequestException(
        'Meta access token is missing from the saved account.',
      );
    }

    const queuedMessage = await this.messagesService.createQueuedOutgoing({
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      phone,
      content: `template:${templateName}`,
      metadata: {
        source: 'meta-testing',
      },
    });

    try {
      const result = await provider.sendTemplateMessage({
        account,
        credentials,
        to: phone,
        templateName,
        language,
      });

      await this.messagesService.markSent({
        messageId: queuedMessage.id,
        userId: dto.userId,
        whatsappAccountId: account.id,
        provider: ProviderType.META_CLOUD,
        providerMessageId: result.externalMessageId,
        rawResponse: (result.raw ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      });
      await this.conversationsService.touchOutgoing(conversation.id);

      return {
        sent: true,
        provider: ProviderType.META_CLOUD,
        templateName,
        to: phone,
        providerMessageId: result.externalMessageId ?? null,
        note: 'If Meta testing mode is active, the recipient must be allowed in your Meta app dashboard.',
      };
    } catch (error) {
      await this.messagesService.markFailed(
        queuedMessage.id,
        error instanceof Error ? error.message : String(error),
        { userId: dto.userId, whatsappAccountId: account.id },
      );

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Meta test send failed.',
      );
    }
  }

  async getWahaQr(userId: string, sessionName?: string) {
    const config = this.getWahaConfig(userId);
    const resolvedSessionName = this.resolveWahaSessionName(
      userId,
      sessionName,
      config,
    );

    if (!config.baseUrl) {
      throw new BadRequestException(
        'WAHA_BASE_URL is missing. Start WAHA and set its base URL in .env first.',
      );
    }

    const existingSession = await this.getWahaSession(
      resolvedSessionName,
      config,
    ).catch(() => null);
    const session = existingSession
      ? await this.ensureWahaSessionStarted(
          resolvedSessionName,
          existingSession,
          config,
        )
      : await this.upsertWahaSession({
          sessionName: resolvedSessionName,
          config,
        });
    const readySession = await this.waitForWahaSessionStatuses(
      resolvedSessionName,
      ['SCAN_QR_CODE', 'WORKING'],
      30,
      1000,
      config,
    );
    const status = this.getWahaSessionStatus(readySession ?? session);

    if (status === 'WORKING') {
      return {
        sessionName: resolvedSessionName,
        qr: null,
        alreadyLinked: true,
        hint: 'This session is already linked. To scan a different number, click Change number on the setup page first (logs out WAHA and clears the saved account).',
      };
    }

    if (status !== 'SCAN_QR_CODE') {
      throw new BadRequestException(
        `WAHA session is not ready for QR yet. Current status: ${status ?? 'unknown'}.`,
      );
    }

    const qr = await this.fetchWahaJson(
      `/api/${encodeURIComponent(resolvedSessionName)}/auth/qr?format=image`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
      'WAHA QR fetch failed',
      config,
    );

    return {
      sessionName: resolvedSessionName,
      qr,
      hint: 'Scan this QR image in WhatsApp -> Linked Devices -> Link a device.',
    };
  }

  async sendWahaTestMessage(dto: SendWahaTestMessageDto & { userId: string }) {
    const account = await this.resolveUserWhatsAppAccount(dto.userId, {
      whatsappAccountId: dto.whatsappAccountId,
      provider: ProviderType.WAHA,
    });

    const phone = normalizePhoneNumber(dto.to);
    const lead = await this.leadsService.findByPhone(dto.userId, phone);
    const contactInsight = await this.leadsService.findContactInsightByPhone(
      dto.userId,
      phone,
    );
    const conversation = await this.conversationsService.findOrCreate({
      userId: dto.userId,
      whatsappAccountId: account.id,
      phone,
      leadId: lead?.id,
      lastMessageAt: new Date(),
    });
    const messageBody =
      dto.message?.trim() || 'WAHA test message from your backend.';
    const hasIncoming = Boolean(
      contactInsight.hasIncoming || conversation.lastIncomingAt,
    );
    const isFirstOutgoing = contactInsight.contactState !== 'CONTACTED';

    const dailyStats = await this.outreachService.getDailyStats(
      account.id,
      dto.userId,
    );
    const eligibility = this.outreachService.evaluateEligibility(
      {
        hasIncoming,
        hasOutgoing: !isFirstOutgoing,
        optIn: true,
        warmUpStatus: lead?.warmUpStatus ?? 'PENDING',
        lastOutgoingAt: lead?.lastOutgoingAt ?? contactInsight.contactedAt,
        messageBody,
        isFirstOutgoing,
      },
      dailyStats.remainingCold,
    );

    if (!eligibility.allowed) {
      throw new BadRequestException(
        this.describeOutreachSkip(eligibility.reason),
      );
    }

    const isColdSend = !hasIncoming && isFirstOutgoing;
    if (isColdSend) {
      this.outreachService.validateOutgoingMessage(messageBody, true);
      const reservation = await this.outreachService.reserveColdSendSlot(
        account,
        dto.userId,
        true,
      );
      if (!reservation.reserved) {
        throw new BadRequestException(
          'Daily cold outreach limit reached for this WhatsApp number.',
        );
      }
    }

    const provider = this.providerRegistry.get(ProviderType.WAHA);
    const credentials = {
      apiKey: this.secretVaultService.decrypt(account.apiKey) ?? '',
      apiSecret: this.secretVaultService.decrypt(account.apiSecret),
    };
    const queuedMessage = await this.messagesService.createQueuedOutgoing({
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      phone,
      content: messageBody,
      metadata: {
        source: 'waha-testing',
      },
    });

    try {
      const result = await provider.sendTextMessage({
        account,
        credentials,
        to: phone,
        body: messageBody,
      });

      await this.messagesService.markSent({
        messageId: queuedMessage.id,
        userId: dto.userId,
        whatsappAccountId: account.id,
        provider: ProviderType.WAHA,
        providerMessageId: result.externalMessageId,
        rawResponse: (result.raw ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      });
      await this.conversationsService.touchOutgoing(conversation.id);
      if (lead?.id) {
        await this.leadsService.touchOutgoing(dto.userId, lead.id);
      }

      return {
        sent: true,
        provider: ProviderType.WAHA,
        to: phone,
        providerMessageId: result.externalMessageId ?? null,
        note: 'Keep the same phone actively connected in WAHA. If WhatsApp Web disconnects, sends will fail until you reconnect.',
      };
    } catch (error) {
      await this.messagesService.markFailed(
        queuedMessage.id,
        error instanceof Error ? error.message : String(error),
        { userId: dto.userId, whatsappAccountId: account.id },
      );

      throw new BadRequestException(
        error instanceof Error ? error.message : 'WAHA test send failed.',
      );
    }
  }

  getVoiceApiInfo() {
    return {
      provider: ProviderType.BAILEYS,
      requiresWahaPlus: false,
      baileysTransport: 'WhatsApp Web socket',
      note: 'Voice uses free Baileys. Link a Baileys session by QR, then send OGG/Opus audio as a WhatsApp voice note.',
      documentation: 'https://github.com/WhiskeySockets/Baileys',
      antiBlocking:
        'https://waha.devlike.pro/docs/overview/%EF%B8%8F-how-to-avoid-blocking/',
      routes: {
        sendImmediate: 'POST /whatsapp/voice/send',
        sendImmediateTesting: 'POST /whatsapp/testing/baileys/send-voice',
        status: 'GET /whatsapp/testing/baileys/status',
        qr: 'GET /whatsapp/testing/baileys/qr',
        bootstrap: 'POST /whatsapp/testing/baileys/bootstrap',
        queue: 'POST /whatsapp/voice/queue',
        queueViaSend: 'POST /whatsapp/send (messageType: "voice")',
      },
      body: {
        url: 'Public HTTPS URL to OGG/Opus audio (one of url or data)',
        data: 'Base64-encoded file (one of url or data)',
        filename: 'Optional, used with data',
        mimetype: 'Default: audio/ogg; codecs=opus',
        convert:
          'Accepted for API compatibility; Baileys path expects pre-converted OGG/Opus audio.',
      },
    };
  }

  async queueVoiceMessage(dto: QueueVoiceMessageDto & { userId: string }) {
    return this.queueMessage({
      userId: dto.userId,
      whatsappAccountId: dto.whatsappAccountId,
      phone: dto.phone,
      leadId: dto.leadId,
      messageType: 'voice',
      url: dto.url,
      data: dto.data,
      filename: dto.filename,
      mimetype: dto.mimetype,
      convert: dto.convert,
      scheduleAt: dto.scheduleAt,
    });
  }

  async sendVoiceMessage(
    dto: SendWahaVoiceMessageDto & {
      userId: string;
      whatsappAccountId?: string;
      metadataSource?: string;
    },
  ) {
    return this.sendBaileysVoiceMessage(dto);
  }

  async getBaileysQr(userId: string, sessionName?: string) {
    return this.baileysSessions.getQr(
      this.getUserScopedSessionName(userId, sessionName, 'baileys'),
    );
  }

  async sendBaileysVoiceMessage(
    dto: SendWahaVoiceMessageDto & {
      userId: string;
      whatsappAccountId?: string;
      metadataSource?: string;
    },
  ) {
    let voice;

    try {
      voice = resolveVoiceFile(dto);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid voice input.',
      );
    }

    const account = dto.whatsappAccountId
      ? await this.prisma.whatsAppAccount.findFirst({
          where: {
            id: dto.whatsappAccountId,
            userId: dto.userId,
            provider: ProviderType.BAILEYS,
            isActive: true,
          },
        })
      : await this.prisma.whatsAppAccount.findFirst({
          where: {
            userId: dto.userId,
            provider: ProviderType.BAILEYS,
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    if (!account) {
      throw new NotFoundException(
        dto.whatsappAccountId
          ? `Baileys account ${dto.whatsappAccountId} not found for this user.`
          : 'Baileys account not found. Run POST /whatsapp/testing/baileys/bootstrap first.',
      );
    }

    const phone = normalizePhoneNumber(dto.to);
    const conversation = await this.conversationsService.findOrCreate({
      userId: dto.userId,
      whatsappAccountId: account.id,
      phone,
      lastMessageAt: new Date(),
    });
    const provider = this.providerRegistry.get(ProviderType.BAILEYS);

    if (!provider.sendVoiceMessage) {
      throw new BadRequestException('Voice send is not supported for Baileys.');
    }

    const contentLabel = buildVoiceContentLabel(voice);
    const queuedMessage = await this.messagesService.createQueuedOutgoing({
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      phone,
      content: contentLabel,
      metadata: buildVoiceMessageMetadata(
        voice,
        dto.metadataSource ?? 'baileys-api',
      ) as Prisma.InputJsonValue,
    });

    try {
      const result = await provider.sendVoiceMessage({
        account,
        credentials: { apiKey: '' },
        to: phone,
        ...voice,
      });

      await this.messagesService.markSent({
        messageId: queuedMessage.id,
        userId: dto.userId,
        whatsappAccountId: account.id,
        provider: ProviderType.BAILEYS,
        providerMessageId: result.externalMessageId,
        rawResponse: (result.raw ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      });
      await this.conversationsService.touchOutgoing(conversation.id);

      return {
        sent: true,
        provider: ProviderType.BAILEYS,
        to: phone,
        providerMessageId: result.externalMessageId ?? null,
        note: 'Voice sent via Baileys as a WhatsApp Web voice note. Use OGG/Opus for best compatibility.',
      };
    } catch (error) {
      await this.messagesService.markFailed(
        queuedMessage.id,
        error instanceof Error ? error.message : String(error),
        { userId: dto.userId, whatsappAccountId: account.id },
      );

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Baileys voice send failed.',
      );
    }
  }

  async sendBaileysScriptVoiceMessage(
    dto: SendBaileysScriptVoiceMessageDto & {
      userId: string;
      whatsappAccountId?: string;
      metadataSource?: string;
    },
  ) {
    const message = dto.message.trim();

    if (!message) {
      throw new BadRequestException('Message text is required for TTS voice.');
    }

    const audio = await this.generateSpeechAudio({
      text: message,
      voice: dto.voice,
    });

    return this.sendBaileysVoiceMessage({
      userId: dto.userId,
      to: dto.to,
      whatsappAccountId: dto.whatsappAccountId,
      data: audio.buffer.toString('base64'),
      filename: audio.filename,
      mimetype: audio.mimetype,
      convert: false,
      metadataSource: dto.metadataSource ?? 'baileys-script-voice',
    });
  }

  private async generateSpeechAudio(input: { text: string; voice?: string }) {
    const { tts } = await import('edge-tts/out/index.js');
    const voice =
      input.voice?.trim() ||
      this.configService.get<string>('EDGE_TTS_VOICE')?.trim() ||
      'en-US-GuyNeural';

    try {
      const result = await tts(input.text, {
        voice,
        rate: this.configService.get<string>('EDGE_TTS_RATE')?.trim() || '+0%',
        pitch:
          this.configService.get<string>('EDGE_TTS_PITCH')?.trim() || '+0Hz',
        volume:
          this.configService.get<string>('EDGE_TTS_VOLUME')?.trim() || '+0%',
      });
      const buffer = Buffer.isBuffer(result) ? result : Buffer.from(result);

      return this.convertAudioToWhatsAppVoice(buffer, 'mp3');
    } catch (error) {
      const shouldTryWindowsFallback = process.platform === 'win32';

      if (!shouldTryWindowsFallback) {
        throw new BadRequestException(
          `Text-to-speech generation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      return this.generateWindowsSpeechAudio(input.text, error);
    }
  }

  private async generateWindowsSpeechAudio(
    text: string,
    originalError: unknown,
  ) {
    const workdir = await mkdtemp(join(tmpdir(), 'whatsapp-agent-tts-'));
    const inputPath = join(workdir, 'script.txt');
    const outputPath = join(workdir, 'voice.wav');
    const script = [
      '$ErrorActionPreference = "Stop"',
      'Add-Type -AssemblyName System.Speech',
      `$text = Get-Content -Raw -LiteralPath '${inputPath.replace(/'/g, "''")}'`,
      '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      `$synth.SetOutputToWaveFile('${outputPath.replace(/'/g, "''")}')`,
      '$synth.Speak($text)',
      '$synth.Dispose()',
    ].join('; ');

    try {
      await writeFile(inputPath, text, 'utf8');
      await execFileAsync(
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { timeout: 60_000, windowsHide: true },
      );

      return this.convertAudioToWhatsAppVoice(
        await readFile(outputPath),
        'wav',
      );
    } catch (fallbackError) {
      throw new BadRequestException(
        `Text-to-speech generation failed. Edge TTS said: ${
          originalError instanceof Error
            ? originalError.message
            : String(originalError)
        }. Windows fallback said: ${
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError)
        }`,
      );
    } finally {
      await rm(workdir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  private async convertAudioToWhatsAppVoice(
    input: Buffer,
    inputExtension: 'mp3' | 'wav',
  ) {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as {
      path: string;
    };
    const workdir = await mkdtemp(join(tmpdir(), 'whatsapp-agent-voice-'));
    const inputPath = join(workdir, `input.${inputExtension}`);
    const outputPath = join(workdir, 'voice.ogg');

    try {
      await writeFile(inputPath, input);
      await execFileAsync(
        ffmpegInstaller.path,
        [
          '-y',
          '-i',
          inputPath,
          '-vn',
          '-acodec',
          'libopus',
          '-b:a',
          '32k',
          '-ar',
          '48000',
          '-ac',
          '1',
          outputPath,
        ],
        { timeout: 60_000, windowsHide: true },
      );

      return {
        buffer: await readFile(outputPath),
        filename: `generated-script-voice-${randomUUID()}.ogg`,
        mimetype: 'audio/ogg; codecs=opus',
      };
    } catch (error) {
      throw new BadRequestException(
        `Audio conversion to WhatsApp voice format failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await rm(workdir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  async sendWahaVoiceMessage(
    dto: SendWahaVoiceMessageDto & {
      userId: string;
      whatsappAccountId?: string;
      metadataSource?: string;
    },
  ) {
    let voice;

    try {
      voice = resolveVoiceFile(dto);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid voice input.',
      );
    }

    const account = dto.whatsappAccountId
      ? await this.prisma.whatsAppAccount.findFirst({
          where: {
            id: dto.whatsappAccountId,
            userId: dto.userId,
            provider: ProviderType.WAHA,
            isActive: true,
          },
        })
      : await this.prisma.whatsAppAccount.findFirst({
          where: {
            userId: dto.userId,
            provider: ProviderType.WAHA,
            isActive: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

    if (!account) {
      throw new NotFoundException(
        dto.whatsappAccountId
          ? `WAHA account ${dto.whatsappAccountId} not found for this user.`
          : 'WAHA account not found. Run POST /whatsapp/testing/waha/bootstrap first.',
      );
    }

    const phone = normalizePhoneNumber(dto.to);
    const conversation = await this.conversationsService.findOrCreate({
      userId: dto.userId,
      whatsappAccountId: account.id,
      phone,
      lastMessageAt: new Date(),
    });
    const provider = this.providerRegistry.get(ProviderType.WAHA);

    if (!provider.sendVoiceMessage) {
      throw new BadRequestException('Voice send is not supported for WAHA.');
    }

    const credentials = {
      apiKey: this.secretVaultService.decrypt(account.apiKey) ?? '',
      apiSecret: this.secretVaultService.decrypt(account.apiSecret),
    };
    const contentLabel = buildVoiceContentLabel(voice);
    const queuedMessage = await this.messagesService.createQueuedOutgoing({
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      phone,
      content: contentLabel,
      metadata: buildVoiceMessageMetadata(
        voice,
        dto.metadataSource ?? 'api',
      ) as Prisma.InputJsonValue,
    });

    try {
      const result = await provider.sendVoiceMessage({
        account,
        credentials,
        to: phone,
        ...voice,
      });

      await this.messagesService.markSent({
        messageId: queuedMessage.id,
        userId: dto.userId,
        whatsappAccountId: account.id,
        provider: ProviderType.WAHA,
        providerMessageId: result.externalMessageId,
        rawResponse: (result.raw ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      });
      await this.conversationsService.touchOutgoing(conversation.id);

      return {
        sent: true,
        provider: ProviderType.WAHA,
        to: phone,
        providerMessageId: result.externalMessageId ?? null,
        note: 'Voice sent via WAHA POST /api/sendVoice. Use Opus format or set convert:true for other formats.',
      };
    } catch (error) {
      await this.messagesService.markFailed(
        queuedMessage.id,
        error instanceof Error ? error.message : String(error),
        { userId: dto.userId, whatsappAccountId: account.id },
      );

      throw new BadRequestException(
        error instanceof Error ? error.message : 'WAHA voice send failed.',
      );
    }
  }

  async sendWahaBulkMessage(dto: SendWahaBulkMessageDto & { userId: string }) {
    const campaignId = randomUUID();
    const messageType = resolveOutgoingMessageType(dto.messageType);
    const expectedProvider =
      messageType === 'voice' ? ProviderType.BAILEYS : ProviderType.WAHA;
    const account = await this.resolveUserWhatsAppAccount(dto.userId, {
      whatsappAccountId: dto.whatsappAccountId,
      provider: expectedProvider,
    });

    let bulkVoice: ReturnType<typeof resolveVoiceFile> | null = null;

    if (messageType === 'voice') {
      try {
        bulkVoice = resolveVoiceFile(dto);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid voice input.',
        );
      }
    } else if (!dto.messageTemplate?.trim()) {
      throw new BadRequestException('Message template is required.');
    }

    if (dto.maxDelaySeconds < dto.minDelaySeconds) {
      throw new BadRequestException(
        'maxDelaySeconds must be greater than or equal to minDelaySeconds.',
      );
    }

    this.outreachService.assertMinBulkDelay(
      dto.minDelaySeconds,
      dto.maxDelaySeconds,
    );

    const uniqueLeadIds = [
      ...new Set(dto.leadIds.map((id) => id.trim())),
    ].filter(Boolean);

    const leads = await this.prisma.lead.findMany({
      where: {
        userId: dto.userId,
        id: {
          in: uniqueLeadIds,
        },
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (leads.length === 0) {
      throw new NotFoundException(
        'No matching contacts were found for bulk send.',
      );
    }

    const contactableLeads = leads.filter(
      (lead): lead is Lead & { phone: string } => Boolean(lead.phone),
    );

    if (contactableLeads.length === 0) {
      throw new BadRequestException(
        'Selected leads do not have phone numbers for WhatsApp outreach.',
      );
    }

    const includePreviouslyContacted = dto.includePreviouslyContacted ?? true;
    const contactInsightsByPhone =
      await this.leadsService.findContactInsightsByPhones(
        dto.userId,
        contactableLeads.map((lead) => lead.phone),
      );
    const leadById = new Map(contactableLeads.map((lead) => [lead.id, lead]));
    const scheduled: Array<{
      leadId: string;
      name: string | null;
      phone: string;
      scheduledFor: string;
      delaySeconds: number;
      jobId: string;
      messageId: string;
      website: string | null;
      seoPoint: string;
      messagePreview: string;
    }> = [];
    const skippedAlreadyContacted: Array<{
      leadId: string;
      name: string | null;
      phone: string;
      contactedAt: string | null;
      latestOutgoingStatus: string | null;
    }> = [];
    const skippedNoIncoming: Array<{
      leadId: string;
      name: string | null;
      phone: string;
    }> = [];
    const skippedDailyCap: Array<{
      leadId: string;
      name: string | null;
      phone: string;
    }> = [];
    const skippedMessageTooLong: Array<{
      leadId: string;
      name: string | null;
      phone: string;
    }> = [];
    const skippedRecentlyContacted: Array<{
      leadId: string;
      name: string | null;
      phone: string;
    }> = [];
    const skippedBlocked: Array<{
      leadId: string;
      name: string | null;
      phone: string;
    }> = [];

    const enableSeoResearch =
      messageType === 'voice' ? false : (dto.enableSeoResearch ?? true);
    const messageTemplates =
      messageType === 'voice'
        ? []
        : [dto.messageTemplate ?? '', ...(dto.messageVariants ?? [])].filter(
            (template): template is string => Boolean(template?.trim().length),
          );
    const voiceContentLabel = bulkVoice
      ? buildVoiceContentLabel(bulkVoice)
      : null;
    let nextRunAt = new Date();
    const dailyStats = await this.outreachService.getDailyStats(
      account.id,
      dto.userId,
    );
    let remainingCold = dailyStats.remainingCold;
    const orderedLeads = sortLeadsByAreaCodeProximity(
      uniqueLeadIds
        .map((leadId) => leadById.get(leadId))
        .filter((lead): lead is Lead & { phone: string } => Boolean(lead)),
      account.phoneNumber,
    );

    for (const lead of orderedLeads) {
      const contactInsight =
        contactInsightsByPhone.get(lead.phone) ??
        (await this.leadsService.findContactInsightByPhone(
          dto.userId,
          lead.phone,
        ));
      const hasIncoming = Boolean(contactInsight.hasIncoming);
      const isFirstOutgoing = contactInsight.contactState !== 'CONTACTED';

      if (
        !includePreviouslyContacted &&
        contactInsight.contactState === 'CONTACTED'
      ) {
        skippedAlreadyContacted.push({
          leadId: lead.id,
          name: lead.name ?? null,
          phone: lead.phone,
          contactedAt: contactInsight.contactedAt?.toISOString() ?? null,
          latestOutgoingStatus: contactInsight.latestOutgoingStatus ?? null,
        });
        continue;
      }

      const seoResearch =
        messageType === 'voice'
          ? this.buildFallbackSeoResearch(lead, dto.fallbackSeoPoint)
          : enableSeoResearch
            ? await this.researchLeadSeo(lead, dto.fallbackSeoPoint)
            : this.buildFallbackSeoResearch(lead, dto.fallbackSeoPoint);
      const renderedMessage =
        messageType === 'voice'
          ? (voiceContentLabel ?? '[voice]')
          : this.renderWahaBulkMessage({
              lead,
              seoResearch,
              templates: messageTemplates,
            });

      const eligibility = this.outreachService.evaluateEligibility(
        {
          hasIncoming,
          hasOutgoing: !isFirstOutgoing,
          optIn: true,
          warmUpStatus: lead?.warmUpStatus ?? 'PENDING',
          lastOutgoingAt: lead?.lastOutgoingAt ?? contactInsight.contactedAt,
          messageBody: renderedMessage,
          isFirstOutgoing,
        },
        remainingCold,
      );

      if (!eligibility.allowed) {
        const skipEntry = {
          leadId: lead.id,
          name: lead.name ?? null,
          phone: lead.phone,
        };

        switch (eligibility.reason) {
          case 'no_incoming':
            skippedNoIncoming.push(skipEntry);
            break;
          case 'daily_cap':
            skippedDailyCap.push(skipEntry);
            break;
          case 'message_too_long':
          case 'url_in_first_message':
            skippedMessageTooLong.push(skipEntry);
            break;
          case 'recently_contacted':
            skippedRecentlyContacted.push(skipEntry);
            break;
          case 'blocked':
            skippedBlocked.push(skipEntry);
            break;
          default:
            break;
        }
        continue;
      }

      const isColdSend = !hasIncoming && isFirstOutgoing;
      if (isColdSend) {
        const reservation = await this.outreachService.reserveColdSendSlot(
          account,
          dto.userId,
          isFirstOutgoing,
        );
        if (!reservation.reserved) {
          skippedDailyCap.push({
            leadId: lead.id,
            name: lead.name ?? null,
            phone: lead.phone,
          });
          continue;
        }
        remainingCold = reservation.remaining;
      }

      const delaySeconds = this.randomIntInclusive(
        dto.minDelaySeconds,
        dto.maxDelaySeconds,
      );
      nextRunAt = new Date(nextRunAt.getTime() + delaySeconds * 1000);

      const queued = await this.queueMessage({
        userId: dto.userId,
        whatsappAccountId: account.id,
        leadId: lead.id,
        phone: lead.phone,
        messageType,
        campaignId,
        outreachPreapproved: true,
        ...(messageType === 'voice' && bulkVoice
          ? {
              url: bulkVoice.url,
              data: bulkVoice.data,
              filename: bulkVoice.filename,
              mimetype: bulkVoice.mimetype,
              convert: bulkVoice.convert,
            }
          : { message: renderedMessage }),
        scheduleAt: nextRunAt.toISOString(),
      });

      scheduled.push({
        leadId: lead.id,
        name: lead.name ?? null,
        phone: lead.phone,
        scheduledFor: queued.scheduledFor,
        delaySeconds,
        jobId: queued.jobId,
        messageId: queued.messageId,
        website: messageType === 'text' ? seoResearch.website : null,
        seoPoint: messageType === 'text' ? seoResearch.point : '',
        messagePreview: this.truncateText(renderedMessage, 180),
      });
    }

    const skippedNotes: string[] = [];
    if (skippedAlreadyContacted.length > 0) {
      skippedNotes.push(
        `${skippedAlreadyContacted.length} already-contacted contact(s)`,
      );
    }
    if (skippedNoIncoming.length > 0) {
      skippedNotes.push(
        `${skippedNoIncoming.length} without incoming message(s)`,
      );
    }
    if (skippedDailyCap.length > 0) {
      skippedNotes.push(`${skippedDailyCap.length} over daily cap`);
    }
    if (skippedMessageTooLong.length > 0) {
      skippedNotes.push(
        `${skippedMessageTooLong.length} first-message rule violation(s)`,
      );
    }
    if (skippedRecentlyContacted.length > 0) {
      skippedNotes.push(
        `${skippedRecentlyContacted.length} recently contacted`,
      );
    }
    if (skippedBlocked.length > 0) {
      skippedNotes.push(`${skippedBlocked.length} blocked contact(s)`);
    }

    const outreachSummary = {
      eligible: scheduled.length,
      skippedNoIncoming,
      skippedDailyCap,
      skippedMessageTooLong,
      skippedRecentlyContacted,
      skippedBlocked,
      remainingCold,
      maxDailyCold: dailyStats.maxDailyCold,
    };

    if (scheduled.length === 0) {
      return {
        queued: 0,
        minDelaySeconds: dto.minDelaySeconds,
        maxDelaySeconds: dto.maxDelaySeconds,
        campaignId,
        messageType,
        seoResearchEnabled: enableSeoResearch,
        includePreviouslyContacted,
        contacts: [],
        skippedAlreadyContacted,
        skippedNotOptedIn: [],
        outreachSummary,
        note:
          skippedNotes.length > 0
            ? `No contacts were queued. Skipped ${skippedNotes.join(', ')}.`
            : 'No contacts were queued.',
      };
    }

    return {
      queued: scheduled.length,
      campaignId,
      messageType,
      minDelaySeconds: dto.minDelaySeconds,
      maxDelaySeconds: dto.maxDelaySeconds,
      seoResearchEnabled: enableSeoResearch,
      includePreviouslyContacted,
      contacts: scheduled,
      skippedAlreadyContacted,
      skippedNotOptedIn: [],
      outreachSummary,
      note: `Queued ${scheduled.length} contact(s). Each message waits a random ${dto.minDelaySeconds}-${dto.maxDelaySeconds} seconds before sending.${enableSeoResearch ? ' Website SEO research was used when a lead website was available.' : ''}${skippedNotes.length > 0 ? ` Skipped ${skippedNotes.join(', ')}.` : ''}`,
    };
  }

  async getBulkCampaignProgress(userId: string, campaignId?: string) {
    const recentJobs = await this.prisma.job.findMany({
      where: {
        userId,
        type: JobType.SEND_WHATSAPP,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000,
      include: {
        lead: true,
      },
    });

    const jobsWithCampaign = recentJobs
      .map((job) => ({
        job,
        payload: job.payload as Record<string, unknown>,
      }))
      .filter(({ payload }) => typeof payload.campaignId === 'string');
    const resolvedCampaignId =
      campaignId?.trim() ||
      (jobsWithCampaign[0]?.payload.campaignId as string | undefined);

    if (!resolvedCampaignId) {
      return {
        campaignId: null,
        total: 0,
        queued: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        contacts: [],
      };
    }

    const campaignJobs = jobsWithCampaign
      .filter(({ payload }) => payload.campaignId === resolvedCampaignId)
      .map(({ job, payload }) => ({ job, payload }))
      .sort(
        (left, right) => left.job.runAt.getTime() - right.job.runAt.getTime(),
      );
    const messageIds = campaignJobs
      .map(({ payload }) => payload.messageId)
      .filter((id): id is string => typeof id === 'string');
    const messages = await this.prisma.message.findMany({
      where: {
        id: {
          in: messageIds,
        },
      },
      select: {
        id: true,
        status: true,
        providerMessageId: true,
        updatedAt: true,
      },
    });
    const messageById = new Map(
      messages.map((message) => [message.id, message]),
    );
    const contacts = campaignJobs.map(({ job, payload }) => {
      const messageId =
        typeof payload.messageId === 'string' ? payload.messageId : null;
      const message = messageId ? messageById.get(messageId) : null;

      return {
        jobId: job.id,
        messageId,
        leadId: job.leadId,
        name: job.lead?.name ?? null,
        phone:
          typeof payload.phone === 'string'
            ? payload.phone
            : (job.lead?.phone ?? ''),
        scheduledFor: job.runAt.toISOString(),
        jobStatus: job.status,
        messageStatus: message?.status ?? null,
        providerMessageId: message?.providerMessageId ?? null,
        lastError: job.lastError,
        updatedAt: (message?.updatedAt ?? job.updatedAt).toISOString(),
      };
    });

    const sent = contacts.filter(
      (contact) =>
        contact.messageStatus === MessageStatus.SENT ||
        contact.messageStatus === MessageStatus.DELIVERED ||
        contact.messageStatus === MessageStatus.READ ||
        contact.jobStatus === JobStatus.DONE,
    ).length;
    const failed = contacts.filter(
      (contact) =>
        contact.messageStatus === MessageStatus.FAILED ||
        contact.jobStatus === JobStatus.FAILED,
    ).length;
    const processing = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.PROCESSING,
    ).length;
    const pending = contacts.filter(
      (contact) => contact.jobStatus === JobStatus.PENDING,
    ).length;

    return {
      campaignId: resolvedCampaignId,
      total: contacts.length,
      queued: contacts.length,
      processing,
      sent,
      failed,
      pending,
      contacts,
    };
  }

  async stopBulkCampaign(userId: string, campaignId?: string) {
    const resolvedCampaignId = campaignId?.trim();

    if (!resolvedCampaignId) {
      throw new BadRequestException('campaignId is required.');
    }

    const jobs = await this.prisma.job.findMany({
      where: {
        userId,
        type: JobType.SEND_WHATSAPP,
        status: JobStatus.PENDING,
      },
      select: {
        id: true,
        payload: true,
      },
    });
    const matchingJobs = jobs.filter((job) => {
      const payload = job.payload as Record<string, unknown>;
      return payload.campaignId === resolvedCampaignId;
    });
    const messageIds = matchingJobs
      .map((job) => (job.payload as Record<string, unknown>).messageId)
      .filter((id): id is string => typeof id === 'string');

    if (matchingJobs.length > 0) {
      await this.prisma.job.updateMany({
        where: {
          id: {
            in: matchingJobs.map((job) => job.id),
          },
          userId,
          status: JobStatus.PENDING,
        },
        data: {
          status: JobStatus.FAILED,
          lastError: 'Campaign stopped by user.',
          lockedAt: null,
        },
      });
    }

    if (messageIds.length > 0) {
      await this.prisma.message.updateMany({
        where: {
          id: {
            in: messageIds,
          },
          status: MessageStatus.QUEUED,
        },
        data: {
          status: MessageStatus.FAILED,
          metadata: {
            stoppedReason: 'Campaign stopped by user.',
          },
        },
      });
    }

    return {
      campaignId: resolvedCampaignId,
      stopped: matchingJobs.length,
      note:
        matchingJobs.length > 0
          ? `Stopped ${matchingJobs.length} pending message(s).`
          : 'No pending messages were left to stop.',
    };
  }

  async sendTwilioTestMessage(
    dto: SendTwilioTestMessageDto & { userId: string },
  ) {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        userId: dto.userId,
        provider: ProviderType.TWILIO,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!account) {
      throw new NotFoundException(
        'Twilio account not found. Run POST /whatsapp/testing/twilio/bootstrap first.',
      );
    }

    const phone = normalizePhoneNumber(dto.to);
    const conversation = await this.conversationsService.findOrCreate({
      userId: dto.userId,
      whatsappAccountId: account.id,
      phone,
      lastMessageAt: new Date(),
    });
    const provider = this.providerRegistry.get(ProviderType.TWILIO);
    const credentials = {
      apiKey: this.secretVaultService.decrypt(account.apiKey) ?? '',
      apiSecret: this.secretVaultService.decrypt(account.apiSecret),
    };

    if (!credentials.apiKey || !account.businessAccountId) {
      throw new BadRequestException(
        'Twilio auth token or account SID is missing from the saved account.',
      );
    }

    const messageBody =
      dto.message?.trim() || 'Twilio WhatsApp test message from your backend.';
    const queuedMessage = await this.messagesService.createQueuedOutgoing({
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      phone,
      content: messageBody,
      metadata: {
        source: 'twilio-testing',
      },
    });

    try {
      const result = await provider.sendTextMessage({
        account,
        credentials,
        to: phone,
        body: messageBody,
      });

      await this.messagesService.markSent({
        messageId: queuedMessage.id,
        userId: dto.userId,
        whatsappAccountId: account.id,
        provider: ProviderType.TWILIO,
        providerMessageId: result.externalMessageId,
        rawResponse: (result.raw ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      });
      await this.conversationsService.touchOutgoing(conversation.id);

      return {
        sent: true,
        provider: ProviderType.TWILIO,
        to: phone,
        providerMessageId: result.externalMessageId ?? null,
        note: this.isTwilioSandboxAccount(account)
          ? 'Sandbox recipients must first send "join <your sandbox code>" to +14155238886 and keep the 24-hour window active.'
          : 'If this is a production sender, make sure the recipient has opted in and your template policy is satisfied when required.',
      };
    } catch (error) {
      await this.messagesService.markFailed(
        queuedMessage.id,
        error instanceof Error ? error.message : String(error),
        { userId: dto.userId, whatsappAccountId: account.id },
      );

      throw new BadRequestException(
        error instanceof Error ? error.message : 'Twilio test send failed.',
      );
    }
  }

  async queueMessage(dto: SendWhatsAppMessageDto & { userId: string }) {
    const phone = normalizePhoneNumber(dto.phone);
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        id: dto.whatsappAccountId,
        userId: dto.userId,
      },
    });

    if (!account) {
      throw new NotFoundException('WhatsApp account not found.');
    }

    const lead = dto.leadId
      ? await this.prisma.lead.findFirst({
          where: {
            id: dto.leadId,
            userId: dto.userId,
            isDeleted: false,
          },
        })
      : await this.leadsService.findByPhone(dto.userId, phone);

    const conversation = await this.conversationsService.findOrCreate({
      userId: dto.userId,
      whatsappAccountId: account.id,
      phone,
      leadId: lead?.id,
      lastMessageAt: new Date(),
    });

    const messageType = resolveOutgoingMessageType(dto.messageType);
    let content = dto.message ?? '';
    let metadata: Prisma.InputJsonValue = {
      source: 'api',
      ...(dto.campaignId ? { campaignId: dto.campaignId } : {}),
    };

    if (messageType === 'voice') {
      if (dto.templateId) {
        throw new BadRequestException(
          'Templates cannot be used with voice messages.',
        );
      }

      if (
        account.provider !== ProviderType.WAHA &&
        account.provider !== ProviderType.BAILEYS
      ) {
        throw new BadRequestException(
          'Voice messages are only supported for Baileys or WAHA accounts.',
        );
      }

      let voice;
      try {
        voice = resolveVoiceFile(dto);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid voice input.',
        );
      }

      content = buildVoiceContentLabel(voice);
      metadata = {
        ...(buildVoiceMessageMetadata(voice, 'api') as Record<string, unknown>),
        ...(dto.campaignId ? { campaignId: dto.campaignId } : {}),
      } as Prisma.InputJsonValue;
    } else {
      if (dto.templateId) {
        const rendered = await this.templatesService.renderTemplateForMessage(
          dto.userId,
          dto.templateId,
          dto.variables,
        );
        content = rendered.content;
      }

      if (!content.trim()) {
        throw new BadRequestException('Message content is required.');
      }
    }

    if (
      !dto.outreachPreapproved &&
      (account.provider === ProviderType.WAHA ||
        account.provider === ProviderType.BAILEYS)
    ) {
      const contactInsight = await this.leadsService.findContactInsightByPhone(
        dto.userId,
        phone,
      );
      const hasIncoming = Boolean(
        contactInsight.hasIncoming || conversation.lastIncomingAt,
      );
      const isFirstOutgoing = contactInsight.contactState !== 'CONTACTED';
      const dailyStats = await this.outreachService.getDailyStats(
        account.id,
        dto.userId,
      );

      const eligibility = this.outreachService.evaluateEligibility(
        {
          hasIncoming,
          hasOutgoing: !isFirstOutgoing,
          optIn: true,
          warmUpStatus: lead?.warmUpStatus ?? 'PENDING',
          lastOutgoingAt: lead?.lastOutgoingAt ?? contactInsight.contactedAt,
          messageBody: content,
          isFirstOutgoing,
        },
        dailyStats.remainingCold,
      );

      if (!eligibility.allowed) {
        throw new BadRequestException(
          this.describeOutreachSkip(eligibility.reason),
        );
      }

      const isColdSend = !hasIncoming && isFirstOutgoing;
      if (isColdSend && messageType === 'text') {
        this.outreachService.validateOutgoingMessage(content, true);
        const reservation = await this.outreachService.reserveColdSendSlot(
          account,
          dto.userId,
          isFirstOutgoing,
        );
        if (!reservation.reserved) {
          throw new BadRequestException(
            'Daily cold outreach limit reached for this WhatsApp number.',
          );
        }
      }
    }

    const queuedMessage = await this.messagesService.createQueuedOutgoing({
      conversationId: conversation.id,
      whatsappAccountId: account.id,
      templateId: messageType === 'text' ? dto.templateId : undefined,
      phone,
      content,
      metadata,
    });

    const runAt = dto.scheduleAt ? new Date(dto.scheduleAt) : new Date();
    const job = await this.jobsService.enqueueSendWhatsApp(
      {
        userId: dto.userId,
        whatsappAccountId: account.id,
        conversationId: conversation.id,
        leadId: lead?.id,
        messageId: queuedMessage.id,
        phone,
        messageType,
        campaignId: dto.campaignId,
        templateId: messageType === 'text' ? dto.templateId : undefined,
        templateVariables: dto.variables,
      },
      runAt,
    );

    return {
      queued: true,
      messageType,
      provider: account.provider,
      providerAdvice:
        account.provider === ProviderType.WAHA
          ? 'WAHA is the free self-hosted path using a WhatsApp Web-style session.'
          : account.provider === ProviderType.BAILEYS
            ? 'Baileys is the free WhatsApp Web socket path and supports voice notes without WAHA Plus.'
            : account.provider === ProviderType.TWILIO
              ? 'Twilio is the easiest path for sandbox testing and then upgrading to your own sender.'
              : account.provider === ProviderType.META_CLOUD
                ? 'Meta Cloud API is the direct official low-cost path.'
                : 'Supported via adapter. Confirm provider template policy before campaign launch.',
      conversationId: conversation.id,
      messageId: queuedMessage.id,
      jobId: job.id,
      campaignId: dto.campaignId ?? null,
      scheduledFor: runAt.toISOString(),
    };
  }

  private sanitizeAccount<
    T extends { apiKey: string; apiSecret: string | null },
  >(account: T) {
    const { apiKey, apiSecret, ...safeAccount } = account;
    return {
      ...safeAccount,
      hasApiKey: Boolean(apiKey),
      hasApiSecret: Boolean(apiSecret),
    };
  }

  private resolveMetaProfile(profile?: string): MetaProfile {
    const candidate = (
      profile ||
      this.configService.get<string>('META_WHATSAPP_ACTIVE_PROFILE') ||
      'TEST'
    ).toUpperCase();

    return candidate === 'LIVE' ? 'LIVE' : 'TEST';
  }

  private getWahaConfig(userId?: string): WahaConfig {
    const suffix = userId
      ?.replace(/^user-/, '')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    const userBaseUrl = suffix
      ? this.configService.get<string>(`WAHA_BASE_URL_${suffix}`)?.trim()
      : undefined;
    const userApiKey = suffix
      ? this.configService.get<string>(`WAHA_API_KEY_${suffix}`)?.trim()
      : undefined;
    const userSessionName = suffix
      ? this.configService.get<string>(`WAHA_SESSION_NAME_${suffix}`)?.trim()
      : undefined;

    return {
      baseUrl:
        userBaseUrl?.replace(/\/$/, '') ||
        this.configService
          .get<string>('WAHA_BASE_URL')
          ?.trim()
          ?.replace(/\/$/, '') ||
        '',
      apiKey:
        userApiKey ||
        this.configService.get<string>('WAHA_API_KEY')?.trim() ||
        '',
      sessionName:
        userSessionName ||
        this.configService.get<string>('WAHA_SESSION_NAME')?.trim() ||
        'default',
      usesDedicatedBaseUrl: Boolean(userBaseUrl),
      webhookSecret:
        this.configService.get<string>('WAHA_WEBHOOK_SECRET')?.trim() || '',
      userId,
    };
  }

  private resolveWahaSessionName(
    userId: string | undefined,
    requestedSessionName: string | undefined,
    config: WahaConfig,
  ) {
    if (config.usesDedicatedBaseUrl) {
      return requestedSessionName?.trim() || config.sessionName;
    }

    return this.getUserScopedSessionName(
      userId,
      requestedSessionName,
      config.sessionName,
    );
  }

  private getUserScopedSessionName(
    userId: string | undefined,
    requestedSessionName: string | undefined,
    fallbackSessionName: string,
  ) {
    const base =
      requestedSessionName?.trim() || fallbackSessionName || 'default';
    const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
    const safeUserId = userId?.replace(/[^a-zA-Z0-9_-]/g, '_');

    return safeUserId ? `${safeBase}_${safeUserId}` : safeBase;
  }

  private getTwilioConfig() {
    return {
      accountSid:
        this.configService.get<string>('TWILIO_ACCOUNT_SID')?.trim() || '',
      authToken:
        this.configService.get<string>('TWILIO_AUTH_TOKEN')?.trim() || '',
      fromPhoneNumber:
        this.configService.get<string>('TWILIO_WHATSAPP_FROM')?.trim() || '',
      sandboxJoinCode:
        this.configService.get<string>('TWILIO_SANDBOX_JOIN_CODE')?.trim() ||
        '',
    };
  }

  private getMetaProfileConfig(profile: MetaProfile) {
    const profilePrefix = `META_WHATSAPP_${profile}_`;

    return {
      accessToken:
        this.configService
          .get<string>(`${profilePrefix}ACCESS_TOKEN`)
          ?.trim() ||
        this.configService.get<string>('META_WHATSAPP_ACCESS_TOKEN')?.trim() ||
        '',
      appSecret:
        this.configService.get<string>(`${profilePrefix}APP_SECRET`)?.trim() ||
        this.configService.get<string>('META_WHATSAPP_APP_SECRET')?.trim() ||
        '',
      verifyToken:
        this.configService
          .get<string>(`${profilePrefix}VERIFY_TOKEN`)
          ?.trim() ||
        this.configService.get<string>('META_WHATSAPP_VERIFY_TOKEN')?.trim() ||
        '',
      phoneNumberId:
        this.configService
          .get<string>(`${profilePrefix}PHONE_NUMBER_ID`)
          ?.trim() ||
        this.configService
          .get<string>('META_WHATSAPP_PHONE_NUMBER_ID')
          ?.trim() ||
        '',
      businessPhoneNumber:
        this.configService
          .get<string>(`${profilePrefix}BUSINESS_PHONE_NUMBER`)
          ?.trim() ||
        this.configService
          .get<string>('META_WHATSAPP_BUSINESS_PHONE_NUMBER')
          ?.trim() ||
        '',
    };
  }

  private getRequiredMetaRegistrationConfig(profile?: string) {
    const resolvedProfile = this.resolveMetaProfile(profile);
    const config = this.getMetaProfileConfig(resolvedProfile);
    const accessToken = config.accessToken;
    const phoneNumberId = config.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      throw new BadRequestException(
        `The active ${resolvedProfile.toLowerCase()} Meta profile is missing access token or phone number id.`,
      );
    }

    return {
      resolvedProfile,
      config,
      accessToken,
      phoneNumberId,
    };
  }

  private isTwilioSandboxNumber(phoneNumber?: string) {
    if (!phoneNumber?.trim()) {
      return false;
    }

    return normalizePhoneNumber(phoneNumber) === '+14155238886';
  }

  private isTwilioSandboxAccount(account: {
    phoneNumber: string;
    metadata?: Prisma.JsonValue | null;
  }) {
    if (this.isTwilioSandboxNumber(account.phoneNumber)) {
      return true;
    }

    const metadata =
      account.metadata && typeof account.metadata === 'object'
        ? (account.metadata as Record<string, unknown>)
        : null;

    return metadata?.mode === 'twilio-sandbox';
  }

  private getMetaRegistrationProvider(): MetaRegistrationProvider {
    const provider = this.providerRegistry.get(ProviderType.META_CLOUD);

    if (
      !provider.requestVerificationCode ||
      !provider.verifyCode ||
      !provider.registerPhone
    ) {
      throw new BadRequestException(
        'Meta Cloud provider does not support phone registration actions.',
      );
    }

    return provider as MetaRegistrationProvider;
  }

  private async upsertConfiguredMetaAccount(input: {
    userId: string;
    profile: MetaProfile;
    accessToken: string;
    appSecret: string;
    phoneNumberId: string;
    verifyToken: string;
    businessPhoneNumber: string;
    webhookBaseUrl?: string;
    metadata?: Record<string, string>;
  }) {
    const businessPhoneNumber = normalizePhoneNumber(input.businessPhoneNumber);

    const account = await this.connectAccount({
      userId: input.userId,
      phoneNumber: businessPhoneNumber,
      provider: ProviderType.META_CLOUD,
      apiKey: input.accessToken,
      apiSecret: input.appSecret,
      businessAccountId: input.phoneNumberId,
      webhookVerifyToken: input.verifyToken,
      webhookUrl: input.webhookBaseUrl
        ? `${input.webhookBaseUrl.replace(/\/$/, '')}/webhooks/whatsapp/meta-cloud`
        : '/webhooks/whatsapp/meta-cloud',
      metadata: {
        phoneNumberId: input.phoneNumberId,
        profile: input.profile,
        ...(input.metadata ?? {}),
      },
      isActive: true,
    });

    const storedAccount = await this.prisma.whatsAppAccount.findFirstOrThrow({
      where: {
        userId: input.userId,
        phoneNumber: businessPhoneNumber,
        provider: ProviderType.META_CLOUD,
      },
    });

    const template = await this.prisma.template.upsert({
      where: {
        userId_name: {
          userId: input.userId,
          name: 'hello_world',
        },
      },
      update: {
        whatsappAccountId: storedAccount.id,
        content: 'hello_world',
        language: 'en_US',
        category: 'UTILITY',
        status: 'APPROVED',
      },
      create: {
        userId: input.userId,
        whatsappAccountId: storedAccount.id,
        name: 'hello_world',
        content: 'hello_world',
        language: 'en_US',
        category: 'UTILITY',
        status: 'APPROVED',
      },
    });

    return {
      account,
      template,
    };
  }

  private async upsertWahaSession(input: {
    sessionName: string;
    config: WahaConfig;
    webhookBaseUrl?: string;
  }) {
    const webhookBaseUrl = this.resolveWebhookBaseUrl(input.webhookBaseUrl);
    const webhookUrl = this.buildWahaWebhookUrl(
      webhookBaseUrl,
      input.config.userId,
      input.config.webhookSecret,
    );
    const payload = {
      name: input.sessionName,
      config: {
        webhooks: webhookUrl
          ? [
              {
                url: webhookUrl,
                events: ['message', 'message.ack'],
              },
            ]
          : [],
        ignore: {
          status: true,
          groups: true,
          channels: true,
        },
      },
    };

    const existing = await this.getWahaSession(
      input.sessionName,
      input.config,
    ).catch(() => null);

    let session: unknown;

    if (existing) {
      await this.fetchWahaJson(
        `/api/sessions/${encodeURIComponent(input.sessionName)}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
        'WAHA session update failed',
        input.config,
      );

      session = await this.fetchWahaJson(
        `/api/sessions/${encodeURIComponent(input.sessionName)}`,
        {},
        'WAHA session fetch failed',
        input.config,
      );
    } else {
      session = await this.fetchWahaJson(
        '/api/sessions',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        'WAHA session create failed',
        input.config,
      );
    }

    return this.ensureWahaSessionStarted(
      input.sessionName,
      session,
      input.config,
    );
  }

  private resolveWebhookBaseUrl(webhookBaseUrl?: string) {
    return (
      webhookBaseUrl ||
      this.configService.get<string>('PUBLIC_API_URL') ||
      this.configService.get<string>('APP_PUBLIC_API_URL') ||
      ''
    )
      .trim()
      .replace(/\/$/, '');
  }

  private buildWahaWebhookUrl(
    webhookBaseUrl: string,
    userId?: string,
    webhookSecret?: string,
  ) {
    if (!webhookBaseUrl) {
      return null;
    }

    const params = new URLSearchParams();
    if (userId) {
      params.set('userId', userId);
    }
    if (webhookSecret) {
      params.set('secret', webhookSecret);
    }

    const query = params.toString();
    return `${webhookBaseUrl}/webhooks/whatsapp/waha${query ? `?${query}` : ''}`;
  }

  private async getWahaSession(sessionName: string, config?: WahaConfig) {
    return this.fetchWahaJson(
      `/api/sessions/${encodeURIComponent(sessionName)}`,
      {},
      'WAHA session fetch failed',
      config,
    );
  }

  private async getWahaSessionMe(sessionName: string, config?: WahaConfig) {
    return this.fetchWahaJson(
      `/api/sessions/${encodeURIComponent(sessionName)}/me`,
      {},
      'WAHA session me fetch failed',
      config,
    );
  }

  private async ensureWahaSessionStarted(
    sessionName: string,
    session?: unknown,
    config?: WahaConfig,
  ) {
    const currentSession =
      session ??
      (await this.getWahaSession(sessionName, config).catch(() => null));
    const status = this.getWahaSessionStatus(currentSession);

    if (status === 'WORKING' || status === 'SCAN_QR_CODE') {
      return currentSession;
    }

    if (status === 'STARTING') {
      return (
        (await this.waitForWahaSessionStatuses(
          sessionName,
          ['SCAN_QR_CODE', 'WORKING', 'FAILED'],
          undefined,
          undefined,
          config,
        )) ?? currentSession
      );
    }

    const action = status === 'FAILED' ? 'restart' : 'start';
    await this.fetchWahaJson(
      `/api/sessions/${encodeURIComponent(sessionName)}/${action}`,
      {
        method: 'POST',
      },
      `WAHA session ${action} failed`,
      config,
    );

    return (
      (await this.waitForWahaSessionStatuses(
        sessionName,
        ['SCAN_QR_CODE', 'WORKING', 'FAILED'],
        undefined,
        undefined,
        config,
      )) ?? currentSession
    );
  }

  private async waitForWahaSessionStatuses(
    sessionName: string,
    expectedStatuses: string[],
    attempts = 8,
    delayMs = 750,
    config?: WahaConfig,
  ) {
    let latestSession: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      latestSession = await this.getWahaSession(sessionName, config).catch(
        () => null,
      );
      const status = this.getWahaSessionStatus(latestSession);

      if (status && expectedStatuses.includes(status)) {
        return latestSession;
      }

      if (attempt < attempts - 1) {
        await this.sleep(delayMs);
      }
    }

    return latestSession;
  }

  private getWahaSessionStatus(session: unknown) {
    const status = (session as Record<string, unknown> | null)?.status;
    return typeof status === 'string' ? status : null;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private renderWahaBulkMessage(input: {
    lead: Lead;
    seoResearch: SeoResearchResult;
    templates: string[];
  }) {
    if (input.templates.length > 0) {
      return this.renderTemplateBackedWahaMessage(input);
    }

    return this.composeSeoOutreachMessage(input.lead, input.seoResearch);
  }

  private renderTemplateBackedWahaMessage(input: {
    lead: Lead;
    seoResearch: SeoResearchResult;
    templates: string[];
  }) {
    const template =
      input.templates[
        this.randomIntInclusive(0, Math.max(input.templates.length - 1, 0))
      ] || input.templates[0];
    const variables = {
      ...buildLeadTemplateVariables(input.lead.name),
      phone: input.lead.phone ?? '',
      website: input.seoResearch.website ?? '',
      seoPoint: input.seoResearch.point,
      pageTitle: input.seoResearch.title ?? '',
      metaDescription: input.seoResearch.description ?? '',
      h1: input.seoResearch.h1 ?? '',
    };
    const rendered = renderTemplateContent(template, variables).trim();

    return rendered;
  }

  private async researchLeadSeo(
    lead: Lead,
    fallbackSeoPoint?: string,
  ): Promise<SeoResearchResult> {
    const website = this.normalizeWebsiteUrl(lead.website);

    if (!website) {
      return this.buildFallbackSeoResearch(lead, fallbackSeoPoint, undefined, [
        'no-website',
      ]);
    }

    try {
      const response = await this.fetchWebsiteHtml(website);

      if (!response) {
        return this.buildFallbackSeoResearch(lead, fallbackSeoPoint, website, [
          'website-unreachable',
        ]);
      }

      const html = response.html;
      const title = this.extractHtmlTagContent(html, 'title');
      const description =
        this.extractMetaContent(html, 'description') ||
        this.extractMetaPropertyContent(html, 'og:description');
      const h1 = this.extractHtmlTagContent(html, 'h1');
      const point = this.buildSeoPoint({
        title,
        description,
        h1,
        domain: response.domain,
      });

      return {
        website: response.url,
        domain: response.domain,
        title,
        description,
        h1,
        point,
        source: 'website',
      };
    } catch {
      return this.buildFallbackSeoResearch(lead, fallbackSeoPoint, website, [
        'website-unreachable',
      ]);
    }
  }

  private buildFallbackSeoResearch(
    lead: Lead,
    fallbackSeoPoint?: string,
    website?: string,
    reasons: Array<'no-website' | 'website-unreachable'> = ['no-website'],
  ): SeoResearchResult {
    const normalizedWebsite = website ?? this.normalizeWebsiteUrl(lead.website);
    const source = reasons.includes('website-unreachable')
      ? 'website-unreachable'
      : 'no-website';

    return {
      website: normalizedWebsite,
      domain: normalizedWebsite ? this.getDomain(normalizedWebsite) : null,
      title: null,
      description: null,
      h1: null,
      point: this.buildFallbackSeoPoint(lead, source, fallbackSeoPoint),
      source,
    };
  }

  private buildSeoPoint(input: {
    title: string | null;
    description: string | null;
    h1: string | null;
    domain: string | null;
  }) {
    const hasTitle = Boolean(input.title);
    const hasDescription = Boolean(input.description);
    const hasH1 = Boolean(input.h1);

    if (!hasTitle) {
      return `Your website${input.domain ? ` (${input.domain})` : ''} does not expose a clear page title, so Google may not understand the main service quickly.`;
    }

    if (!hasDescription) {
      return `The page title is "${this.truncateText(input.title ?? '', 70)}", but I could not find a strong meta description for search-result clicks.`;
    }

    if (!hasH1) {
      return `The site has a title, but the main H1 heading is missing or unclear, which can weaken keyword relevance on the page.`;
    }

    if (
      input.title &&
      input.description &&
      input.title.toLowerCase() === input.description.toLowerCase()
    ) {
      return 'The title and meta description look too similar, so the Google snippet could be rewritten to earn better clicks.';
    }

    return `Your current page title "${this.truncateText(input.title ?? '', 70)}" is visible, but it could be sharpened around buyer keywords and local intent.`;
  }

  private composeSeoOutreachMessage(lead: Lead, research: SeoResearchResult) {
    const firstName = this.getLeadFirstName(lead);
    const variantIndex = this.stableIndex(
      `${lead.id}:${research.point}:${research.source}`,
      4,
    );
    const signature = 'This is Rehman Ahmed from Social Velocity.';

    if (research.source === 'website') {
      const websiteLine = research.domain
        ? `I reviewed ${research.domain} and found one SEO point.`
        : 'I reviewed your website and found one SEO point.';
      const openings = [
        `Hi ${firstName},`,
        `Salam ${firstName},`,
        `Assalam o Alaikum ${firstName},`,
        `${firstName}, quick note from my side.`,
      ];
      const closings = [
        'Would it be okay if I share 2-3 practical improvements for your website?',
        'If useful, I can send a short list of fixes you can apply first.',
        'I can share a quick mini-audit with the most useful next steps.',
        'Should I send you a few simple changes that could improve this?',
      ];

      return [
        openings[variantIndex],
        signature,
        websiteLine,
        research.point,
        '',
        closings[variantIndex],
      ].join('\n');
    }

    if (research.source === 'website-unreachable') {
      const domain = research.domain ?? 'your listed website';
      const variants = [
        [
          `Hi ${firstName},`,
          signature,
          `I tried checking ${domain}, but it did not load cleanly from my side.`,
          research.point,
          '',
          'Would you like me to send a quick checklist to fix the first SEO and website visibility issues?',
        ],
        [
          `Salam ${firstName},`,
          signature,
          `I found a website listed for your business (${domain}), but the page was not easy to review right now.`,
          research.point,
          '',
          'I can still share a short practical SEO checklist if that helps.',
        ],
        [
          `Assalam o Alaikum ${firstName},`,
          signature,
          `I tried to review ${domain}, but it looks unavailable or blocked at the moment.`,
          research.point,
          '',
          'Should I send 2-3 quick checks for fixing website visibility first?',
        ],
        [
          `${firstName}, quick SEO note.`,
          signature,
          `${domain} was listed, but I could not read the page content properly.`,
          research.point,
          '',
          'If you want, I can share the first fixes I would check.',
        ],
      ];

      return variants[variantIndex].join('\n');
    }

    return this.composeNoWebsiteOutreach(lead, research, signature);
  }

  private buildFallbackSeoPoint(
    lead: Lead,
    source: 'website-unreachable' | 'no-website',
    fallbackSeoPoint?: string,
  ) {
    const custom = fallbackSeoPoint?.trim();
    const variants =
      source === 'website-unreachable'
        ? [
            'A website that does not load reliably can lose visitors before SEO even starts, so speed, uptime, and indexability should be checked first.',
            'Before keyword work, the first SEO priority is making sure the website loads consistently and search engines can crawl it.',
            'If the site is slow, blocked, or unavailable, Google and customers may both struggle to access it.',
            'The first practical fix is a technical visibility check: load status, mobile access, page title, and crawlability.',
          ]
        : [
            'Without a website, local SEO depends heavily on Google Business Profile, service keywords, and consistent contact details.',
            'A simple landing page plus Google Business Profile can help people find your business when they search locally.',
            'The first SEO win is usually setting up a clear web presence with services, location keywords, and a visible WhatsApp/contact path.',
            'If you do not have a website yet, a small SEO-focused page can still capture local search demand.',
          ];

    if (custom && source === 'website-unreachable') {
      return custom;
    }

    return variants[
      this.stableIndex(`${lead.id}:${lead.phone}:${source}`, variants.length)
    ];
  }

  private composeNoWebsiteOutreach(
    lead: Lead,
    research: SeoResearchResult,
    signature: string,
  ) {
    const firstName = this.getLeadFirstName(lead);
    const seed = `${lead.id}:${lead.phone}:${lead.name ?? ''}:no-website`;
    const openings = [
      `Hi ${firstName},`,
      `Salam ${firstName},`,
      `Assalam o Alaikum ${firstName},`,
      `${firstName}, quick question.`,
      `Hello ${firstName},`,
      `Hi ${firstName}, quick note.`,
      `Salam ${firstName}, hope you are well.`,
      `${firstName}, I wanted to share a quick marketing thought.`,
      `Assalam o Alaikum ${firstName}, one small suggestion.`,
      `Hi ${firstName}, I was checking your online presence.`,
    ];
    const contexts = [
      'I could not find a clear website for your business, so the first opportunity may be improving your online visibility.',
      'I was preparing a quick SEO note and noticed your business may not have a website showing clearly online.',
      'I did not find a website link, so the strongest first step may be helping people discover you on Google.',
      'I could not review a website yet, but there is still a useful local SEO starting point.',
      'I did not see a website for your business, which usually makes Google Business Profile and local keywords more important.',
      'I would start with the foundation: Google profile, service keywords, contact consistency, and a simple landing page.',
      'Customers often look for a website before contacting a business, so having a clear online page can build trust.',
      'If your business is mainly getting leads from referrals or social pages, local search could be another useful channel.',
      'I could not check on-page SEO yet, so I would first focus on getting a basic searchable presence in place.',
      'When a business website is not easy to find, there are usually quick wins in local SEO and trust-building.',
    ];
    const points = [
      research.point,
      'A Google Business Profile with clear services, location keywords, and WhatsApp contact can be the first visibility win.',
      'Even a single SEO-focused landing page can help people find your services and contact you faster.',
      'The basic setup I would check first is business profile, service keywords, contact consistency, and a simple web page.',
      'If you already have a website, sharing the link would let me point out title, description, and page structure improvements.',
      'For a business without a visible website, the fastest path is usually a lightweight page plus local SEO setup.',
      'Search visibility improves when Google can clearly see what you offer, where you serve, and how customers can reach you.',
      'A small page with services, area keywords, reviews, and WhatsApp CTA can often outperform having no site at all.',
      'The first goal is making your business easy to discover and trust before running ads or heavy campaigns.',
      'Local SEO can start small: one clean page, Google profile optimization, and consistent NAP details.',
    ];
    const closings = [
      'Would it be useful if I share the first 2-3 steps to make your business easier to find on Google?',
      'I can send a simple starter checklist for local SEO if you want.',
      'Should I share a few practical steps you can start with?',
      'If you already have a website, send it over and I can point out the first SEO improvements.',
      'Would you like me to send a short no-website SEO starter plan?',
      'I can share a quick plan that does not require building a large website.',
      'Should I send the first few fixes I would do for local visibility?',
      'If this is relevant, I can send a concise checklist here.',
      'Would a short local SEO roadmap be useful for you?',
      'I can keep it simple and send the top 3 actions only.',
    ];

    const opening =
      openings[this.stableIndex(`${seed}:opening`, openings.length)];
    const context =
      contexts[this.stableIndex(`${seed}:context`, contexts.length)];
    const point = points[this.stableIndex(`${seed}:point`, points.length)];
    const closing =
      closings[this.stableIndex(`${seed}:closing`, closings.length)];

    return [opening, signature, context, point, '', closing].join('\n');
  }

  private async fetchWebsiteHtml(website: string) {
    const candidates = this.buildWebsiteCandidates(website);

    for (const candidate of candidates) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        SEO_RESEARCH_TIMEOUT_MS,
      );

      try {
        const response = await fetch(candidate, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'WhatsAppAgentSEOResearch/1.0',
          },
          redirect: 'follow',
          signal: controller.signal,
        });

        if (!response.ok) {
          continue;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType && !contentType.toLowerCase().includes('html')) {
          continue;
        }

        const html = await response.text();
        return {
          url: response.url || candidate,
          domain: this.getDomain(response.url || candidate),
          html,
        };
      } catch {
        continue;
      } finally {
        clearTimeout(timeout);
      }
    }

    return null;
  }

  private buildWebsiteCandidates(website: string) {
    const normalized = this.normalizeWebsiteUrl(website);
    if (!normalized) {
      return [];
    }

    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '');
    const path = `${url.pathname}${url.search}`;
    const candidates = [
      normalized,
      `https://www.${host}${path}`,
      `http://${host}${path}`,
      `http://www.${host}${path}`,
    ];

    return [...new Set(candidates)];
  }

  private getLeadFirstName(lead: Lead) {
    return lead.name?.trim().split(/\s+/)[0] || 'there';
  }

  private stableIndex(value: string, length: number) {
    if (length <= 1) {
      return 0;
    }

    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash % length;
  }

  private getDomain(value: string) {
    try {
      return new URL(value).hostname.replace(/^www\./i, '');
    } catch {
      return null;
    }
  }

  private normalizeWebsiteUrl(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const url = new URL(withProtocol);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return null;
      }

      return url.toString();
    } catch {
      return null;
    }
  }

  private extractHtmlTagContent(html: string, tagName: string) {
    const match = html.match(
      new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
    );

    return match?.[1] ? this.cleanHtmlText(match[1]) : null;
  }

  private extractMetaContent(html: string, name: string) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+name=["']${escapedName}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escapedName}["'][^>]*>`,
        'i',
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return this.cleanHtmlText(match[1]);
      }
    }

    return null;
  }

  private extractMetaPropertyContent(html: string, property: string) {
    const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+property=["']${escapedProperty}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escapedProperty}["'][^>]*>`,
        'i',
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return this.cleanHtmlText(match[1]);
      }
    }

    return null;
  }

  private cleanHtmlText(value: string) {
    const cleaned = value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.length > 0 ? cleaned : null;
  }

  private describeOutreachSkip(
    reason?: import('../outreach/outreach.service').OutreachSkipReason,
  ) {
    switch (reason) {
      case 'no_incoming':
        return 'This contact has not messaged you first. Send a wa.me invite link and wait for them to reply before pitching on WhatsApp.';
      case 'daily_cap':
        return 'Daily cold outreach limit reached for this WhatsApp number. Try again tomorrow or message engaged contacts only.';
      case 'message_too_long':
        return 'First cold message exceeds the configured character limit. Use a shorter opener.';
      case 'url_in_first_message':
        return 'Links are blocked in the first cold message. Send a short opener without URLs.';
      case 'recently_contacted':
        return 'This contact was messaged recently. Wait for the cooldown period before contacting again.';
      case 'blocked':
        return 'This contact is blocked from outreach.';
      default:
        return 'Outreach blocked by safety rules.';
    }
  }

  private randomIntInclusive(min: number, max: number) {
    const safeMin = Math.ceil(Math.min(min, max));
    const safeMax = Math.floor(Math.max(min, max));

    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  }

  private truncateText(value: string, maxLength: number) {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  }

  private async fetchWahaJson(
    path: string,
    init: RequestInit,
    errorPrefix: string,
    config = this.getWahaConfig(),
  ) {
    if (!config.baseUrl) {
      throw new BadRequestException('WAHA_BASE_URL is missing.');
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'X-Api-Key': config.apiKey } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body,
    });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      throw new BadRequestException(`${errorPrefix}: ${JSON.stringify(json)}`);
    }

    return json;
  }

  private extractPhoneNumberFromWahaMe(me: unknown) {
    const id = (me as Record<string, unknown> | null)?.id;

    if (typeof id !== 'string') {
      return null;
    }

    const match = id.match(/^(\d+)@(?:c\.us|s\.whatsapp\.net)$/i);
    if (!match) {
      return null;
    }

    return normalizePhoneNumber(`+${match[1]}`);
  }
}

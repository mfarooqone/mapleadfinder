import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmailAiProvider, Lead } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretVaultService } from '../security/secret-vault.service';
import { UpsertEmailAiSettingsDto } from './dto/upsert-email-ai-settings.dto';

type PersonalizeInput = {
  userId: string;
  lead: Lead;
  subject: string;
  body: string;
};

type PersonalizedEmail = {
  subject: string;
  body: string;
};

type EmailAiSettingsLike = {
  id?: string;
  provider: EmailAiProvider;
  apiKey?: string | null;
  openaiApiKey?: string | null;
  mistralApiKey?: string | null;
  openaiModel?: string | null;
  mistralModel?: string | null;
  isActive?: boolean;
};

type UsableEmailAiSettings = EmailAiSettingsLike & {
  persisted: boolean;
};

@Injectable()
export class EmailAiService {
  private readonly openAiModel = process.env.OPENAI_EMAIL_MODEL ?? 'gpt-5.5';
  private readonly mistralModel =
    process.env.MISTRAL_EMAIL_MODEL ?? 'mistral-large-latest';

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretVaultService: SecretVaultService,
  ) {}

  async getSettings(userId: string) {
    const settings = await this.prisma.emailAiSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      const provider = this.defaultProviderFromEnv();
      const hasOpenAiKey = this.hasProviderKey(
        { provider },
        EmailAiProvider.OPENAI,
      );
      const hasMistralKey = this.hasProviderKey(
        { provider },
        EmailAiProvider.MISTRAL,
      );
      const hasActiveKey = this.hasProviderKey({ provider }, provider);

      return {
        configured: hasActiveKey,
        provider,
        hasApiKey: hasActiveKey,
        openaiModel: this.openAiModel,
        mistralModel: this.mistralModel,
        providerKeys: {
          OPENAI: hasOpenAiKey,
          MISTRAL: hasMistralKey,
        },
        isActive: true,
        models: this.models(),
        providers: this.providers(),
      };
    }
    const activeApiKey = this.resolveApiKey(settings);
    const hasOpenAiKey = this.hasProviderKey(settings, EmailAiProvider.OPENAI);
    const hasMistralKey = this.hasProviderKey(
      settings,
      EmailAiProvider.MISTRAL,
    );

    return {
      configured: Boolean(activeApiKey),
      id: settings.id,
      provider: settings.provider,
      hasApiKey: Boolean(activeApiKey),
      openaiModel: this.normalizeModel(settings.openaiModel, this.openAiModel),
      mistralModel: this.normalizeModel(
        settings.mistralModel,
        this.mistralModel,
      ),
      providerKeys: {
        OPENAI: hasOpenAiKey,
        MISTRAL: hasMistralKey,
      },
      isActive: settings.isActive,
      lastTestedAt: settings.lastTestedAt?.toISOString() ?? null,
      lastTestError: settings.lastTestError,
      updatedAt: settings.updatedAt.toISOString(),
      models: this.models(),
      providers: this.providers(),
    };
  }

  async upsertSettings(userId: string, dto: UpsertEmailAiSettingsDto) {
    const existing = await this.prisma.emailAiSettings.findUnique({
      where: { userId },
    });
    const encryptedApiKey =
      dto.apiKey && dto.apiKey.trim()
        ? this.secretVaultService.encrypt(dto.apiKey.trim())
        : undefined;
    const providerKeyField =
      dto.provider === EmailAiProvider.MISTRAL
        ? 'mistralApiKey'
        : 'openaiApiKey';
    const existingProviderKeyField =
      existing?.provider === EmailAiProvider.MISTRAL
        ? 'mistralApiKey'
        : 'openaiApiKey';
    const migratedLegacyKey =
      existing?.apiKey && !existing.openaiApiKey && !existing.mistralApiKey
        ? { [existingProviderKeyField]: existing.apiKey }
        : {};

    const settings = await this.prisma.emailAiSettings.upsert({
      where: { userId },
      create: {
        userId,
        provider: dto.provider,
        apiKey: encryptedApiKey ?? null,
        ...(encryptedApiKey ? { [providerKeyField]: encryptedApiKey } : {}),
        openaiModel: this.normalizeModel(dto.openaiModel, this.openAiModel),
        mistralModel: this.normalizeModel(dto.mistralModel, this.mistralModel),
        isActive: dto.isActive ?? true,
        lastTestError: null,
      },
      update: {
        provider: dto.provider,
        apiKey: encryptedApiKey ?? existing?.apiKey ?? null,
        ...migratedLegacyKey,
        ...(encryptedApiKey ? { [providerKeyField]: encryptedApiKey } : {}),
        openaiModel: this.normalizeModel(dto.openaiModel, this.openAiModel),
        mistralModel: this.normalizeModel(dto.mistralModel, this.mistralModel),
        isActive: dto.isActive ?? true,
        lastTestError: null,
      },
    });

    return {
      saved: true,
      settings: await this.getSettings(settings.userId),
    };
  }

  async testSettings(userId: string) {
    const settings = await this.requireUsableSettings(userId);
    const input = {
      userId,
      lead: {
        id: 'test',
        userId,
        name: 'Sample Clinic',
        category: 'Clinic',
        address: 'London',
        phone: null,
        email: 'hello@example.com',
        website: null,
        rating: null,
        reviewsCount: null,
        source: 'MANUAL',
        sourceKeyword: 'clinic',
        optIn: false,
        warmUpStatus: 'PENDING',
        firstIncomingAt: null,
        lastOutgoingAt: null,
        status: 'NEW',
        tags: [],
        qualityScore: 0,
        qualityReasons: [],
        emailDeliveryStatus: 'UNKNOWN',
        emailLastSentAt: null,
        emailLastReplyAt: null,
        emailLastBounceAt: null,
        emailLastError: null,
        metadata: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Lead,
      subject: 'Quick support for {{name}}',
      body: 'Hi {{firstName}}, I wanted to reach out about {{category}} support.',
    };

    try {
      await this.personalizeWithSettings(settings, input);
      const testedAt = new Date();
      if (settings.persisted) {
        await this.prisma.emailAiSettings.update({
          where: { userId },
          data: {
            lastTestedAt: testedAt,
            lastTestError: null,
          },
        });
      }

      return {
        ok: true,
        testedAt: testedAt.toISOString(),
        note: 'AI personalization connection verified.',
      };
    } catch (error) {
      const message = this.errorMessage(error);
      if (settings.persisted) {
        await this.prisma.emailAiSettings.update({
          where: { userId },
          data: { lastTestError: message.slice(0, 500) },
        });
      }
      throw new BadRequestException(
        `AI personalization test failed: ${message}`,
      );
    }
  }

  async personalizeEmail(input: PersonalizeInput): Promise<PersonalizedEmail> {
    const settings = await this.requireUsableSettings(input.userId);
    return this.personalizeWithSettings(settings, input);
  }

  private async personalizeWithSettings(
    settings: EmailAiSettingsLike,
    input: PersonalizeInput,
  ) {
    const apiKey = this.resolveApiKey(settings);
    if (!apiKey) {
      throw new Error('AI API key is missing.');
    }

    const research = await this.researchLead(input.lead);
    const prompt = this.buildPrompt(input, research);
    const result =
      settings.provider === EmailAiProvider.MISTRAL
        ? await this.callMistral(
            apiKey,
            prompt,
            this.normalizeModel(settings.mistralModel, this.mistralModel),
          )
        : await this.callOpenAi(
            apiKey,
            prompt,
            this.normalizeModel(settings.openaiModel, this.openAiModel),
          );

    return {
      subject: this.truncate((result.subject || input.subject).trim(), 200),
      body: this.truncate((result.body || input.body).trim(), 5000),
    };
  }

  private async researchLead(lead: Lead) {
    const websiteText = await this.fetchWebsiteSummary(lead.website);

    return {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      website: lead.website,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
      sourceKeyword: lead.sourceKeyword,
      websiteText,
    };
  }

  private async fetchWebsiteSummary(website?: string | null) {
    if (!website) {
      return '';
    }

    const url = this.normalizeUrl(website);
    if (!url) {
      return '';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'user-agent':
            'Mozilla/5.0 (compatible; LeadOutreachBot/1.0; +https://leadoutreach.local)',
        },
      });
      if (!response.ok) {
        return '';
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
        return '';
      }

      return this.cleanWebsiteText(await response.text()).slice(0, 5000);
    } catch {
      return '';
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPrompt(
    input: PersonalizeInput,
    research: Record<string, unknown>,
  ) {
    return [
      {
        role: 'system',
        content:
          'You write concise cold outreach emails. Use only provided business facts. Do not invent services, awards, clients, or claims. Do not mention that research was performed. Keep a natural professional tone. Return only JSON with subject and body.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          business: research,
          template: {
            subject: input.subject,
            body: input.body,
          },
          rules: {
            maxBodyWords: 170,
            goal: 'start a conversation and invite a reply',
            fallback:
              'If website research is weak, personalize using business name, category, location, and source keyword only.',
            preserveSignature: true,
          },
          outputSchema: {
            subject: 'string',
            body: 'string',
          },
        }),
      },
    ];
  }

  private async callOpenAi(
    apiKey: string,
    messages: Array<{ role: string; content: string }>,
    model = this.openAiModel,
  ) {
    const body: Record<string, unknown> = {
      model,
      input: messages,
      text: {
        format: {
          type: 'json_schema',
          name: 'personalized_email',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'body'],
            properties: {
              subject: { type: 'string' },
              body: { type: 'string' },
            },
          },
        },
      },
    };
    if (model.startsWith('gpt-5')) {
      body.reasoning = { effort: 'low' };
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = await this.parseProviderResponse(response);
    const outputText =
      typeof json.output_text === 'string'
        ? json.output_text
        : this.extractOpenAiOutputText(json);

    return this.parsePersonalizedJson(outputText);
  }

  private async callMistral(
    apiKey: string,
    messages: Array<{ role: string; content: string }>,
    model = this.mistralModel,
  ) {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    const json = await this.parseProviderResponse(response);
    const content = json.choices?.[0]?.message?.content;
    return this.parsePersonalizedJson(
      Array.isArray(content)
        ? content.map((part) => part.text ?? '').join('')
        : String(content ?? ''),
    );
  }

  private async parseProviderResponse(response: Response) {
    const text = await response.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `AI provider returned invalid JSON: ${text.slice(0, 200)}`,
      );
    }

    if (!response.ok) {
      const message =
        json.error?.message ||
        json.message ||
        `AI provider request failed with status ${response.status}`;
      throw new Error(message);
    }

    return json;
  }

  private parsePersonalizedJson(value: string) {
    try {
      const parsed = JSON.parse(value);
      return {
        subject: String(parsed.subject ?? ''),
        body: String(parsed.body ?? ''),
      };
    } catch {
      throw new Error('AI provider did not return a valid personalized email.');
    }
  }

  private extractOpenAiOutputText(json: any) {
    const parts = Array.isArray(json.output) ? json.output : [];
    return parts
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
      .map((content) => content.text ?? '')
      .join('');
  }

  private normalizeUrl(value: string) {
    try {
      const withProtocol = /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`;
      const url = new URL(withProtocol);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  private cleanWebsiteText(html: string) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async requireUsableSettings(
    userId: string,
  ): Promise<UsableEmailAiSettings> {
    const settings = await this.prisma.emailAiSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      const provider = this.defaultProviderFromEnv();
      if (!this.getEnvApiKey(provider)) {
        throw new NotFoundException(
          'AI personalization is not configured for this login account.',
        );
      }

      return {
        provider,
        apiKey: null,
        openaiApiKey: null,
        mistralApiKey: null,
        openaiModel: this.openAiModel,
        mistralModel: this.mistralModel,
        isActive: true,
        persisted: false,
      };
    }

    if (!settings.isActive || !this.resolveApiKey(settings)) {
      throw new NotFoundException(
        'AI personalization is not configured for this login account.',
      );
    }

    return { ...settings, persisted: true };
  }

  private resolveApiKey(settings: EmailAiSettingsLike) {
    const encryptedApiKey = this.getEncryptedApiKey(settings);
    const savedApiKey = encryptedApiKey
      ? this.secretVaultService.decrypt(encryptedApiKey)
      : null;

    return savedApiKey ?? this.getEnvApiKey(settings.provider);
  }

  private getEncryptedApiKey(settings: EmailAiSettingsLike) {
    const hasProviderSpecificKey = Boolean(
      settings.openaiApiKey || settings.mistralApiKey,
    );

    if (settings.provider === EmailAiProvider.MISTRAL) {
      return (
        settings.mistralApiKey ??
        (hasProviderSpecificKey ? null : settings.apiKey) ??
        null
      );
    }

    return (
      settings.openaiApiKey ??
      (hasProviderSpecificKey ? null : settings.apiKey) ??
      null
    );
  }

  private hasProviderKey(
    settings: EmailAiSettingsLike,
    provider: EmailAiProvider,
  ) {
    if (this.getEnvApiKey(provider)) {
      return true;
    }

    const hasProviderSpecificKey = Boolean(
      settings.openaiApiKey || settings.mistralApiKey,
    );
    if (provider === EmailAiProvider.MISTRAL) {
      return Boolean(
        settings.mistralApiKey ||
        (!hasProviderSpecificKey &&
          settings.provider === EmailAiProvider.MISTRAL &&
          settings.apiKey),
      );
    }

    return Boolean(
      settings.openaiApiKey ||
      (!hasProviderSpecificKey &&
        settings.provider === EmailAiProvider.OPENAI &&
        settings.apiKey),
    );
  }

  private getEnvApiKey(provider: EmailAiProvider) {
    if (provider === EmailAiProvider.MISTRAL) {
      return (
        process.env.MISTRAL_EMAIL_API_KEY || process.env.MISTRAL_API_KEY || null
      );
    }

    return (
      process.env.OPENAI_EMAIL_API_KEY || process.env.OPENAI_API_KEY || null
    );
  }

  private defaultProviderFromEnv() {
    return this.getEnvApiKey(EmailAiProvider.OPENAI)
      ? EmailAiProvider.OPENAI
      : EmailAiProvider.MISTRAL;
  }

  private providers() {
    return [
      { value: EmailAiProvider.OPENAI, label: 'ChatGPT (OpenAI)' },
      { value: EmailAiProvider.MISTRAL, label: 'Mistral (Le Chat)' },
    ];
  }

  private models() {
    return {
      OPENAI: this.openAiModel,
      MISTRAL: this.mistralModel,
      options: {
        OPENAI: [
          'gpt-5.5',
          'gpt-5.4',
          'gpt-5-mini',
          'gpt-4.1',
          'gpt-4.1-mini',
          'gpt-4o-mini',
        ],
        MISTRAL: [
          'mistral-large-latest',
          'mistral-medium-latest',
          'mistral-small-latest',
        ],
      },
    };
  }

  private normalizeModel(value: string | null | undefined, fallback: string) {
    return value?.trim() || fallback;
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

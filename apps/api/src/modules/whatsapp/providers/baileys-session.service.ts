import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ConnectionState,
  DisconnectReason,
  WASocket,
} from '@whiskeysockets/baileys';
import { toDataURL } from 'qrcode';
import { normalizePhoneNumber } from '../../../common/utils/phone.util';

type BaileysModule = typeof import('@whiskeysockets/baileys');

type SessionState = {
  socket?: WASocket;
  status: 'idle' | 'connecting' | 'qr' | 'open' | 'close';
  qr?: string;
  qrDataUrl?: string;
  phoneNumber?: string;
  lastError?: string;
  connecting?: Promise<SessionState>;
};

@Injectable()
export class BaileysSessionService implements OnModuleDestroy {
  private readonly sessions = new Map<string, SessionState>();
  private baileysModule?: Promise<BaileysModule>;

  constructor(private readonly configService: ConfigService) {}

  async start(sessionName?: string) {
    const key = this.normalizeSessionName(sessionName);
    const existing = this.sessions.get(key);

    if (
      existing?.socket &&
      ['connecting', 'qr', 'open'].includes(existing.status)
    ) {
      return this.describe(key, existing);
    }

    const state = existing ?? { status: 'idle' as const };
    this.sessions.set(key, state);

    if (state.connecting) {
      await state.connecting;
      return this.describe(key, state);
    }

    state.connecting = this.connect(key, state);

    try {
      await state.connecting;
    } finally {
      state.connecting = undefined;
    }

    return this.describe(key, state);
  }

  async getStatus(sessionName?: string) {
    const key = this.normalizeSessionName(sessionName);
    const state = this.sessions.get(key);

    if (!state) {
      return {
        sessionName: key,
        status: 'idle',
        connected: false,
        hasQr: false,
        phoneNumber: null,
        lastError: null,
      };
    }

    return this.describe(key, state);
  }

  async getQr(sessionName?: string) {
    const status = await this.start(sessionName);
    const key = this.normalizeSessionName(sessionName);
    const state = this.sessions.get(key);

    return {
      ...status,
      qr: state?.qr ?? null,
      qrDataUrl: state?.qrDataUrl ?? null,
      hint: state?.qr
        ? 'Scan this QR from WhatsApp > Linked devices.'
        : status.connected
          ? 'Baileys session is already connected.'
          : 'QR is not ready yet. Retry in a few seconds.',
    };
  }

  async sendVoice(input: {
    sessionName?: string;
    to: string;
    url?: string;
    data?: string;
    mimetype?: string;
  }) {
    const key = this.normalizeSessionName(input.sessionName);
    await this.start(key);
    const state = await this.waitForOpen(key, 10_000);

    if (!state?.socket || state.status !== 'open') {
      throw new Error(
        'Baileys session is not connected yet. If you just scanned the QR, wait a few seconds, refresh status, then send again.',
      );
    }

    const audio = await this.resolveAudioBuffer(input);
    const response = await state.socket.sendMessage(this.toJid(input.to), {
      audio,
      mimetype: input.mimetype?.trim() || 'audio/ogg; codecs=opus',
      ptt: true,
    });

    return {
      externalMessageId: response?.key?.id ?? null,
      raw: response,
    };
  }

  async sendText(input: { sessionName?: string; to: string; body: string }) {
    const key = this.normalizeSessionName(input.sessionName);
    await this.start(key);
    const state = await this.waitForOpen(key, 10_000);

    if (!state?.socket || state.status !== 'open') {
      throw new Error(
        'Baileys session is not connected yet. If you just scanned the QR, wait a few seconds, refresh status, then send again.',
      );
    }

    const response = await state.socket.sendMessage(this.toJid(input.to), {
      text: input.body,
    });

    return {
      externalMessageId: response?.key?.id ?? null,
      raw: response,
    };
  }

  async waitForConnected(sessionName?: string, timeoutMs = 10_000) {
    const key = this.normalizeSessionName(sessionName);
    await this.start(key);
    const state = await this.waitForOpen(key, timeoutMs);

    return state ? this.describe(key, state) : this.getStatus(key);
  }

  async onModuleDestroy() {
    for (const state of this.sessions.values()) {
      state.socket?.end(new Error('Application shutdown'));
    }
  }

  private async connect(key: string, state: SessionState) {
    state.status = 'connecting';
    state.lastError = undefined;

    const baileys = await this.loadBaileys();
    const { state: authState, saveCreds } = await baileys.useMultiFileAuthState(
      this.getAuthFolder(key),
    );
    const socket = baileys.makeWASocket({
      auth: authState,
      browser: baileys.Browsers.ubuntu('WhatsApp Agent Baileys'),
      printQRInTerminal: false,
      syncFullHistory: false,
    });

    state.socket = socket;
    state.phoneNumber = this.extractPhoneNumber(socket.user?.id);

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      if (update.qr) {
        state.qr = update.qr;
        state.qrDataUrl = await toDataURL(update.qr, {
          margin: 1,
          scale: 6,
        });
        state.status = 'qr';
      }

      if (update.connection === 'open') {
        state.status = 'open';
        state.qr = undefined;
        state.qrDataUrl = undefined;
        state.phoneNumber = this.extractPhoneNumber(socket.user?.id);
      }

      if (update.connection === 'close') {
        state.status = 'close';
        state.lastError =
          update.lastDisconnect?.error instanceof Error
            ? update.lastDisconnect.error.message
            : undefined;

        const statusCode = (
          update.lastDisconnect?.error as
            | { output?: { statusCode?: DisconnectReason | number } }
            | undefined
        )?.output?.statusCode;

        if (statusCode !== baileys.DisconnectReason.loggedOut) {
          state.connecting = this.connect(key, state);
          await state.connecting.catch(() => undefined);
          state.connecting = undefined;
        }
      }
    });

    return state;
  }

  private describe(sessionName: string, state: SessionState) {
    return {
      sessionName,
      status: state.status,
      connected: state.status === 'open',
      hasQr: Boolean(state.qr),
      phoneNumber: state.phoneNumber ?? null,
      lastError: state.lastError ?? null,
    };
  }

  private async waitForOpen(sessionName: string, timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    let state = this.sessions.get(sessionName);

    while (state && state.status !== 'open' && Date.now() < deadline) {
      await this.sleep(500);
      state = this.sessions.get(sessionName);
    }

    return state;
  }

  private loadBaileys() {
    this.baileysModule ??= import('@whiskeysockets/baileys');
    return this.baileysModule;
  }

  private getAuthFolder(sessionName: string) {
    const base =
      this.configService.get<string>('BAILEYS_SESSION_DIR')?.trim() ||
      'sessions/baileys';

    return `${base.replace(/[\\/]+$/, '')}/${sessionName}`;
  }

  private normalizeSessionName(value?: string) {
    const raw =
      value?.trim() ||
      this.configService.get<string>('BAILEYS_SESSION_NAME')?.trim() ||
      'default';

    return raw.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
  }

  private toJid(phone: string) {
    return `${normalizePhoneNumber(phone).slice(1)}@s.whatsapp.net`;
  }

  private extractPhoneNumber(jid?: string | null) {
    const match = jid?.match(/^(\d+)[:@]/);
    return match ? normalizePhoneNumber(`+${match[1]}`) : undefined;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async resolveAudioBuffer(input: {
    url?: string;
    data?: string;
  }): Promise<Buffer> {
    if (input.data?.trim()) {
      return Buffer.from(input.data.trim(), 'base64');
    }

    if (!input.url?.trim()) {
      throw new Error('Voice file is required. Provide either url or data.');
    }

    const response = await fetch(input.url.trim());

    if (!response.ok) {
      throw new Error(`Could not fetch voice URL (${response.status}).`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

"use client";

import { Mic, Upload, Link2 } from "lucide-react";

export type VoiceSourceMode = "url" | "file";

type VoiceMessageComposerProps = {
  recipientPhone: string;
  onRecipientPhoneChange: (value: string) => void;
  sourceMode: VoiceSourceMode;
  onSourceModeChange: (mode: VoiceSourceMode) => void;
  voiceUrl: string;
  onVoiceUrlChange: (value: string) => void;
  voiceData: string;
  onVoiceDataChange: (value: string) => void;
  filename: string;
  onFilenameChange: (value: string) => void;
  mimetype: string;
  onMimetypeChange: (value: string) => void;
  convert: boolean;
  onConvertChange: (value: boolean) => void;
  onFileSelect: (file: File) => void;
  onSend: () => void;
  sending?: boolean;
  connected?: boolean;
};

export default function VoiceMessageComposer({
  recipientPhone,
  onRecipientPhoneChange,
  sourceMode,
  onSourceModeChange,
  voiceUrl,
  onVoiceUrlChange,
  voiceData,
  filename,
  onFilenameChange,
  mimetype,
  onMimetypeChange,
  convert,
  onConvertChange,
  onFileSelect,
  onSend,
  sending = false,
  connected = false,
}: VoiceMessageComposerProps) {
  const canSend =
    connected &&
    recipientPhone.trim() &&
    (sourceMode === "url" ? voiceUrl.trim() : voiceData.trim()) &&
    !sending;
  const disabledReason = !connected
    ? "Connect and save the Baileys session first."
    : !recipientPhone.trim()
      ? "Choose a saved customer or type a recipient number."
      : sourceMode === "url" && !voiceUrl.trim()
        ? "Paste a public audio URL, or switch to Upload file."
        : sourceMode === "file" && !voiceData.trim()
          ? "Upload a recorded audio file first."
          : "";

  return (
    <div className="section-card p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Voice Composer
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">Send a voice note</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Uses{" "}
        <code className="font-mono">POST /whatsapp/voice/send</code>{" "}
        (URL or base64 file). OGG/Opus works best for WhatsApp voice-note playback.
      </p>
      <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
        <strong>Baileys voice enabled.</strong> This path uses a free linked-device
        WhatsApp Web session, not WAHA Plus. For MP3/WAV, convert the file to
        OGG/Opus before uploading. Do not use a sample URL here; upload or paste
        your own recorded voice note.{" "}
        <a
          href="https://github.com/WhiskeySockets/Baileys"
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline"
        >
          Baileys docs
        </a>
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Recipient Number
          </label>
          <input
            value={recipientPhone}
            onChange={(event) => onRecipientPhoneChange(event.target.value)}
            placeholder="+1234567890"
            className="mt-3 w-full rounded-2xl border border-violet-100 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white"
          />
        </div>

        <div className="flex gap-2 rounded-2xl border border-violet-100 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => onSourceModeChange("url")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              sourceMode === "url"
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Link2 className="h-4 w-4" />
            URL
          </button>
          <button
            type="button"
            onClick={() => onSourceModeChange("file")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              sourceMode === "file"
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload file
          </button>
        </div>

        {sourceMode === "url" ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Voice file URL
            </label>
            <input
              value={voiceUrl}
              onChange={(event) => onVoiceUrlChange(event.target.value)}
              placeholder="https://example.com/voice.opus"
              className="mt-3 w-full rounded-2xl border border-violet-100 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Audio file
              </label>
              <input
                type="file"
                accept="audio/*,.opus,.ogg,.mp3,.m4a,.wav"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFileSelect(file);
                }}
                className="mt-3 w-full rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {voiceData ? (
                <p className="mt-2 text-xs text-emerald-600">
                  File encoded ({Math.round(voiceData.length / 1024)} KB base64)
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Filename (optional)
              </label>
              <input
                value={filename}
                onChange={(event) => onFilenameChange(event.target.value)}
                placeholder="voice-message.opus"
                className="mt-3 w-full rounded-2xl border border-violet-100 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white"
              />
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            MIME type
          </label>
          <input
            value={mimetype}
            onChange={(event) => onMimetypeChange(event.target.value)}
            placeholder="audio/ogg; codecs=opus"
            className="mt-3 w-full rounded-2xl border border-violet-100 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <input
            type="checkbox"
            checked={convert}
            onChange={(event) => onConvertChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-violet-300 text-violet-600"
          />
          <span>
            <span className="text-sm font-semibold text-slate-900">
              Already converted to WhatsApp voice format
            </span>
            <span className="mt-1 block text-sm leading-6 text-slate-500">
              Keep this off for Baileys. The backend accepts the flag for API
              compatibility, but Baileys expects a ready OGG/Opus file.
            </span>
          </span>
        </label>

        <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Preview
          </p>
          <div className="mt-3 flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100">
              <Mic className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Voice message</p>
              <p className="text-xs text-slate-500">
                {sourceMode === "url"
                  ? voiceUrl.trim() || "Enter a public audio URL"
                  : filename || "Select an audio file"}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">transport: baileys/sendVoice</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,_#7c3aed,_#6d28d9)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(109,40,217,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {sending ? "Sending voice..." : "Send Baileys Voice Message"}
        </button>
        {!canSend && disabledReason ? (
          <p className="text-center text-xs font-semibold text-amber-700">
            {disabledReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}

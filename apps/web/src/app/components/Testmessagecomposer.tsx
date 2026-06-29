"use client";

import { useMemo, useState } from "react";
import { Search, Send, Sparkles } from "lucide-react";
import type { LeadRecord, TemplateRecord } from "@/lib/backend";

type TestMessageComposerProps = {
  templates: TemplateRecord[];
  contacts?: LeadRecord[];
  recipientPhone: string;
  onRecipientPhoneChange: (value: string) => void;
  onPickContact?: (contact: LeadRecord) => void;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  connected?: boolean;
};

export default function TestMessageComposer({
  templates,
  contacts = [],
  recipientPhone,
  onRecipientPhoneChange,
  onPickContact,
  message,
  onMessageChange,
  onSend,
  sending = false,
  connected = false,
}: TestMessageComposerProps) {
  const [search, setSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const approvedTemplates = templates.filter(
    (template) => (template.channel ?? "WHATSAPP") === "WHATSAPP",
  );

  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...contacts].sort((a, b) =>
      (a.name ?? a.phone).localeCompare(b.name ?? b.phone),
    );
    if (!needle) return sorted.slice(0, 8);

    return sorted
      .filter(
        (contact) =>
          (contact.name ?? "").toLowerCase().includes(needle) ||
          contact.phone.includes(needle) ||
          (contact.email ?? "").toLowerCase().includes(needle),
      )
      .slice(0, 12);
  }, [contacts, search]);

  return (
    <div>
      <p className="section-label">Test send</p>
      <h2 className="text-lg font-semibold text-neutral-900">
        Send your first WhatsApp test
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Pick one contact below or type a number. For many contacts, use bulk send
        in the section underneath.
      </p>

      <div className="mt-4 space-y-4">
        {contacts.length > 0 ? (
          <div>
            <label className="label" htmlFor="test-contact-search">
              Search contacts
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                id="test-contact-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or phone…"
                className="input pl-9"
              />
            </div>
            <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg border border-neutral-200 p-1">
              {filteredContacts.map((contact) => {
                const active = recipientPhone === contact.phone;
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      onRecipientPhoneChange(contact.phone);
                      onPickContact?.(contact);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-green-50 font-medium text-green-900"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <span>{contact.name ?? "Unnamed"}</span>
                    <span className="text-xs text-neutral-500">{contact.phone}</span>
                  </button>
                );
              })}
              {filteredContacts.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-neutral-500">
                  No contacts match your search.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="hint-box hint-box-info text-sm">
            No contacts imported yet. Add contacts on the{" "}
            <strong>Contacts</strong> page, then return here to search and send.
          </div>
        )}

        <div>
          <label className="label" htmlFor="recipient-phone">
            Recipient number
          </label>
          <input
            id="recipient-phone"
            value={recipientPhone}
            onChange={(event) => onRecipientPhoneChange(event.target.value)}
            placeholder="+1234567890"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="test-message">
            Message text
          </label>
          {approvedTemplates.length > 0 ? (
            <select
              value={selectedTemplateId}
              onChange={(event) => {
                const templateId = event.target.value;
                setSelectedTemplateId(templateId);
                const template = approvedTemplates.find((item) => item.id === templateId);
                if (template) onMessageChange(template.content);
              }}
              className="input mb-2"
            >
              <option value="">Write manually</option>
              {approvedTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          ) : null}
          <textarea
            id="test-message"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            rows={4}
            placeholder="Assalam o Alaikum, this is a live WAHA test from the dashboard."
            className="input resize-none"
          />
        </div>

        <div className="hint-box hint-box-info">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-sky-600" />
            <p className="text-sm text-neutral-700">
              {approvedTemplates.length > 0
                ? `${approvedTemplates.length} WhatsApp template(s) stored. Pick one above or write manually.`
                : "WAHA test sends are direct messages (no Meta template approval needed)."}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Preview
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-800">
            {message.trim() || "Your test message will appear here."}
          </p>
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!connected || !recipientPhone.trim() || !message.trim() || sending}
          className="btn btn-primary w-full"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {sending ? "Sending…" : "Send test to one contact"}
        </button>
      </div>
    </div>
  );
}

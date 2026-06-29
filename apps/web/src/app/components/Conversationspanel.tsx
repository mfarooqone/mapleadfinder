"use client";

import { useMemo, useState } from "react";
import {
  CheckCheck,
  MessageSquareMore,
  Search,
  Sparkles,
} from "lucide-react";
import type { ConversationRecord, MessageRecord } from "@/lib/backend";

type ConversationsPanelProps = {
  conversations: ConversationRecord[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  messages: MessageRecord[];
  loading?: boolean;
};

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusTone(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-emerald-100 text-emerald-700";
    case "CLOSED":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

export default function ConversationsPanel({
  conversations,
  selectedConversationId,
  onSelectConversation,
  messages,
  loading = false,
}: ConversationsPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const title = conversation.lead?.name ?? conversation.phone;
      const matchesSearch =
        search.trim().length === 0 ||
        title.toLowerCase().includes(search.toLowerCase()) ||
        conversation.phone.includes(search.trim());
      const matchesFilter =
        filter === "ALL" || conversation.status.toUpperCase() === filter;

      return matchesSearch && matchesFilter;
    });
  }, [conversations, filter, search]);

  const activeConversation =
    conversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? filteredConversations[0];

  return (
    <div className="overflow-hidden rounded-[30px] border border-emerald-100 bg-white/95 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
      <div className="grid min-h-[620px] xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-emerald-100 bg-[linear-gradient(180deg,_rgba(247,251,248,0.98),_rgba(240,253,246,0.76))] xl:border-b-0 xl:border-r">
          <div className="border-b border-emerald-100 px-5 py-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                  Conversations
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Live inbox
                </h2>
              </div>
              <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Active
                </p>
                <p className="text-lg font-semibold text-emerald-800">
                  {filteredConversations.length}
                </p>
              </div>
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or phone"
                className="w-full rounded-2xl border border-emerald-100 bg-white px-11 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <div className="mt-3 flex gap-2">
              {(["ALL", "OPEN", "CLOSED"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    filter === item
                      ? "bg-emerald-600 text-white shadow-[0_8px_20px_rgba(31,175,90,0.22)]"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {item.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const displayName = conversation.lead?.name ?? "Unknown lead";
                const isActive = conversation.id === activeConversation?.id;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`flex w-full items-start gap-3 border-b border-emerald-50 px-5 py-4 text-left transition ${
                      isActive
                        ? "bg-emerald-50/80"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#1FAF5A,_#60d394)] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,175,90,0.25)]">
                      {getInitials(displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {displayName}
                        </p>
                        <span className="text-xs text-slate-400">
                          {formatRelativeTime(
                            conversation.lastMessageAt ??
                              conversation.updatedAt,
                          )}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {conversation.phone}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(conversation.status)}`}
                        >
                          {conversation.status.toLowerCase()}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {conversation._count?.messages ?? 0} messages
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-5 py-10 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                  <MessageSquareMore className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  No conversations yet
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Send a Meta test message from the dashboard to create your
                  first conversation record.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col bg-[linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(247,251,248,0.9))]">
          {activeConversation ? (
            <>
              <div className="flex flex-wrap items-center gap-4 border-b border-emerald-100 px-6 py-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#1FAF5A,_#60d394)] text-sm font-semibold text-white">
                  {getInitials(
                    activeConversation.lead?.name ?? activeConversation.phone,
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-slate-900">
                    {activeConversation.lead?.name ?? activeConversation.phone}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {activeConversation.phone}
                  </p>
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusTone(activeConversation.status)}`}
                  >
                    {activeConversation.status.toLowerCase()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {activeConversation._count?.messages ?? 0} stored message(s)
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        index % 2 === 0 ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div className="h-20 w-full max-w-[440px] animate-pulse rounded-[26px] bg-slate-100" />
                    </div>
                  ))
                ) : messages.length > 0 ? (
                  messages.map((message) => {
                    const outgoing = message.direction === "OUTGOING";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          outgoing ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-[26px] px-5 py-4 text-sm leading-6 shadow-sm ${
                            outgoing
                              ? "rounded-tr-md bg-[linear-gradient(135deg,_#dff7e8,_#effcf3)] text-slate-800 ring-1 ring-emerald-100"
                              : "rounded-tl-md bg-white text-slate-700 ring-1 ring-slate-200"
                          }`}
                        >
                          <p>{message.content}</p>
                          <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
                            <span>{formatClock(message.createdAt)}</span>
                            {outgoing ? (
                              <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center">
                    <div className="max-w-md rounded-[28px] border border-dashed border-emerald-200 bg-white/80 px-8 py-10 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                        <Sparkles className="h-6 w-6 text-emerald-600" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-slate-900">
                        Conversation linked
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        The contact is present in PostgreSQL, but there are no
                        message rows for this thread yet.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-12">
              <div className="max-w-lg rounded-[30px] border border-dashed border-emerald-200 bg-white/80 px-10 py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-100">
                  <MessageSquareMore className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">
                  Inbox is ready for your first reply
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Once a WhatsApp test message is sent or a webhook reply comes
                  in, the full conversation thread will appear here.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

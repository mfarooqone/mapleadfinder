"use client";

import Link from "next/link";
import { MessageSquare, RefreshCw } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import type { ConversationRecord, MessageRecord } from "@/lib/backend";
import AppShell from "./AppShell";
import ConversationsPanel from "./Conversationspanel";
import EmptyState from "./Emptystates";
import PageHeader, { PageLink } from "./PageHeader";
import StatusBanner, { type BannerState } from "./StatusBanner";
import {
  fetchConversationMessages,
  fetchConversations,
} from "./dashboard-data";

export default function ConversationsWorkspace() {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);

  const loadConversationList = async () => {
    const nextConversations = await fetchConversations();
    startTransition(() => {
      setConversations(nextConversations);
      setSelectedConversationId((current) =>
        current && nextConversations.some((c) => c.id === current)
          ? current
          : (nextConversations[0]?.id ?? null),
      );
    });
    return nextConversations;
  };

  const loadMessages = async (conversationId: string) => {
    setMessageLoading(true);
    try {
      const nextMessages = await fetchConversationMessages(conversationId);
      startTransition(() => setMessages(nextMessages));
    } finally {
      setMessageLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextConversations = await fetchConversations();
        if (!active) return;
        startTransition(() => {
          setConversations(nextConversations);
          setSelectedConversationId(nextConversations[0]?.id ?? null);
        });
      } catch (error) {
        if (!active) return;
        setBanner({
          type: "error",
          message:
            error instanceof Error ? error.message : "Could not load conversations.",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      const nextConversations = await loadConversationList();
      if (
        selectedConversationId &&
        nextConversations.some((c) => c.id === selectedConversationId)
      ) {
        await loadMessages(selectedConversationId);
      }
      setBanner({ type: "success", message: "Inbox refreshed." });
    } catch (error) {
      setBanner({
        type: "error",
        message: error instanceof Error ? error.message : "Refresh failed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const openCount = conversations.filter((c) => c.status === "OPEN").length;

  return (
    <AppShell onRefresh={() => void handleRefresh()} refreshing={refreshing}>
      <div className="flex flex-col gap-4 pb-20 xl:pb-6">
        <PageHeader
          title="Inbox"
          description="Messages from your linked WhatsApp number."
          actions={
            <>
              <span className="badge badge-neutral">
                {loading ? "…" : `${conversations.length} threads`}
              </span>
              {openCount > 0 ? (
                <span className="badge badge-success">{openCount} open</span>
              ) : null}
              <PageLink href="/dashboard/whatsapp" primary>
                <MessageSquare className="h-4 w-4" />
                Send
              </PageLink>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="btn btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </>
          }
        />

        <StatusBanner banner={banner} />

        {!loading && conversations.length === 0 ? (
          <EmptyState
            variant="conversations"
            ctaLabel="Go to Send"
            onCta={() => {
              window.location.href = "/dashboard/whatsapp";
            }}
          />
        ) : (
          <div className="card overflow-hidden">
            <ConversationsPanel
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={setSelectedConversationId}
              messages={messages}
              loading={loading || messageLoading}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

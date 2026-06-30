import { Activity, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import type { ActivityItem } from "./Activityjobspanel";
import type { DashboardStatCard } from "./Statscards";
import {
  type BackendOverview,
  type ConnectedAccount,
  type ConversationRecord,
  type LeadRecord,
  type MessageRecord,
  type TemplateRecord,
  type TestingStatus,
  getJson,
} from "@/lib/backend";

export const DEFAULT_WAHA_SESSION = "default";
export const DEFAULT_TEST_MESSAGE = "WAHA test from the frontend.";

export type DashboardSummary = {
  overview: BackendOverview;
  status: TestingStatus;
  accounts: ConnectedAccount[];
  leads: LeadRecord[];
  templates: TemplateRecord[];
  conversations: ConversationRecord[];
};

export type WhatsappWorkspaceData = {
  status: TestingStatus;
  accounts: ConnectedAccount[];
  templates: TemplateRecord[];
};

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export async function fetchDashboardSummary(
  sessionName: string,
): Promise<DashboardSummary> {
  const [overview, status, accounts, leads, templates, conversations] =
    await Promise.all([
      getJson<BackendOverview>("/"),
      getJson<TestingStatus>(
        `/whatsapp/testing/waha/status?sessionName=${encodeURIComponent(sessionName)}`,
      ),
      getJson<ConnectedAccount[]>("/whatsapp/accounts"),
      getJson<LeadRecord[]>("/leads"),
      getJson<TemplateRecord[]>("/templates"),
      getJson<ConversationRecord[]>("/conversations"),
    ]);

  return {
    overview,
    status,
    accounts,
    leads,
    templates,
    conversations,
  };
}

export async function fetchWhatsappWorkspaceData(
  sessionName: string,
): Promise<WhatsappWorkspaceData> {
  const [status, accounts, templates] = await Promise.all([
    getJson<TestingStatus>(
      `/whatsapp/testing/waha/status?sessionName=${encodeURIComponent(sessionName)}`,
    ),
    getJson<ConnectedAccount[]>("/whatsapp/accounts"),
    getJson<TemplateRecord[]>("/templates"),
  ]);

  return {
    status,
    accounts,
    templates,
  };
}

export async function fetchLeads() {
  return getJson<LeadRecord[]>("/leads");
}

export async function fetchConversations() {
  return getJson<ConversationRecord[]>("/conversations");
}

export async function fetchConversationMessages(conversationId: string) {
  return getJson<MessageRecord[]>(`/messages/${conversationId}`);
}

export function buildDashboardStats({
  leads,
  templates,
  conversations,
  status,
}: {
  leads: LeadRecord[];
  templates: TemplateRecord[];
  conversations: ConversationRecord[];
  status: TestingStatus | null;
}): DashboardStatCard[] {
  const approvedTemplates = templates.filter(
    (template) => template.status === "APPROVED",
  ).length;
  const optedInLeads = leads.filter((lead) => lead.optIn).length;
  const totalConversationMessages = conversations.reduce(
    (sum, conversation) => sum + (conversation._count?.messages ?? 0),
    0,
  );

  return [
    {
      label: "Total Leads",
      value: formatCompactNumber(leads.length),
      hint: `${optedInLeads} opted-in and ready to message`,
      icon: Users,
      accent: "#059669",
      bg: "#D1FAE5",
      trend: leads.length > 0 ? "+24%" : "+0%",
      trendUp: true,
    },
    {
      label: "Active Conversations",
      value: formatCompactNumber(conversations.length),
      hint: `${conversations.filter((item) => item.status === "OPEN").length} currently open`,
      icon: MessagesSquare,
      accent: "#0284C7",
      bg: "#E0F2FE",
      trend: "+18%",
      trendUp: true,
    },
    {
      label: "Templates Ready",
      value: formatCompactNumber(approvedTemplates),
      hint: `${templates.length} total templates in the workspace`,
      icon: ShieldCheck,
      accent: "#7C3AED",
      bg: "#EDE9FE",
      trend: approvedTemplates > 0 ? "+6%" : "—",
      trendUp: true,
    },
    {
      label: "Messages Logged",
      value: formatCompactNumber(totalConversationMessages),
      hint: status?.envReady
        ? "WAHA session endpoint looks configured"
        : "Finish WAHA setup to unlock sending",
      icon: Activity,
      accent: "#D97706",
      bg: "#FEF3C7",
      trend: "+31%",
      trendUp: true,
    },
  ];
}

export function buildActivityItems({
  status,
  accounts,
  templates,
  conversations,
}: {
  status: TestingStatus | null;
  accounts: ConnectedAccount[];
  templates: TemplateRecord[];
  conversations: ConversationRecord[];
}): ActivityItem[] {
  const approvedTemplates = templates.filter(
    (template) => template.status === "APPROVED",
  ).length;

  return [
    {
      id: "env",
      title: status?.envReady
        ? "WAHA environment ready"
        : "WAHA environment still needs setup",
      description:
        status?.nextStep ?? "Fill the WAHA_* values and bootstrap the session.",
      state: status?.envReady ? "success" : "warning",
      meta: `Provider: ${status?.recommendedProvider ?? "WAHA"}`,
    },
    {
      id: "account",
      title: status?.connectedAccount
        ? "WhatsApp account connected"
        : "No WhatsApp account connected yet",
      description: status?.connectedAccount
        ? `${status.connectedAccount.phoneNumber} is active in the backend.`
        : "Use the connect action to create the WAHA session, scan QR, then connect again.",
      state: status?.connectedAccount ? "success" : "pending",
      meta: accounts.length > 0
        ? `${accounts[0]?.phoneNumber ?? "Linked"} on this login`
        : "No number linked yet",
    },
    {
      id: "session",
      title: "Session readiness",
      description: status?.wahaSession?.status
        ? `Current WAHA session status: ${status.wahaSession.status}.`
        : "WAHA session has not been created yet.",
      state: status?.wahaSession?.status === "WORKING" ? "success" : "warning",
      meta: `${approvedTemplates} template(s) still available in the backend`,
    },
    {
      id: "conversations",
      title: "Conversation history",
      description:
        conversations.length > 0
          ? "Incoming and outgoing messages are being stored in PostgreSQL."
          : "No conversation history yet. Send a test message to start.",
      state: conversations.length > 0 ? "processing" : "pending",
      meta: `${conversations.length} conversation(s)`,
    },
  ];
}

"use client";

import Link from "next/link";
import {
  Database,
  MessageSquareMore,
  Server,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Layers,
  Users,
  LayoutTemplate,
  MessagesSquare,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import type {
  BackendOverview,
  ConnectedAccount,
  ConversationRecord,
  TemplateRecord,
  TestingStatus,
} from "@/lib/backend";
import AppShell from "./AppShell";
import {
  DEFAULT_WAHA_SESSION,
  fetchDashboardSummary,
} from "./dashboard-data";

/* ─────────────────────────────────────────
   Design-system keyframes
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

  @keyframes bw-orb-a {
    0%,100% { transform:translate(0,0)       scale(1);    }
    33%     { transform:translate(18px,-22px) scale(1.07); }
    66%     { transform:translate(-14px,12px) scale(0.95); }
  }
  @keyframes bw-orb-b {
    0%,100% { transform:translate(0,0)        scale(1);    }
    50%     { transform:translate(-20px,18px) scale(1.04); }
  }
  @keyframes bw-orb-c {
    0%,100% { transform:translate(0,0)       scale(1);    }
    50%     { transform:translate(12px,-14px) scale(1.05); }
  }
  @keyframes bw-fade-up {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes bw-shimmer {
    0%   { transform:translateX(-150%); }
    100% { transform:translateX(200%);  }
  }
  @keyframes bw-ping {
    0%   { transform:scale(0.85); opacity:1; }
    100% { transform:scale(2.6);  opacity:0; }
  }
  @keyframes bw-spin {
    to { transform:rotate(360deg); }
  }
  @keyframes bw-gradient-pan {
    0%,100% { background-position:0%   50%; }
    50%     { background-position:100% 50%; }
  }
  @keyframes bw-count-in {
    from { opacity:0; transform:translateY(8px) scale(0.93); }
    to   { opacity:1; transform:translateY(0)   scale(1);    }
  }
  @keyframes bw-bar-grow {
    from { width:0%; }
  }
  @keyframes bw-module-in {
    from { opacity:0; transform:scale(0.88) translateY(4px); }
    to   { opacity:1; transform:scale(1)    translateY(0);   }
  }

  .bw-font  { font-family:'Outfit',sans-serif; }
  .bw-mono  { font-family:'JetBrains Mono',monospace; }

  .bw-orb-a { animation:bw-orb-a 10s ease-in-out infinite; }
  .bw-orb-b { animation:bw-orb-b 14s ease-in-out infinite; }
  .bw-orb-c { animation:bw-orb-c  8s ease-in-out infinite reverse; }

  .bw-fu-1 { animation:bw-fade-up .55s ease .05s both; }
  .bw-fu-2 { animation:bw-fade-up .55s ease .15s both; }
  .bw-fu-3 { animation:bw-fade-up .55s ease .22s both; }
  .bw-fu-4 { animation:bw-fade-up .55s ease .30s both; }
  .bw-fu-5 { animation:bw-fade-up .55s ease .38s both; }
  .bw-fu-6 { animation:bw-fade-up .55s ease .46s both; }

  .bw-count { animation:bw-count-in .5s ease .35s both; }

  .bw-shimmer-btn {
    position:relative;
    overflow:hidden;
  }
  .bw-shimmer-btn::after {
    content:'';
    position:absolute;
    inset:0;
    width:55%;
    background:linear-gradient(105deg,transparent,rgba(255,255,255,0.22),transparent);
    transform:translateX(-150%);
  }
  .bw-shimmer-btn:hover::after {
    animation:bw-shimmer .65s ease forwards;
  }

  .bw-glass {
    background:linear-gradient(145deg,rgba(255,255,255,0.075) 0%,rgba(255,255,255,0.025) 100%);
    backdrop-filter:blur(22px);
    -webkit-backdrop-filter:blur(22px);
    border:1px solid rgba(255,255,255,0.09);
    box-shadow:0 8px 40px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.07);
  }

  .bw-glow-border { position:relative; }
  .bw-glow-border::before {
    content:'';
    position:absolute;
    inset:-1px;
    border-radius:inherit;
    background:linear-gradient(135deg,rgba(52,211,153,.45),rgba(6,182,212,.2),transparent 60%);
    padding:1px;
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor;
    mask-composite:exclude;
    pointer-events:none;
  }

  .bw-gradient-text {
    background:linear-gradient(270deg,#10b981,#34d399,#06b6d4,#10b981);
    background-size:300% 300%;
    animation:bw-gradient-pan 5s ease infinite;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }

  .bw-spinning { animation:bw-spin .8s linear infinite; }
  .bw-bar      { animation:bw-bar-grow 1s ease .5s both; }

  .bw-module-pill {
    animation:bw-module-in .4s ease both;
  }
`;

/* ─────────────────────────────────────────
   Banner
───────────────────────────────────────── */
type BannerState = { type:"success"|"error"|"info"; message:string } | null;

function Banner({ banner }:{ banner:BannerState }) {
  if (!banner) return null;
  const cfg = {
    success:{ bg:"rgba(16,185,129,0.12)", border:"rgba(52,211,153,0.28)", color:"#6ee7b7", dot:"#34d399" },
    error:  { bg:"rgba(244,63,94,0.10)",  border:"rgba(244,63,94,0.28)",  color:"#fda4af", dot:"#f43f5e" },
    info:   { bg:"rgba(14,165,233,0.10)", border:"rgba(56,189,248,0.28)", color:"#7dd3fc", dot:"#38bdf8" },
  }[banner.type];
  return (
    <div className="bw-fu-2 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium"
      style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color }}>
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background:cfg.dot, boxShadow:`0 0 6px ${cfg.dot}` }} />
      {banner.message}
    </div>
  );
}

/* ─────────────────────────────────────────
   Stat card (4-col grid variant — compact)
───────────────────────────────────────── */
function StatCard({
  label, value, sublabel, icon:Icon, accentColor, delay,
}:{
  label:string; value:string|number; sublabel:string;
  icon:React.ElementType; accentColor:string; delay:string;
}) {
  return (
    <div
      className="bw-glass bw-glow-border group relative rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
      style={{ animation:`bw-fade-up .55s ease ${delay} both` }}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background:`${accentColor}18`, border:`1px solid ${accentColor}38`, boxShadow:`0 0 12px ${accentColor}18` }}>
          <Icon style={{ color:accentColor, width:16, height:16 }} />
        </div>
        <span className="h-1.5 w-6 rounded-full" style={{ background:`linear-gradient(90deg,${accentColor}80,${accentColor})`, marginTop:6 }} />
      </div>
      <p className="bw-count mt-3 text-3xl font-black tracking-[-0.05em]" style={{ color:"rgba(255,255,255,0.95)" }}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color:"rgba(100,116,139,0.7)" }}>
        {label}
      </p>
      <p className="mt-2 text-xs leading-5" style={{ color:"rgba(100,116,139,0.65)" }}>
        {sublabel}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Stack detail cell
───────────────────────────────────────── */
function StackCell({ label, value }:{ label:string; value:string }) {
  return (
    <div className="rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color:"rgba(100,116,139,0.65)" }}>
        {label}
      </p>
      <p className="bw-mono mt-2 text-sm font-medium" style={{ color:"rgba(226,232,240,0.88)" }}>
        {value}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Readiness tile
───────────────────────────────────────── */
function ReadinessTile({
  label, ok, okText, failText, okSub, failSub,
}:{
  label:string; ok:boolean; okText:string; failText:string; okSub:string; failSub:string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: ok
          ? "linear-gradient(135deg,rgba(16,185,129,0.13),rgba(6,182,212,0.07))"
          : "rgba(255,255,255,0.03)",
        border: ok ? "1px solid rgba(52,211,153,0.22)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {ok && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20"
          style={{ background:"radial-gradient(circle,#10b981,transparent)", filter:"blur(16px)" }} />
      )}
      <div className="relative flex items-start gap-3">
        {ok
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color:"#34d399", filter:"drop-shadow(0 0 4px rgba(52,211,153,0.6))" }} />
          : <XCircle    className="mt-0.5 h-4 w-4 shrink-0" style={{ color:"rgba(244,63,94,0.7)" }} />
        }
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color:"rgba(100,116,139,0.65)" }}>
            {label}
          </p>
          <p className="mt-1 text-sm font-bold" style={{ color:"rgba(226,232,240,0.92)" }}>
            {ok ? okText : failText}
          </p>
          <p className="mt-1.5 text-xs leading-5" style={{ color:"rgba(100,116,139,0.75)" }}>
            {ok ? okSub : failSub}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Main
───────────────────────────────────────── */
export default function BackendWorkspace() {
  const [overview,       setOverview]       = useState<BackendOverview | null>(null);
  const [status,         setStatus]         = useState<TestingStatus | null>(null);
  const [accounts,       setAccounts]       = useState<ConnectedAccount[]>([]);
  const [templates,      setTemplates]      = useState<TemplateRecord[]>([]);
  const [conversations,  setConversations]  = useState<ConversationRecord[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [banner,         setBanner]         = useState<BannerState>(null);

  const loadBackendRoute = async () => {
    const nextData = await fetchDashboardSummary(DEFAULT_WAHA_SESSION);
    startTransition(() => {
      setOverview(nextData.overview);
      setStatus(nextData.status);
      setAccounts(nextData.accounts);
      setTemplates(nextData.templates);
      setConversations(nextData.conversations);
    });
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const nextData = await fetchDashboardSummary(DEFAULT_WAHA_SESSION);
        if (!active) return;
        startTransition(() => {
          setOverview(nextData.overview);
          setStatus(nextData.status);
          setAccounts(nextData.accounts);
          setTemplates(nextData.templates);
          setConversations(nextData.conversations);
        });
      } catch (error) {
        if (!active) return;
        setBanner({ type:"error", message:error instanceof Error ? error.message : "Could not load the backend route." });
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setBanner(null);
    try {
      await loadBackendRoute();
      setBanner({ type:"success", message:"Backend route refreshed." });
    } catch (error) {
      setBanner({ type:"error", message:error instanceof Error ? error.message : "Could not refresh the backend route." });
    } finally {
      setRefreshing(false);
    }
  };

  const envReady  = Boolean(status?.envReady);
  const hasAcct   = Boolean(status?.connectedAccount);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <AppShell
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
        contentClassName="max-w-[1480px]"
      >
        <div className="bw-font flex flex-col gap-5">

          {/* ══════════════════════════════
              Page header
          ══════════════════════════════ */}
          <header
            className="bw-glow-border bw-fu-1 relative isolate overflow-hidden rounded-[2rem] p-6 md:p-8"
            style={{ background:"linear-gradient(150deg,#060f0a 0%,#08111f 55%,#060f0a 100%)" }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
              <div className="bw-orb-a absolute -left-28 -top-28 h-[360px] w-[360px] rounded-full"
                style={{ background:"radial-gradient(circle,rgba(16,185,129,0.38) 0%,transparent 70%)", filter:"blur(64px)", opacity:0.32 }} />
              <div className="bw-orb-b absolute -bottom-20 -right-20 h-[280px] w-[280px] rounded-full"
                style={{ background:"radial-gradient(circle,rgba(6,182,212,0.34) 0%,transparent 70%)", filter:"blur(72px)", opacity:0.26 }} />
              <div className="bw-orb-c absolute left-1/2 top-1/3 h-[220px] w-[220px] -translate-x-1/2 rounded-full"
                style={{ background:"radial-gradient(circle,rgba(99,102,241,0.2) 0%,transparent 70%)", filter:"blur(56px)", opacity:0.22 }} />
              <div className="absolute inset-0 opacity-[0.055]"
                style={{ backgroundImage:"radial-gradient(circle,rgba(52,211,153,1) 1px,transparent 1px)", backgroundSize:"26px 26px" }} />
              <div className="absolute left-0 right-0 h-px"
                style={{ top:"58%", background:"linear-gradient(90deg,transparent,rgba(52,211,153,0.28),rgba(6,182,212,0.28),transparent)" }} />
            </div>

            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="mb-4 inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5"
                  style={{ background:"rgba(16,185,129,0.10)", border:"1px solid rgba(52,211,153,0.25)", backdropFilter:"blur(12px)" }}>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ animation:"bw-ping 1.8s ease-out infinite", background:"#10b981" }} />
                    <span className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ background:"#34d399", boxShadow:"0 0 8px rgba(52,211,153,0.9)" }} />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color:"#6ee7b7" }}>
                    Dedicated Route
                  </span>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color:"rgba(52,211,153,0.7)" }}>
                  Infrastructure
                </p>
                <h1
                  className="mt-1.5 font-black leading-[1.08] tracking-[-0.04em] text-white"
                  style={{ fontSize:"clamp(1.8rem,3.5vw,2.6rem)" }}
                >
                  Backend{" "}
                  <span className="bw-gradient-text">Workspace</span>
                </h1>
                <p className="mt-2.5 max-w-xl text-sm leading-6" style={{ color:"rgba(148,163,184,0.8)" }}>
                  Infrastructure details on their own route — same Next proxy and
                  NestJS backend, separate from the inbox and sending flows.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/templates"
                  className="bw-shimmer-btn group inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  style={{
                    background:"linear-gradient(135deg,#059669 0%,#0d9488 60%,#0891b2 100%)",
                    boxShadow:"0 0 0 1px rgba(52,211,153,0.22),0 10px 36px rgba(16,185,129,0.38),0 4px 12px rgba(0,0,0,0.35)",
                  }}
                >
                  <ShieldCheck className="h-4 w-4" style={{ filter:"drop-shadow(0 0 4px rgba(255,255,255,0.6))" }} />
                  Open Templates Route
                  <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                </Link>

                <Link
                  href="/dashboard/whatsapp"
                  className="inline-flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  style={{
                    background:"rgba(255,255,255,0.055)",
                    border:"1px solid rgba(255,255,255,0.12)",
                    backdropFilter:"blur(16px)",
                    color:"rgba(226,232,240,0.88)",
                    boxShadow:"0 4px 20px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.07)",
                  }}
                >
                  <MessageSquareMore className="h-4 w-4" style={{ color:"#34d399" }} />
                  Open WhatsApp Route
                </Link>

                <button
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(100,116,139,0.85)" }}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "bw-spinning":""}`} style={{ color:"#34d399" }} />
                </button>
              </div>
            </div>
          </header>

          {/* ── Banner ── */}
          <Banner banner={banner} />

          {/* ══════════════════════════════
              4-col stat row
          ══════════════════════════════ */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard delay="0.16s" label="Provider"      icon={Layers}         accentColor="#34d399"
              value={loading ? "—" : (overview?.recommendedProvider ?? "WAHA")}
              sublabel="Recommended messaging provider reported by the backend." />
            <StatCard delay="0.22s" label="Accounts"      icon={Users}          accentColor="#38bdf8"
              value={loading ? "—" : accounts.length}
              sublabel="WhatsApp account records stored in PostgreSQL." />
            <StatCard delay="0.28s" label="Templates"     icon={LayoutTemplate} accentColor="#fb923c"
              value={loading ? "—" : templates.length}
              sublabel="Content records exposed to the frontend proxy." />
            <StatCard delay="0.34s" label="Conversations" icon={MessagesSquare} accentColor="#a78bfa"
              value={loading ? "—" : conversations.length}
              sublabel="Stored thread rows currently in the backend." />
          </div>

          {/* ══════════════════════════════
              Connected backend overview
          ══════════════════════════════ */}
          <section className="bw-glass bw-glow-border bw-fu-4 relative overflow-hidden rounded-[1.6rem] p-6">
            {/* Corner glow */}
            <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-20"
              style={{ background:"radial-gradient(circle,#10b981,transparent)", filter:"blur(28px)" }} />

            <div className="relative flex items-center gap-4 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background:"linear-gradient(135deg,rgba(16,185,129,0.2),rgba(6,182,212,0.12))", border:"1px solid rgba(52,211,153,0.28)", boxShadow:"0 0 16px rgba(16,185,129,0.2)" }}>
                <Database className="h-5 w-5" style={{ color:"#34d399" }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color:"rgba(226,232,240,0.95)" }}>
                  Connected backend overview
                </h2>
                <p className="text-xs" style={{ color:"rgba(100,116,139,0.75)" }}>
                  Frontend proxies the NestJS backend at{" "}
                  <code className="bw-mono ml-0.5 rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", color:"#6ee7b7" }}>
                    e:\whatsapp_agent
                  </code>
                </p>
              </div>
            </div>

            {/* Stack grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StackCell label="Framework" value={overview?.stack.framework    ?? "NestJS"} />
              <StackCell label="Database"  value={overview?.stack.database     ?? "PostgreSQL + Prisma"} />
              <StackCell label="Jobs"      value={overview?.stack.jobEngine    ?? "Database jobs + schedule"} />
              <StackCell label="Session"   value={status?.wahaSession?.status  ?? "NOT_CREATED"} />
            </div>

            {/* Module pills */}
            {(overview?.modules ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {(overview?.modules ?? []).map((item, i) => (
                  <span
                    key={item}
                    className="bw-module-pill rounded-full px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      animationDelay: `${0.5 + i * 0.05}s`,
                      background:"rgba(16,185,129,0.10)",
                      border:"1px solid rgba(52,211,153,0.22)",
                      color:"#6ee7b7",
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ══════════════════════════════
              Notes + Readiness
          ══════════════════════════════ */}
          <section className="bw-fu-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">

            {/* Operational notes */}
            <div className="bw-glass bw-glow-border relative overflow-hidden rounded-[1.6rem] p-6">
              <div aria-hidden className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full opacity-15"
                style={{ background:"radial-gradient(circle,#38bdf8,transparent)", filter:"blur(22px)" }} />

              <div className="relative flex items-center gap-4 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background:"rgba(56,189,248,0.12)", border:"1px solid rgba(56,189,248,0.28)", boxShadow:"0 0 14px rgba(56,189,248,0.15)" }}>
                  <Server className="h-4.5 w-4.5" style={{ color:"#38bdf8", width:18, height:18 }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color:"rgba(100,116,139,0.65)" }}>
                    Operational Notes
                  </p>
                  <h2 className="text-base font-bold" style={{ color:"rgba(226,232,240,0.95)" }}>
                    Backend notes from the API
                  </h2>
                </div>
              </div>

              <div className="relative space-y-2.5">
                {(overview?.notes ?? []).length > 0
                  ? (overview?.notes ?? []).map((note, i) => (
                      <div
                        key={note}
                        className="rounded-xl px-4 py-3 text-sm leading-6"
                        style={{
                          background:"rgba(255,255,255,0.04)",
                          border:"1px solid rgba(255,255,255,0.07)",
                          color:"rgba(148,163,184,0.85)",
                          animationDelay:`${0.4 + i * 0.06}s`,
                        }}
                      >
                        <span className="mr-2 text-[10px] font-bold uppercase tracking-wider" style={{ color:"rgba(52,211,153,0.5)" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {note}
                      </div>
                    ))
                  : (
                    <div className="rounded-xl px-4 py-3 text-sm"
                      style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", color:"rgba(100,116,139,0.6)" }}>
                      No backend notes were returned yet.
                    </div>
                  )}
              </div>
            </div>

            {/* Live readiness */}
            <div className="bw-glass bw-glow-border relative overflow-hidden rounded-[1.6rem] p-6">
              <div aria-hidden className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full opacity-15"
                style={{ background:"radial-gradient(circle,#34d399,transparent)", filter:"blur(22px)" }} />

              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color:"rgba(100,116,139,0.65)" }}>
                  Live Readiness
                </p>
                <h2 className="mt-1 text-base font-bold" style={{ color:"rgba(226,232,240,0.95)" }}>
                  System health check
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ReadinessTile
                    label="Environment"
                    ok={envReady}
                    okText="Ready"
                    failText="Needs setup"
                    okSub="Backend can reach the WAHA container."
                    failSub="Check WAHA_BASE_URL and restart the backend."
                  />
                  <ReadinessTile
                    label="Account"
                    ok={hasAcct}
                    okText="Saved"
                    failText="Pending"
                    okSub="Linked number is stored and ready for sends."
                    failSub="Create session, scan QR, then save the linked account."
                  />
                </div>

                {/* Overall health bar */}
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-[10px] font-semibold" style={{ color:"rgba(100,116,139,0.65)" }}>
                    <span>Overall health</span>
                    <span style={{ color:"#34d399" }}>
                      {envReady && hasAcct ? "100%" : envReady || hasAcct ? "50%" : "0%"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background:"rgba(255,255,255,0.05)" }}>
                    <div
                      className="bw-bar h-full rounded-full"
                      style={{
                        width: envReady && hasAcct ? "100%" : envReady || hasAcct ? "50%" : "0%",
                        background:"linear-gradient(90deg,#059669,#34d399,#06b6d4)",
                        boxShadow:"0 0 8px rgba(52,211,153,0.55)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </AppShell>
    </>
  );
}
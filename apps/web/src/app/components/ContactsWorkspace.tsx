"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  Save,
  Trash2,
  Upload,
  UserPlus,
  Users,
  ChevronRight,
  RefreshCw,
  Link2,
} from "lucide-react";
import {
  type LeadRecord,
  type ScrapeBatch,
  type UploadLeadsResponse,
  deleteJson,
  fetchWaMeLink,
  getJson,
  markWaMeLinkSent,
  patchJson,
  postJson,
} from "@/lib/backend";
import AppShell from "./AppShell";
import { getWarmUpLabel } from "./WahaContactPicker";

const CSV_SAMPLE = `name,phone,email,website
Sarah Khan,+1234567890,sarah@example.com,https://example.com
Ali Raza,+1987654321,ali@example.com,`;

/* ─────────────────────────────────────────
   Keyframes — same design system
───────────────────────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

  @keyframes cw-orb-a {
    0%,100% { transform:translate(0,0)       scale(1);    }
    33%     { transform:translate(18px,-22px) scale(1.07); }
    66%     { transform:translate(-14px,12px) scale(0.95); }
  }
  @keyframes cw-orb-b {
    0%,100% { transform:translate(0,0)        scale(1);    }
    50%     { transform:translate(-20px,18px) scale(1.04); }
  }
  @keyframes cw-fade-up {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes cw-shimmer {
    0%   { transform:translateX(-150%); }
    100% { transform:translateX(200%);  }
  }
  @keyframes cw-ping {
    0%   { transform:scale(0.85); opacity:1; }
    100% { transform:scale(2.6);  opacity:0; }
  }
  @keyframes cw-spin {
    to { transform:rotate(360deg); }
  }
  @keyframes cw-gradient-pan {
    0%,100% { background-position:0%   50%; }
    50%     { background-position:100% 50%; }
  }
  @keyframes cw-row-in {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0);    }
  }

  .cw-font { font-family:'Outfit',sans-serif; }
  .cw-mono { font-family:'JetBrains Mono',monospace; }

  .cw-orb-a { animation:cw-orb-a 10s ease-in-out infinite; }
  .cw-orb-b { animation:cw-orb-b 14s ease-in-out infinite; }

  .cw-fu-1 { animation:cw-fade-up .5s ease .05s both; }
  .cw-fu-2 { animation:cw-fade-up .5s ease .12s both; }
  .cw-fu-3 { animation:cw-fade-up .5s ease .20s both; }
  .cw-fu-4 { animation:cw-fade-up .5s ease .28s both; }
  .cw-fu-5 { animation:cw-fade-up .5s ease .36s both; }

  .cw-shimmer-btn {
    position:relative;
    overflow:hidden;
  }
  .cw-shimmer-btn::after {
    content:'';
    position:absolute;
    inset:0;
    width:55%;
    background:linear-gradient(105deg,transparent,rgba(255,255,255,0.22),transparent);
    transform:translateX(-150%);
  }
  .cw-shimmer-btn:hover::after {
    animation:cw-shimmer .65s ease forwards;
  }

  /* Light glass card */
  .cw-card {
    background:rgba(255,255,255,0.85);
    backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
    border:1px solid rgba(15,23,42,0.07);
    box-shadow:0 4px 24px rgba(15,23,42,0.06),inset 0 1px 0 rgba(255,255,255,0.9);
  }

  /* Glow border for cards */
  .cw-glow-border { position:relative; }
  .cw-glow-border::before {
    content:'';
    position:absolute;
    inset:-1px;
    border-radius:inherit;
    background:linear-gradient(135deg,rgba(52,211,153,.3),rgba(6,182,212,.12),transparent 60%);
    padding:1px;
    -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
    -webkit-mask-composite:xor;
    mask-composite:exclude;
    pointer-events:none;
  }

  .cw-gradient-text {
    background:linear-gradient(270deg,#10b981,#34d399,#06b6d4,#10b981);
    background-size:300% 300%;
    animation:cw-gradient-pan 5s ease infinite;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }

  .cw-spinning { animation:cw-spin .8s linear infinite; }

  /* Form inputs — light */
  .cw-input {
    width:100%;
    border-radius:1rem;
    border:1px solid #e2e8f0;
    background:#f8fafc;
    padding:0.75rem 1rem;
    font-size:0.875rem;
    color:#1e293b;
    outline:none;
    transition:border-color .2s,background .2s;
    font-family:'Outfit',sans-serif;
  }
  .cw-input::placeholder { color:#94a3b8; }
  .cw-input:focus {
    border-color:rgba(52,211,153,0.6);
    background:#ffffff;
    box-shadow:0 0 0 3px rgba(52,211,153,0.1);
  }

  /* Textarea mono */
  .cw-textarea {
    width:100%;
    border-radius:1.25rem;
    border:1px solid #e2e8f0;
    background:#f8fafc;
    padding:1rem;
    font-size:0.8125rem;
    color:#1e293b;
    outline:none;
    resize:none;
    transition:border-color .2s,background .2s;
    font-family:'JetBrains Mono',monospace;
    line-height:1.7;
  }
  .cw-textarea:focus {
    border-color:rgba(52,211,153,0.6);
    background:#ffffff;
    box-shadow:0 0 0 3px rgba(52,211,153,0.1);
  }

  /* Table row animation */
  .cw-row { animation:cw-row-in .35s ease both; }

  .cw-table-scroll {
    max-height:30rem;
    overflow-y:auto;
    overscroll-behavior:contain;
    scrollbar-width:thin;
    scrollbar-color:rgba(148,163,184,0.55) transparent;
  }
  .cw-table-scroll::-webkit-scrollbar {
    width:10px;
  }
  .cw-table-scroll::-webkit-scrollbar-track {
    background:transparent;
  }
  .cw-table-scroll::-webkit-scrollbar-thumb {
    background:linear-gradient(180deg,rgba(52,211,153,0.42),rgba(6,182,212,0.34));
    border-radius:999px;
    border:2px solid rgba(255,255,255,0.85);
  }

  /* Section label */
  .cw-label {
    display:block;
    font-size:10px;
    font-weight:700;
    letter-spacing:0.2em;
    text-transform:uppercase;
    color:#94a3b8;
    margin-bottom:0.6rem;
  }
`;

/* ─────────────────────────────────────────
   Banner
───────────────────────────────────────── */
type BannerState = { type:"success"|"error"|"info"; message:string } | null;

function Banner({ banner }:{ banner:BannerState }) {
  if (!banner) return null;
  const cfg = {
    success:{ bg:"#f0fdf4", border:"#bbf7d0", color:"#15803d", dot:"#22c55e" },
    error:  { bg:"#fff1f2", border:"#fecdd3", color:"#be123c", dot:"#f43f5e" },
    info:   { bg:"#f0f9ff", border:"#bae6fd", color:"#0369a1", dot:"#0ea5e9" },
  }[banner.type];
  return (
    <div className="cw-fu-2 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium"
      style={{ background:cfg.bg, border:`1px solid ${cfg.border}`, color:cfg.color }}>
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background:cfg.dot }} />
      {banner.message}
    </div>
  );
}

/* ─────────────────────────────────────────
   Main
───────────────────────────────────────── */
function getWebsiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export default function ContactsWorkspace() {
  const [leads, setLeads]             = useState<LeadRecord[]>([]);
  const [scrapeBatches, setScrapeBatches] = useState<ScrapeBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [savingSingle, setSavingSingle] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkOptingIn, setBulkOptingIn] = useState(false);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [copyingLinkLeadId, setCopyingLinkLeadId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [csvText, setCsvText] = useState(CSV_SAMPLE);
  const [banner, setBanner]   = useState<BannerState>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const sortedLeads = useMemo(
    () => [...leads].sort((l, r) => (l.name ?? l.phone).localeCompare(r.name ?? r.phone)),
    [leads],
  );
  const selectedBatch = useMemo(
    () => scrapeBatches.find((batch) => batch.id === selectedBatchId) ?? null,
    [scrapeBatches, selectedBatchId],
  );
  const leadIdSet = useMemo(() => new Set(leads.map((lead) => lead.id)), [leads]);
  const visibleLeadIds = useMemo(() => sortedLeads.map((lead) => lead.id), [sortedLeads]);
  const selectedLeadIdSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const selectedCount = selectedLeadIds.length;
  const allVisibleSelected =
    visibleLeadIds.length > 0 && visibleLeadIds.every((id) => selectedLeadIdSet.has(id));
  const someVisibleSelected =
    visibleLeadIds.some((id) => selectedLeadIdSet.has(id)) && !allVisibleSelected;

  useEffect(() => {
    setSelectedLeadIds((current) => {
      const next = current.filter((id) => leadIdSet.has(id));
      return next.length === current.length ? current : next;
    });
  }, [leadIdSet]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const loadBatches = useCallback(async () => {
    const data = await getJson<ScrapeBatch[]>("/scrape/batches");
    setScrapeBatches(data);
    setSelectedBatchId((current) =>
      current && data.some((batch) => batch.id === current) ? current : "",
    );
    return data;
  }, []);

  const loadLeads = useCallback(async () => {
    const data = await getJson<LeadRecord[]>(
      selectedBatchId
        ? `/scrape/batches/${encodeURIComponent(selectedBatchId)}/leads`
        : "/leads",
    );
    setLeads(data);
    return data;
  }, [selectedBatchId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await loadBatches();
        await loadLeads();
      }
      catch (error) {
        if (!active) return;
        setBanner({ type:"error", message: error instanceof Error ? error.message : "Could not load saved contacts." });
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, [loadBatches, loadLeads]);

  const handleSaveSingle = async () => {
    setSavingSingle(true); setBanner(null);
    try {
      await postJson<
        LeadRecord,
        { name?:string; phone:string; email?:string; website?:string; optIn:boolean }
      >(
        "/leads",
        {
          name: name.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          optIn: true,
        },
      );
      await loadLeads();
      setName(""); setPhone(""); setEmail(""); setWebsite("");
      setBanner({ type:"success", message:"Contact saved successfully." });
    } catch (error) {
      setBanner({ type:"error", message: error instanceof Error ? error.message : "Could not save the contact." });
    } finally { setSavingSingle(false); }
  };

  const handleUploadCsv = async () => {
    setUploading(true); setBanner(null);
    try {
      const response = await postJson<UploadLeadsResponse,{ csv:string }>(
        "/leads/upload",
        { csv: csvText },
      );
      await loadLeads();
      setBanner({ type:"success", message:`${response.imported} contact(s) imported${response.skipped ? `, ${response.skipped} skipped` : ""}.` });
    } catch (error) {
      setBanner({ type:"error", message: error instanceof Error ? error.message : "CSV upload failed." });
    } finally { setUploading(false); }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setBanner({ type:"info", message:`${file.name} loaded. Review it, then click Import Contacts.` });
    event.target.value = "";
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBatches();
      await loadLeads();
      setBanner({ type:"info", message:"Contacts refreshed." });
    } catch (error) {
      setBanner({ type:"error", message: error instanceof Error ? error.message : "Could not refresh contacts." });
    } finally { setRefreshing(false); }
  };

  const handleCopyWaMeLink = async (lead: LeadRecord) => {
    setCopyingLinkLeadId(lead.id);
    setBanner(null);
    try {
      const response = await fetchWaMeLink(lead.id, "Hi");
      await markWaMeLinkSent(lead.id);
      await navigator.clipboard.writeText(response.link);
      await loadLeads();
      setBanner({
        type: "success",
        message: `WhatsApp invite link copied for ${lead.name ?? lead.phone}. Send it by email or SMS — do not cold-DM on WhatsApp until they reply.`,
      });
    } catch (error) {
      setBanner({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not copy invite link.",
      });
    } finally {
      setCopyingLinkLeadId(null);
    }
  };

  const handleDeleteLead = async (lead: LeadRecord) => {
    const label = lead.name?.trim() || lead.phone;
    if (!window.confirm(`Remove ${label} from saved contacts? It will stay in the database.`)) return;
    setDeletingLeadId(lead.id); setBanner(null);
    try {
      await deleteJson<{ deleted:boolean; id:string }>(`/leads/${lead.id}`);
      await loadLeads();
      setSelectedLeadIds((current) => current.filter((id) => id !== lead.id));
      setBanner({ type:"success", message:`${label} removed from saved contacts.` });
    } catch (error) {
      setBanner({ type:"error", message: error instanceof Error ? error.message : "Could not delete contact." });
    } finally { setDeletingLeadId(null); }
  };

  const handleToggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId],
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedLeadIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleLeadIds.includes(id));
      }

      return [...new Set([...current, ...visibleLeadIds])];
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedCount === 0) return;
    const label =
      selectedCount === 1 ? "this selected contact" : `${selectedCount} selected contacts`;

    if (!window.confirm(`Remove ${label} from saved contacts? They will stay in the database.`)) {
      return;
    }

    setBulkDeleting(true);
    setBanner(null);

    try {
      const response = await patchJson<
        { deleted:boolean; count:number; ids:string[] },
        { ids:string[] }
      >("/leads/bulk/delete", { ids: selectedLeadIds });
      await loadLeads();
      setSelectedLeadIds([]);
      setBanner({
        type:"success",
        message:`${response.count} contact(s) removed from saved contacts.`,
      });
    } catch (error) {
      setBanner({
        type:"error",
        message: error instanceof Error ? error.message : "Could not delete selected contacts.",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleOptInSelected = async () => {
    if (selectedCount === 0) return;
    const label =
      selectedCount === 1 ? "this selected contact" : `${selectedCount} selected contacts`;

    if (
      !window.confirm(
        `Mark ${label} as opted-in for WhatsApp outreach? Only do this after you have consent or a valid warm-up reply.`,
      )
    ) {
      return;
    }

    setBulkOptingIn(true);
    setBanner(null);

    try {
      const response = await patchJson<
        { updated:boolean; count:number; optIn:boolean; ids:string[] },
        { ids:string[]; optIn:boolean }
      >("/leads/bulk/opt-in", { ids: selectedLeadIds, optIn: true });
      await loadLeads();
      setBanner({
        type:"success",
        message:`${response.count} contact(s) marked opted-in.`,
      });
    } catch (error) {
      setBanner({
        type:"error",
        message: error instanceof Error ? error.message : "Could not mark selected contacts opted-in.",
      });
    } finally {
      setBulkOptingIn(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <AppShell
        onRefresh={() => void handleRefresh()}
        refreshing={refreshing}
        contentClassName="max-w-6xl"
      >
        <div className="cw-font flex flex-col gap-5">

          <header className="card card-pad border-l-4 border-l-emerald-500">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div>
                <Link
                  href="/dashboard/whatsapp/setup"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to WAHA setup
                </Link>

                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  CRM
                </p>
                <h1 className="page-title mt-1">Contacts Workspace</h1>
                <p className="page-subtitle mt-2 max-w-2xl">
                  Upload contact lists, save individual customers, and keep the WAHA dropdown ready for outreach.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-5 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    Saved Contacts
                  </p>
                  <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-emerald-800">
                    {loading ? "-" : sortedLeads.length}
                  </p>
                </div>

                <button
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                  className="btn btn-secondary"
                  title="Refresh contacts"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "cw-spinning" : ""}`} />
                </button>
              </div>
            </div>
          </header>

          {/* ── Banner ── */}
          <Banner banner={banner} />

          {/* ══════════════════════════════
              Two-col: Manual Add + CSV
          ══════════════════════════════ */}
          <section className="cw-fu-3 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">

            {/* ── Left: Manual add ── */}
            <div className="cw-card cw-glow-border flex flex-col gap-5 rounded-[2rem] p-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background:"linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.08))", border:"1px solid rgba(52,211,153,0.25)", boxShadow:"0 0 14px rgba(16,185,129,0.12)" }}>
                  <UserPlus className="h-5 w-5" style={{ color:"#10b981" }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Manual Add</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Save a single contact</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Add one contact quickly. The saved record appears in the WAHA dropdown automatically.
                  </p>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-3.5">
                {[
                  { label:"Name",   val:name,  set:setName,  ph:"Sarah Khan" },
                  { label:"Number", val:phone, set:setPhone, ph:"+1234567890" },
                  { label:"Email",  val:email, set:setEmail, ph:"sarah@example.com" },
                  { label:"Website", val:website, set:setWebsite, ph:"https://example.com" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label}>
                    <label className="cw-label">{label}</label>
                    <input value={val} onChange={(e) => set(e.target.value)} placeholder={ph} className="cw-input" />
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleSaveSingle}
                disabled={savingSingle || !phone.trim()}
                className="cw-shimmer-btn group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background:"linear-gradient(135deg,#059669 0%,#0d9488 60%,#0891b2 100%)",
                  boxShadow:"0 0 0 1px rgba(52,211,153,0.22),0 10px 36px rgba(16,185,129,0.28),0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                {savingSingle
                  ? <LoaderCircle className="h-4 w-4 cw-spinning" />
                  : <Save className="h-4 w-4" style={{ filter:"drop-shadow(0 0 4px rgba(255,255,255,0.6))" }} />}
                Save Contact
              </button>

              {/* Info tip */}
              <div className="rounded-xl px-4 py-3"
                style={{ background:"rgba(240,253,244,0.9)", border:"1px solid #bbf7d0" }}>
                <p className="text-xs leading-5 text-emerald-700">
                  <span className="font-bold">Tip:</span> All manually saved contacts are auto-opted in and will appear in the WAHA Setup contact dropdown.
                </p>
              </div>
            </div>

            {/* ── Right: CSV upload ── */}
            <div className="cw-card cw-glow-border flex flex-col gap-5 rounded-[2rem] p-6">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background:"linear-gradient(135deg,rgba(14,165,233,0.15),rgba(2,132,199,0.08))", border:"1px solid rgba(56,189,248,0.25)", boxShadow:"0 0 14px rgba(14,165,233,0.12)" }}>
                  <Upload className="h-5 w-5" style={{ color:"#0ea5e9" }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Bulk Upload</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Import contacts from CSV</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    Headers: <code className="cw-mono rounded px-1 text-[11px]" style={{ background:"#f1f5f9", color:"#0f172a" }}>name</code>{" "}
                    <code className="cw-mono rounded px-1 text-[11px]" style={{ background:"#f1f5f9", color:"#0f172a" }}>phone</code>{" "}
                    <code className="cw-mono rounded px-1 text-[11px]" style={{ background:"#f1f5f9", color:"#0f172a" }}>email</code>{" "}
                    <code className="cw-mono rounded px-1 text-[11px]" style={{ background:"#f1f5f9", color:"#0f172a" }}>website</code>.
                    Empty rows are skipped automatically.
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="flex flex-wrap gap-3">
                <label
                  className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/60"
                >
                  <FileUp className="h-4 w-4 text-emerald-600" />
                  Load CSV File
                  <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                </label>
                <Link
                  href="/dashboard/whatsapp/setup"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/60"
                >
                  <Users className="h-4 w-4 text-sky-600" />
                  Open WAHA Dropdown
                  <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                </Link>
              </div>

              {/* CSV textarea */}
              <div className="flex-1">
                <label className="cw-label">CSV Content</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={10}
                  className="cw-textarea"
                />
              </div>

              {/* Import CTA */}
              <button
                onClick={handleUploadCsv}
                disabled={uploading || !csvText.trim()}
                className="cw-shimmer-btn group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 py-4 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background:"linear-gradient(135deg,#0284c7 0%,#0891b2 60%,#06b6d4 100%)",
                  boxShadow:"0 0 0 1px rgba(14,165,233,0.22),0 10px 36px rgba(14,165,233,0.28),0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                {uploading
                  ? <LoaderCircle className="h-4 w-4 cw-spinning" />
                  : <Upload className="h-4 w-4" style={{ filter:"drop-shadow(0 0 4px rgba(255,255,255,0.6))" }} />}
                Import Contacts
              </button>
            </div>
          </section>

          {/* ══════════════════════════════
              Contacts table
          ══════════════════════════════ */}
          <section className="cw-card cw-glow-border cw-fu-4 rounded-[2rem] p-6">
            {/* Table header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Saved List</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {selectedBatch ? selectedBatch.keyword : "Stored contacts"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedBatch
                    ? "Showing contacts from this scraped search group."
                    : "Showing all saved contacts across manual, CSV, and scraper imports."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {sortedLeads.length > 0 ? (
                  <>
                    <button
                      onClick={handleToggleSelectAll}
                      disabled={bulkDeleting || deletingLeadId !== null}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {allVisibleSelected ? "Clear selection" : "Select all"}
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={selectedCount === 0 || bulkDeleting || bulkOptingIn || deletingLeadId !== null}
                      className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background:"rgba(255,241,242,0.9)", border:"1px solid #fecdd3", color:"#be123c" }}
                    >
                      {bulkDeleting
                        ? <LoaderCircle className="h-3.5 w-3.5 cw-spinning" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                      Delete selected
                    </button>
                    <button
                      onClick={handleOptInSelected}
                      disabled={selectedCount === 0 || bulkDeleting || bulkOptingIn || deletingLeadId !== null}
                      className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background:"rgba(240,253,244,0.95)", border:"1px solid #bbf7d0", color:"#047857" }}
                    >
                      {bulkOptingIn
                        ? <LoaderCircle className="h-3.5 w-3.5 cw-spinning" />
                        : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Mark opted-in
                    </button>
                    {selectedCount > 0 ? (
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold"
                        style={{ background:"rgba(236,253,245,0.95)", border:"1px solid #a7f3d0", color:"#047857" }}
                      >
                        {selectedCount} selected
                      </span>
                    ) : null}
                  </>
                ) : null}
                {loading ? (
                  <span className="text-sm text-slate-400">Loading…</span>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold"
                    style={{ background:"rgba(240,253,244,0.9)", border:"1px solid #bbf7d0", color:"#15803d" }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {sortedLeads.length} saved
                  </span>
                )}
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong>Lowest-risk outreach:</strong> copy a wa.me invite link per contact and
              send it by email or SMS. When they message you first, status becomes Engaged and
              bulk send on Setup can pitch them safely.
            </div>

            {scrapeBatches.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Scraped lead tabs
                  </p>
                  <p className="text-xs text-slate-500">
                    Tabs group contacts by the search keyword used in scraper.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBatchId("")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selectedBatchId === ""
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All contacts
                  </button>
                  {scrapeBatches.map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      onClick={() => setSelectedBatchId(batch.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        selectedBatchId === batch.id
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {batch.keyword}
                      <span className="ml-2 opacity-75">{batch.leadCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white/70">
              {/* Table head */}
              <div
                className="grid grid-cols-[auto_1.1fr_0.9fr_0.8fr_0.9fr_0.7fr_auto] gap-3 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ background:"rgba(248,250,252,0.9)", color:"#94a3b8", borderBottom:"1px solid #f1f5f9" }}
              >
                <label className="flex items-center justify-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    disabled={sortedLeads.length === 0 || bulkDeleting || deletingLeadId !== null}
                    aria-label="Select all contacts"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                  />
                </label>
                <span>Name</span>
                <span>Phone</span>
                <span>Email</span>
                <span>Website</span>
                <span>Warm-up</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Table body */}
              <div className="cw-table-scroll divide-y divide-slate-50">
                {sortedLeads.length > 0 ? (
                  sortedLeads.map((lead, i) => (
                    <div
                      key={lead.id}
                      className={`cw-row grid grid-cols-[auto_1.1fr_0.9fr_0.8fr_0.9fr_0.7fr_auto] gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50/80 ${selectedLeadIdSet.has(lead.id) ? "bg-emerald-50/60" : ""}`}
                      style={{ animationDelay:`${i * 0.04}s` }}
                    >
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedLeadIdSet.has(lead.id)}
                          onChange={() => handleToggleLeadSelection(lead.id)}
                          disabled={bulkDeleting || deletingLeadId !== null}
                          aria-label={`Select ${lead.name ?? lead.phone}`}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
                        />
                      </label>
                      <span className="font-semibold text-slate-900 truncate">
                        {lead.name ?? "Unnamed contact"}
                      </span>
                      <span className="cw-mono text-[12px] text-slate-600 truncate">{lead.phone}</span>
                      <span className="text-slate-500 truncate">{lead.email ?? "—"}</span>
                      {lead.website ? (
                        <a
                          href={getWebsiteHref(lead.website)}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sky-700 underline-offset-4 hover:underline"
                        >
                          {lead.website}
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                      <span className="text-xs font-semibold text-slate-600">
                        {getWarmUpLabel(lead)}
                      </span>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => void handleCopyWaMeLink(lead)}
                          disabled={
                            bulkDeleting ||
                            deletingLeadId === lead.id ||
                            copyingLinkLeadId === lead.id
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background:"rgba(240,253,244,0.95)", border:"1px solid #bbf7d0", color:"#047857" }}
                        >
                          {copyingLinkLeadId === lead.id
                            ? <LoaderCircle className="h-3.5 w-3.5 cw-spinning" />
                            : <Link2 className="h-3.5 w-3.5" />}
                          Copy link
                        </button>
                        <button
                          onClick={() => void handleDeleteLead(lead)}
                          disabled={bulkDeleting || deletingLeadId === lead.id}
                          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background:"rgba(255,241,242,0.9)", border:"1px solid #fecdd3", color:"#be123c" }}
                        >
                          {deletingLeadId === lead.id
                            ? <LoaderCircle className="h-3.5 w-3.5 cw-spinning" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center gap-3 py-14 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ background:"rgba(240,253,244,0.9)", border:"1px solid #bbf7d0" }}>
                      <Users className="h-6 w-6" style={{ color:"#10b981" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">No contacts saved yet</p>
                      <p className="mt-1 text-xs text-slate-400">Add one manually or import a CSV above.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </AppShell>
    </>
  );
}

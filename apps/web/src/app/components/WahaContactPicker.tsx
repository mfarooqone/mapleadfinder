"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { LeadRecord, ScrapeBatch } from "@/lib/backend";

function getContactState(lead: LeadRecord) {
  return lead.contactState === "CONTACTED" || lead.status === "CONTACTED"
    ? "CONTACTED"
    : "NEW";
}

function getContactStateLabel(lead: LeadRecord) {
  return getContactState(lead) === "CONTACTED" ? "Contacted" : "New";
}

function getWarmUpLabel(lead: LeadRecord) {
  switch (lead.warmUpStatus) {
    case "ENGAGED":
      return "Engaged";
    case "LINK_SENT":
      return "Link sent";
    case "BLOCKED":
      return "Blocked";
    default:
      return "Pending";
  }
}

function getWarmUpBadgeClass(lead: LeadRecord) {
  switch (lead.warmUpStatus) {
    case "ENGAGED":
      return "badge-success";
    case "LINK_SENT":
      return "badge-info";
    case "BLOCKED":
      return "badge-error";
    default:
      return "badge-warning";
  }
}

function isBulkEligible(lead: LeadRecord, requireIncoming: boolean) {
  if (lead.warmUpStatus === "BLOCKED") return false;
  if (requireIncoming && !lead.hasIncoming) return false;
  return true;
}

function getWebsiteHref(website: string) {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function matchesSearch(contact: LeadRecord, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    (contact.name ?? "").toLowerCase().includes(needle) ||
    contact.phone.includes(needle) ||
    (contact.email ?? "").toLowerCase().includes(needle) ||
    (contact.website ?? "").toLowerCase().includes(needle)
  );
}

type WahaContactPickerProps = {
  contacts: LeadRecord[];
  selectedContactId: string;
  selectedContactIds: string[];
  onSelectContact: (id: string) => void;
  onToggleContact: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearAll: () => void;
  scrapeBatches?: ScrapeBatch[];
  selectedBatchId?: string;
  onSelectBatch?: (batchId: string) => void;
  requireIncoming?: boolean;
  onSelectEngagedOnly?: () => void;
  showQuickPick?: boolean;
};

export default function WahaContactPicker({
  contacts,
  selectedContactId,
  selectedContactIds,
  onSelectContact,
  onToggleContact,
  onSelectAll,
  onClearAll,
  scrapeBatches = [],
  selectedBatchId = "",
  onSelectBatch,
  requireIncoming = false,
  onSelectEngagedOnly,
  showQuickPick = true,
}: WahaContactPickerProps) {
  const [search, setSearch] = useState("");

  const sortedContacts = useMemo(
    () =>
      [...contacts].sort((a, b) =>
        (a.name ?? a.phone).localeCompare(b.name ?? b.phone),
      ),
    [contacts],
  );

  const filteredContacts = useMemo(
    () => sortedContacts.filter((contact) => matchesSearch(contact, search)),
    [search, sortedContacts],
  );

  const selectedContact =
    sortedContacts.find((c) => c.id === selectedContactId) ?? null;
  const eligibleCount = sortedContacts.filter((c) =>
    isBulkEligible(c, requireIncoming),
  ).length;
  const visibleSelectedCount = filteredContacts.filter((contact) =>
    selectedContactIds.includes(contact.id),
  ).length;
  const allVisibleSelected =
    filteredContacts.length > 0 &&
    visibleSelectedCount === filteredContacts.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && !allVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredContacts.map((contact) => contact.id));
      const remaining = selectedContactIds.filter((id) => !visibleIds.has(id));
      onSelectAll(remaining);
      return;
    }

    const merged = new Set([
      ...selectedContactIds,
      ...filteredContacts.map((contact) => contact.id),
    ]);
    onSelectAll([...merged]);
  };

  return (
    <div className="space-y-3">
      {requireIncoming ? (
        <div className="hint-box hint-box-warning text-xs">
          Bulk send only queues contacts who have messaged you first (engaged).
          Use <strong>Copy WhatsApp invite link</strong> on the Contacts page for
          everyone else.
        </div>
      ) : null}

      {scrapeBatches.length > 0 && onSelectBatch ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-neutral-700">Lead lists</p>
            <p className="text-xs text-neutral-500">
              Select one list, then use the buttons below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectBatch("")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selectedBatchId === ""
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              All leads
            </button>
            {scrapeBatches.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => onSelectBatch(batch.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedBatchId === batch.id
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {batch.keyword}
                <span className="ml-2 opacity-75">{batch.leadCount}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="contact-search">
          Search contacts
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            id="contact-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, email, or website…"
            className="input pl-9"
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          {search.trim()
            ? `Showing ${filteredContacts.length} of ${sortedContacts.length} imported contact(s)`
            : `${sortedContacts.length} imported contact(s) · ${selectedContactIds.length} selected for bulk`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectAll(sortedContacts.map((contact) => contact.id))}
          className="btn btn-secondary text-xs"
          disabled={sortedContacts.length === 0}
        >
          Select all ({sortedContacts.length})
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectAll(filteredContacts.map((contact) => contact.id))
          }
          className="btn btn-secondary text-xs"
          disabled={filteredContacts.length === 0}
        >
          Select shown ({filteredContacts.length})
        </button>
        {onSelectEngagedOnly ? (
          <button
            type="button"
            onClick={onSelectEngagedOnly}
            className="btn btn-secondary text-xs"
          >
            Select engaged ({eligibleCount})
          </button>
        ) : null}
        <button type="button" onClick={onClearAll} className="btn btn-ghost text-xs">
          Clear ({selectedContactIds.length})
        </button>
      </div>

      {showQuickPick ? (
        <div>
          <label className="label" htmlFor="setup-contact">
            Quick pick one contact (for test send)
          </label>
          <select
            id="setup-contact"
            value={selectedContactId}
            onChange={(e) => onSelectContact(e.target.value)}
            className="input"
          >
            <option value="">None selected</option>
            {filteredContacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {(contact.name ?? "Unnamed") +
                  " · " +
                  contact.phone +
                  " · " +
                  getContactStateLabel(contact)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-neutral-500">
            {selectedContact
              ? `${selectedContact.name ?? "Unnamed"} (${selectedContact.phone}) — fills the test recipient field`
              : "Pick a contact or type a phone number in the send section."}
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <div className="flex items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            ref={(input) => {
              if (input) input.indeterminate = someVisibleSelected;
            }}
            onChange={handleToggleSelectAllVisible}
            disabled={filteredContacts.length === 0}
            className="h-4 w-4"
            aria-label="Select all visible contacts"
          />
          <span className="text-xs font-medium text-neutral-600">
            {allVisibleSelected
              ? "All visible selected"
              : `${visibleSelectedCount} of ${filteredContacts.length} visible selected`}
          </span>
        </div>

        <div className="max-h-56 space-y-1 overflow-auto p-2">
          {filteredContacts.length > 0 ? (
            filteredContacts.map((contact) => {
              const checked = selectedContactIds.includes(contact.id);
              return (
                <label
                  key={contact.id}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-2 ${
                    checked
                      ? "border border-green-200 bg-green-50"
                      : "hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleContact(contact.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-left"
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectContact(contact.id);
                        }}
                      >
                        <p className="text-sm font-medium text-neutral-900">
                          {contact.name ?? "Unnamed contact"}
                        </p>
                        <p className="text-xs text-neutral-500">{contact.phone}</p>
                      </button>
                      {contact.website ? (
                        <a
                          href={getWebsiteHref(contact.website)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-sky-600 hover:underline"
                        >
                          <span className="max-w-[160px] truncate">{contact.website}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${getWarmUpBadgeClass(contact)}`}>
                      {getWarmUpLabel(contact)}
                    </span>
                    <span
                      className={`badge ${
                        getContactState(contact) === "NEW"
                          ? "badge-warning"
                          : "badge-neutral"
                      }`}
                    >
                      {getContactStateLabel(contact)}
                    </span>
                  </div>
                </label>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-sm text-neutral-500">
              {sortedContacts.length === 0
                ? "No contacts yet. Import them from the Contacts page."
                : "No contacts match your search."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { getContactState, getContactStateLabel, isBulkEligible, getWarmUpLabel };

import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Toast({ show, message, type }) {
  if (!show) return null;
  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div
        className={cx(
          "rounded-lg border px-4 py-3 shadow-xl backdrop-blur",
          "bg-slate-950/80 border-slate-800 text-slate-100",
          type === "success" && "border-emerald-700/60",
          type === "error" && "border-rose-700/60",
          type === "info" && "border-sky-700/60"
        )}
      >
        <div className="text-sm font-semibold">{message}</div>
      </div>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function StatusPill({ status }) {
  const s = status || "—";
  const cls =
    s === "success"
      ? "border-emerald-700/50 text-emerald-200"
      : s === "failed"
        ? "border-rose-700/50 text-rose-200"
        : s === "running"
          ? "border-sky-700/50 text-sky-200"
          : s === "queued"
            ? "border-amber-700/50 text-amber-200"
            : "border-slate-800 text-slate-300";
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", cls)}>
      {s}
    </span>
  );
}

function Pill({ tone = "neutral", label, value }) {
  const base = "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold";
  const toneCls =
    tone === "good"
      ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200"
      : tone === "warn"
        ? "border-amber-700/50 bg-amber-950/30 text-amber-200"
        : tone === "bad"
          ? "border-rose-700/50 bg-rose-950/30 text-rose-200"
          : "border-slate-800 bg-slate-950/40 text-slate-200";
  return (
    <span className={cx(base, toneCls)}>
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </span>
  );
}

function MissionNav({ activeMission, onChange }) {
  const missions = [
    { id: "post_engagement", name: "Post Engagement", status: "implemented" },
    { id: "people_search", name: "People Search URL", status: "implemented" },
    { id: "jobs_intent", name: "Jobs Intent Miner", status: "implemented" },
    { id: "sales_nav_scrape", name: "Sales Navigator Scrape", status: "coming_soon" },
    { id: "recruiter_scrape", name: "LinkedIn Recruiter Scrape", status: "coming_soon" },
    { id: "connect_requests", name: "Connect Requests", status: "implemented" },
    { id: "send_message", name: "Send Message", status: "implemented" },
  ];

  const badge = (m) =>
    m.status === "implemented" ? (
      <span className="ml-auto rounded-full border border-emerald-700/50 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
        Implemented
      </span>
    ) : (
      <span className="ml-auto rounded-full border border-slate-800 bg-slate-950/40 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
        Coming soon
      </span>
    );

  return (
    <>
      {/* Mobile: top tabs */}
      <div className="lg:hidden -mx-2 px-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {missions.map((m) => {
            const active = m.id === activeMission;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange(m.id)}
                className={cx(
                  "shrink-0 rounded-xl border px-3 py-2 text-left",
                  active ? "border-sky-700/50 bg-sky-950/30" : "border-slate-800 bg-slate-950/40 hover:bg-slate-950/70"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cx("text-sm font-semibold", active ? "text-slate-100" : "text-slate-200")}>{m.name}</div>
                </div>
                <div className="mt-1">{badge(m)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop: left sidebar */}
      <div className="hidden lg:block w-72 shrink-0">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="text-sm font-semibold text-slate-200">Missions</div>
          <div className="mt-3 space-y-2">
            {missions.map((m) => {
              const active = m.id === activeMission;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange(m.id)}
                  className={cx(
                    "w-full rounded-xl border px-3 py-3 text-left transition",
                    active ? "border-sky-700/50 bg-sky-950/30" : "border-slate-800 bg-slate-950/40 hover:bg-slate-950/70"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cx("text-sm font-semibold", active ? "text-slate-100" : "text-slate-200")}>{m.name}</div>
                    {badge(m)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {m.id === "post_engagement"
                      ? "Collect likers/commenters from a LinkedIn post."
                      : m.id === "people_search"
                        ? "Extract profiles from a LinkedIn people search URL."
                        : m.id === "jobs_intent"
                          ? "Extract job postings from a LinkedIn Jobs search URL."
                      : m.id === "connect_requests"
                        ? "Queue connection requests via Cloud Engine."
                        : m.id === "send_message"
                          ? "Send messages to 1st connections via Cloud Engine."
                          : "UI scaffold only — wiring coming soon."}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ComingSoonPanel({ title, bullets }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-slate-100">{title}</div>
          <div className="mt-1 text-sm text-slate-400">This mission UI is ready — execution wiring will be added next.</div>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-200">
          Coming soon
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 opacity-70">
          <div className="text-xs font-semibold text-slate-400">Input</div>
          <input
            disabled
            value=""
            placeholder="Disabled (coming soon)"
            className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </label>

        <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 opacity-70">
          <div className="text-xs font-semibold text-slate-400">Schedule</div>
          <select
            disabled
            className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option>Manual</option>
            <option>Daily</option>
            <option>Weekly</option>
          </select>
        </label>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold text-slate-400">What it will do</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {(bullets || []).slice(0, 3).map((b, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-600" />
                <span className="text-slate-300">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 opacity-70"
          title="Coming soon"
        >
          Save mission
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white opacity-70"
          title="Coming soon"
        >
          Run now
        </button>
      </div>
    </div>
  );
}

function normalizeLinkedinUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  if (!/linkedin\.com/i.test(raw)) return null;
  try {
    const u = new URL(raw);
    // remove obvious tracking params; keep path stable
    ["trk", "lipi"].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}

function extractLinkedinUrls(rows, columnKey) {
  const arr = Array.isArray(rows) ? rows : [];
  const urls = [];
  for (const r of arr) {
    const obj = r && typeof r === "object" ? r : {};
    const candidates = [];
    if (columnKey) candidates.push(obj[columnKey]);
    candidates.push(
      obj.linkedin_url,
      obj.linkedinUrl,
      obj.linkedin,
      obj.profile_url,
      obj.profileUrl,
      obj.url
    );
    for (const c of candidates) {
      const n = normalizeLinkedinUrl(c);
      if (n) {
        urls.push(n);
        break;
      }
    }
  }
  // dedupe
  return Array.from(new Set(urls));
}

function AddLeadsModal({ open, onClose, onConfirm }) {
  const [source, setSource] = useState("campaigns"); // campaigns | sourcing | table
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);

  const [sourcingCampaigns, setSourcingCampaigns] = useState([]);
  const [selectedSourcingIds, setSelectedSourcingIds] = useState([]);

  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [tableColumnKey, setTableColumnKey] = useState("linkedin_url");

  const [previewUrls, setPreviewUrls] = useState([]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setPreviewUrls([]);
    setSelectedCampaignIds([]);
    setSelectedSourcingIds([]);
    // don’t reset table selection each time; keep last used
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadCampaigns = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await apiGet("/api/getCampaigns");
      setCampaigns(Array.isArray(resp?.campaigns) ? resp.campaigns : []);
    } catch (e) {
      setError(e?.message || "Failed to load campaigns");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSourcingCampaigns = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await apiGet("/api/sourcing/campaigns");
      setSourcingCampaigns(Array.isArray(resp) ? resp : resp?.campaigns || []);
    } catch (e) {
      setError(e?.message || "Failed to load sourcing campaigns");
      setSourcingCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("unauthenticated");
      const { data: rows, error: supaErr } = await supabase
        .from("custom_tables")
        .select("id,name,updated_at,schema_json,data_json")
        .order("updated_at", { ascending: false });
      if (supaErr) throw new Error(supaErr.message);
      setTables(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e?.message || "Failed to load tables");
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (source === "campaigns") void loadCampaigns();
    if (source === "sourcing") void loadSourcingCampaigns();
    if (source === "table") void loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const toggleId = (arr, id) => {
    const key = String(id);
    return arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key];
  };

  const preview = async () => {
    setLoading(true);
    setError("");
    setPreviewUrls([]);
    try {
      if (source === "campaigns") {
        if (!selectedCampaignIds.length) throw new Error("Select at least one campaign.");
        const all = [];
        // Fetch leads per campaign using existing filtered endpoint
        for (const id of selectedCampaignIds) {
          const resp = await apiGet(`/api/getLeads?campaignId=${encodeURIComponent(id)}`);
          all.push(...(Array.isArray(resp) ? resp : []));
        }
        const urls = extractLinkedinUrls(all);
        setPreviewUrls(urls);
        return;
      }
      if (source === "sourcing") {
        if (!selectedSourcingIds.length) throw new Error("Select at least one sourcing campaign.");
        const all = [];
        for (const id of selectedSourcingIds) {
          const resp = await apiGet(`/api/sourcing/campaigns/${encodeURIComponent(id)}/leads?limit=2000&offset=0`);
          const leads = Array.isArray(resp?.leads) ? resp.leads : [];
          all.push(...leads);
        }
        const urls = extractLinkedinUrls(all);
        setPreviewUrls(urls);
        return;
      }
      if (source === "table") {
        const t = tables.find((x) => String(x.id) === String(selectedTableId));
        if (!t) throw new Error("Select a table.");
        const rows = Array.isArray(t.data_json) ? t.data_json : [];
        const urls = extractLinkedinUrls(rows, tableColumnKey);
        setPreviewUrls(urls);
        return;
      }
    } catch (e) {
      setError(e?.message || "Failed to preview leads");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="text-lg font-bold text-slate-100">Add Leads</div>
            <div className="mt-1 text-sm text-slate-400">Import LinkedIn profile URLs from Campaigns, Sourcing Campaigns, or a Table.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "campaigns", label: "Campaigns" },
              { id: "sourcing", label: "Sourcing Campaigns" },
              { id: "table", label: "Custom Table" },
            ].map((t) => {
              const active = t.id === source;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSource(t.id)}
                  className={cx(
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    active ? "border-sky-700/50 bg-sky-950/30 text-slate-100" : "border-slate-800 bg-slate-950/40 text-slate-200 hover:bg-slate-950/70"
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-800/60 bg-rose-950/20 p-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            {source === "campaigns" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-200">Select campaign(s)</div>
                  <button
                    type="button"
                    onClick={loadCampaigns}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-800">
                  {(campaigns || []).length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-400">No campaigns found.</div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {campaigns.map((c) => {
                        const id = String(c.id);
                        const checked = selectedCampaignIds.includes(id);
                        return (
                          <label key={id} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedCampaignIds((prev) => toggleId(prev, id))}
                            />
                            <span className="flex-1">
                              <span className="font-semibold text-slate-100">{c.name || c.title || "Campaign"}</span>
                              <span className="ml-2 text-xs text-slate-500">({Number(c.total_leads || 0)} leads)</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {source === "sourcing" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-200">Select sourcing campaign(s)</div>
                  <button
                    type="button"
                    onClick={loadSourcingCampaigns}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-800">
                  {(sourcingCampaigns || []).length === 0 ? (
                    <div className="px-4 py-4 text-sm text-slate-400">No sourcing campaigns found.</div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {sourcingCampaigns.map((c) => {
                        const id = String(c.id);
                        const checked = selectedSourcingIds.includes(id);
                        return (
                          <label key={id} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedSourcingIds((prev) => toggleId(prev, id))}
                            />
                            <span className="flex-1">
                              <span className="font-semibold text-slate-100">{c.title || c.name || "Sourcing Campaign"}</span>
                              {c.status ? <span className="ml-2 text-xs text-slate-500">({String(c.status)})</span> : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {source === "table" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-200">Select a table</div>
                  <button
                    type="button"
                    onClick={loadTables}
                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <label className="lg:col-span-2">
                    <div className="text-xs font-semibold text-slate-400">Table</div>
                    <select
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    >
                      <option value="">Select…</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || "Untitled Table"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="text-xs font-semibold text-slate-400">LinkedIn URL column</div>
                    <input
                      value={tableColumnKey}
                      onChange={(e) => setTableColumnKey(e.target.value)}
                      placeholder="linkedin_url"
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    />
                  </label>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Tip: We’ll also auto-detect common fields like <span className="font-mono">linkedin_url</span>, <span className="font-mono">profile_url</span>, or <span className="font-mono">url</span>.
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-400">
              {previewUrls.length ? (
                <>
                  Found <span className="font-semibold text-slate-100">{previewUrls.length}</span> LinkedIn profile URL(s).
                </>
              ) : (
                "Preview to calculate how many LinkedIn URLs will be added."
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={preview}
                disabled={loading}
                className={cx(
                  "rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70",
                  loading && "opacity-70 cursor-not-allowed"
                )}
              >
                {loading ? "Loading…" : "Preview"}
              </button>
              <button
                type="button"
                onClick={() => onConfirm(previewUrls)}
                disabled={!previewUrls.length || loading}
                className={cx(
                  "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                  (!previewUrls.length || loading) && "opacity-70 cursor-not-allowed"
                )}
              >
                Add {previewUrls.length ? `(${previewUrls.length})` : ""} leads
              </button>
            </div>
          </div>

          {previewUrls.length ? (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="text-xs font-semibold text-slate-400">Preview</div>
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                {previewUrls.slice(0, 5).map((u) => (
                  <div key={u} className="break-all">
                    {u}
                  </div>
                ))}
                {previewUrls.length > 5 ? <div className="text-xs text-slate-500">+ {previewUrls.length - 5} more…</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SchedulePromptModal({ open, title, limit, dailyCap, saving, onClose, onSchedule, onRunOnce }) {
  if (!open) return null;
  const safeLimit = Math.max(1, Number(limit || 0));
  const safeDaily = Math.max(1, Number(dailyCap || 0));
  const days = Math.max(1, Math.ceil(safeLimit / safeDaily));
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950/90 shadow-2xl backdrop-blur">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="text-lg font-bold text-slate-100">Schedule recommended</div>
            <div className="mt-1 text-sm text-slate-400">{title || "Large run detected."}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            You selected <span className="font-semibold">{safeLimit}</span> profiles. Your daily cap is{" "}
            <span className="font-semibold">{safeDaily}</span>. To keep pulls safe, schedule this to run daily.
          </div>
          <div className="text-xs text-slate-500">
            Estimated: about {days} day{days === 1 ? "" : "s"} at {safeDaily} profiles/day. You can pause the schedule once you reach your total.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onRunOnce}
            disabled={saving}
            className={cx(
              "rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70",
              saving && "opacity-70 cursor-not-allowed"
            )}
          >
            Run once anyway
          </button>
          <button
            type="button"
            onClick={onSchedule}
            disabled={saving}
            className={cx(
              "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
              saving && "opacity-70 cursor-not-allowed"
            )}
          >
            {saving ? "Scheduling..." : "Schedule daily"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SchedulePicker({ title, disabled, timezone, buildToolPayload, apiPost, showToast, maxLimit }) {
  const [mode, setMode] = useState("manual"); // manual | run_at | daily | weekly
  const [name, setName] = useState(title ? `Sniper • ${title}` : "Sniper • Mission");
  const [runAtLocal, setRunAtLocal] = useState("");
  const [timeLocal, setTimeLocal] = useState("09:00");
  const [weekday, setWeekday] = useState("1"); // 0=Sun ... 6=Sat
  const [saving, setSaving] = useState(false);

  const tz = String(timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  const buildCronExpr = () => {
    const parts = String(timeLocal || "09:00").split(":");
    const h = Math.max(0, Math.min(Number(parts[0] || 9), 23));
    const m = Math.max(0, Math.min(Number(parts[1] || 0), 59));
    if (mode === "daily") return `${m} ${h} * * *`;
    if (mode === "weekly") return `${m} ${h} * * ${weekday}`;
    return null;
  };

  const toIsoFromDatetimeLocal = (val) => {
    const v = String(val || "").trim();
    if (!v) return null;
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString();
  };

  const saveSchedule = async () => {
    if (disabled) return;
    if (mode === "manual") return showToast("Select a schedule type first.", "info");
    const toolPayload = { ...(buildToolPayload ? buildToolPayload() : {}), timezone: tz };
    if (Number.isFinite(maxLimit) && maxLimit > 0 && Number.isFinite(toolPayload?.limit)) {
      toolPayload.limit = Math.min(toolPayload.limit, maxLimit);
    }
    if (!toolPayload?.job_type) return showToast("Missing job type for schedule.", "error");

    let schedule_kind = "one_time";
    let run_at = null;
    let cron_expr = null;
    if (mode === "run_at") {
      run_at = toIsoFromDatetimeLocal(runAtLocal);
      if (!run_at) return showToast("Pick a valid date/time.", "info");
      schedule_kind = "one_time";
    } else {
      cron_expr = buildCronExpr();
      if (!cron_expr) return showToast("Pick a valid recurring time.", "info");
      schedule_kind = "recurring";
    }

    setSaving(true);
    try {
      await apiPost("/api/schedules", {
        name: String(name || `Sniper • ${title || "Mission"}`),
        schedule_kind,
        cron_expr,
        run_at,
        action_tool: "sniper.run_job",
        tool_payload: toolPayload,
      });
      showToast("Schedule saved. It will run automatically.", "success");
    } catch (e) {
      showToast(e?.message || "Failed to create schedule", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-400">Schedule</div>
          <div className="mt-1 text-xs text-slate-500">Timezone: {tz}</div>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-950/40 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
          {mode === "manual" ? "Manual" : mode === "run_at" ? "One-time" : "Recurring"}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <label>
          <div className="text-xs font-semibold text-slate-400">Mode</div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-70"
          >
            <option value="manual">Manual (no schedule)</option>
            <option value="run_at">Run at (one-time)</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        {mode === "run_at" ? (
          <label>
            <div className="text-xs font-semibold text-slate-400">Run at</div>
            <input
              type="datetime-local"
              value={runAtLocal}
              onChange={(e) => setRunAtLocal(e.target.value)}
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-70"
            />
          </label>
        ) : null}

        {mode === "daily" || mode === "weekly" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mode === "weekly" ? (
              <label>
                <div className="text-xs font-semibold text-slate-400">Day</div>
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                  disabled={disabled}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-70"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </label>
            ) : (
              <div />
            )}
            <label>
              <div className="text-xs font-semibold text-slate-400">Time</div>
              <input
                type="time"
                value={timeLocal}
                onChange={(e) => setTimeLocal(e.target.value)}
                disabled={disabled}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-70"
              />
            </label>
          </div>
        ) : null}

        <label>
          <div className="text-xs font-semibold text-slate-400">Schedule name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none disabled:opacity-70"
          />
        </label>

        <button
          type="button"
          onClick={saveSchedule}
          disabled={disabled || saving || mode === "manual"}
          className={cx(
            "w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
            (disabled || saving || mode === "manual") && "opacity-70 cursor-not-allowed"
          )}
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>

        {Number.isFinite(maxLimit) && maxLimit > 0 ? (
          <div className="text-xs text-slate-500">
            Per-run cap: {maxLimit} (from Sniper Settings).
          </div>
        ) : null}

        <div className="text-xs text-slate-500">
          You can manage schedules in <a className="text-sky-300 hover:underline" href="/agent/advanced/schedules">Agent Schedules</a>.
        </div>
      </div>
    </div>
  );
}

export default function SniperTargets() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postUrl, setPostUrl] = useState("");
  const [workingId, setWorkingId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [activeMission, setActiveMission] = useState("post_engagement");
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [runLimit, setRunLimit] = useState(200);
  const [sniperSettings, setSniperSettings] = useState(null);
  const [linkedinStatus, setLinkedinStatus] = useState(null);
  const [connectProfileUrls, setConnectProfileUrls] = useState([]);
  const [connectNote, setConnectNote] = useState("");
  const [messageProfileUrls, setMessageProfileUrls] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [addLeadsFor, setAddLeadsFor] = useState(null); // 'connect' | 'message'
  const [peopleSearchUrl, setPeopleSearchUrl] = useState("");
  const [peopleSearchLimit, setPeopleSearchLimit] = useState(200);
  const [jobsSearchUrl, setJobsSearchUrl] = useState("");
  const [jobsSearchLimit, setJobsSearchLimit] = useState(100);
  const [schedulePrompt, setSchedulePrompt] = useState({
    open: false,
    title: "",
    limit: 0,
    dailyCap: 0,
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const schedulePendingRef = useRef({ onRunOnce: null, toolPayload: null, scheduleName: "" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => setToast({ show: false, message: "", type: "info" }), 2200);
  };

  const loadTargets = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/sniper/targets");
      // v1 returns an array; fall back to { targets } if older shape appears
      const next = Array.isArray(data) ? data : data?.targets || [];
      setTargets(next);
      // keep a stable selection for mission panel actions
      if (next?.length) {
        setSelectedTargetId((prev) => (prev && next.some((t) => String(t.id) === String(prev)) ? prev : next[0].id));
      } else {
        setSelectedTargetId(null);
      }
    } catch (e) {
      showToast(`Failed to load targets: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    // best-effort; placeholders are OK
    try {
      const s = await apiGet("/api/sniper/settings");
      setSniperSettings(s || null);
      if (s?.cloud_engine_enabled) {
        try {
          const li = await apiGet("/api/sniper/linkedin/auth/status");
          setLinkedinStatus(li || null);
        } catch {
          setLinkedinStatus(null);
        }
      } else {
        setLinkedinStatus({ connected: false });
      }
    } catch {
      setSniperSettings(null);
      setLinkedinStatus(null);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadTargets(), loadStatus()]);
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const dailyCap = Number(sniperSettings?.max_actions_per_day);
  const effectiveDailyCap = Number.isFinite(dailyCap) && dailyCap > 0 ? dailyCap : null;
  const scheduleTimezone = String(sniperSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const scheduleStart = String(sniperSettings?.active_hours_start || "09:00");

  const buildDailyCronExpr = (timeStr) => {
    const parts = String(timeStr || "09:00").split(":");
    const h = Math.max(0, Math.min(Number(parts[0] || 9), 23));
    const m = Math.max(0, Math.min(Number(parts[1] || 0), 59));
    return `${m} ${h} * * *`;
  };

  const promptScheduleIfNeeded = ({ limit, title, toolPayload, scheduleName, onRunOnce }) => {
    if (!effectiveDailyCap || Number(limit) <= effectiveDailyCap) {
      onRunOnce?.();
      return;
    }
    schedulePendingRef.current = {
      onRunOnce,
      toolPayload,
      scheduleName: scheduleName || title || "Sniper • Mission",
    };
    setSchedulePrompt({
      open: true,
      title: title || "Large run detected.",
      limit,
      dailyCap: effectiveDailyCap,
    });
  };

  const handleScheduleDaily = async () => {
    const pending = schedulePendingRef.current || {};
    const toolPayload = pending.toolPayload || {};
    if (!toolPayload?.job_type) {
      showToast("Missing job payload for schedule.", "error");
      setSchedulePrompt((prev) => ({ ...prev, open: false }));
      return;
    }
    setScheduleSaving(true);
    try {
      const perRunLimit = Number.isFinite(effectiveDailyCap) && effectiveDailyCap > 0
        ? Math.min(Number(toolPayload.limit || effectiveDailyCap), effectiveDailyCap)
        : toolPayload.limit;
      await apiPost("/api/schedules", {
        name: pending.scheduleName || "Sniper • Mission",
        schedule_kind: "recurring",
        cron_expr: buildDailyCronExpr(scheduleStart),
        run_at: null,
        action_tool: "sniper.run_job",
        tool_payload: {
          ...toolPayload,
          limit: perRunLimit,
          timezone: scheduleTimezone,
        },
      });
      showToast("Daily schedule created. It will run automatically.", "success");
      setSchedulePrompt((prev) => ({ ...prev, open: false }));
    } catch (e) {
      showToast(e?.message || "Failed to create schedule", "error");
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleRunOnceAnyway = () => {
    const pending = schedulePendingRef.current || {};
    setSchedulePrompt((prev) => ({ ...prev, open: false }));
    pending.onRunOnce?.();
  };

  const createAndRun = async () => {
    const url = String(postUrl || "").trim();
    if (!url) return showToast("Paste a LinkedIn post URL.", "info");
    setWorkingId("create");
    try {
      showToast("Target created. Run queued…", "info");
      await apiPost("/api/sniper/targets", {
        type: "linkedin_post_engagement",
        post_url: url,
        auto_run: true,
      });
      setPostUrl("");
      await refreshAll();
      showToast("Run queued.", "success");
    } catch (e) {
      showToast(`Create failed: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setWorkingId(null);
    }
  };

  const runNow = async (id, limit = 200) => {
    setWorkingId(id);
    try {
      showToast("Run queued…", "info");
      const n = Number(limit);
      const safeLimit = Math.max(1, Math.min(Number.isFinite(n) && n > 0 ? n : 200, 1000));
      await apiPost(`/api/sniper/targets/${id}/run`, { limit: safeLimit });
      await refreshAll();
      showToast("Run queued.", "success");
    } catch (e) {
      showToast(`Run failed: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setWorkingId(null);
    }
  };

  const pause = async (id) => {
    setWorkingId(id);
    try {
      await apiPost(`/api/sniper/targets/${id}/pause`, {});
      await refreshAll();
      showToast("Paused.", "success");
    } catch (e) {
      showToast(`Pause failed: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setWorkingId(null);
    }
  };

  const resume = async (id) => {
    setWorkingId(id);
    try {
      await apiPost(`/api/sniper/targets/${id}/resume`, {});
      await refreshAll();
      showToast("Resumed.", "success");
    } catch (e) {
      showToast(`Resume failed: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setWorkingId(null);
    }
  };

  const selectedTarget = selectedTargetId ? targets.find((t) => String(t.id) === String(selectedTargetId)) : null;
  const cloudEngineEnabled = Boolean(sniperSettings?.cloud_engine_enabled);
  const cloudEnginePill = cloudEngineEnabled ? <Pill tone="good" label="Cloud Engine" value="Enabled" /> : <Pill tone="neutral" label="Cloud Engine" value={sniperSettings ? "Disabled" : "Unknown"} />;
  const linkedinPill =
    linkedinStatus?.connected === true
      ? <Pill tone="good" label="LinkedIn" value="Connected" />
      : linkedinStatus?.connected === false
        ? <Pill tone="warn" label="LinkedIn" value="Not connected" />
        : <Pill tone="neutral" label="LinkedIn" value="Unknown" />;

  const openAddLeads = (mode) => {
    setAddLeadsFor(mode);
    setAddLeadsOpen(true);
  };

  const applyAddedUrls = (urls) => {
    const list = Array.isArray(urls) ? urls : [];
    if (!list.length) {
      setAddLeadsOpen(false);
      return;
    }
    if (addLeadsFor === "connect") {
      setConnectProfileUrls((prev) => Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...list])));
    } else if (addLeadsFor === "message") {
      setMessageProfileUrls((prev) => Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...list])));
    }
    setAddLeadsOpen(false);
  };

  const queueConnectRequests = async () => {
    if (!cloudEngineEnabled) return showToast("Enable Cloud Engine in Sniper Settings to queue requests.", "info");
    if (!connectProfileUrls.length) return showToast("Add leads first (LinkedIn profile URLs).", "info");
    const note = String(connectNote || "").trim();
    if (note.length > 300) return showToast("Connect note must be 300 characters or less.", "error");
    setWorkingId("connect");
    try {
      await apiPost("/api/sniper/actions/connect", {
        profile_urls: connectProfileUrls,
        note: note || null,
      });
      showToast("Queued connection requests. Track progress in Sniper Activity.", "success");
    } catch (e) {
      showToast(e?.message || "Failed to queue connection requests", "error");
    } finally {
      setWorkingId(null);
    }
  };

  const queueSendMessages = async () => {
    if (!cloudEngineEnabled) return showToast("Enable Cloud Engine in Sniper Settings to queue messages.", "info");
    if (!messageProfileUrls.length) return showToast("Add leads first (LinkedIn profile URLs).", "info");
    const msg = String(messageText || "").trim();
    if (!msg) return showToast("Message is required.", "info");
    if (msg.length > 3000) return showToast("Message must be 3000 characters or less.", "error");
    setWorkingId("message");
    try {
      await apiPost("/api/sniper/actions/message", {
        profile_urls: messageProfileUrls,
        message: msg,
      });
      showToast("Queued messages. Track progress in Sniper Activity.", "success");
    } catch (e) {
      showToast(e?.message || "Failed to queue messages", "error");
    } finally {
      setWorkingId(null);
    }
  };

  const queuePeopleSearch = async () => {
    if (!cloudEngineEnabled) return showToast("Enable Cloud Engine in Sniper Settings to run this mission.", "info");
    const url = String(peopleSearchUrl || "").trim();
    if (!url) return showToast("Paste a LinkedIn people search URL.", "info");
    const limit = Math.max(1, Math.min(Number(peopleSearchLimit) || 200, 2000));
    promptScheduleIfNeeded({
      limit,
      title: "People Search run exceeds daily cap.",
      scheduleName: `Sniper • People Search • Daily (${limit})`,
      toolPayload: {
        job_type: "people_search",
        search_url: url,
        limit,
      },
      onRunOnce: async () => {
        setWorkingId("people_search");
        try {
          const out = await apiPost("/api/sniper/jobs", {
            target_id: null,
            job_type: "people_search",
            input_json: { search_url: url, limit },
          });
          showToast("People Search queued. Track progress in Sniper Activity.", "success");
          const jobId = out?.job?.id || out?.job_id;
          if (jobId) {
            try { window.open(`/sniper/activity?job=${encodeURIComponent(String(jobId))}`, "_self"); } catch {}
          }
        } catch (e) {
          showToast(e?.message || "Failed to queue People Search", "error");
        } finally {
          setWorkingId(null);
        }
      },
    });
  };

  const queueJobsIntent = async () => {
    if (!cloudEngineEnabled) return showToast("Enable Cloud Engine in Sniper Settings to run this mission.", "info");
    const url = String(jobsSearchUrl || "").trim();
    if (!url) return showToast("Paste a LinkedIn Jobs search URL.", "info");
    const limit = Math.max(1, Math.min(Number(jobsSearchLimit) || 100, 2000));
    promptScheduleIfNeeded({
      limit,
      title: "Jobs Intent run exceeds daily cap.",
      scheduleName: `Sniper • Jobs Intent • Daily (${limit})`,
      toolPayload: {
        job_type: "jobs_intent",
        search_url: url,
        limit,
      },
      onRunOnce: async () => {
        setWorkingId("jobs_intent");
        try {
          const out = await apiPost("/api/sniper/jobs", {
            target_id: null,
            job_type: "jobs_intent",
            input_json: { search_url: url, limit },
          });
          showToast("Jobs Intent queued. Track progress in Sniper Activity.", "success");
          const jobId = out?.job?.id || out?.job_id;
          if (jobId) {
            try { window.open(`/sniper/activity?job=${encodeURIComponent(String(jobId))}`, "_self"); } catch {}
          }
        } catch (e) {
          showToast(e?.message || "Failed to queue Jobs Intent", "error");
        } finally {
          setWorkingId(null);
        }
      },
    });
  };

  return (
    <div className="p-6">
      <Toast show={toast.show} message={toast.message} type={toast.type} />
      <AddLeadsModal
        open={addLeadsOpen}
        onClose={() => setAddLeadsOpen(false)}
        onConfirm={applyAddedUrls}
      />
      <SchedulePromptModal
        open={schedulePrompt.open}
        title={schedulePrompt.title}
        limit={schedulePrompt.limit}
        dailyCap={schedulePrompt.dailyCap}
        saving={scheduleSaving}
        onClose={() => setSchedulePrompt((prev) => ({ ...prev, open: false }))}
        onSchedule={handleScheduleDaily}
        onRunOnce={handleRunOnceAnyway}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/agent")}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
            type="button"
          >
            ← Back to Agent Center
          </button>
          <div className="text-2xl font-bold text-slate-100">Sniper</div>
          <div className="mt-1 text-sm text-slate-400">
            Automate LinkedIn actions with Cloud Engine
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
            disabled={loading}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status strip */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {cloudEnginePill}
          {linkedinPill}
          {linkedinStatus?.profile_id ? <Pill tone="neutral" label="Profile" value={String(linkedinStatus.profile_id).slice(0, 22) + (String(linkedinStatus.profile_id).length > 22 ? "…" : "")} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/sniper/settings"
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
          >
            Sniper Settings
          </a>
          <a
            href="/sniper/results"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            View Results
          </a>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <MissionNav activeMission={activeMission} onChange={setActiveMission} />

        <div className="flex-1 space-y-6">
          {/* Mission detail panel */}
          {activeMission === "post_engagement" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-100">Post Engagement</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Create missions from a LinkedIn post URL. Sniper will collect likers/commenters and store them as results.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/sniper/activity"
                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                  >
                    Activity (legacy)
                  </a>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-400">LinkedIn post URL</div>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={postUrl}
                      onChange={(e) => setPostUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/posts/..."
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
                    />
                    <button
                      onClick={createAndRun}
                      disabled={workingId === "create"}
                      className={cx(
                        "rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500",
                        workingId === "create" && "opacity-70 cursor-not-allowed"
                      )}
                      type="button"
                    >
                      {workingId === "create" ? "Creating…" : "Create + Run"}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Uses the existing v1 endpoints: <span className="font-mono">POST /api/sniper/targets</span> + queue worker.
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-400">Run options</div>
                  <div className="mt-2 grid grid-cols-1 gap-3">
                    <label>
                      <div className="text-xs font-semibold text-slate-500">Limit</div>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={runLimit}
                        onChange={(e) => setRunLimit(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                      />
                      {effectiveDailyCap ? (
                        <div className="mt-2 text-[11px] text-slate-500">
                          Daily cap from settings: {effectiveDailyCap} profiles.
                        </div>
                      ) : null}
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <SchedulePicker
                  title="Post Engagement"
                  disabled={!cloudEngineEnabled || !(selectedTarget?.post_url || String(postUrl || "").trim())}
                  timezone={sniperSettings?.timezone}
                  apiPost={apiPost}
                  showToast={showToast}
                  maxLimit={effectiveDailyCap}
                  buildToolPayload={() => ({
                    job_type: "prospect_post_engagers",
                    post_url: selectedTarget?.post_url || String(postUrl || "").trim(),
                    limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                  })}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Run / pause a saved mission</div>
                    <div className="mt-1 text-xs text-slate-500">Select a mission, then run now (uses your run limit).</div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={selectedTargetId || ""}
                      onChange={(e) => setSelectedTargetId(e.target.value || null)}
                      className="min-w-[240px] rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none"
                      disabled={!targets.length}
                    >
                      {!targets.length ? <option value="">No missions yet</option> : null}
                      {targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {String(t.post_url || "").slice(0, 60)}
                          {String(t.post_url || "").length > 60 ? "…" : ""}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!selectedTarget || workingId === selectedTarget?.id}
                        onClick={() => selectedTarget && promptScheduleIfNeeded({
                          limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                          title: "Post Engagement run exceeds daily cap.",
                          scheduleName: `Sniper • Post Engagement • Daily (${runLimit})`,
                          toolPayload: {
                            job_type: "prospect_post_engagers",
                            post_url: selectedTarget?.post_url,
                            limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                          },
                          onRunOnce: () => runNow(selectedTarget.id, runLimit),
                        })}
                        className={cx(
                          "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                          (!selectedTarget || workingId === selectedTarget?.id) && "opacity-70 cursor-not-allowed"
                        )}
                      >
                        Run now
                      </button>
                      {selectedTarget?.status === "active" ? (
                        <button
                          type="button"
                          disabled={!selectedTarget || workingId === selectedTarget?.id}
                          onClick={() => selectedTarget && pause(selectedTarget.id)}
                          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!selectedTarget || workingId === selectedTarget?.id}
                          onClick={() => selectedTarget && resume(selectedTarget.id)}
                          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          Resume
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeMission === "people_search" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-100">People Search URL</div>
                  <div className="mt-1 text-sm text-slate-400">Extract LinkedIn profiles from a people search results URL.</div>
                </div>
                <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Implemented
                </span>
              </div>

              {!cloudEngineEnabled ? (
                <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
                  <div className="text-sm font-semibold text-amber-200">Cloud Engine is disabled</div>
                  <div className="mt-1 text-sm text-amber-200/80">
                    Enable Cloud Engine in <a className="text-sky-300 hover:underline" href="/sniper/settings">Sniper Settings</a> to run this mission.
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-400">Search URL</div>
                  <input
                    value={peopleSearchUrl}
                    onChange={(e) => setPeopleSearchUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/search/results/people/?keywords=..."
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Tip: Use the URL from your LinkedIn people search results page.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-400">Limit</div>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={peopleSearchLimit}
                    onChange={(e) => setPeopleSearchLimit(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                  {effectiveDailyCap ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Daily cap from settings: {effectiveDailyCap} profiles.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <SchedulePicker
                  title="People Search"
                  disabled={!cloudEngineEnabled || !String(peopleSearchUrl || "").trim()}
                  timezone={sniperSettings?.timezone}
                  apiPost={apiPost}
                  showToast={showToast}
                  maxLimit={effectiveDailyCap}
                  buildToolPayload={() => ({
                    job_type: "people_search",
                    search_url: String(peopleSearchUrl || "").trim(),
                    limit: Math.max(1, Math.min(Number(peopleSearchLimit) || 200, 2000)),
                  })}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <a
                  href="/sniper/activity"
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                >
                  View Activity
                </a>
                <button
                  type="button"
                  disabled={!cloudEngineEnabled || workingId === "people_search"}
                  onClick={queuePeopleSearch}
                  className={cx(
                    "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                    (!cloudEngineEnabled || workingId === "people_search") && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {workingId === "people_search" ? "Queuing…" : "Run now"}
                </button>
              </div>
            </div>
          ) : activeMission === "jobs_intent" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-100">Jobs Intent Miner</div>
                  <div className="mt-1 text-sm text-slate-400">Extract job postings from a LinkedIn Jobs search URL (v1). Enrichment/outreach steps come next.</div>
                </div>
                <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Implemented (v1)
                </span>
              </div>

              {!cloudEngineEnabled ? (
                <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
                  <div className="text-sm font-semibold text-amber-200">Cloud Engine is disabled</div>
                  <div className="mt-1 text-sm text-amber-200/80">
                    Enable Cloud Engine in <a className="text-sky-300 hover:underline" href="/sniper/settings">Sniper Settings</a> to run this mission.
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-400">Jobs search URL</div>
                  <input
                    value={jobsSearchUrl}
                    onChange={(e) => setJobsSearchUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/jobs/search/?keywords=..."
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Tip: Use the URL from your LinkedIn Jobs search results page.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs font-semibold text-slate-400">Limit</div>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={jobsSearchLimit}
                    onChange={(e) => setJobsSearchLimit(Number(e.target.value))}
                    className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                  />
                  {effectiveDailyCap ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Daily cap from settings: {effectiveDailyCap} profiles.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4">
                <SchedulePicker
                  title="Jobs Intent"
                  disabled={!cloudEngineEnabled || !String(jobsSearchUrl || "").trim()}
                  timezone={sniperSettings?.timezone}
                  apiPost={apiPost}
                  showToast={showToast}
                  maxLimit={effectiveDailyCap}
                  buildToolPayload={() => ({
                    job_type: "jobs_intent",
                    search_url: String(jobsSearchUrl || "").trim(),
                    limit: Math.max(1, Math.min(Number(jobsSearchLimit) || 100, 2000)),
                  })}
                />
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs font-semibold text-slate-400">What v1 does</div>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-600" />Scrapes job cards (title/company/location/job link).</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-600" />Stores results as Sniper extracts (view in Activity).</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-600" />Next iteration: enrich companies + infer decision makers + outreach automation.</li>
                </ul>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <a
                  href="/sniper/activity"
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                >
                  View Activity
                </a>
                <button
                  type="button"
                  disabled={!cloudEngineEnabled || workingId === "jobs_intent"}
                  onClick={queueJobsIntent}
                  className={cx(
                    "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                    (!cloudEngineEnabled || workingId === "jobs_intent") && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {workingId === "jobs_intent" ? "Queuing…" : "Run now"}
                </button>
              </div>
            </div>
          ) : activeMission === "sales_nav_scrape" ? (
            <ComingSoonPanel
              title="Sales Navigator Scrape"
              bullets={[
                "Mimic Chrome extension scraping for Sales Navigator lead lists.",
                "Continuously sync new leads into campaigns.",
                "Respect throttles, active hours, and daily caps.",
              ]}
            />
          ) : activeMission === "recruiter_scrape" ? (
            <ComingSoonPanel
              title="LinkedIn Recruiter Scrape"
              bullets={[
                "Capture recruiter search results and shortlist leads.",
                "Enrich and normalize profiles across workspaces.",
                "Prepare outreach-ready lead sets with audit trails.",
              ]}
            />
          ) : activeMission === "connect_requests" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-100">Connect Requests</div>
                  <div className="mt-1 text-sm text-slate-400">Queue LinkedIn connection requests via Cloud Engine.</div>
                </div>
                <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Implemented
                </span>
              </div>

              {!cloudEngineEnabled ? (
                <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
                  <div className="text-sm font-semibold text-amber-200">Cloud Engine is disabled</div>
                  <div className="mt-1 text-sm text-amber-200/80">
                    Enable Cloud Engine in <a className="text-sky-300 hover:underline" href="/sniper/settings">Sniper Settings</a> to queue requests.
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-400">Leads</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddLeads("connect")}
                        className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                      >
                        Add Leads
                      </button>
                      <button
                        type="button"
                        onClick={() => setConnectProfileUrls([])}
                        className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                        disabled={!connectProfileUrls.length}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-200">
                    {connectProfileUrls.length ? (
                      <>
                        <span className="font-semibold text-slate-100">{connectProfileUrls.length}</span> LinkedIn profile(s) selected.
                      </>
                    ) : (
                      <span className="text-slate-400">No leads added yet.</span>
                    )}
                  </div>
                  {connectProfileUrls.length ? (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs font-semibold text-slate-400">Preview</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-200">
                        {connectProfileUrls.slice(0, 5).map((u) => (
                          <div key={u} className="break-all">{u}</div>
                        ))}
                        {connectProfileUrls.length > 5 ? <div className="text-xs text-slate-500">+ {connectProfileUrls.length - 5} more…</div> : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <SchedulePicker
                  title="Connect Requests"
                  disabled={!cloudEngineEnabled || !connectProfileUrls.length}
                  timezone={sniperSettings?.timezone}
                  apiPost={apiPost}
                  showToast={showToast}
                  buildToolPayload={() => ({
                    job_type: "send_connect_requests",
                    profile_urls: connectProfileUrls,
                    note: String(connectNote || "").trim() ? String(connectNote || "").trim().slice(0, 300) : null,
                  })}
                />
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs font-semibold text-slate-400">Optional connect note (max 300 chars)</div>
                <textarea
                  value={connectNote}
                  onChange={(e) => setConnectNote(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Optional note to include with the connection request."
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <a
                  href="/sniper/activity"
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                >
                  View Activity
                </a>
                <button
                  type="button"
                  disabled={!cloudEngineEnabled || !connectProfileUrls.length || workingId === "connect"}
                  onClick={queueConnectRequests}
                  className={cx(
                    "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                    (!cloudEngineEnabled || !connectProfileUrls.length || workingId === "connect") && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {workingId === "connect" ? "Queuing…" : "Run now"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-100">Send Message</div>
                  <div className="mt-1 text-sm text-slate-400">Queue LinkedIn messages to 1st connections via Cloud Engine.</div>
                </div>
                <span className="rounded-full border border-emerald-700/50 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Implemented
                </span>
              </div>

              {!cloudEngineEnabled ? (
                <div className="mt-4 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
                  <div className="text-sm font-semibold text-amber-200">Cloud Engine is disabled</div>
                  <div className="mt-1 text-sm text-amber-200/80">
                    Enable Cloud Engine in <a className="text-sky-300 hover:underline" href="/sniper/settings">Sniper Settings</a> to queue messages.
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-400">Leads</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddLeads("message")}
                        className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                      >
                        Add Leads
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageProfileUrls([])}
                        className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                        disabled={!messageProfileUrls.length}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-200">
                    {messageProfileUrls.length ? (
                      <>
                        <span className="font-semibold text-slate-100">{messageProfileUrls.length}</span> LinkedIn profile(s) selected.
                      </>
                    ) : (
                      <span className="text-slate-400">No leads added yet.</span>
                    )}
                  </div>
                  {messageProfileUrls.length ? (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-xs font-semibold text-slate-400">Preview</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-200">
                        {messageProfileUrls.slice(0, 5).map((u) => (
                          <div key={u} className="break-all">{u}</div>
                        ))}
                        {messageProfileUrls.length > 5 ? <div className="text-xs text-slate-500">+ {messageProfileUrls.length - 5} more…</div> : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <SchedulePicker
                  title="Send Message"
                  disabled={!cloudEngineEnabled || !messageProfileUrls.length || !String(messageText || "").trim()}
                  timezone={sniperSettings?.timezone}
                  apiPost={apiPost}
                  showToast={showToast}
                  buildToolPayload={() => ({
                    job_type: "send_messages",
                    profile_urls: messageProfileUrls,
                    message: String(messageText || "").trim().slice(0, 3000),
                  })}
                />
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs font-semibold text-slate-400">Message (required, max 3000 chars)</div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5}
                  maxLength={3000}
                  placeholder="Write your message…"
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <div className="mt-2 text-xs text-slate-500">{String(messageText || "").length}/3000</div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <a
                  href="/sniper/activity"
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                >
                  View Activity
                </a>
                <button
                  type="button"
                  disabled={!cloudEngineEnabled || !messageProfileUrls.length || !String(messageText || "").trim() || workingId === "message"}
                  onClick={queueSendMessages}
                  className={cx(
                    "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                    (!cloudEngineEnabled || !messageProfileUrls.length || !String(messageText || "").trim() || workingId === "message") && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {workingId === "message" ? "Queuing…" : "Run now"}
                </button>
              </div>
            </div>
          )}

          {/* Saved missions table (Post Engagement only for now) */}
          {activeMission === "post_engagement" ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Saved Missions</div>
                    <div className="mt-1 text-xs text-slate-500">These are your existing post engagement targets (no backend changes).</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/sniper/activity"
                      className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                    >
                      Activity
                    </a>
                    <a
                      href="/sniper/results"
                      className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                    >
                      Results
                    </a>
                  </div>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <div className="grid grid-cols-12 gap-0 border-b border-slate-800 bg-slate-950/60 px-5 py-3 text-xs font-semibold text-slate-400">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-4">Post URL</div>
                  <div className="col-span-2">Schedule</div>
                  <div className="col-span-2">Last Run</div>
                  <div className="col-span-1">Leads</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                {loading ? (
                  <div className="px-5 py-6 text-sm text-slate-400">Loading…</div>
                ) : targets.length === 0 ? (
                  <div className="px-5 py-10 text-sm text-slate-400">No missions yet.</div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {targets.map((t) => (
                      <div key={t.id} className="grid grid-cols-12 items-center px-5 py-4">
                        <div className="col-span-2 text-sm font-semibold text-slate-100">{t.type || "linkedin_post_engagement"}</div>
                        <div className="col-span-4">
                          <a href={t.post_url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:underline">
                            {t.post_url}
                          </a>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusPill status={t.last_run_status} />
                            <span className="text-xs text-slate-500">{t.status}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-slate-300">Manual</span>
                        </div>
                        <div className="col-span-2 text-sm text-slate-300">{formatDate(t.last_run_at)}</div>
                        <div className="col-span-1 text-sm font-semibold text-slate-100">{t.last_run_leads_found ?? "—"}</div>
                        <div className="col-span-1 flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={workingId === t.id}
                            onClick={() => promptScheduleIfNeeded({
                              limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                              title: "Post Engagement run exceeds daily cap.",
                              scheduleName: `Sniper • Post Engagement • Daily (${runLimit})`,
                              toolPayload: {
                                job_type: "prospect_post_engagers",
                                post_url: t.post_url,
                                limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                              },
                              onRunOnce: () => runNow(t.id, runLimit),
                            })}
                            className={cx(
                              "rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                              workingId === t.id && "opacity-70 cursor-not-allowed"
                            )}
                            title={`Run now (limit ${runLimit})`}
                          >
                            Run
                          </button>
                          {t.status === "active" ? (
                            <button
                              type="button"
                              disabled={workingId === t.id}
                              onClick={() => pause(t.id)}
                              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={workingId === t.id}
                              onClick={() => resume(t.id)}
                              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile stacked cards */}
              <div className="md:hidden">
                {loading ? (
                  <div className="px-5 py-6 text-sm text-slate-400">Loading…</div>
                ) : targets.length === 0 ? (
                  <div className="px-5 py-10 text-sm text-slate-400">No missions yet.</div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {targets.map((t) => (
                      <div key={t.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-100">{t.type || "linkedin_post_engagement"}</div>
                            <div className="mt-1">
                              <a href={t.post_url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:underline break-all">
                                {t.post_url}
                              </a>
                            </div>
                          </div>
                          <StatusPill status={t.last_run_status} />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                            <div className="text-xs font-semibold text-slate-400">Schedule</div>
                            <div className="mt-1 text-slate-200">Manual</div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                            <div className="text-xs font-semibold text-slate-400">Leads</div>
                            <div className="mt-1 text-slate-200">{t.last_run_leads_found ?? "—"}</div>
                          </div>
                          <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                            <div className="text-xs font-semibold text-slate-400">Last run</div>
                            <div className="mt-1 text-slate-200">{formatDate(t.last_run_at)}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <a
                            href="/sniper/activity"
                            className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                          >
                            Activity
                          </a>
                          <button
                            type="button"
                            disabled={workingId === t.id}
                            onClick={() => promptScheduleIfNeeded({
                              limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                              title: "Post Engagement run exceeds daily cap.",
                              scheduleName: `Sniper • Post Engagement • Daily (${runLimit})`,
                              toolPayload: {
                                job_type: "prospect_post_engagers",
                                post_url: t.post_url,
                                limit: Math.max(1, Math.min(Number(runLimit) || 200, 1000)),
                              },
                              onRunOnce: () => runNow(t.id, runLimit),
                            })}
                            className={cx(
                              "rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                              workingId === t.id && "opacity-70 cursor-not-allowed"
                            )}
                          >
                            Run
                          </button>
                          {t.status === "active" ? (
                            <button
                              type="button"
                              disabled={workingId === t.id}
                              onClick={() => pause(t.id)}
                              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              Pause
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={workingId === t.id}
                              onClick={() => resume(t.id)}
                              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                              Resume
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}



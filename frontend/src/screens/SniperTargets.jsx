import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

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
    { id: "people_search", name: "People Search URL", status: "coming_soon" },
    { id: "jobs_intent", name: "Jobs Intent Miner", status: "coming_soon" },
    { id: "sales_nav_scrape", name: "Sales Navigator Scrape", status: "coming_soon" },
    { id: "recruiter_scrape", name: "LinkedIn Recruiter Scrape", status: "coming_soon" },
    { id: "connect_requests", name: "Connect Requests", status: "coming_soon" },
    { id: "send_message", name: "Send Message", status: "coming_soon" },
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
      await apiPost(`/api/sniper/targets/${id}/run`, { limit: Number.isFinite(n) && n > 0 ? n : 200 });
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

  return (
    <div className="p-6">
      <Toast show={toast.show} message={toast.message} type={toast.type} />

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
                    </label>
                    <label>
                      <div className="text-xs font-semibold text-slate-500">Schedule</div>
                      <select
                        disabled
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none opacity-70"
                        title="Scheduling UI will be wired soon."
                      >
                        <option>Manual</option>
                        <option>Daily (coming soon)</option>
                      </select>
                    </label>
                  </div>
                </div>
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
                        onClick={() => selectedTarget && runNow(selectedTarget.id, runLimit)}
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
            <ComingSoonPanel
              title="People Search URL"
              bullets={[
                "Paste a LinkedIn/Sales Nav people search URL and save as a recurring mission.",
                "Pull leads daily, enrich, and add to a sourcing campaign automatically.",
                "Optionally trigger email + connection request sequences when guardrails allow.",
              ]}
            />
          ) : activeMission === "jobs_intent" ? (
            <ComingSoonPanel
              title="Jobs Intent Miner"
              bullets={[
                "Scrape job postings for intent signals and new hiring activity.",
                "Enrich companies (Apollo) and infer decision makers/titles with GPT.",
                "Find contacts and launch outreach sequences automatically.",
              ]}
            />
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
            <ComingSoonPanel
              title="Connect Requests"
              bullets={[
                "Send connection requests safely with randomized spacing.",
                "Support per-lead notes and scheduled execution windows.",
                "Track statuses across queued/sent/skipped/failed outcomes.",
              ]}
            />
          ) : (
            <ComingSoonPanel
              title="Send Message"
              bullets={[
                "Send messages to 1st connections with templates and tokens.",
                "Schedule runs and enforce hourly/daily caps automatically.",
                "Centralize delivery status + errors in Results.",
              ]}
            />
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
                            onClick={() => runNow(t.id, runLimit)}
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
                            onClick={() => runNow(t.id, runLimit)}
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



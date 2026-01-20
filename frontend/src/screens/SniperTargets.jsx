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

export default function SniperTargets() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postUrl, setPostUrl] = useState("");
  const [workingId, setWorkingId] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => setToast({ show: false, message: "", type: "info" }), 2200);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/api/sniper/targets");
      // v1 returns an array; fall back to { targets } if older shape appears
      setTargets(Array.isArray(data) ? data : data?.targets || []);
    } catch (e) {
      showToast(`Failed to load targets: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
      await load();
      showToast("Run queued.", "success");
    } catch (e) {
      showToast(`Create failed: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setWorkingId(null);
    }
  };

  const runNow = async (id) => {
    setWorkingId(id);
    try {
      showToast("Run queued…", "info");
      await apiPost(`/api/sniper/targets/${id}/run`, { limit: 200 });
      await load();
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
      await load();
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
      await load();
      showToast("Resumed.", "success");
    } catch (e) {
      showToast(`Resume failed: ${e?.message || "Unknown error"}`, "error");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="p-6">
      <Toast show={toast.show} message={toast.message} type={toast.type} />

      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate("/agent")}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
            type="button"
          >
            ← Back to Agent Center
          </button>
          <div className="text-2xl font-bold text-slate-100">Sniper Targets</div>
          <div className="mt-1 text-sm text-slate-400">
            Create a target from a LinkedIn post. Sniper will collect likers/commenters and store them as results.
          </div>
        </div>

        <button
          onClick={load}
          className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <div className="text-sm font-semibold text-slate-200">Create target (LinkedIn post likers/commenters)</div>
        <div className="mt-3 flex gap-3">
          <input
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://www.linkedin.com/posts/..."
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none"
          />
          <button
            onClick={createAndRun}
            disabled={workingId === "create"}
            className={cx(
              "rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500",
              workingId === "create" && "opacity-70 cursor-not-allowed"
            )}
          >
            {workingId === "create" ? "Creating…" : "Create + Run"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="grid grid-cols-12 gap-0 border-b border-slate-800 bg-slate-950/60 px-5 py-3 text-xs font-semibold text-slate-400">
          <div className="col-span-2">Type</div>
          <div className="col-span-5">Post URL</div>
          <div className="col-span-2">Last Run</div>
          <div className="col-span-1">Leads</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-400">Loading…</div>
        ) : targets.length === 0 ? (
          <div className="px-5 py-10 text-sm text-slate-400">No targets yet.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {targets.map((t) => (
              <div key={t.id} className="grid grid-cols-12 items-center px-5 py-4">
                <div className="col-span-2 text-sm font-semibold text-slate-100">{t.type || "linkedin_post_engagement"}</div>
                <div className="col-span-5">
                  <a href={t.post_url} target="_blank" rel="noreferrer" className="text-sm text-slate-200 hover:underline">
                    {t.post_url}
                  </a>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusPill status={t.last_run_status} />
                    <span className="text-xs text-slate-500">{t.status}</span>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-slate-300">{formatDate(t.last_run_at)}</div>
                <div className="col-span-1 text-sm font-semibold text-slate-100">{t.last_run_leads_found ?? "—"}</div>
                <div className="col-span-2 flex justify-end gap-2">
                  <a
                    href="/sniper/activity"
                    className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                  >
                    View results
                  </a>
                  <button
                    disabled={workingId === t.id}
                    onClick={() => runNow(t.id)}
                    className={cx(
                      "rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500",
                      workingId === t.id && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    Run now
                  </button>
                  {t.status === "active" ? (
                    <button
                      disabled={workingId === t.id}
                      onClick={() => pause(t.id)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      disabled={workingId === t.id}
                      onClick={() => resume(t.id)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
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
  );
}



import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-200">
      {children}
    </span>
  );
}

export default function SniperResults() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [missionType, setMissionType] = useState("all");

  const filtered = useMemo(() => {
    // Placeholder: wiring will come later.
    return [];
  }, [query, missionType]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/sniper")}
            className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
            type="button"
          >
            ← Back to Sniper
          </button>
          <div className="text-2xl font-bold text-slate-100">Sniper Results</div>
          <div className="mt-1 text-sm text-slate-400">Results view placeholder — mission output + filters will be wired next.</div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/sniper/activity"
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
          >
            Activity (legacy)
          </a>
          <a
            href="/sniper/settings"
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
          >
            Sniper Settings
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill>Coming soon</Pill>
        <Pill>Filters</Pill>
        <Pill>Export</Pill>
        <Pill>Saved views</Pill>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs font-semibold text-slate-400">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, URL, company…"
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
            />
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="text-xs font-semibold text-slate-400">Mission type</div>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              <option value="all">All</option>
              <option value="post_engagement">Post Engagement</option>
              <option value="connect_requests">Connect Requests</option>
              <option value="send_message">Send Message</option>
            </select>
          </label>
          <label className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 opacity-70">
            <div className="text-xs font-semibold text-slate-400">Date range</div>
            <input
              disabled
              value=""
              placeholder="Coming soon"
              className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
            />
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="grid grid-cols-12 gap-0 border-b border-slate-800 bg-slate-950/60 px-5 py-3 text-xs font-semibold text-slate-400">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Company</div>
          <div className="col-span-3">LinkedIn URL</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-1 text-right">Status</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
              <div className="text-base font-bold text-slate-100">No results yet</div>
              <div className="mt-2 text-sm text-slate-400">
                Results will appear here after you run a mission (e.g. Post Engagement). For now, track runs in{" "}
                <a className="text-sky-300 hover:underline" href="/sniper/activity">
                  Sniper Activity
                </a>
                .
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/sniper")}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                >
                  Go to Sniper Missions
                </button>
                <a
                  href="/sniper/activity"
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-950/70"
                >
                  View Activity
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {/* placeholder rows later */}
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-500">
        TODO: wire this page to Sniper job items + saved mission outputs. No backend endpoints were added in this step.
      </div>
    </div>
  );
}


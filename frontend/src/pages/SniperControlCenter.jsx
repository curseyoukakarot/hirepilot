import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "../lib/supabaseClient";
import { api, apiGet } from "../lib/api";
import { toast } from "../components/ui/use-toast";

const DEFAULT_SETTINGS = {
  globalActive: true,
  timezone: 'America/Chicago',
  workingHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5], runOnWeekends: false },
  warmup: { enabled: true, weeks: 3, currentWeek: 1, speed: 0.4 },
  sources: {
    linkedin: {
      profileViewsPerDay: 40,
      connectionInvitesPerDay: 30,
      messagesPerDay: 120,
      inMailsPerDay: 10,
      concurrency: 2,
      actionsPerMinute: 2
    }
  },
  creditBudget: { dailyMax: 200 },
  safety: { maxTouchesPerPerson: 3, doNotContactDomains: [] },
  primaryJobBoard: 'linkedin_jobs',
  autoCreateTables: false,
  defaultEnrichment: 'apollo_only'
};

const DAY_LABELS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 7 }
];

function SliderRow({ label, max = 100, recommended, value, onChange }) {
  const safeValue = Math.min(Math.max(value ?? 0, 0), max);
  const percentage = Math.max(0, Math.min(100, (safeValue / max) * 100));
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        {recommended ? (
          <p className="text-muted-foreground text-xs mt-1">Recommended: {recommended}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3 w-72">
        <div className="relative w-full">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-gray-400/30 dark:bg-gray-700/60" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-blue-500/70"
            style={{ width: `${percentage}%` }}
          />
          <input
            type="range"
            min={0}
            max={max}
            value={safeValue}
            onChange={(e)=> onChange?.(Number(e.target.value))}
            className="relative w-full h-6 bg-transparent appearance-none cursor-pointer"
            style={{ WebkitAppearance: 'none', appearance: 'none' }}
          />
        </div>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400">
          <span className="font-semibold">{safeValue}</span>
          <span className="text-muted-foreground">/ {max}</span>
        </span>
      </div>
    </div>
  );
}

export default function SniperControlCenter() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [accountId, setAccountId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to edit Sniper settings.');
        setLoading(false);
        return;
      }
      const inferredAccount = user.user_metadata?.account_id || user.user_metadata?.accountId || user.id;
      setAccountId(inferredAccount);
      const data = await apiGet(`/api/sniper/settings?accountId=${encodeURIComponent(inferredAccount)}`, { requireAuth: true });
      setSettings({ ...DEFAULT_SETTINGS, ...(data || {}) });
      setError('');
    } catch (err) {
      setError(err?.message || 'Unable to load Sniper settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateLinkedInSource = (key, value) => {
    setSettings(s => ({
      ...s,
      sources: {
        ...s.sources,
        linkedin: {
          ...s.sources.linkedin,
          [key]: value
        }
      }
    }));
  };

  const handleSave = async () => {
    if (!accountId) {
      toast({ title: 'Missing account', description: 'Please refresh and try again.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api('/api/sniper/settings', {
        method: 'PUT',
        body: JSON.stringify({ accountId, settings })
      });
      toast({ title: 'Sniper settings saved', description: 'Global defaults updated.' });
    } catch (err) {
      toast({ title: 'Save failed', description: err?.message || 'Unable to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setSettings(DEFAULT_SETTINGS);

  return (
    <div className="w-full p-8 flex flex-col gap-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold tracking-tight">Sniper Control Center</h1>
        <p className="text-muted-foreground max-w-xl mt-1">
          Configure how Sniper discovers leads, enriches decision makers, manages sessions,
          and applies global automation rules.
        </p>
      </motion.div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleReset} disabled={loading || saving}>Reset to Defaults</Button>
        <Button onClick={handleSave} disabled={loading || saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
      </div>

      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="global">Global Defaults</TabsTrigger>
          <TabsTrigger value="limits">Limits & Throttling</TabsTrigger>
          <TabsTrigger value="integrations">Integrations & Sessions</TabsTrigger>
          <TabsTrigger value="modules">Discovery Modules</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-8 space-y-8">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {loading ? (
            <Card className="rounded-2xl border border-border/60">
              <CardHeader>
                <h2 className="text-xl font-semibold">Loading settings…</h2>
              </CardHeader>
              <CardContent className="py-6 text-muted-foreground">
                Please wait while we fetch your current defaults.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-2xl border border-border/60">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Default Sniper Behavior</h2>
                  <p className="text-muted-foreground text-sm max-w-lg">
                    Define how Sniper behaves automatically when you run discoveries from Workflows or REX.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Primary Job Board</p>
                      <p className="text-muted-foreground text-sm">Choose the default platform for Sniper searches.</p>
                    </div>
                    <select
                      className="border rounded-xl px-3 py-2 bg-background text-sm"
                      value={settings.primaryJobBoard}
                      onChange={(e)=> setSettings(s => ({ ...s, primaryJobBoard: e.target.value }))}
                    >
                      <option value="linkedin_jobs">LinkedIn Jobs</option>
                      <option value="ziprecruiter">ZipRecruiter</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-create Tables</p>
                      <p className="text-muted-foreground text-sm">Automatically save job results into a custom table.</p>
                    </div>
                    <Switch
                      checked={settings.autoCreateTables}
                      onCheckedChange={(val)=> setSettings(s => ({ ...s, autoCreateTables: val }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Default Enrichment</p>
                      <p className="text-muted-foreground text-sm">Controls how Sniper enriches decision makers.</p>
                    </div>
                    <select
                      className="border rounded-xl px-3 py-2 bg-background text-sm"
                      value={settings.defaultEnrichment}
                      onChange={(e)=> setSettings(s => ({ ...s, defaultEnrichment: e.target.value }))}
                    >
                      <option value="apollo_only">Apollo Only</option>
                      <option value="apollo_brightdata">Apollo → Bright Data</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/60">
                <CardHeader>
                  <h2 className="text-xl font-semibold">Working Hours & Warm-up</h2>
                  <p className="text-muted-foreground text-sm max-w-lg">
                    Sniper respects these hours when running Bright Data sourcing and throttling.
                  </p>
                </CardHeader>
                <CardContent className="py-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Start Time</label>
                      <input
                        type="time"
                        className="border rounded-xl px-3 py-2 bg-background text-sm w-full"
                        value={settings.workingHours.start}
                        onChange={(e)=> setSettings(s => ({ ...s, workingHours: { ...s.workingHours, start: e.target.value }}))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">End Time</label>
                      <input
                        type="time"
                        className="border rounded-xl px-3 py-2 bg-background text-sm w-full"
                        value={settings.workingHours.end}
                        onChange={(e)=> setSettings(s => ({ ...s, workingHours: { ...s.workingHours, end: e.target.value }}))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Time Zone</label>
                      <input
                        className="border rounded-xl px-3 py-2 bg-background text-sm w-full"
                        value={settings.timezone}
                        onChange={(e)=> setSettings(s => ({ ...s, timezone: e.target.value }))}
                        placeholder="America/Chicago"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map(day => {
                      const active = settings.workingHours.days.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={()=>{
                            setSettings(s => {
                              const exists = s.workingHours.days.includes(day.value);
                              const nextDays = exists
                                ? s.workingHours.days.filter(d => d !== day.value)
                                : [...s.workingHours.days, day.value];
                              return { ...s, workingHours: { ...s.workingHours, days: nextDays.sort((a,b)=>a-b) } };
                            });
                          }}
                          className={`px-3 py-2 rounded-lg text-sm ${active ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'}`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-border/40 pt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Warm-up Mode</p>
                        <p className="text-sm text-muted-foreground">Gradually ramp up LinkedIn volume for new accounts.</p>
                      </div>
                      <Switch
                        checked={settings.warmup.enabled}
                        onCheckedChange={(val)=> setSettings(s => ({ ...s, warmup: { ...s.warmup, enabled: val }}))}
                      />
                    </div>
                    {settings.warmup.enabled && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Weeks</label>
                          <input
                            type="number"
                            min={1}
                            className="border rounded-xl px-3 py-2 bg-background text-sm w-full"
                            value={settings.warmup.weeks}
                            onChange={(e)=> setSettings(s => ({ ...s, warmup: { ...s.warmup, weeks: Number(e.target.value) }}))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Current Week</label>
                          <input
                            type="number"
                            min={1}
                            max={settings.warmup.weeks}
                            className="border rounded-xl px-3 py-2 bg-background text-sm w-full"
                            value={settings.warmup.currentWeek}
                            onChange={(e)=> setSettings(s => ({ ...s, warmup: { ...s.warmup, currentWeek: Number(e.target.value) }}))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted-foreground mb-1">Speed</label>
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.1}
                            value={settings.warmup.speed}
                            onChange={(e)=> setSettings(s => ({ ...s, warmup: { ...s.warmup, speed: Number(e.target.value) }}))}
                          />
                          <p className="text-xs text-muted-foreground mt-1">Current: {(settings.warmup.speed * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="limits" className="mt-8 space-y-8">
          <Card className="rounded-2xl border border-border/60">
            <CardHeader>
              <h2 className="text-xl font-semibold">Daily Limits</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                Set safe operating limits for LinkedIn automations. Sniper enforces these when Bright Data is enabled.
              </p>
            </CardHeader>
            <CardContent className="py-6 space-y-8">
              <div>
                <h3 className="font-medium mb-2">LinkedIn</h3>
                <div className="space-y-4">
                  <SliderRow
                    label="Profile Views"
                    max={100}
                    recommended="40-60"
                    value={settings.sources.linkedin.profileViewsPerDay}
                    onChange={(val)=> updateLinkedInSource('profileViewsPerDay', val)}
                  />
                  <SliderRow
                    label="Connection Invites"
                    max={100}
                    recommended="40-50"
                    value={settings.sources.linkedin.connectionInvitesPerDay}
                    onChange={(val)=> updateLinkedInSource('connectionInvitesPerDay', val)}
                  />
                  <SliderRow
                    label="Messages"
                    max={200}
                    recommended="100-150"
                    value={settings.sources.linkedin.messagesPerDay}
                    onChange={(val)=> updateLinkedInSource('messagesPerDay', val)}
                  />
                  <SliderRow
                    label="InMails"
                    max={50}
                    recommended="5-15"
                    value={settings.sources.linkedin.inMailsPerDay}
                    onChange={(val)=> updateLinkedInSource('inMailsPerDay', val)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60">
            <CardHeader>
              <h2 className="text-xl font-semibold">Concurrency & Throttling</h2>
            </CardHeader>
            <CardContent className="py-6 space-y-6">
              <div className="flex items-center justify-between">
                <p className="font-medium">Max Concurrent Sessions</p>
                <input
                  type="number"
                  min={1}
                  className="border rounded-xl px-3 py-2 w-24 text-sm"
                  value={settings.sources.linkedin.concurrency}
                  onChange={(e)=> updateLinkedInSource('concurrency', Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="font-medium">Actions per Minute</p>
                <input
                  type="number"
                  min={1}
                  className="border rounded-xl px-3 py-2 w-24 text-sm"
                  value={settings.sources.linkedin.actionsPerMinute}
                  onChange={(e)=> updateLinkedInSource('actionsPerMinute', Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-8 space-y-8">
          <Card className="rounded-2xl border border-border/60">
            <CardHeader>
              <h2 className="text-xl font-semibold">LinkedIn Remote Session</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                Sniper uses your LinkedIn session to perform searches and enrich profiles.
              </p>
            </CardHeader>
            <CardContent className="py-6 flex items-center justify-between">
              <div>
                <p className="font-medium">Status: Connected</p>
                <p className="text-muted-foreground text-sm">Last refreshed: 2 hours ago</p>
              </div>
              <Button>Reconnect Session</Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60">
            <CardHeader>
              <h2 className="text-xl font-semibold">Apollo Integration</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                Primary enrichment engine for email and contact validation.
              </p>
            </CardHeader>
            <CardContent className="flex items-center justify-between py-6">
              <p className="font-medium">Active</p>
              <Button variant="outline">Manage API Key</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules" className="mt-8 space-y-8">
          <Card className="rounded-2xl border border-border/60">
            <CardHeader>
              <h2 className="text-xl font-semibold">Discovery Modules</h2>
              <p className="text-muted-foreground text-sm max-w-lg">
                Configure additional discovery sources for Sniper. More modules coming soon.
              </p>
            </CardHeader>
            <CardContent className="py-6 text-muted-foreground">
              No discovery modules are currently enabled.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

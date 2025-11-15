import React, { useState } from "react";
import { motion } from "framer-motion";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Minimal slider row used by the provided UI. Keeps visual-only behavior.
function SliderRow({ label, max = 100, recommended }) {
  const [val, setVal] = useState(Math.min(Math.round(max * 0.5), max));
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
          {/* Static track (unfilled) */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-gray-400/30 dark:bg-gray-700/60" />
          {/* Filled track */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-blue-500/70"
            style={{ width: `${Math.max(0, Math.min(100, (val / max) * 100))}%` }}
          />
          {/* Native control (keeps the thumb for affordance) */}
          <input
          type="range"
          min={0}
          max={max}
          value={val}
          onChange={(e)=> setVal(Number(e.target.value))}
            className="relative w-full h-6 bg-transparent appearance-none cursor-pointer"
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
            }}
          />
        </div>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400">
          <span className="font-semibold">{val}</span>
          <span className="text-muted-foreground">/ {max}</span>
        </span>
      </div>
    </div>
  );
}
export default function SniperControlCenter() {

  return (

    <div className="w-full p-8 flex flex-col gap-10">

      {/* Header */}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        <h1 className="text-3xl font-semibold tracking-tight">Sniper Control Center</h1>

        <p className="text-muted-foreground max-w-xl mt-1">

          Configure how Sniper discovers leads, enriches decision makers, manages sessions,

          and applies global automation rules.

        </p>

      </motion.div>

      {/* Tabs */}

      <Tabs defaultValue="global" className="w-full">

        <TabsList className="grid grid-cols-4 w-full max-w-3xl">

          <TabsTrigger value="global">Global Defaults</TabsTrigger>

          <TabsTrigger value="limits">Limits & Throttling</TabsTrigger>

          <TabsTrigger value="integrations">Integrations & Sessions</TabsTrigger>

          <TabsTrigger value="modules">Discovery Modules</TabsTrigger>

        </TabsList>

        {/* TAB 1 — GLOBAL DEFAULTS */}

        <TabsContent value="global" className="mt-8 space-y-8">

          <Card className="rounded-2xl border border-border/60">

            <CardHeader>

              <h2 className="text-xl font-semibold">Default Sniper Behavior</h2>

              <p className="text-muted-foreground text-sm max-w-lg">

                Define how Sniper behaves automatically when you run discoveries from Workflows

                or REX.

              </p>

            </CardHeader>

            <CardContent className="flex flex-col gap-6 py-6">

              <div className="flex items-center justify-between">

                <div>

                  <p className="font-medium">Primary Job Board</p>

                  <p className="text-muted-foreground text-sm">Choose the default platform for Sniper searches.</p>

                </div>

                <select className="border rounded-xl px-3 py-2 bg-background text-sm">

                  <option>Indeed</option>

                  <option>Google Jobs</option>

                  <option>ZipRecruiter</option>

                </select>

              </div>

              <div className="flex items-center justify-between">

                <div>

                  <p className="font-medium">Auto-create Tables</p>

                  <p className="text-muted-foreground text-sm">Automatically save job results into a custom table.</p>

                </div>

                <Switch />

              </div>

              <div className="flex items-center justify-between">

                <div>

                  <p className="font-medium">Default Enrichment</p>

                  <p className="text-muted-foreground text-sm">Controls how Sniper enriches decision makers.</p>

                </div>

                <select className="border rounded-xl px-3 py-2 bg-background text-sm">

                  <option>Apollo Only</option>

                  <option>Apollo → ZoomInfo</option>

                </select>

              </div>

            </CardContent>

          </Card>

        </TabsContent>

        {/* TAB 2 — LIMITS & THROTTLING */}

        <TabsContent value="limits" className="mt-8 space-y-8">

          <Card className="rounded-2xl border border-border/60">

            <CardHeader>

              <h2 className="text-xl font-semibold">Daily Limits</h2>

              <p className="text-muted-foreground text-sm max-w-lg">

                Set safe operating limits for each platform Sniper interacts with.

              </p>

            </CardHeader>

            <CardContent className="py-6 space-y-8">

              <div>

                <h3 className="font-medium mb-2">LinkedIn</h3>

                <div className="space-y-4">

                  <SliderRow label="Profile Views" max={60} recommended="40-60" />

                  <SliderRow label="Connection Invites" max={50} recommended="40-50" />

                  <SliderRow label="Messages" max={120} recommended="100-120" />

                </div>

              </div>

              <div>

                <h3 className="font-medium mb-2">Indeed</h3>

                <div className="space-y-4">

                  <SliderRow label="Scrapes per Day" max={500} recommended="200-500" />

                  <SliderRow label="Reachouts per Day" max={50} recommended="20-50" />

                </div>

              </div>

              <div>

                <h3 className="font-medium mb-2">TikTok</h3>

                <div className="space-y-4">

                  <SliderRow label="Creator Searches" max={150} recommended="50-100" />

                  <SliderRow label="Post Engagement Scrapes" max={200} recommended="50-150" />

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

                <input type="number" className="border rounded-xl px-3 py-2 w-24 text-sm" />

              </div>

              <div className="flex items-center justify-between">

                <p className="font-medium">Actions per Minute</p>

                <input type="number" className="border rounded-xl px-3 py-2 w-24 text-sm" />

              </div>

            </CardContent>

          </Card>

        </TabsContent>

        {/* TAB 3 — INTEGRATIONS / SESSIONS */}

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

        {/* TAB 4 — DISCOVERY MODULES */}

        <TabsContent value="modules" className="mt-8 space-y-8">

          <Card className="rounded-2xl border border-border/60">

            <CardHeader>

              <h2 className="text-xl font-semibold">ZoomInfo Enrichment</h2>

              <p className="text-muted-foreground text-sm max-w-lg">

                Enable ZoomInfo for decision maker intelligence. (+1 credit only when emails are found.)

              </p>

            </CardHeader>

            <CardContent className="py-6 flex items-center justify-between">

              <p className="font-medium">Enable ZoomInfo</p>

              <Switch />

            </CardContent>

          </Card>

          <Card className="rounded-2xl border border-border/60">

            <CardHeader>

              <h2 className="text-xl font-semibold">TikTok Discovery</h2>

            </CardHeader>

            <CardContent className="py-6 space-y-6">

              <div className="flex items-center justify-between">

                <p className="font-medium">Creator Search</p>

                <Switch />

              </div>

              <div className="flex items-center justify-between">

                <p className="font-medium">Post Engagement Scraping</p>

                <Switch />

              </div>

            </CardContent>

          </Card>

        </TabsContent>

      </Tabs>

    </div>
  );
}



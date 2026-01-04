import React, { useMemo } from "react";
import { motion } from "framer-motion";
import PublicNavbar from "../components/PublicNavbar";
import PublicFooter from "../components/PublicFooter";

export default function GtmStrategy() {
  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="min-h-screen w-full">
      <PublicNavbar />
      {/* Keep the styling self-contained to this page render (removed on unmount). */}
      <style>{`
    :root{
      --bg0:#070A12;
      --bg1:#0B1020;
      --card:#0D1427cc;
      --card2:#0F1830cc;
      --line:#1E2A44;
      --line2:#2A3A5E;
      --text:#EAF0FF;
      --muted:#A8B4D6;
      --muted2:#7F8BB1;
      --good:#2EE59D;
      --warn:#FBBF24;
      --bad:#FB7185;
      --hp:#7C3AED;
      --hp2:#22D3EE;
      --shadow: 0 30px 90px rgba(0,0,0,.55);
      --shadow2: 0 22px 60px rgba(0,0,0,.45);
      --radius: 18px;
      --radius2: 22px;
      --max: 1180px;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }

    *{box-sizing:border-box}
    html,body{height:100%}
    body{
      margin:0;
      font-family:var(--sans);
      color:var(--text);
      background:
        radial-gradient(1200px 700px at 30% -10%, rgba(124,58,237,.45), transparent 65%),
        radial-gradient(1200px 700px at 90% 10%, rgba(34,211,238,.28), transparent 60%),
        radial-gradient(800px 600px at 40% 120%, rgba(124,58,237,.25), transparent 60%),
        linear-gradient(180deg, var(--bg0), var(--bg1));
      overflow-x:hidden;
    }

    a{color:inherit}
    .wrap{max-width:var(--max); margin:0 auto; padding:28px 18px 80px;}
    .shell{
      border:1px solid rgba(42,58,94,.55);
      background: linear-gradient(180deg, rgba(15,24,48,.55), rgba(10,14,30,.35));
      border-radius: 28px;
      box-shadow: var(--shadow);
      overflow:hidden;
      position:relative;
    }

    /* subtle glow frame */
    .shell:before{
      content:"";
      position:absolute; inset:-2px;
      background:
        radial-gradient(800px 240px at 20% 0%, rgba(124,58,237,.25), transparent 70%),
        radial-gradient(700px 220px at 80% 0%, rgba(34,211,238,.16), transparent 70%);
      filter: blur(10px);
      opacity:.9;
      pointer-events:none;
    }

    .topbar{
      position:relative;
      z-index:50;
      display:flex; align-items:center; justify-content:space-between;
      gap:16px;
      padding:18px 18px;
      background: linear-gradient(180deg, rgba(10,14,30,.82), rgba(10,14,30,.40));
      border-bottom:1px solid rgba(30,42,68,.65);
      backdrop-filter: blur(10px);
    }
    .brand{
      display:flex; align-items:center; gap:12px;
      min-width:220px;
    }
    .logo{
      width:38px; height:38px; border-radius:14px;
      background: radial-gradient(14px 14px at 30% 30%, rgba(255,255,255,.55), transparent 60%),
                  linear-gradient(135deg, rgba(124,58,237,1), rgba(34,211,238,1));
      box-shadow: 0 16px 40px rgba(124,58,237,.25);
    }
    .brand h1{
      margin:0; font-size:14px; font-weight:800; letter-spacing:.2px;
      line-height:1.05;
    }
    .brand p{
      margin:2px 0 0; font-size:12px; color:var(--muted2);
    }

    .pills{display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end}
    .pill{
      display:inline-flex; align-items:center; gap:8px;
      padding:9px 12px;
      border-radius:999px;
      border:1px solid rgba(42,58,94,.7);
      background: rgba(13,20,39,.45);
      color:var(--muted);
      font-size:12px;
      text-decoration:none;
      transition: all .18s ease;
    }
    .pill:hover{
      border-color: rgba(124,58,237,.55);
      background: rgba(124,58,237,.10);
      transform: translateY(-1px);
      color: var(--text);
    }
    .pill.primary{
      border-color: rgba(124,58,237,.55);
      background: linear-gradient(180deg, rgba(124,58,237,.22), rgba(13,20,39,.45));
      color: var(--text);
    }

    .content{padding:20px 18px 28px; position:relative; z-index:1;}

    .hero{
      display:grid;
      grid-template-columns: 1.3fr .9fr;
      gap:16px;
      padding:18px;
    }
    @media (max-width: 980px){
      .hero{grid-template-columns:1fr}
    }

    .card{
      border:1px solid rgba(30,42,68,.75);
      background: linear-gradient(180deg, rgba(13,20,39,.66), rgba(13,20,39,.35));
      border-radius: var(--radius2);
      box-shadow: var(--shadow2);
    }

    .heroLeft{padding:18px 18px 16px;}
    .tag{
      display:inline-flex; align-items:center; gap:8px;
      padding:6px 10px;
      border-radius:999px;
      border:1px solid rgba(46,229,157,.25);
      background: rgba(46,229,157,.07);
      color: rgba(46,229,157,.95);
      font-size:12px;
      font-weight:700;
      letter-spacing:.2px;
    }
    .dot{width:8px; height:8px; border-radius:999px; background: var(--good); box-shadow:0 0 0 4px rgba(46,229,157,.10);}
    .title{
      margin:12px 0 8px;
      font-size:44px;
      line-height:1.05;
      letter-spacing:-.5px;
    }
    .title span{
      background: linear-gradient(90deg, rgba(124,58,237,1), rgba(34,211,238,1));
      -webkit-background-clip:text;
      background-clip:text;
      color:transparent;
    }
    .lede{
      color: var(--muted);
      font-size:15px;
      line-height:1.6;
      margin:0;
      max-width: 56ch;
    }

    .chips{display:flex; gap:10px; flex-wrap:wrap; margin-top:14px;}
    .chip{
      display:flex; align-items:center; gap:8px;
      padding:9px 11px;
      border-radius:999px;
      border:1px solid rgba(30,42,68,.85);
      background: rgba(9,14,28,.35);
      color: var(--muted);
      font-size:12px;
    }
    .chip b{color:var(--text); font-weight:700;}
    .miniIcon{
      width:16px; height:16px; border-radius:6px;
      background: rgba(124,58,237,.20);
      border:1px solid rgba(124,58,237,.35);
    }

    .heroSplit{
      margin-top:14px;
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:12px;
    }
    @media (max-width: 620px){
      .heroSplit{grid-template-columns:1fr}
    }
    .miniCard{
      padding:14px;
      border-radius: 16px;
      border: 1px solid rgba(30,42,68,.75);
      background: rgba(9,14,28,.30);
    }
    .miniCard h3{
      margin:0 0 8px; font-size:13px; letter-spacing:.2px;
      color: var(--text);
    }
    .miniCard p{margin:0; color:var(--muted); font-size:12.5px; line-height:1.55;}
    .badgeLine{
      margin-top:10px;
      display:flex; align-items:center; justify-content:space-between;
      gap:10px;
      padding-top:10px;
      border-top:1px solid rgba(30,42,68,.55);
      color: var(--muted2);
      font-size:12px;
    }
    .kbd{
      font-family:var(--mono);
      font-size:11px;
      padding:5px 8px;
      border-radius:10px;
      border:1px solid rgba(42,58,94,.65);
      background: rgba(13,20,39,.55);
      color: var(--text);
    }

    /* Right rail cards */
    .heroRight{
      padding:16px;
      display:grid;
      gap:12px;
    }
    .railCard{padding:14px 14px 12px;}
    .railCard h4{margin:0 0 8px; font-size:13px; color:var(--text);}
    .railCard p{margin:0; color:var(--muted); font-size:12.5px; line-height:1.55;}
    .list{margin:10px 0 0; padding:0; list-style:none; display:flex; gap:8px; flex-wrap:wrap;}
    .pillTag{
      font-size:11px;
      padding:6px 9px;
      border-radius:999px;
      border:1px solid rgba(42,58,94,.65);
      background: rgba(9,14,28,.35);
      color: var(--muted);
    }
    .tip{
      margin-top:10px;
      padding:10px 11px;
      border-radius:14px;
      border:1px dashed rgba(42,58,94,.65);
      background: rgba(124,58,237,.08);
      color: var(--muted);
      font-size:12px;
    }

    /* Trio tiles */
    .tiles{
      padding:0 18px 18px;
      display:grid;
      grid-template-columns: repeat(3, 1fr);
      gap:12px;
    }
    @media (max-width: 980px){
      .tiles{grid-template-columns:1fr}
    }
    .tile{padding:14px; border-radius:18px;}
    .tile .top{
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      margin-bottom:10px;
    }
    .tile .top h3{margin:0; font-size:13px;}
    .tile .top span{color:var(--muted2); font-size:12px;}
    .checks{margin:0; padding:0; list-style:none; display:grid; gap:8px;}
    .checks li{
      display:flex; align-items:flex-start; gap:10px;
      color:var(--muted);
      font-size:12.5px;
      line-height:1.45;
    }
    .check{
      width:18px; height:18px; border-radius:8px;
      display:inline-flex; align-items:center; justify-content:center;
      border:1px solid rgba(46,229,157,.25);
      background: rgba(46,229,157,.08);
      color: rgba(46,229,157,.95);
      font-weight:900;
      font-size:12px;
      margin-top:1px;
    }

    /* Section */
    .section{
      padding:18px;
      border-top:1px solid rgba(30,42,68,.65);
      display:grid;
      gap:14px;
    }

    .secHead{
      display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;
    }
    .secHead h2{
      margin:0;
      font-size:18px;
      letter-spacing:.2px;
    }
    .secHead .sub{
      color:var(--muted);
      font-size:12.5px;
      margin-top:6px;
      max-width:70ch;
      line-height:1.55;
    }
    .secTip{
      display:flex; align-items:center; gap:10px;
      padding:10px 12px;
      border-radius: 16px;
      border:1px solid rgba(42,58,94,.65);
      background: rgba(9,14,28,.30);
      color: var(--muted);
      font-size:12px;
      white-space:nowrap;
    }

    /* TOC cards */
    .toc{
      display:grid;
      grid-template-columns: repeat(4, 1fr);
      gap:12px;
    }
    @media (max-width: 980px){ .toc{grid-template-columns: repeat(2, 1fr);} }
    @media (max-width: 560px){ .toc{grid-template-columns: 1fr;} }

    .tocCard{
      padding:14px;
      border-radius:18px;
      border:1px solid rgba(30,42,68,.75);
      background: rgba(9,14,28,.30);
      text-decoration:none;
      transition: transform .18s ease, border-color .18s ease, background .18s ease;
      display:flex; gap:12px; align-items:flex-start;
    }
    .tocCard:hover{
      transform: translateY(-2px);
      border-color: rgba(124,58,237,.55);
      background: rgba(124,58,237,.08);
    }
    .num{
      width:34px; height:34px; border-radius:14px;
      display:flex; align-items:center; justify-content:center;
      font-weight:900;
      background: rgba(124,58,237,.18);
      border:1px solid rgba(124,58,237,.35);
      color: var(--text);
      flex:0 0 auto;
    }
    .tocCard h4{margin:0 0 4px; font-size:13px;}
    .tocCard p{margin:0; color:var(--muted2); font-size:12px; line-height:1.5;}

    /* Callout */
    .callout{
      padding:14px;
      border-radius:18px;
      border:1px solid rgba(124,58,237,.35);
      background: linear-gradient(180deg, rgba(124,58,237,.14), rgba(9,14,28,.25));
      display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap;
    }
    .callout b{color:var(--text)}
    .callout p{margin:0; color:var(--muted); font-size:12.5px; line-height:1.55;}
    .callout .right{display:flex; gap:10px; align-items:center}
    .pillSmall{
      border-radius:999px;
      padding:8px 10px;
      border:1px solid rgba(42,58,94,.65);
      background: rgba(9,14,28,.30);
      color: var(--muted);
      font-size:12px;
      display:flex; gap:8px; align-items:center;
    }

    /* Detail blocks */
    .detailGrid{
      display:grid;
      grid-template-columns: 1.3fr .7fr;
      gap:12px;
    }
    @media (max-width: 980px){
      .detailGrid{grid-template-columns:1fr}
    }
    .panel{
      padding:16px;
      border-radius:18px;
      border:1px solid rgba(30,42,68,.75);
      background: rgba(9,14,28,.30);
    }
    .panel h3{margin:0 0 8px; font-size:14px;}
    .panel p{margin:0; color:var(--muted); font-size:12.5px; line-height:1.6;}
    .steps{margin:10px 0 0; padding-left:18px; color:var(--muted); font-size:12.5px; line-height:1.6;}
    .steps li{margin:6px 0}
    .miniRule{
      margin-top:10px;
      padding:10px 11px;
      border-radius:16px;
      border:1px dashed rgba(42,58,94,.65);
      background: rgba(34,211,238,.07);
      color: var(--muted);
      font-size:12px;
    }

    /* Footer */
    .footer{
      padding:18px;
      border-top:1px solid rgba(30,42,68,.65);
      color:var(--muted2);
      font-size:12px;
      display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;
    }
    .footer a{color:var(--text); text-decoration:none; border-bottom:1px dotted rgba(124,58,237,.55)}
      `}</style>

      <div className="wrap pt-24">
        <motion.div
          className="shell"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="topbar">
            <div className="pills">
              <a className="pill" href="#toc">
                Table of Contents
              </a>
              <a className="pill" href="#setup">
                Setup
              </a>
              <a className="pill" href="#daily">
                Daily Cadence
              </a>
              <a className="pill primary" href="#dashboards">
                Dashboards
              </a>
            </div>
          </div>

          <div className="content">
            {/* HERO */}
            <div className="hero">
              <motion.div
                className="card heroLeft"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
              >
                <span className="tag">
                  <span className="dot" />
                  Outreach Operating System for Founders & Small Teams
                </span>
                <h2 className="title">
                  GTM Strategy Guide for <span>Using HirePilot</span>
                </h2>
                <p className="lede">
                  This guide turns a multi-channel outbound motion into a repeatable engine you can run{" "}
                  <b>20–30 hours/week</b> with 1 founder + 1–2 support reps. Automate what can be automated, measure what
                  matters, and build a pipeline you can trust.
                </p>

                <div className="chips">
                  <div className="chip">
                    <span className="miniIcon" />
                    <b>Designed for</b> 50–100 meetings/quarter
                  </div>
                  <div className="chip">
                    <span className="miniIcon" />
                    <b>Works for</b> recruiting + services + B2B consultancies
                  </div>
                  <div className="chip">
                    <span className="miniIcon" />
                    <b>Principle</b> automation-first, safety-first cadence
                  </div>
                </div>

                <div className="heroSplit">
                  <div className="miniCard">
                    <h3>What you’ll build</h3>
                    <p>
                      A complete outreach system that connects <b>Personas → Campaigns → Scheduling → Follow-up</b>.
                      Dashboards update weekly and produce measurable pipeline.
                    </p>
                    <div className="badgeLine">
                      <span>
                        Outcome: <b>predictable meetings</b>
                      </span>
                      <span className="kbd">+ clear levers</span>
                    </div>
                  </div>

                  <div className="miniCard">
                    <h3>What you’ll stop doing</h3>
                    <p>
                      No more spreadsheet chaos, random outreach bursts, or “where did the leads go?” HirePilot becomes
                      the single place to run GTM.
                    </p>
                    <div className="badgeLine">
                      <span>
                        Replace: <b>guesswork</b>
                      </span>
                      <span className="kbd">spreadsheets + vibes</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="card heroRight"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
              >
                <div className="railCard">
                  <h4>Recommended stack (inside HirePilot)</h4>
                  <ul className="list">
                    <li className="pillTag">Personas</li>
                    <li className="pillTag">Scheduler</li>
                    <li className="pillTag">Campaign Wizard</li>
                    <li className="pillTag">Email Sequences</li>
                    <li className="pillTag">LinkedIn Actions</li>
                    <li className="pillTag">Tasks</li>
                    <li className="pillTag">Custom Tables</li>
                    <li className="pillTag">Dashboards</li>
                  </ul>
                  <div className="tip">
                    <b>Tip:</b> Start from Templates + Mapping Wizard for instant dashboards.
                  </div>
                </div>

                <div className="railCard">
                  <h4>Safety rules (non-negotiable)</h4>
                  <p>
                    Warm up domains • throttle outbound • rotate copy • respect platform limits • keep opt-outs clean •
                    track bounces.
                    <br />
                    <b>Goal:</b> high deliverability + low risk.
                  </p>
                </div>

                <div className="railCard">
                  <h4>Quick start</h4>
                  <p>Use this guide in order. Build once, then run weekly.</p>
                  <div className="tip">
                    <b>Time-to-live:</b> 2–4 hours setup
                  </div>
                </div>
              </motion.div>
            </div>

            {/* THREE TILES */}
            <motion.div
              className="tiles"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.18 }}
            >
              <div className="card tile">
                <div className="top">
                  <h3>Company Health</h3>
                  <span>Exec view</span>
                </div>
                <ul className="checks">
                  <li>
                    <span className="check">✓</span>Revenue vs gross costs vs net costs
                  </li>
                  <li>
                    <span className="check">✓</span>Margin thresholds + cash timing rules
                  </li>
                  <li>
                    <span className="check">✓</span>Forecast scenarios + monthly pacing
                  </li>
                </ul>
              </div>

              <div className="card tile">
                <div className="top">
                  <h3>Event / Offer Health</h3>
                  <span>Deal view</span>
                </div>
                <ul className="checks">
                  <li>
                    <span className="check">✓</span>Revenue, cost, profit, projected margin
                  </li>
                  <li>
                    <span className="check">✓</span>Cash required pre-event policy
                  </li>
                  <li>
                    <span className="check">✓</span>Scope creep risk + payment timing
                  </li>
                </ul>
              </div>

              <div className="card tile">
                <div className="top">
                  <h3>Outbound Engine</h3>
                  <span>Weekly rhythm</span>
                </div>
                <ul className="checks">
                  <li>
                    <span className="check">✓</span>Persona-driven list pulls
                  </li>
                  <li>
                    <span className="check">✓</span>Scheduled email sequences + LinkedIn touches
                  </li>
                  <li>
                    <span className="check">✓</span>ABM touches and follow-up tasks
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* TOC */}
            <div className="section" id="toc">
              <div className="secHead">
                <div>
                  <h2>Table of Contents</h2>
                  <div className="sub">
                    Use this page as your execution playbook. Each section maps to a HirePilot build step.
                  </div>
                </div>
                <div className="secTip">
                  Tip: Use <span className="kbd">⌘</span> + <span className="kbd">F</span> to jump quickly.
                </div>
              </div>

              <div className="toc">
                <a className="tocCard" href="#setup">
                  <div className="num">1</div>
                  <div>
                    <h4>System Setup</h4>
                    <p>Tables, personas, rules</p>
                  </div>
                </a>
                <a className="tocCard" href="#daily">
                  <div className="num">2</div>
                  <div>
                    <h4>Daily Cadence</h4>
                    <p>2–3 hrs/day engine</p>
                  </div>
                </a>
                <a className="tocCard" href="#weekly">
                  <div className="num">3</div>
                  <div>
                    <h4>Weekly Rhythm</h4>
                    <p>Fixed days</p>
                  </div>
                </a>
                <a className="tocCard" href="#monthly">
                  <div className="num">4</div>
                  <div>
                    <h4>Monthly + Quarterly</h4>
                    <p>Scale & optimize</p>
                  </div>
                </a>
                <a className="tocCard" href="#abm">
                  <div className="num">5</div>
                  <div>
                    <h4>ABM Touches</h4>
                    <p>Must-win accounts</p>
                  </div>
                </a>
                <a className="tocCard" href="#sequences">
                  <div className="num">6</div>
                  <div>
                    <h4>Sequences</h4>
                    <p>Plug & play</p>
                  </div>
                </a>
                <a className="tocCard" href="#dashboards">
                  <div className="num">7</div>
                  <div>
                    <h4>Dashboards</h4>
                    <p>Exec visibility</p>
                  </div>
                </a>
                <a className="tocCard" href="#automation">
                  <div className="num">8</div>
                  <div>
                    <h4>Automation Map</h4>
                    <p>80–90% automated</p>
                  </div>
                </a>
              </div>
            </div>

            {/* SETUP */}
            <div className="section" id="setup">
              <div className="secHead">
                <div>
                  <h2>1) System Setup (Build Once)</h2>
                  <div className="sub">
                    Before you automate anything, you need clean “source-of-truth” data structures. This is the minimum
                    setup that powers everything else.
                  </div>
                </div>
                <div className="secTip">
                  Goal: create a repeatable engine in <b>1–2 hours</b>
                </div>
              </div>

              <div className="callout">
                <div>
                  <p>
                    <b>Golden rule:</b> Every outreach action must trace back to a <b>Persona</b> and a <b>Campaign</b>.
                    If it doesn’t map, you can’t measure it — and you can’t scale it.
                  </p>
                </div>
                <div className="right">
                  <div className="pillSmall">
                    <span className="dot" />
                    Source-of-truth
                  </div>
                  <div className="pillSmall">No spreadsheet drift</div>
                </div>
              </div>

              <div className="detailGrid">
                <div className="panel">
                  <h3>Build these first inside HirePilot</h3>
                  <ol className="steps">
                    <li>
                      <b>Create Personas</b> (titles, keywords, locations). Use “OR mode” for titles when you want larger
                      pools.
                    </li>
                    <li>
                      <b>Campaign Wizard</b>: define the offer, channel, and messaging spine.
                    </li>
                    <li>
                      <b>Scheduler</b>: set daily/weekly list pulls + daily send limits.
                    </li>
                    <li>
                      <b>Sequences</b>: build 2–3 evergreen sequences (Funding Signal, Event Bridge, ABM Multi-Touch).
                    </li>
                    <li>
                      <b>Tasks</b>: auto-generate follow-ups for high-intent replies or event registrants.
                    </li>
                  </ol>
                </div>

                <div className="panel">
                  <h3>Non-negotiable rules</h3>
                  <p>These protect deliverability and ensure the engine stays stable.</p>
                  <div className="miniRule">
                    <b>Deliverability:</b> Warmup domains, rotate copy, track bounces, keep opt-outs clean.
                  </div>
                  <div className="miniRule">
                    <b>Throttling:</b> Daily send caps + automatic queueing. No spikes.
                  </div>
                  <div className="miniRule">
                    <b>Attribution:</b> Every action tracks persona + campaign + source.
                  </div>
                </div>
              </div>
            </div>

            {/* DAILY */}
            <div className="section" id="daily">
              <div className="secHead">
                <div>
                  <h2>2) Daily Cadence (2–3 Hours / Weekday)</h2>
                  <div className="sub">
                    This is the “engine block.” Most of it can be scheduled and automated once the system is built.
                  </div>
                </div>
                <div className="secTip">
                  Target: <b>3–5 conversations → 1 meeting/day</b>
                </div>
              </div>

              <div className="detailGrid">
                <div className="panel">
                  <h3>Daily plan (automation-first)</h3>
                  <ol className="steps">
                    <li>
                      <b>Email sends (scheduled):</b> 50–75/day from active personas + campaigns.
                    </li>
                    <li>
                      <b>LinkedIn touches (semi-automated):</b> connect requests + follow-up messages.
                    </li>
                    <li>
                      <b>High-intent calls:</b> only to responders, warm registrants, and replies.
                    </li>
                    <li>
                      <b>Content engagement:</b> 20–30 minutes commenting on ICP posts to boost reply rates.
                    </li>
                    <li>
                      <b>ABM touches:</b> 5–10 must-win accounts receive 1 tailored touch/day.
                    </li>
                  </ol>
                </div>

                <div className="panel">
                  <h3>How HirePilot helps</h3>
                  <p>
                    Scheduler pulls new leads (deduped) → sequences send → tasks create follow-ups → dashboards show
                    weekly pipeline. You operate the exceptions; the machine runs the baseline.
                  </p>
                  <div className="miniRule">
                    <b>Win condition:</b> daily activity is consistent, not heroic.
                  </div>
                </div>
              </div>
            </div>

            {/* WEEKLY */}
            <div className="section" id="weekly">
              <div className="secHead">
                <div>
                  <h2>3) Weekly Rhythm (Fixed Days)</h2>
                  <div className="sub">
                    You don’t need motivation — you need a calendar. This rhythm keeps the engine fed.
                  </div>
                </div>
                <div className="secTip">
                  Target: <b>15–25 meetings/week</b> → 4–6 proposals
                </div>
              </div>

              <div className="panel">
                <h3>Weekly focus (high level)</h3>
                <ol className="steps">
                  <li>
                    <b>Monday:</b> launch or refresh email sequence + founder post.
                  </li>
                  <li>
                    <b>Tuesday:</b> heavier LinkedIn outbound + engagement.
                  </li>
                  <li>
                    <b>Wednesday:</b> phone block + high-intent follow-ups.
                  </li>
                  <li>
                    <b>Thursday:</b> content repurposing + community distribution.
                  </li>
                  <li>
                    <b>Friday:</b> partnerships + review metrics + plan next week.
                  </li>
                </ol>
              </div>
            </div>

            {/* MONTHLY */}
            <div className="section" id="monthly">
              <div className="secHead">
                <div>
                  <h2>4) Monthly + Quarterly Cadence</h2>
                  <div className="sub">
                    Monthly fills the top of the funnel. Quarterly compounds results with ABM + referrals.
                  </div>
                </div>
                <div className="secTip">
                  Target: <b>500 new ICPs/month</b> + 1 flagship asset
                </div>
              </div>

              <div className="detailGrid">
                <div className="panel">
                  <h3>Monthly (Week 1)</h3>
                  <ol className="steps">
                    <li>
                      <b>List building:</b> add 500 ICPs with a clear persona label and source.
                    </li>
                    <li>
                      <b>Content launch:</b> publish 1 flagship playbook or report.
                    </li>
                    <li>
                      <b>Paid test:</b> small spend to a single offer (“audit”, “scorecard”, “event invite”).
                    </li>
                    <li>
                      <b>Partner sync:</b> portfolio updates + targeted asks.
                    </li>
                    <li>
                      <b>Review:</b> leads → meetings → proposals → wins; fix bottlenecks.
                    </li>
                  </ol>
                </div>

                <div className="panel">
                  <h3>Quarterly (Weeks 1–2)</h3>
                  <ol className="steps">
                    <li>
                      <b>Must-win ABM:</b> 50 focus accounts, 8–12 touches each.
                    </li>
                    <li>
                      <b>Referral push:</b> clients + partners: “Who needs a sprint/pod?”
                    </li>
                    <li>
                      <b>State of GTM report:</b> anonymized insights + predictions.
                    </li>
                    <li>
                      <b>Offer refresh:</b> tighten pricing, scope, and positioning.
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* ABM */}
            <div className="section" id="abm">
              <div className="secHead">
                <div>
                  <h2>5) ABM Touches (Must-Win Accounts)</h2>
                  <div className="sub">
                    ABM is your “unfair advantage” layer: a small list of accounts that receive consistent, tailored
                    touches. It turns brand + community + outbound into a focused closing motion.
                  </div>
                </div>
                <div className="secTip">5–10 accounts/day</div>
              </div>

              <div className="panel">
                <h3>ABM touch examples (rotate daily)</h3>
                <ol className="steps">
                  <li>Personalized note referencing a recent hiring, funding, or product move.</li>
                  <li>Invite to a relevant event or roundtable (or send replay + scorecard).</li>
                  <li>Share a 1-page teardown of their GTM motion + 2 action items.</li>
                  <li>Ask for the “right owner” intro (low friction) instead of pitching hard.</li>
                </ol>
              </div>
            </div>

            {/* SEQUENCES */}
            <div className="section" id="sequences">
              <div className="secHead">
                <div>
                  <h2>6) Sequences (Plug & Play)</h2>
                  <div className="sub">Keep sequences short, direct, and built around a single offer. Rotate copy monthly.</div>
                </div>
                <div className="secTip">Build 3 evergreen sequences</div>
              </div>

              <div className="detailGrid">
                <div className="panel">
                  <h3>Funding Signal (monthly)</h3>
                  <ol className="steps">
                    <li>Day 1: “Congrats on [Funding] — here’s GTM hiring at your stage”</li>
                    <li>Day 3: “3 roles most [Stage] companies mis-hire (scorecard)”</li>
                    <li>Day 7: “[Company] GTM Gap Audit — 20 min this week?”</li>
                    <li>Day 5: call referencing email + current openings</li>
                  </ol>
                </div>

                <div className="panel">
                  <h3>Event Bridge (per event)</h3>
                  <ol className="steps">
                    <li>Day −7: “Live next week: [Outcome] in [Time]”</li>
                    <li>Day 0: reminder + teaser</li>
                    <li>Day +1: replay + personalized scorecard</li>
                    <li>Day +3: “3 similar companies took action — you?”</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* DASHBOARDS */}
            <div className="section" id="dashboards">
              <div className="secHead">
                <div>
                  <h2>7) Dashboards (Executive Visibility)</h2>
                  <div className="sub">
                    Dashboards exist to change behavior. Your exec team should instantly see: what’s working, what’s
                    risky, and what to do next.
                  </div>
                </div>
                <div className="secTip">No vanity charts</div>
              </div>

              <div className="panel">
                <h3>Recommended dashboards to ship by default</h3>
                <ol className="steps">
                  <li>
                    <b>Executive Overview:</b> total revenue, total cost, profit, margin % + revenue vs cost trend.
                  </li>
                  <li>
                    <b>Net Profit Outlook:</b> forecast profit against operating costs (by category).
                  </li>
                  <li>
                    <b>Outbound Engine:</b> leads added, emails sent, replies, meetings booked, pipeline created.
                  </li>
                  <li>
                    <b>At-Risk Monitor:</b> margin below threshold, deposit below policy, scope creep high + payment late.
                  </li>
                </ol>
                <div className="miniRule">
                  <b>Rule:</b> each dashboard must answer “What changed?” and “What do we do?”
                </div>
              </div>
            </div>

            {/* AUTOMATION */}
            <div className="section" id="automation">
              <div className="secHead">
                <div>
                  <h2>8) Automation Map (80–90% Automated)</h2>
                  <div className="sub">
                    The goal is to automate baseline activity so humans focus on exceptions: high-intent conversations,
                    key accounts, and closing.
                  </div>
                </div>
                <div className="secTip">Operate exceptions</div>
              </div>

              <div className="detailGrid">
                <div className="panel">
                  <h3>Automate</h3>
                  <ol className="steps">
                    <li>Daily list pulls from Personas (dedupe + rotation)</li>
                    <li>Scheduled email sequences with throttling</li>
                    <li>LinkedIn connect + follow-ups (within safe limits)</li>
                    <li>Auto tasks on replies, clicks, registrants</li>
                    <li>Weekly dashboard refresh + at-risk flags</li>
                  </ol>
                </div>

                <div className="panel">
                  <h3>Keep human</h3>
                  <ol className="steps">
                    <li>ABM account strategy + personalization</li>
                    <li>Calls with high-intent prospects</li>
                    <li>Proposal shaping + deal closing</li>
                    <li>Content narrative + thought leadership</li>
                  </ol>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
      <PublicFooter />
    </div>
  );
}



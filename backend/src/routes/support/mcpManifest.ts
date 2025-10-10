import { Router } from "express";
const router = Router();

router.get("/.well-known/mcp.json", (_req, res) => {
  res.json({
    name: "hirepilot_support_tools",
    description: "HirePilot Support Tools",
    version: "1.0.0",
    tools: [
      { name: "lookup_user", method: "POST", endpoint: "/agent-tools/support/lookup-user",
        description: "Find a user by email or session token.",
        input_schema: {
          type: "object",
          properties: { email: {type:"string"}, session_token: {type:"string"} },
          required: []
        }
      },
      { name: "fetch_plan", method: "POST", endpoint: "/agent-tools/support/account/fetch-plan",
        description: "Return plan/seats/credits/renewal for a user.",
        input_schema: { type:"object", properties:{ user_id:{type:"string"} }, required:["user_id"] }
      },
      { name: "fetch_quota", method: "POST", endpoint: "/agent-tools/support/account/fetch-quota",
        description: "Return quota/usage limits for a user.",
        input_schema: { type:"object", properties:{ user_id:{type:"string"} }, required:["user_id"] }
      },
      { name: "fetch_usage", method: "POST", endpoint: "/agent-tools/support/account/fetch-usage",
        description: "Return recent usage metrics for a user.",
        input_schema: { type:"object", properties:{ user_id:{type:"string"} }, required:["user_id"] }
      },
      { name: "check_integrations", method: "POST", endpoint: "/agent-tools/support/checks/integrations",
        description: "Quick integration health for a user (gmail/outlook/sendgrid/slack).",
        input_schema: { type:"object", properties:{ user_id:{type:"string"} }, required:["user_id"] }
      },
      { name: "check_service_health", method: "POST", endpoint: "/agent-tools/support/checks/service-health",
        description: "Platform/service status: ok|degraded|down.",
        input_schema: { type:"object", properties:{ service:{type:"string"} }, required:["service"] }
      },
      { name: "check_recent_errors", method: "POST", endpoint: "/agent-tools/support/checks/recent-errors",
        description: "Recent error signals for a user.",
        input_schema: { type:"object", properties:{ user_id:{type:"string"}, window_minutes:{type:"number"} }, required:["user_id"] }
      },
      { name: "probe_endpoint", method: "POST", endpoint: "/agent-tools/support/checks/probe-endpoint",
        description: "Synthetic probe to a named endpoint.",
        input_schema: { type:"object", properties:{ name:{type:"string"} }, required:["name"] }
      },
      { name: "start_walkthrough", method: "POST", endpoint: "/agent-tools/support/walkthroughs/start",
        description: "Begin a procedural walkthrough.",
        input_schema: { type:"object",
          properties:{ user_id:{type:"string"}, procedure_slug:{type:"string"} },
          required:["user_id","procedure_slug"] }
      },
      { name: "advance_walkthrough", method: "POST", endpoint: "/agent-tools/support/walkthroughs/advance",
        description: "Advance the walkthrough based on user reply.",
        input_schema: { type:"object",
          properties:{ session_id:{type:"string"}, user_reply:{type:"string"} },
          required:["session_id","user_reply"] }
      },
      { name: "create_ticket", method: "POST", endpoint: "/agent-tools/support/tickets/create",
        description: "Create a structured support ticket.",
        input_schema: {
          type: "object",
          properties: {
            user_id:{type:"string"}, issue_kind:{type:"string"},
            summary:{type:"string"}, signals:{type:"object"},
            repro_steps:{type:"string"},
            attempted_fixes:{type:"array", items:{type:"string"}},
            customer_impact:{type:"string"}
          },
          required:["user_id","issue_kind","summary"]
        }
      },
      { name: "notify_email_thread", method: "POST", endpoint: "/agent-tools/support/notify/email-thread",
        description: "Send a support email via HirePilot pipeline.",
        input_schema: {
          type:"object",
          properties:{ to:{type:"string"}, subject:{type:"string"}, body:{type:"string"}, cc:{type:"array",items:{type:"string"}} },
          required:["to","subject","body"]
        }
      },
      { name: "log_feedback", method: "POST", endpoint: "/agent-tools/support/feedback/log",
        description: "Log feature request or feedback from a user.",
        input_schema: {
          type:"object",
          properties:{ user_id:{type:"string"}, text:{type:"string"}, category:{type:"string"} },
          required:["text"]
        }
      },
      { name: "create_sales_lead", method: "POST", endpoint: "/agent-tools/support/sales/create-lead",
        description: "Create a CRM lead sourced from support.",
        input_schema: { type:"object", properties:{ name:{type:"string"}, email:{type:"string"}, notes:{type:"string"}, source:{type:"string"} }, required:["source"] }
      },
      { name: "schedule_demo", method: "POST", endpoint: "/agent-tools/support/sales/schedule-demo",
        description: "Schedule a demo call.",
        input_schema: { type:"object", properties:{ email:{type:"string"}, timeslot_pref:{type:"string"} }, required:["email"] }
      }
    ]
  });
});

export default router;



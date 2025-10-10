import { Router } from "express";

const router = Router();

function getBaseUrl(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/agent-tools/support`;
}

router.get("/.well-known/ai-plugin.json", (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.json({
    schema_version: "v1",
    name_for_human: "HirePilot Support Tools",
    name_for_model: "hirepilot_support_tools",
    description_for_model: "Support tools for HirePilot: lookup users, check health, create tickets, send notifications.",
    description_for_human: "Support tools for HirePilot",
    auth: {
      type: "none"
    },
    api: {
      type: "openapi",
      url: `${baseUrl}/openapi.json`
    },
    contact_email: "support@thehirepilot.com",
    legal_info_url: "https://thehirepilot.com/legal"
  });
});

router.get("/openapi.json", (req, res) => {
  const baseUrl = getBaseUrl(req);
  const doc: any = {
    openapi: "3.0.1",
    info: { title: "HirePilot Support Tools", version: "1.0.0" },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/lookup-user": {
        post: {
          operationId: "lookup_user",
          summary: "Find a user by email or session token",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { email: { type: "string" }, session_token: { type: "string" } }
                }
              }
            }
          },
          responses: { "200": { description: "OK" } }
        }
      },
      "/account/fetch-plan": {
        post: {
          operationId: "fetch_plan",
          summary: "Return plan/seats/credits/renewal for a user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/account/fetch-quota": {
        post: {
          operationId: "fetch_quota",
          summary: "Return quota/usage limits for a user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/account/fetch-usage": {
        post: {
          operationId: "fetch_usage",
          summary: "Return recent usage metrics for a user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/checks/integrations": {
        post: {
          operationId: "check_integrations",
          summary: "Quick integration health for a user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" } }, required: ["user_id"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/checks/service-health": {
        post: {
          operationId: "check_service_health",
          summary: "Platform/service status",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { service: { type: "string" } }, required: ["service"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/checks/recent-errors": {
        post: {
          operationId: "check_recent_errors",
          summary: "Recent error signals for a user",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" }, window_minutes: { type: "number" } }, required: ["user_id"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/checks/probe-endpoint": {
        post: {
          operationId: "probe_endpoint",
          summary: "Synthetic probe",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/walkthroughs/start": {
        post: {
          operationId: "start_walkthrough",
          summary: "Begin a procedural walkthrough",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" }, procedure_slug: { type: "string" } }, required: ["user_id", "procedure_slug"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/walkthroughs/advance": {
        post: {
          operationId: "advance_walkthrough",
          summary: "Advance walkthrough",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { session_id: { type: "string" }, user_reply: { type: "string" } }, required: ["session_id", "user_reply"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/tickets/create": {
        post: {
          operationId: "create_ticket",
          summary: "Create a support ticket",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user_id: { type: "string" },
                    issue_kind: { type: "string" },
                    summary: { type: "string" },
                    signals: { type: "object" },
                    repro_steps: { type: "string" },
                    attempted_fixes: { type: "array", items: { type: "string" } },
                    customer_impact: { type: "string" }
                  },
                  required: ["user_id", "issue_kind", "summary"]
                }
              }
            }
          },
          responses: { "200": { description: "OK" } }
        }
      },
      "/notify/email-thread": {
        post: {
          operationId: "notify_email_thread",
          summary: "Send support email",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, cc: { type: "array", items: { type: "string" } } }, required: ["to", "subject", "body"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/feedback/log": {
        post: {
          operationId: "log_feedback",
          summary: "Log feedback",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { user_id: { type: "string" }, text: { type: "string" }, category: { type: "string" } }, required: ["text"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/sales/create-lead": {
        post: {
          operationId: "create_sales_lead",
          summary: "Create CRM lead from support",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, notes: { type: "string" }, source: { type: "string" } }, required: ["source"] } } } },
          responses: { "200": { description: "OK" } }
        }
      },
      "/sales/schedule-demo": {
        post: {
          operationId: "schedule_demo",
          summary: "Schedule demo",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, timeslot_pref: { type: "string" } }, required: ["email"] } } } },
          responses: { "200": { description: "OK" } }
        }
      }
    }
  };
  res.json(doc);
});

export default router;



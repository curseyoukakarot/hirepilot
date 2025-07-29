import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fires a Google Analytics `page_view` event whenever the React Router path changes **and**
 * updates `document.title` so each virtual page inside the SPA is distinct in analytics.
 *
 * Assumes gtag.js is loaded globally and `window.gtag` is available.
 */
export default function useGAPageViews() {
  const location = useLocation();

  /**
   * Convert blog/article slugs like `flow-of-hirepilot` or `PipelineBestPractices` to
   * human-readable titles.
   */
  const slugToTitle = (slug) => {
    if (!slug) return "";
    // Replace hyphens/underscores with spaces
    let readable = slug.replace(/[-_]/g, " ");
    // Add space before camelCase capitals (e.g. PipelineBestPractices → Pipeline Best Practices)
    readable = readable.replace(/([a-z])([A-Z])/g, "$1 $2");
    // Capitalise first letter of each word
    readable = readable
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return readable;
  };

  /**
   * Basic map of route prefixes to page titles. We use `startsWith` rather than exact
   * matching so that nested paths (e.g. `/settings/profile`) inherit the parent title.
   */
  const titleMap = {
    "/": "HirePilot – AI Recruiting Platform",
    "/signup": "Sign Up | HirePilot",
    "/login": "Log In | HirePilot",
    "/onboarding": "Onboarding | HirePilot",
    "/dashboard": "Dashboard | HirePilot",
    "/campaigns/new": "Create Campaign | HirePilot",
    "/campaigns": "Campaigns | HirePilot",
    "/messages": "Message Center | HirePilot",
    "/settings": "Settings | HirePilot",
    "/billing": "Billing | HirePilot",
    "/rex-chat": "REX Chat | HirePilot",
    "/leads/profile": "Lead Profile | HirePilot",
    "/leads": "Lead Management | HirePilot",
    "/pricing": "Pricing Plans | HirePilot",
    "/rex": "Meet REX | HirePilot",
    "/copilot": "Copilot | HirePilot",
    "/handsfree": "Handsfree Sourcing | HirePilot",
    "/templates": "Templates | HirePilot",
    "/candidates": "Candidates | HirePilot",
    "/jobs/pipeline": "Job Pipeline | HirePilot",
    "/jobs": "Job Requisitions | HirePilot",
    "/analytics": "Analytics | HirePilot",
    "/phantom-monitor": "Phantom Monitor | HirePilot",
    "/phantom/cookie-refresh": "LinkedIn Cookie Refresh | HirePilot",
    "/phantom/bulk-refresh": "Bulk Cookie Refresh | HirePilot",
    "/phantom/analytics": "Phantom Analytics | HirePilot",
    "/phantom/lead-sync-failures": "Lead Sync Failures | HirePilot",
    "/phantom/config": "Phantom Config | HirePilot",
    "/phantom/webhook-logs": "Webhook Logs | HirePilot",
    "/super-admin": "Admin Dashboard | HirePilot",
    "/admin/users": "User Management | HirePilot",
    "/admin/puppet-health": "Puppet Health | HirePilot",
    "/admin/proxy-management": "Proxy Management | HirePilot",
    "/blog": "HirePilot Blog",
    "/chromeextension/privacy": "Chrome Extension Privacy | HirePilot",
    "/chromeextension": "Chrome Extension | HirePilot",
    "/terms": "Terms & Privacy | HirePilot",
    "/rexsupport": "REX Support | HirePilot",
    "/apidoc": "API Documentation | HirePilot",
    "/test-gmail": "Test Gmail Integration | HirePilot",
  };

  useEffect(() => {
    const path = location.pathname;

    // 1. Determine the document title
    let docTitle = "HirePilot"; // Fallback

    // Exact or prefix match from map (longest prefix wins)
    const matchedPrefix = Object.keys(titleMap)
      .filter((prefix) => path.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedPrefix) {
      docTitle = titleMap[matchedPrefix];
    }

    // Handle specific blog article titles dynamically
    if (path.startsWith("/blog/") && path !== "/blog") {
      const slug = path.substring("/blog/".length);
      docTitle = `${slugToTitle(slug)} | HirePilot Blog`;
    }

    // Set the document title for the SPA
    if (typeof document !== "undefined") {
      document.title = docTitle;
    }

    // 2. Fire GA page_view with title if gtag is present
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: path + location.search,
        page_title: docTitle,
      });
    }
  }, [location]);
} 
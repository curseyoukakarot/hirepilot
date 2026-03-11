-- ============================================================================
-- Migration: Customizable Sidebar Apps System
-- Creates user_sidebar_apps (per-user app preferences) and app_usage_events
-- (analytics tracking for future monetization insights).
-- ============================================================================

-- 1. User sidebar app preferences
CREATE TABLE IF NOT EXISTS public.user_sidebar_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sidebar_apps_user
  ON public.user_sidebar_apps(user_id);

-- RLS
ALTER TABLE public.user_sidebar_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sidebar apps"
  ON public.user_sidebar_apps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sidebar apps"
  ON public.user_sidebar_apps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sidebar apps"
  ON public.user_sidebar_apps FOR DELETE
  USING (auth.uid() = user_id);

-- 2. App usage events (analytics / future monetization)
CREATE TABLE IF NOT EXISTS public.app_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'navigate',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_usage_events_user
  ON public.app_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_events_app
  ON public.app_usage_events(app_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_events_created
  ON public.app_usage_events(created_at);

-- RLS
ALTER TABLE public.app_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own usage events"
  ON public.app_usage_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view all usage events"
  ON public.app_usage_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'superadmin')
    )
  );

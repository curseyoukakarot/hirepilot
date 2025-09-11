-- Reorder pipeline stages transactionally via RPC
-- Ensures deterministic minimal return to avoid PostgREST single-object coercion

-- Optional: make unique on (pipeline_id, position) deferrable for transactional safety
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_pipeline_stage_position
--   ON public.pipeline_stages (pipeline_id, position);
-- ALTER INDEX uq_pipeline_stage_position DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.reorder_pipeline_stages(
  p_pipeline uuid,
  p_stages   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialize concurrent reorders on the same pipeline
  PERFORM 1 FROM public.pipelines WHERE id = p_pipeline FOR UPDATE;

  WITH data AS (
    SELECT
      (elem->>'id')::uuid      AS id,
      (elem->>'position')::int AS position
    FROM jsonb_array_elements(p_stages) AS elem
  )
  UPDATE public.pipeline_stages ps
  SET position = d.position,
      updated_at = now()
  FROM data d
  WHERE ps.id = d.id
    AND ps.pipeline_id = p_pipeline;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_pipeline_stages(uuid, jsonb) TO anon, authenticated, service_role;



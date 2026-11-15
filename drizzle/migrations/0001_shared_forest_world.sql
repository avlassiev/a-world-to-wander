CREATE TABLE public.shared_forest_world (id integer PRIMARY KEY CHECK (id = 1), snapshot jsonb NOT NULL, revision integer NOT NULL DEFAULT 1);
GRANT SELECT ON public.shared_forest_world TO anon, authenticated;
GRANT ALL ON public.shared_forest_world TO service_role;
ALTER TABLE public.shared_forest_world ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads the common forest" ON public.shared_forest_world FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.shared_forest_world (id,snapshot) SELECT 1,snapshot - 'player' FROM public.game_worlds ORDER BY updated_at DESC LIMIT 1;
CREATE FUNCTION public.commit_shared_forest(expected_revision integer, world_snapshot jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF world_snapshot IS NULL OR jsonb_typeof(world_snapshot) <> 'object' OR octet_length(world_snapshot::text) > 2000000 OR world_snapshot->>'version' <> '1' OR jsonb_typeof(world_snapshot->'holes') <> 'array' OR jsonb_typeof(world_snapshot->'tunnels') <> 'array' OR jsonb_typeof(world_snapshot->'trees') <> 'array' THEN RAISE EXCEPTION 'Invalid world'; END IF;
 IF expected_revision = 0 THEN
 INSERT INTO public.shared_forest_world (id,snapshot) VALUES (1,world_snapshot - 'player') ON CONFLICT DO NOTHING;
 RETURN FOUND;
 END IF;
 UPDATE public.shared_forest_world SET snapshot = world_snapshot - 'player', revision = revision + 1 WHERE id = 1 AND revision = expected_revision;
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.commit_shared_forest(integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_shared_forest(integer,jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.commit_shared_forest(expected_revision integer, world_snapshot jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE previous_snapshot jsonb; merged_trees jsonb;
BEGIN
 IF world_snapshot IS NULL OR jsonb_typeof(world_snapshot) <> 'object' OR octet_length(world_snapshot::text) > 2000000 OR world_snapshot->>'version' <> '1' OR jsonb_typeof(world_snapshot->'holes') <> 'array' OR jsonb_typeof(world_snapshot->'tunnels') <> 'array' OR jsonb_typeof(world_snapshot->'trees') <> 'array' THEN RAISE EXCEPTION 'Invalid world'; END IF;
 IF expected_revision = 0 THEN
  INSERT INTO public.shared_forest_world (id,snapshot) VALUES (1,world_snapshot - 'player') ON CONFLICT DO NOTHING;
  RETURN FOUND;
 END IF;
 SELECT snapshot INTO previous_snapshot FROM public.shared_forest_world WHERE id = 1 AND revision = expected_revision FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT coalesce(jsonb_agg(CASE WHEN incoming.value IS NULL THEN old.value ELSE jsonb_strip_nulls(jsonb_build_object('cutAt',old.value->'cutAt','timber',old.value->'timber','destroyed',old.value->'destroyed','explosion',old.value->'explosion')) || incoming.value END ORDER BY coalesce(incoming.ordinality,old.ordinality)), '[]'::jsonb)
 INTO merged_trees
 FROM jsonb_array_elements(previous_snapshot->'trees') WITH ORDINALITY AS old(value,ordinality)
 FULL OUTER JOIN jsonb_array_elements(world_snapshot->'trees') WITH ORDINALITY AS incoming(value,ordinality) ON incoming.ordinality = old.ordinality;
 world_snapshot := jsonb_set(world_snapshot, '{trees}', merged_trees);
 IF octet_length(world_snapshot::text) > 2000000 THEN RAISE EXCEPTION 'Invalid world'; END IF;
 UPDATE public.shared_forest_world SET snapshot = world_snapshot - 'player', revision = revision + 1 WHERE id = 1 AND revision = expected_revision;
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.commit_shared_forest(integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_shared_forest(integer,jsonb) TO anon, authenticated;
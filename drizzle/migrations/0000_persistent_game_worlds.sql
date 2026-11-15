CREATE TABLE public.game_worlds (
 key_hash text PRIMARY KEY,
 snapshot jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.game_worlds TO service_role;
ALTER TABLE public.game_worlds ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.read_game_world(device_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF device_key IS NULL OR device_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid save key'; END IF;
 RETURN (SELECT snapshot FROM public.game_worlds WHERE key_hash = encode(sha256(convert_to(device_key, 'UTF8')), 'hex'));
END; $$;
CREATE FUNCTION public.write_game_world(device_key text, world_snapshot jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
 IF device_key IS NULL OR device_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid save key'; END IF;
 IF world_snapshot IS NULL OR jsonb_typeof(world_snapshot) <> 'object' OR octet_length(world_snapshot::text) > 2000000 THEN RAISE EXCEPTION 'Invalid save'; END IF;
 INSERT INTO public.game_worlds(key_hash, snapshot) VALUES (encode(sha256(convert_to(device_key, 'UTF8')), 'hex'), world_snapshot)
 ON CONFLICT (key_hash) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.read_game_world(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_game_world(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_game_world(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_game_world(text, jsonb) TO anon, authenticated;
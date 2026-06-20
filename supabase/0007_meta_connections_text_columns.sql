-- supabase-js sends inserts via PostgREST as JSON, which doesn't natively
-- carry binary `bytea`. Switching the three encryption columns to text with
-- base64 encoding keeps the same security model (still AES-256-GCM with the
-- same key) and makes inserts/reads roundtrip cleanly without raw SQL or
-- hex-string contortions.

alter table public.meta_connections
  alter column ciphertext type text using encode(ciphertext, 'base64'),
  alter column iv type text using encode(iv, 'base64'),
  alter column auth_tag type text using encode(auth_tag, 'base64');

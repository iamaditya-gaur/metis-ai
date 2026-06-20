-- The trigger handler must not be callable via REST. Triggers run as the
-- table owner regardless of EXECUTE grants on the function, so revoking
-- public/authenticated access is safe and closes the only externally-
-- exposed path to a SECURITY DEFINER function.

revoke execute on function public.handle_new_user() from anon, authenticated, public;
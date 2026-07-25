
REVOKE ALL ON FUNCTION public.get_open_blood_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_match_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_blood_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_candidates(uuid) TO authenticated;

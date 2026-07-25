
-- Drop the broad SELECT policy
DROP POLICY IF EXISTS "Authenticated can view donors" ON public.donors;

-- Owner-only direct SELECT on the base table
CREATE POLICY "Users view own donor"
ON public.donors
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Safe listing function: excludes emergency_contact; requires auth
CREATE OR REPLACE FUNCTION public.get_available_donors()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  blood_group text,
  whatsapp_number text,
  latitude double precision,
  longitude double precision,
  is_available boolean,
  available_days text[],
  start_time text,
  end_time text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.user_id, d.full_name, d.blood_group, d.whatsapp_number,
         d.latitude, d.longitude, d.is_available, d.available_days,
         d.start_time, d.end_time, d.created_at, d.updated_at
  FROM public.donors d
  WHERE d.is_available = true
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_available_donors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_donors() TO authenticated;

-- Single donor detail: excludes emergency_contact; requires auth
CREATE OR REPLACE FUNCTION public.get_donor_detail(_donor_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  blood_group text,
  whatsapp_number text,
  latitude double precision,
  longitude double precision,
  is_available boolean,
  available_days text[],
  start_time text,
  end_time text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.user_id, d.full_name, d.blood_group, d.whatsapp_number,
         d.latitude, d.longitude, d.is_available, d.available_days,
         d.start_time, d.end_time, d.created_at, d.updated_at
  FROM public.donors d
  WHERE d.id = _donor_id
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_donor_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_donor_detail(uuid) TO authenticated;

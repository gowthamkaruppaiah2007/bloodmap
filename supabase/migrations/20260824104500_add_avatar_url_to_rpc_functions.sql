-- Migration to update get_available_donors and get_donor_detail RPC functions to include avatar_url
DROP FUNCTION IF EXISTS public.get_available_donors();
DROP FUNCTION IF EXISTS public.get_donor_detail(uuid);

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
  address text,
  avatar_url text,
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
         d.start_time, d.end_time, d.address,
         COALESCE(d.avatar_url, p.avatar_url) AS avatar_url,
         d.created_at, d.updated_at
  FROM public.donors d
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE d.is_available = true
    AND auth.uid() IS NOT NULL;
$$;

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
  address text,
  avatar_url text,
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
         d.start_time, d.end_time, d.address,
         COALESCE(d.avatar_url, p.avatar_url) AS avatar_url,
         d.created_at, d.updated_at
  FROM public.donors d
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE d.id = _donor_id
    AND auth.uid() IS NOT NULL;
$$;

-- Add address column to donors table
ALTER TABLE public.donors ADD COLUMN IF NOT EXISTS address TEXT;

-- Update get_available_donors function to include address
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
         d.start_time, d.end_time, d.address, d.created_at, d.updated_at
  FROM public.donors d
  WHERE d.is_available = true
    AND auth.uid() IS NOT NULL;
$$;

-- Update get_donor_detail function to include address
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
         d.start_time, d.end_time, d.address, d.created_at, d.updated_at
  FROM public.donors d
  WHERE d.id = _donor_id
    AND auth.uid() IS NOT NULL;
$$;

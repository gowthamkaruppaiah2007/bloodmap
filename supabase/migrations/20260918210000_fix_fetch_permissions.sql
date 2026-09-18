-- Migration: Fix Table Grants & RLS Policies for Fetching & Joining

-- 1. Grant explicit permissions on all tables
GRANT ALL ON public.fcm_tokens TO authenticated, service_role;
GRANT ALL ON public.live_locations TO authenticated, service_role;
GRANT ALL ON public.chat_messages TO authenticated, service_role;
GRANT ALL ON public.request_responses TO authenticated, service_role;
GRANT ALL ON public.donors TO authenticated, service_role;
GRANT ALL ON public.blood_requests TO authenticated, service_role;
GRANT ALL ON public.profiles TO authenticated, service_role;

-- 2. Donors Table RLS
DROP POLICY IF EXISTS "Users view own donor" ON public.donors;
DROP POLICY IF EXISTS "Authenticated can view donors" ON public.donors;
DROP POLICY IF EXISTS "Authenticated users view donors" ON public.donors;

CREATE POLICY "Authenticated users view donors"
    ON public.donors
    FOR SELECT
    TO authenticated
    USING (true);

-- 3. Request Responses RLS
DROP POLICY IF EXISTS "Requester views responses" ON public.request_responses;
DROP POLICY IF EXISTS "Donors insert own response" ON public.request_responses;
DROP POLICY IF EXISTS "Donors update own response" ON public.request_responses;
DROP POLICY IF EXISTS "Authenticated view request responses" ON public.request_responses;

CREATE POLICY "Authenticated view request responses"
    ON public.request_responses
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated insert request responses"
    ON public.request_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = donor_user_id OR auth.uid() = request_user_id);

CREATE POLICY "Authenticated update request responses"
    ON public.request_responses
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = donor_user_id OR auth.uid() = request_user_id);

-- 4. Live Locations RLS
DROP POLICY IF EXISTS "View live location for request participant" ON public.live_locations;
DROP POLICY IF EXISTS "Users insert own live location" ON public.live_locations;
DROP POLICY IF EXISTS "Users update own live location" ON public.live_locations;

CREATE POLICY "View live location for request participant"
    ON public.live_locations
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users insert own live location"
    ON public.live_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own live location"
    ON public.live_locations
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Chat Messages RLS
DROP POLICY IF EXISTS "View chat messages for request participant" ON public.chat_messages;
DROP POLICY IF EXISTS "Users insert chat message" ON public.chat_messages;
DROP POLICY IF EXISTS "View chat messages" ON public.chat_messages;

CREATE POLICY "View chat messages"
    ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users insert chat message"
    ON public.chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

-- 6. RPC Grants
GRANT EXECUTE ON FUNCTION public.get_matching_donor_fcm_tokens(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_emergency_request(uuid, text) TO anon, authenticated, service_role;

-- 7. Security Definer RPC for fetching accepted donors for a blood request
CREATE OR REPLACE FUNCTION public.get_accepted_donors_for_request(p_request_id UUID)
RETURNS TABLE (
  id UUID,
  donor_id UUID,
  donor_user_id UUID,
  full_name TEXT,
  blood_group TEXT,
  phone TEXT,
  status TEXT,
  responded_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    rr.id,
    rr.donor_id,
    rr.donor_user_id,
    COALESCE(d.full_name, p.full_name, 'Accepted Donor') AS full_name,
    COALESCE(d.blood_group, 'O+') AS blood_group,
    COALESCE(d.emergency_contact, d.whatsapp_number, p.phone, '') AS phone,
    rr.status,
    rr.responded_at
  FROM public.request_responses rr
  LEFT JOIN public.donors d ON d.id = rr.donor_id
  LEFT JOIN public.profiles p ON p.id = rr.donor_user_id
  WHERE rr.request_id = p_request_id
    AND rr.status = 'accepted';
$$;

GRANT EXECUTE ON FUNCTION public.get_accepted_donors_for_request(uuid) TO anon, authenticated, service_role;

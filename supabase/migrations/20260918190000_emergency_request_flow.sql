-- Migration: Emergency Request Flow & Supabase Realtime Setup

-- 1. Ensure RLS policies on request_responses allow donors to insert & update responses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'request_responses' AND policyname = 'Donors insert own response'
    ) THEN
        CREATE POLICY "Donors insert own response" 
            ON public.request_responses 
            FOR INSERT 
            TO authenticated 
            WITH CHECK (auth.uid() = donor_user_id OR auth.uid() = request_user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'request_responses' AND policyname = 'Donors update own response'
    ) THEN
        CREATE POLICY "Donors update own response" 
            ON public.request_responses 
            FOR UPDATE 
            TO authenticated 
            USING (auth.uid() = donor_user_id OR auth.uid() = request_user_id);
    END IF;
END $$;

-- 2. Security Definer RPC for donors to respond (accept/decline) an emergency blood request
CREATE OR REPLACE FUNCTION public.respond_to_emergency_request(
    p_request_id UUID,
    p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_donor record;
    v_request record;
    v_response_id UUID;
    v_result JSONB;
BEGIN
    -- Validate status input
    IF p_status NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION 'Invalid status. Must be accepted or declined.';
    END IF;

    -- Fetch donor profile for current authenticated user
    SELECT * INTO v_donor
    FROM public.donors
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF v_donor.id IS NULL THEN
        RAISE EXCEPTION 'Donor profile not found for user';
    END IF;

    -- Fetch blood request details
    SELECT * INTO v_request
    FROM public.blood_requests
    WHERE id = p_request_id;

    IF v_request.id IS NULL THEN
        RAISE EXCEPTION 'Blood request not found';
    END IF;

    -- Upsert response in request_responses table
    INSERT INTO public.request_responses (
        request_id,
        request_user_id,
        donor_id,
        donor_user_id,
        status,
        responded_at,
        updated_at
    ) VALUES (
        p_request_id,
        v_request.user_id,
        v_donor.id,
        v_donor.user_id,
        p_status,
        NOW(),
        NOW()
    )
    ON CONFLICT (request_id, donor_id) DO UPDATE SET
        status = EXCLUDED.status,
        responded_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_response_id;

    -- If donor accepted, update blood_requests status to matched
    IF p_status = 'accepted' THEN
        UPDATE public.blood_requests
        SET status = 'matched',
            updated_at = NOW()
        WHERE id = p_request_id AND status = 'open';
    END IF;

    SELECT jsonb_build_object(
        'success', true,
        'response_id', v_response_id,
        'request_id', p_request_id,
        'donor_id', v_donor.id,
        'donor_name', v_donor.full_name,
        'status', p_status
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 3. Enable Supabase Realtime for request_responses & blood_requests
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if already added
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if already added
    END;
END $$;

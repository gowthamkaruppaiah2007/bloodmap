-- Migration: Live Location Sharing & In-App Chat for Blood Requests

-- 1. Create Live Locations Table
CREATE TABLE IF NOT EXISTS public.live_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    is_active BOOLEAN NOT NULL DEFAULT true,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT live_locations_request_user_key UNIQUE (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_locations_request ON public.live_locations(request_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_user ON public.live_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_active ON public.live_locations(is_active, expires_at);

-- 2. Create Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_location_message BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_request ON public.chat_messages(request_id, created_at);

-- 3. Enable RLS
ALTER TABLE public.live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for live_locations
-- Select policy: Only requester or accepted donor for this request can view live location
CREATE POLICY "View live location for request participant"
    ON public.live_locations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.blood_requests r
            LEFT JOIN public.request_responses resp ON resp.request_id = r.id AND resp.status = 'accepted'
            WHERE r.id = live_locations.request_id
              AND (r.user_id = auth.uid() OR resp.donor_user_id = auth.uid())
        )
    );

CREATE POLICY "Users insert own live location"
    ON public.live_locations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own live location"
    ON public.live_locations
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own live location"
    ON public.live_locations
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. RLS Policies for chat_messages
CREATE POLICY "View chat messages for request participant"
    ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.blood_requests r
            LEFT JOIN public.request_responses resp ON resp.request_id = r.id AND resp.status = 'accepted'
            WHERE r.id = chat_messages.request_id
              AND (r.user_id = auth.uid() OR resp.donor_user_id = auth.uid())
        )
    );

CREATE POLICY "Users insert chat message"
    ON public.chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sender_id);

-- 6. Enable Supabase Realtime for live_locations and chat_messages
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.live_locations;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

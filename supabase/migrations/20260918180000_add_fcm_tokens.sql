-- Migration: Add FCM Tokens table for Web Push Notifications

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'web',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fcm_tokens_user_token_key UNIQUE (user_id, token)
);

-- Index on user_id for quick lookup
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for fcm_tokens
CREATE POLICY "Users can view their own FCM tokens"
    ON public.fcm_tokens
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own FCM tokens"
    ON public.fcm_tokens
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own FCM tokens"
    ON public.fcm_tokens
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own FCM tokens"
    ON public.fcm_tokens
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Security definer RPC for fetching FCM tokens of matching donors for a blood request
CREATE OR REPLACE FUNCTION public.get_matching_donor_fcm_tokens(p_blood_group TEXT)
RETURNS TABLE (
    user_id UUID,
    token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ft.user_id, ft.token
    FROM public.fcm_tokens ft
    JOIN public.donors d ON d.user_id = ft.user_id
    WHERE d.is_available = true
      AND (
        (p_blood_group = 'O-' AND d.blood_group = 'O-') OR
        (p_blood_group = 'O+' AND d.blood_group IN ('O-', 'O+')) OR
        (p_blood_group = 'A-' AND d.blood_group IN ('O-', 'A-')) OR
        (p_blood_group = 'A+' AND d.blood_group IN ('O-', 'O+', 'A-', 'A+')) OR
        (p_blood_group = 'B-' AND d.blood_group IN ('O-', 'B-')) OR
        (p_blood_group = 'B+' AND d.blood_group IN ('O-', 'O+', 'B-', 'B+')) OR
        (p_blood_group = 'AB-' AND d.blood_group IN ('O-', 'A-', 'B-', 'AB-')) OR
        (p_blood_group = 'AB+' AND d.blood_group IN ('O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'))
      );
END;
$$;

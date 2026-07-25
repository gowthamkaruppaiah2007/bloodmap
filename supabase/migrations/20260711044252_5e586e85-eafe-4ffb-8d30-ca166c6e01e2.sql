
-- ============ HOSPITALS ============
CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  phone text,
  verified boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own hospital" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users update own hospital" ON public.hospitals FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users delete own hospital" ON public.hospitals FOR DELETE TO authenticated USING (auth.uid() = created_by);
CREATE TRIGGER trg_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ BLOOD REQUESTS ============
CREATE TABLE public.blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  blood_group text NOT NULL,
  units_needed integer NOT NULL DEFAULT 1 CHECK (units_needed > 0),
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','critical')),
  patient_name text,
  reason text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  needed_by timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','fulfilled','cancelled','expired')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_requests TO authenticated;
GRANT ALL ON public.blood_requests TO service_role;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own requests" ON public.blood_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own request" ON public.blood_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own request" ON public.blood_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own request" ON public.blood_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_blood_requests_updated_at BEFORE UPDATE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_blood_requests_status ON public.blood_requests(status);
CREATE INDEX idx_blood_requests_group ON public.blood_requests(blood_group);

-- ============ DONATIONS ============
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  donor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  donated_at timestamptz NOT NULL DEFAULT now(),
  units integer NOT NULL DEFAULT 1 CHECK (units > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donor views own donations" ON public.donations FOR SELECT TO authenticated USING (auth.uid() = donor_user_id);
CREATE POLICY "Donor inserts own donation" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_user_id);
CREATE POLICY "Donor updates own donation" ON public.donations FOR UPDATE TO authenticated USING (auth.uid() = donor_user_id);
CREATE POLICY "Donor deletes own donation" ON public.donations FOR DELETE TO authenticated USING (auth.uid() = donor_user_id);
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_donations_donor ON public.donations(donor_id);
CREATE INDEX idx_donations_request ON public.donations(request_id);

-- ============ REQUEST RESPONSES ============
CREATE TABLE public.request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  request_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES public.donors(id) ON DELETE CASCADE,
  donor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined','no_response','completed')),
  ml_score double precision,
  ml_reasons jsonb,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_responses TO authenticated;
GRANT ALL ON public.request_responses TO service_role;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester views responses" ON public.request_responses FOR SELECT TO authenticated USING (auth.uid() = request_user_id OR auth.uid() = donor_user_id);
CREATE POLICY "Requester inserts invite" ON public.request_responses FOR INSERT TO authenticated WITH CHECK (auth.uid() = request_user_id);
CREATE POLICY "Donor updates own response" ON public.request_responses FOR UPDATE TO authenticated USING (auth.uid() = donor_user_id OR auth.uid() = request_user_id);
CREATE POLICY "Requester deletes invite" ON public.request_responses FOR DELETE TO authenticated USING (auth.uid() = request_user_id);
CREATE TRIGGER trg_request_responses_updated_at BEFORE UPDATE ON public.request_responses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_rr_request ON public.request_responses(request_id);
CREATE INDEX idx_rr_donor ON public.request_responses(donor_id);

-- ============ ML PREDICTIONS AUDIT ============
CREATE TABLE public.ml_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  model_version text NOT NULL,
  request_type text NOT NULL,
  input_hash text,
  input jsonb,
  output jsonb,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ml_predictions TO authenticated;
GRANT ALL ON public.ml_predictions TO service_role;
ALTER TABLE public.ml_predictions ENABLE ROW LEVEL SECURITY;
-- Only service role writes; no authenticated policy needed for insert (bypassed via service role).
CREATE POLICY "Deny all reads by default" ON public.ml_predictions FOR SELECT TO authenticated USING (false);
CREATE INDEX idx_ml_predictions_created ON public.ml_predictions(created_at DESC);
CREATE INDEX idx_ml_predictions_model ON public.ml_predictions(model_name, model_version);

-- ============ SECURITY DEFINER RPCs ============

-- List open blood requests (safe columns only) for signed-in users
CREATE OR REPLACE FUNCTION public.get_open_blood_requests()
RETURNS TABLE (
  id uuid, blood_group text, units_needed integer, urgency text,
  latitude double precision, longitude double precision,
  needed_by timestamptz, status text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.blood_group, r.units_needed, r.urgency,
         r.latitude, r.longitude, r.needed_by, r.status, r.created_at
  FROM public.blood_requests r
  WHERE r.status = 'open'
    AND auth.uid() IS NOT NULL;
$$;

-- Return candidate donors for a request (owner-only), including features the ML service will score
CREATE OR REPLACE FUNCTION public.get_match_candidates(_request_id uuid)
RETURNS TABLE (
  donor_id uuid, full_name text, blood_group text,
  latitude double precision, longitude double precision,
  is_available boolean, available_days text[],
  start_time text, end_time text,
  total_donations bigint, last_donation_at timestamptz,
  response_rate double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.blood_requests WHERE id = _request_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT d.id, d.full_name, d.blood_group, d.latitude, d.longitude,
         d.is_available, d.available_days, d.start_time, d.end_time,
         COALESCE(don.total, 0) AS total_donations,
         don.last_at AS last_donation_at,
         COALESCE(rr.rate, 0.0) AS response_rate
  FROM public.donors d
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS total, max(donated_at) AS last_at
    FROM public.donations WHERE donor_id = d.id
  ) don ON true
  LEFT JOIN LATERAL (
    SELECT (count(*) FILTER (WHERE status IN ('accepted','completed')))::double precision
           / NULLIF(count(*),0)::double precision AS rate
    FROM public.request_responses WHERE donor_id = d.id
  ) rr ON true
  WHERE d.is_available = true;
END;
$$;

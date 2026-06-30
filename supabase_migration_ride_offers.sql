-- DriverDash Roxou - Ride Offers Preparation Migration
-- Purpose: Create ride_offers table to store captured ride offers for future Android AccessibilityService integration.

-- 1. Create public.ride_offers table
CREATE TABLE IF NOT EXISTS public.ride_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('uber', '99', 'indrive', 'other')),
    raw_text TEXT,
    fare_amount NUMERIC NOT NULL DEFAULT 0.0,
    estimated_distance_km NUMERIC NOT NULL DEFAULT 0.0,
    estimated_duration_min NUMERIC NOT NULL DEFAULT 0.0,
    pickup_text TEXT,
    destination_text TEXT,
    pickup_neighborhood TEXT,
    destination_neighborhood TEXT,
    pickup_city TEXT,
    destination_city TEXT,
    confidence_score NUMERIC NOT NULL DEFAULT 0.0,
    source TEXT NOT NULL CHECK (source IN ('android_accessibility', 'manual', 'ocr', 'notification')),
    status TEXT NOT NULL CHECK (status IN ('detected', 'accepted', 'rejected', 'expired', 'ignored')),
    calculated_revenue_per_km NUMERIC NOT NULL DEFAULT 0.0,
    calculated_revenue_per_hour NUMERIC NOT NULL DEFAULT 0.0,
    estimated_cost NUMERIC NOT NULL DEFAULT 0.0,
    estimated_profit NUMERIC NOT NULL DEFAULT 0.0,
    decision TEXT NOT NULL CHECK (decision IN ('excellent', 'good', 'attention', 'only_if_returning', 'bad')),
    decision_reason TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Turn on Row Level Security (RLS)
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- policy_select: motorista só lê as próprias ofertas, admin lê todas
DROP POLICY IF EXISTS "Drivers can view their own ride offers" ON public.ride_offers;
CREATE POLICY "Drivers can view their own ride offers" 
ON public.ride_offers FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- policy_insert: motorista só insere as próprias ofertas
DROP POLICY IF EXISTS "Drivers can insert their own ride offers" ON public.ride_offers;
CREATE POLICY "Drivers can insert their own ride offers" 
ON public.ride_offers FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- policy_update: motorista só atualiza as próprias ofertas
DROP POLICY IF EXISTS "Drivers can update their own ride offers" ON public.ride_offers;
CREATE POLICY "Drivers can update their own ride offers" 
ON public.ride_offers FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- policy_delete: motoristas podem deletar as próprias ofertas ou admin pode deletar todas
DROP POLICY IF EXISTS "Drivers can delete their own ride offers" ON public.ride_offers;
CREATE POLICY "Drivers can delete their own ride offers" 
ON public.ride_offers FOR DELETE 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_ride_offers_user_id ON public.ride_offers (user_id);
CREATE INDEX IF NOT EXISTS idx_ride_offers_provider ON public.ride_offers (provider);
CREATE INDEX IF NOT EXISTS idx_ride_offers_status ON public.ride_offers (status);
CREATE INDEX IF NOT EXISTS idx_ride_offers_detected_at ON public.ride_offers (detected_at);
CREATE INDEX IF NOT EXISTS idx_ride_offers_pickup_neighborhood ON public.ride_offers (pickup_neighborhood);
CREATE INDEX IF NOT EXISTS idx_ride_offers_destination_neighborhood ON public.ride_offers (destination_neighborhood);
CREATE INDEX IF NOT EXISTS idx_ride_offers_decision ON public.ride_offers (decision);

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

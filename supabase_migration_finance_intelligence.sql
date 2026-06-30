-- DriverDash Roxou V3 - Driver Finance Intelligence V1 SQL Migration
-- Purpose: Support advanced costing engine, custom periodicities, and automatic apportionment.

-- 1. Create custom costs table
CREATE TABLE IF NOT EXISTS public.driver_custom_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'fuel' | 'electricity' | 'oil' | 'filters' | 'brakes' | 'tires' | 'insurance' | 'ipva' | 'license' | 'depreciation' | 'washing' | 'financing' | 'rent' | 'uber_fee' | '99_fee' | 'indrive_fee' | 'other'
    amount NUMERIC NOT NULL DEFAULT 0.0,
    periodicity TEXT NOT NULL, -- 'per_km' | 'per_hour' | 'per_day' | 'monthly' | 'yearly' | 'per_ride'
    apportionment_km NUMERIC NOT NULL DEFAULT 0.0,
    apportionment_hour NUMERIC NOT NULL DEFAULT 0.0,
    apportionment_day NUMERIC NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.driver_custom_costs ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policy for custom costs management
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'driver_custom_costs' AND policyname = 'Drivers manage their own custom costs'
    ) THEN
        CREATE POLICY "Drivers manage their own custom costs"
            ON public.driver_custom_costs FOR ALL
            USING (auth.uid() = user_id OR public.is_admin())
            WITH CHECK (auth.uid() = user_id OR public.is_admin());
    END IF;
END
$$;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_driver_custom_costs_user ON public.driver_custom_costs (user_id);
CREATE INDEX IF NOT EXISTS idx_driver_custom_costs_category ON public.driver_custom_costs (category);

-- 5. Extend existing tables if needed with helper flags
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recurring_periodicity TEXT DEFAULT 'monthly';

-- DriverDash Roxou - SQL Database Setup
-- Run this in the Supabase SQL Editor to construct the necessary tables, indices, and RLS policies.

-- --------------------------------------------------
-- 1. Create Tables
-- --------------------------------------------------

-- Profile table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT CHECK (role IN ('driver', 'admin')) DEFAULT 'driver'::TEXT NOT NULL,
    plan TEXT CHECK (plan IN ('free', 'pro', 'pro_plus')) DEFAULT 'free'::TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    plate_optional TEXT,
    fuel_type TEXT NOT NULL,
    km_per_liter NUMERIC NOT NULL,
    ownership_type TEXT CHECK (ownership_type IN ('own', 'rented', 'financed')) DEFAULT 'own'::TEXT NOT NULL,
    weekly_km_limit INTEGER,
    monthly_km_limit INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT unique_user_vehicle UNIQUE (user_id) -- One active vehicle at a time is managed here
);

-- Earnings table
CREATE TABLE IF NOT EXISTS public.earnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    platform TEXT CHECK (platform IN ('uber', '99', 'indriver', 'private', 'other')) DEFAULT 'uber'::TEXT NOT NULL,
    gross_amount NUMERIC NOT NULL DEFAULT 0.0,
    total_km NUMERIC NOT NULL DEFAULT 0.0,
    passenger_km NUMERIC NOT NULL DEFAULT 0.0,
    empty_km NUMERIC NOT NULL DEFAULT 0.0,
    online_minutes INTEGER NOT NULL DEFAULT 0,
    waiting_minutes INTEGER NOT NULL DEFAULT 0,
    rides_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    entry_mode TEXT CHECK (entry_mode IN ('single_ride', 'shift_close')) DEFAULT 'single_ride'::TEXT NOT NULL,
    shift_period TEXT CHECK (shift_period IN ('morning', 'afternoon', 'night', 'dawn', 'full_day')),
    closure_reported_gross_amount NUMERIC DEFAULT 0.0,
    closure_deducted_single_rides_amount NUMERIC DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    type TEXT CHECK (type IN ('fuel', 'food', 'maintenance', 'rent', 'financing', 'ipva', 'license', 'insurance', 'cleaning', 'tires', 'oil', 'brakes', 'other')) NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0.0,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Daily Closings table
CREATE TABLE IF NOT EXISTS public.daily_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    gross_amount NUMERIC NOT NULL DEFAULT 0.0,
    total_expenses NUMERIC NOT NULL DEFAULT 0.0,
    net_profit NUMERIC NOT NULL DEFAULT 0.0,
    total_km NUMERIC NOT NULL DEFAULT 0.0,
    cost_per_km NUMERIC NOT NULL DEFAULT 0.0,
    profit_per_km NUMERIC NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT unique_user_daily_closing UNIQUE (user_id, date)
);

-- Weekly Closings table
CREATE TABLE IF NOT EXISTS public.weekly_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    gross_amount NUMERIC NOT NULL DEFAULT 0.0,
    total_expenses NUMERIC NOT NULL DEFAULT 0.0,
    net_profit NUMERIC NOT NULL DEFAULT 0.0,
    total_km NUMERIC NOT NULL DEFAULT 0.0,
    cost_per_km NUMERIC NOT NULL DEFAULT 0.0,
    profit_per_km NUMERIC NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT unique_user_weekly_closing UNIQUE (user_id, week_start)
);

-- Admin Peak hour Rules table
CREATE TABLE IF NOT EXISTS public.admin_peak_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    region TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    days_of_week JSONB NOT NULL DEFAULT '[]'::JSONB,
    demand_level TEXT CHECK (demand_level IN ('low', 'medium', 'high', 'extreme')) NOT NULL,
    source_type TEXT CHECK (source_type IN ('admin', 'manual', 'api')) DEFAULT 'manual'::TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Passenger Reports table
CREATE TABLE IF NOT EXISTS public.passenger_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    region TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);


-- --------------------------------------------------
-- 2. Indices for Optimized Queries
-- --------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_earnings_user_date ON public.earnings (user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses (user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_closings_user_date ON public.daily_closings (user_id, date);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.passenger_reports (created_at DESC);


-- --------------------------------------------------
-- 3. Security & Helper Helper Functions
-- --------------------------------------------------

-- Check if authenticated user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.jwt() ->> 'email' = 'noturnocszapps@gmail.com' 
        OR auth.jwt() ->> 'email' LIKE '%adm%'
        OR COALESCE(auth.jwt()->'user_metadata'->>'email', '') = 'noturnocszapps@gmail.com'
        OR COALESCE(auth.jwt()->'user_metadata'->>'email', '') LIKE '%adm%'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Automate Profile Creation on Registration Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_role TEXT := 'driver';
BEGIN
    -- Set role to 'admin' if email is a predefined manager, or stays 'driver' as fallback.
    -- Feel free to adjust email matching.
    IF new.email = 'noturnocszapps@gmail.com' OR new.email LIKE '%adm%' THEN
        new_role := 'admin';
    END IF;

    INSERT INTO public.profiles (id, name, email, avatar_url, role, plan)
    VALUES (
        new.id,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'name',
            SPLIT_PART(new.email, '@', 1)
        ),
        new.email,
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        new_role,
        'free'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(profiles.name, EXCLUDED.name),
        email = EXCLUDED.email,
        avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Register User Registration Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- --------------------------------------------------
-- 4. Enable Row Level Security (RLS) & Policies
-- --------------------------------------------------

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_peak_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_reports ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view and edit their own profiles"
    ON public.profiles FOR ALL
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can do everything on profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- Vehicles Policies
CREATE POLICY "Drivers manage their own vehicle"
    ON public.vehicles FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Earnings Policies
CREATE POLICY "Drivers manage their own earnings"
    ON public.earnings FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Expenses Policies
CREATE POLICY "Drivers manage their own expenses"
    ON public.expenses FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Daily Closings Policies
CREATE POLICY "Drivers manage their daily closings"
    ON public.daily_closings FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Weekly Closings Policies
CREATE POLICY "Drivers manage their weekly closings"
    ON public.weekly_closings FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Admin Peak Rules Policies
CREATE POLICY "Peak entries readable by authenticated users"
    ON public.admin_peak_rules FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin manages peak rules completely"
    ON public.admin_peak_rules FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Passenger Reports Policies
CREATE POLICY "Authenticated users can read reports"
    ON public.passenger_reports FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Drivers manage their own passenger reports"
    ON public.passenger_reports FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- --------------------------------------------------
-- 5. FASE 2.1 - Planejamento Financeiro Inteligente
-- --------------------------------------------------

-- 5.1 Financial Goals Table
CREATE TABLE IF NOT EXISTS public.financial_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    daily_goal NUMERIC NOT NULL DEFAULT 0.0,
    weekly_goal NUMERIC NOT NULL DEFAULT 0.0,
    monthly_goal NUMERIC NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT unique_user_financial_goal UNIQUE (user_id)
);

-- 5.2 Vehicle Cost Settings Table
CREATE TABLE IF NOT EXISTS public.vehicle_cost_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    fuel_price NUMERIC NOT NULL DEFAULT 0.0,
    tire_cost NUMERIC NOT NULL DEFAULT 0.0,
    tire_lifespan_km NUMERIC NOT NULL DEFAULT 0.0,
    oil_change_cost NUMERIC NOT NULL DEFAULT 0.0,
    oil_change_interval_km NUMERIC NOT NULL DEFAULT 0.0,
    brake_cost NUMERIC NOT NULL DEFAULT 0.0,
    brake_interval_km NUMERIC NOT NULL DEFAULT 0.0,
    insurance_yearly NUMERIC NOT NULL DEFAULT 0.0,
    ipva_yearly NUMERIC NOT NULL DEFAULT 0.0,
    licensing_yearly NUMERIC NOT NULL DEFAULT 0.0,
    emergency_reserve_monthly NUMERIC NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT unique_user_vehicle_cost UNIQUE (user_id)
);

-- 5.3 Enable Row Level Security (RLS)
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_cost_settings ENABLE ROW LEVEL SECURITY;

-- 5.4 RLS Policies for Financial Goals
CREATE POLICY "Drivers manage their own financial goals"
    ON public.financial_goals FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 5.5 RLS Policies for Vehicle Cost Settings
CREATE POLICY "Drivers manage their own vehicle cost settings"
    ON public.vehicle_cost_settings FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- --------------------------------------------------
-- 6. FASE 2.2 - Inteligência Operacional
-- --------------------------------------------------

-- 6.1 Smart Alerts Table
CREATE TABLE IF NOT EXISTS public.smart_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'goal', 'fuel', 'profit', 'rental'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 6.2 Enable Row Level Security (RLS)
ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;

-- 6.3 RLS Policies for Smart Alerts
CREATE POLICY "Drivers manage their own smart alerts"
    ON public.smart_alerts FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());


-- --------------------------------------------------
-- 7. PREPARAÇÃO PARA GPS & TELEMETRIA (FASE 2.4 ARCHITECTURE ONLY)
-- --------------------------------------------------

-- 7.1 Driver Sessions Table
CREATE TABLE IF NOT EXISTS public.driver_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    total_distance NUMERIC NOT NULL DEFAULT 0.0,
    total_minutes NUMERIC NOT NULL DEFAULT 0.0,
    status TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active'::TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 7.2 Route Points (Telemetry) Table
CREATE TABLE IF NOT EXISTS public.route_points (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.driver_sessions ON DELETE CASCADE NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    speed NUMERIC, -- in km/h or m/s
    accuracy NUMERIC, -- horizontal GPS accuracy radius
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 7.3 Enable Row Level Security (RLS)
ALTER TABLE public.driver_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_points ENABLE ROW LEVEL SECURITY;

-- 7.4 RLS Policies for Driver Sessions
CREATE POLICY "Drivers manage their own sessions"
    ON public.driver_sessions FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 7.5 RLS Policies for Route Points
CREATE POLICY "Drivers manage their routes points"
    ON public.route_points FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.driver_sessions s
            WHERE s.id = route_points.session_id AND (s.user_id = auth.uid() OR public.is_admin())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.driver_sessions s
            WHERE s.id = route_points.session_id AND (s.user_id = auth.uid() OR public.is_admin())
        )
    );

-- 7.6 Indices for GPS Routing Optimization
CREATE INDEX IF NOT EXISTS idx_driver_sessions_user ON public.driver_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_route_points_session ON public.route_points (session_id, timestamp ASC);

-- ==========================================
-- 8. ROXOU SMART DEMAND SIGNALS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.demand_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    region TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    signal_type TEXT NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 1.0,
    start_at TIMESTAMP WITH TIME ZONE,
    end_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

ALTER TABLE public.demand_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active demand signals"
    ON public.demand_signals FOR SELECT
    USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage demand signals"
    ON public.demand_signals FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_demand_signals_coords ON public.demand_signals (latitude, longitude) WHERE is_active = true;


-- ==========================================
-- 9. FASE 5.2 - OBSERVABILIDADE & BETA FECHADO
-- ==========================================

-- 9.1 Add beta_tester to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beta_tester BOOLEAN DEFAULT false;

-- 9.2 App Logs Table
CREATE TABLE IF NOT EXISTS public.app_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    level TEXT CHECK (level IN ('info', 'warn', 'error', 'critical')) NOT NULL,
    category TEXT CHECK (category IN ('auth', 'gps', 'sync', 'supabase', 'admin', 'payment', 'demand', 'system')) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 9.3 Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 9.4 System Health Snapshots Table
CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    database_ok BOOLEAN NOT NULL DEFAULT true,
    auth_ok BOOLEAN NOT NULL DEFAULT true,
    gps_ok BOOLEAN NOT NULL DEFAULT true,
    sync_ok BOOLEAN NOT NULL DEFAULT true,
    demand_ok BOOLEAN NOT NULL DEFAULT true,
    alerts_ok BOOLEAN NOT NULL DEFAULT true,
    version TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- 9.5 Enable Row Level Security (RLS)
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;

-- 9.6 RLS Policies for App Logs
CREATE POLICY "Users can insert own logs"
    ON public.app_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admin can view all app logs"
    ON public.app_logs FOR SELECT
    USING (public.is_admin());

-- 9.7 RLS Policies for Audit Logs
CREATE POLICY "Anyone can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin can view all audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

-- 9.8 RLS Policies for Health Snapshots
CREATE POLICY "Anyone can insert health snapshots"
    ON public.system_health_snapshots FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admin can view health snapshots"
    ON public.system_health_snapshots FOR SELECT
    USING (public.is_admin());

-- 9.9 Indices for Logs
CREATE INDEX IF NOT EXISTS idx_app_logs_created ON public.app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_created ON public.system_health_snapshots (created_at DESC);


-- ==========================================
-- 10. FASE 5.3 - ALTERAÇÕES DE TABELAS (VEÍCULO)
-- ==========================================

-- Alter table dynamic additions for rented vehicles
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS rental_amount NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS rental_period TEXT CHECK (rental_period IN ('weekly', 'monthly')) DEFAULT 'weekly';
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS rental_food_daily NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS rental_damage_monthly NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS rental_cleaning_monthly NUMERIC DEFAULT 0;

-- Alter table dynamic additions for financed/own vehicle support inside cost settings
ALTER TABLE IF EXISTS public.vehicle_cost_settings ADD COLUMN IF NOT EXISTS financing_monthly NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.vehicle_cost_settings ADD COLUMN IF NOT EXISTS maintenance_monthly NUMERIC DEFAULT 0;

-- Alter table dynamic additions for earnings closing and entry mode logic
ALTER TABLE IF EXISTS public.earnings ADD COLUMN IF NOT EXISTS entry_mode TEXT CHECK (entry_mode IN ('single_ride', 'shift_close')) DEFAULT 'single_ride';
ALTER TABLE IF EXISTS public.earnings ADD COLUMN IF NOT EXISTS shift_period TEXT CHECK (shift_period IN ('morning', 'afternoon', 'night', 'dawn', 'full_day'));
ALTER TABLE IF EXISTS public.earnings ADD COLUMN IF NOT EXISTS closure_reported_gross_amount NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.earnings ADD COLUMN IF NOT EXISTS closure_deducted_single_rides_amount NUMERIC DEFAULT 0;

-- Alter table dynamic additions for electric vehicles (EV Support)
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS electric_consumption_kwh_100km NUMERIC DEFAULT 15.0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS electricity_price_kwh NUMERIC DEFAULT 0.0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS charging_type TEXT DEFAULT 'residential';
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS home_electricity_price_kwh NUMERIC DEFAULT 0.0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS public_electricity_price_kwh NUMERIC DEFAULT 0.0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS home_charging_percent NUMERIC DEFAULT 100;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS public_charging_percent NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS battery_replacement_cost NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.vehicles ADD COLUMN IF NOT EXISTS battery_life_km NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.vehicles DROP CONSTRAINT IF EXISTS check_vehicles_charging_type;
ALTER TABLE IF EXISTS public.vehicles ADD CONSTRAINT check_vehicles_charging_type CHECK (charging_type IN ('residential', 'public', 'mixed'));


-- ==========================================
-- 11. FASE 5.4 - UBER PASS INTELLIGENCE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.driver_uber_pass_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    pass_type TEXT,
    pass_price NUMERIC,
    earnings_limit NUMERIC,
    old_fee_percent NUMERIC DEFAULT 20,
    target_profit_per_hour NUMERIC,
    target_daily_revenue NUMERIC,
    planned_hours NUMERIC,
    average_ticket NUMERIC,
    cost_per_km NUMERIC,
    estimated_km NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    CONSTRAINT unique_user_uber_pass_settings UNIQUE (user_id)
);

ALTER TABLE public.driver_uber_pass_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.driver_uber_pass_settings ADD COLUMN IF NOT EXISTS detailed_vehicle_config JSONB DEFAULT '{}'::jsonb;

CREATE POLICY "Drivers manage their own uber pass settings"
    ON public.driver_uber_pass_settings FOR ALL
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

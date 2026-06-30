-- DriverDash Roxou V3 - Vehicles & EV Support SQL Migration
-- Purpose: Extend vehicles table to support detailed rental/financing parameters and comprehensive Electric/Hybrid Vehicle configuration.

-- 1. Alter public.vehicles table to support rental/financing costing details
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_amount NUMERIC DEFAULT 0.0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_period TEXT DEFAULT 'weekly' CHECK (rental_period IN ('weekly', 'monthly'));
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_food_daily NUMERIC DEFAULT 0.0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_damage_monthly NUMERIC DEFAULT 0.0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS rental_cleaning_monthly NUMERIC DEFAULT 0.0;

-- 2. Alter public.vehicles table to support electric/hybrid vehicle specification
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS electric_consumption_kwh_100km NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS electricity_price_kwh NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS charging_type TEXT CHECK (charging_type IN ('residential', 'public', 'mixed', NULL));
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS home_electricity_price_kwh NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS public_electricity_price_kwh NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS home_charging_percent NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS public_charging_percent NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS battery_replacement_cost NUMERIC;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS battery_life_km NUMERIC;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- DriverDash Roxou V3 - Smart Ride Detection Engine Migration
-- Purpose: Add AI classification confidence, reasoning, automation flag, and confirmation tracking to public.driver_ride_events.

-- 1. Add AI-related columns to public.driver_ride_events safely
ALTER TABLE public.driver_ride_events ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT false;
ALTER TABLE public.driver_ride_events ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 100.0;
ALTER TABLE public.driver_ride_events ADD COLUMN IF NOT EXISTS classification_reason TEXT DEFAULT 'Manual override';
ALTER TABLE public.driver_ride_events ADD COLUMN IF NOT EXISTS was_confirmed_manually BOOLEAN DEFAULT false;

-- 2. Create index for fast analytics
CREATE INDEX IF NOT EXISTS idx_driver_ride_events_automation ON public.driver_ride_events (is_automated);
CREATE INDEX IF NOT EXISTS idx_driver_ride_events_confirmed ON public.driver_ride_events (was_confirmed_manually);

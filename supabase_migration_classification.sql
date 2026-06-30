-- DriverDash Roxou V3 - Mileage Classification Engine Migration
-- Purpose: Add segment_type and ride_event_id to public.route_points, create driver_ride_events table, and secure with RLS policies.

-- 1. Add segment_type and ride_event_id to public.route_points safely
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS segment_type TEXT DEFAULT 'empty';
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS ride_event_id UUID;

-- 2. Add check constraint for segment_type if not already exists
ALTER TABLE public.route_points DROP CONSTRAINT IF EXISTS chk_segment_type;
ALTER TABLE public.route_points ADD CONSTRAINT chk_segment_type CHECK (segment_type IN ('empty', 'productive', 'personal', 'dead', 'stopped', 'waiting', 'offline'));

-- 3. Create driver_ride_events table
CREATE TABLE IF NOT EXISTS public.driver_ride_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('ride_started', 'ride_finished', 'personal_started', 'personal_finished')),
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    start_latitude DOUBLE PRECISION,
    start_longitude DOUBLE PRECISION,
    end_latitude DOUBLE PRECISION,
    end_longitude DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.driver_ride_events ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for driver_ride_events
DROP POLICY IF EXISTS "Drivers manage their own ride events" ON public.driver_ride_events;
CREATE POLICY "Drivers manage their own ride events"
    ON public.driver_ride_events FOR ALL
    USING (auth.uid() = driver_id OR public.is_admin())
    WITH CHECK (auth.uid() = driver_id OR public.is_admin());

-- 6. Create Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_route_points_segment_type ON public.route_points (segment_type);
CREATE INDEX IF NOT EXISTS idx_route_points_ride_event_id ON public.route_points (ride_event_id);
CREATE INDEX IF NOT EXISTS idx_driver_ride_events_driver_id ON public.driver_ride_events (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_ride_events_session_id ON public.driver_ride_events (session_id);

-- DriverDash Roxou V3 - Telemetry and RLS Sync Migration
-- Purpose: Safely update public.route_points structure, add missing telemetry columns, and secure with robust RLS policies.

-- 1. Add missing columns to public.route_points safely using ALTER TABLE
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS driver_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS heading NUMERIC DEFAULT 0;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS altitude NUMERIC DEFAULT 0;
ALTER TABLE public.route_points ADD COLUMN IF NOT EXISTS distance_meters NUMERIC DEFAULT 0;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.route_points ENABLE ROW LEVEL SECURITY;

-- 3. Recreate the RLS policies with full compatibility with driver_id and auth.uid()
DROP POLICY IF EXISTS "Drivers manage their routes points" ON public.route_points;
DROP POLICY IF EXISTS "Drivers can select their own route points" ON public.route_points;
DROP POLICY IF EXISTS "Drivers can insert their own route points" ON public.route_points;
DROP POLICY IF EXISTS "Drivers can update their own route points" ON public.route_points;

-- Policy for SELECT: Users can only view route points that they own (by driver_id) OR belong to their sessions OR if they are admins
CREATE POLICY "Drivers can select their own route points"
    ON public.route_points FOR SELECT
    USING (
        driver_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.driver_sessions s
            WHERE s.id = route_points.session_id AND (s.user_id = auth.uid() OR public.is_admin())
        )
        OR public.is_admin()
    );

-- Policy for INSERT: Users can only insert points with their own driver_id OR for their own sessions OR if they are admins
CREATE POLICY "Drivers can insert their own route points"
    ON public.route_points FOR INSERT
    WITH CHECK (
        driver_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.driver_sessions s
            WHERE s.id = route_points.session_id AND (s.user_id = auth.uid() OR public.is_admin())
        )
        OR public.is_admin()
    );

-- Policy for UPDATE: Users can only update points that they own OR for their sessions OR if they are admins
CREATE POLICY "Drivers can update their own route points"
    ON public.route_points FOR UPDATE
    USING (
        driver_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.driver_sessions s
            WHERE s.id = route_points.session_id AND (s.user_id = auth.uid() OR public.is_admin())
        )
        OR public.is_admin()
    )
    WITH CHECK (
        driver_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.driver_sessions s
            WHERE s.id = route_points.session_id AND (s.user_id = auth.uid() OR public.is_admin())
        )
        OR public.is_admin()
    );

-- 4. Create index for performance optimization
CREATE INDEX IF NOT EXISTS idx_route_points_driver_id ON public.route_points (driver_id);

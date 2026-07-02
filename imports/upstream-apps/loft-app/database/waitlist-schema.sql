-- Personal Room Waitlist System Schema
-- Run these commands to add the waitlist functionality to your existing database

-- 1. Add waitlist table for personal rooms
CREATE TABLE IF NOT EXISTS public.loft_room_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  loft_room_id uuid NOT NULL REFERENCES public.loft_room(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text,
  guest_avatar_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamp with time zone DEFAULT now(),
  approved_at timestamp with time zone,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loft_room_waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT loft_room_waitlist_unique_guest UNIQUE(loft_room_id, guest_name)
);

-- 2. Add access control columns to existing loft_room table
ALTER TABLE public.loft_room 
ADD COLUMN IF NOT EXISTS is_open boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS access_mode text DEFAULT 'host-approval' CHECK (access_mode IN ('open', 'host-approval', 'scheduled')),
ADD COLUMN IF NOT EXISTS scheduled_open_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS scheduled_close_at timestamp with time zone;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loft_room_waitlist_room_id ON public.loft_room_waitlist(loft_room_id);
CREATE INDEX IF NOT EXISTS idx_loft_room_waitlist_status ON public.loft_room_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_loft_room_waitlist_guest_name ON public.loft_room_waitlist(guest_name);

-- 4. Add RLS (Row Level Security) policies for waitlist
ALTER TABLE public.loft_room_waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view waitlist for rooms they host
CREATE POLICY "Hosts can view their room waitlist" ON public.loft_room_waitlist
  FOR SELECT USING (
    auth.uid() IN (
      SELECT lr.host_profile_id 
      FROM public.loft_room lr 
      WHERE lr.id = loft_room_id
    )
  );

-- Policy: Anyone can request access (insert)
CREATE POLICY "Anyone can request room access" ON public.loft_room_waitlist
  FOR INSERT WITH CHECK (true);

-- Policy: Only hosts can update waitlist entries
CREATE POLICY "Only hosts can update waitlist" ON public.loft_room_waitlist
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT lr.host_profile_id 
      FROM public.loft_room lr 
      WHERE lr.id = loft_room_id
    )
  );

-- Policy: Only hosts can delete waitlist entries
CREATE POLICY "Only hosts can delete waitlist" ON public.loft_room_waitlist
  FOR DELETE USING (
    auth.uid() IN (
      SELECT lr.host_profile_id 
      FROM public.loft_room lr 
      WHERE lr.id = loft_room_id
    )
  );

-- 5. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waitlist_updated_at
  BEFORE UPDATE ON public.loft_room_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_updated_at();

-- 6. Create function to get room access status (used by edge function)
CREATE OR REPLACE FUNCTION get_room_access_status(p_room_id uuid, p_guest_name text DEFAULT null)
RETURNS jsonb AS $$
DECLARE
  v_room record;
  v_waitlist_status text;
BEGIN
  -- Get room details
  SELECT lr.id, lr.title, lr.is_open, lr.access_mode, lr.host_profile_id,
         p.display_name, p.full_name, p.avatar_url
  INTO v_room
  FROM public.loft_room lr
  INNER JOIN public.profile p ON lr.host_profile_id = p.id
  WHERE lr.id = p_room_id;

  IF v_room IS NULL THEN
    RETURN jsonb_build_object('error', 'Room not found');
  END IF;

  -- Check guest waitlist status if provided
  IF p_guest_name IS NOT NULL THEN
    SELECT status INTO v_waitlist_status
    FROM public.loft_room_waitlist
    WHERE loft_room_id = p_room_id AND guest_name = p_guest_name
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'roomId', v_room.id,
    'title', COALESCE(v_room.title, 'Personal Room'),
    'hostName', COALESCE(v_room.display_name, v_room.full_name, 'Host'),
    'hostDetails', jsonb_build_object(
      'profileId', v_room.host_profile_id,
      'displayName', COALESCE(v_room.display_name, v_room.full_name),
      'avatarUrl', v_room.avatar_url
    ),
    'accessStatus', jsonb_build_object(
      'isOpen', v_room.is_open,
      'requiresApproval', NOT v_room.is_open OR v_room.access_mode = 'host-approval'
    ),
    'guestApprovalStatus', v_waitlist_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant necessary permissions
GRANT ALL ON public.loft_room_waitlist TO authenticated;
GRANT ALL ON public.loft_room_waitlist TO anon;
GRANT EXECUTE ON FUNCTION update_waitlist_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION update_waitlist_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION get_room_access_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_access_status(uuid, text) TO anon;

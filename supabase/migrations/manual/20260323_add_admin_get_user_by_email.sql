-- Create RPC function to get Auth user by email
CREATE OR REPLACE FUNCTION admin_get_user_by_email(user_email text)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function requires admin privileges to access auth.users
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at
  FROM auth.users u
  WHERE u.email = user_email
  LIMIT 1;
END;
$$;

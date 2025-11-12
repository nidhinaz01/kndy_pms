-- SQL Functions for User Management
-- Run these in Supabase SQL Editor

-- Function to get all Supabase Auth users with their linked status
CREATE OR REPLACE FUNCTION get_auth_users_with_linked_status()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  email_confirmed_at timestamptz,
  is_linked boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::text,
    au.created_at,
    au.email_confirmed_at,
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM public.app_users 
        WHERE app_users.auth_user_id = au.id 
        AND app_users.is_deleted = false
      ) THEN true
      ELSE false
    END as is_linked
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

-- Function to get email from Supabase Auth user by ID
CREATE OR REPLACE FUNCTION get_auth_user_email(auth_user_id_param uuid)
RETURNS TABLE (
  email text,
  email_confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.email::text,
    au.email_confirmed_at
  FROM auth.users au
  WHERE au.id = auth_user_id_param;
END;
$$;

-- Grant execute permissions (adjust as needed for your security model)
GRANT EXECUTE ON FUNCTION get_auth_users_with_linked_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_users_with_linked_status() TO anon;
GRANT EXECUTE ON FUNCTION get_auth_user_email(uuid) TO anon;

-- Also grant to service_role for admin operations (if needed)
-- GRANT EXECUTE ON FUNCTION get_auth_users_with_linked_status() TO service_role;
-- GRANT EXECUTE ON FUNCTION get_auth_user_email(uuid) TO service_role;


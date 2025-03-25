-- Ensure supabase_admin exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_admin') THEN
    CREATE ROLE supabase_admin WITH LOGIN SUPERUSER PASSWORD 'postgres';
  END IF;
END $$;

-- Grant necessary privileges
ALTER ROLE supabase_admin WITH SUPERUSER CREATEDB CREATEROLE;

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

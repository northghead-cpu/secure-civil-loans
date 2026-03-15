
-- Add new roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'compliance_team';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'data_entry_team';

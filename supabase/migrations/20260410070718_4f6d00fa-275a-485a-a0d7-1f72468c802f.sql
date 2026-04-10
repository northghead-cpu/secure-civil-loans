-- Add VERIFIED to the kyc_status enum
ALTER TYPE public.kyc_status ADD VALUE IF NOT EXISTS 'VERIFIED';

-- Add nrc_verified and phone_verified columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nrc_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
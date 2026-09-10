DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'kyc_status'
  ) THEN
    CREATE TYPE public.kyc_status AS ENUM ('PENDING', 'IN_REVIEW', 'COMPLETED', 'REJECTED');
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'PENDING';

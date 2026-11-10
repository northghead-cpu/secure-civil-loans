CREATE TYPE public.kyc_status AS ENUM ('PENDING', 'IN_REVIEW', 'COMPLETED', 'REJECTED');

ALTER TABLE public.profiles ADD COLUMN kyc_status public.kyc_status NOT NULL DEFAULT 'PENDING';
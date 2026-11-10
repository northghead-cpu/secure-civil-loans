CREATE OR REPLACE FUNCTION public.current_application_date()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CURRENT_DATE;
$$;

REVOKE ALL ON FUNCTION public.current_application_date() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_application_date() TO authenticated;

ALTER TABLE public.kyc_documents
  DROP CONSTRAINT IF EXISTS kyc_documents_path_owner;

ALTER TABLE public.kyc_documents
  ADD CONSTRAINT kyc_documents_path_contract
  CHECK (storage_path ~ ('^' || user_id::text || '/(nrc|gov-id|payslip|introductory-letter)-[0-9]{13}\.(pdf|png|jpe?g)$'));

CREATE OR REPLACE FUNCTION public.validate_kyc_document_period()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  application_date date := public.current_application_date();
  required_start date := (date_trunc('month', application_date) - interval '3 months')::date;
  required_end date := (date_trunc('month', application_date) - interval '1 month')::date;
BEGIN
  IF NEW.document_type = 'PAYSLIP' THEN
    IF NEW.pay_period IS NULL OR NEW.pay_period <> date_trunc('month', NEW.pay_period)::date THEN
      RAISE EXCEPTION 'PAYSLIP pay_period must be the first day of its calendar month';
    END IF;
    IF NEW.pay_period < required_start OR NEW.pay_period > required_end THEN
      RAISE EXCEPTION 'PAYSLIP period must be one of the three latest completed calendar months';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_kyc_document_period ON public.kyc_documents;
CREATE TRIGGER trg_validate_kyc_document_period
BEFORE INSERT OR UPDATE ON public.kyc_documents
FOR EACH ROW EXECUTE FUNCTION public.validate_kyc_document_period();

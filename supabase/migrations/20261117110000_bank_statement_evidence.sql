-- Add supporting bank statements to the existing private document inventory.
alter table public.kyc_documents drop constraint kyc_documents_document_type_check;
alter table public.kyc_documents add constraint kyc_documents_document_type_check check(document_type in ('NRC','GOV_ID','PAYSLIP','INTRODUCTORY_LETTER','BANK_STATEMENT'));
alter table public.kyc_documents drop constraint kyc_documents_path_contract;
alter table public.kyc_documents add constraint kyc_documents_path_contract check(storage_path ~ ('^'||user_id::text||'/(nrc|gov-id|payslip|introductory-letter|bank-statement)-[0-9]{13}\.(pdf|png|jpe?g)$'));

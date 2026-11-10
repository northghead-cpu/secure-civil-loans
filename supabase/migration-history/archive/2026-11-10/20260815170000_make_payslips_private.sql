-- Payslips contain sensitive financial information and must never be publicly readable.
update storage.buckets
set public = false
where id = 'payslips' and public = true;

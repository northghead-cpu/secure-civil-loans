SELECT cron.schedule('riverbanc-monthly-payroll-billing','5 22 22 * *',$$SELECT private.run_riverbanc_monthly_billing((CURRENT_DATE + INTERVAL '1 day')::date);$$);

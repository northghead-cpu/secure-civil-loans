CREATE OR REPLACE FUNCTION private.run_riverbanc_monthly_billing(_billing_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_run public.billing_runs;v_end date;s record;v_tx public.billing_transactions;v_receipt public.payment_receipts;n integer:=0;rc integer:=0;e integer:=0;
BEGIN
 IF _billing_date IS NULL OR extract(day from _billing_date)<>23 THEN RAISE EXCEPTION 'Billing date must be the 23rd of a month';END IF;
 v_end:=(_billing_date+interval '1 month'-interval '1 day')::date;
 INSERT INTO public.billing_runs(billing_date,period_start,period_end,status,started_at) VALUES(_billing_date,_billing_date,v_end,'running',now()) ON CONFLICT(billing_date) DO UPDATE SET status=CASE WHEN public.billing_runs.status='completed' THEN public.billing_runs.status ELSE 'running' END,started_at=CASE WHEN public.billing_runs.status='completed' THEN public.billing_runs.started_at ELSE now() END,updated_at=now() RETURNING * INTO v_run;
 IF v_run.status='completed' THEN RETURN jsonb_build_object('billing_run_id',v_run.id,'status',v_run.status,'transactions',v_run.transaction_count,'receipts',v_run.receipt_count,'idempotent',true);END IF;
 SELECT count(*) INTO e FROM public.subscription_authorizations WHERE status='active';
 FOR s IN SELECT sa.user_id,sa.payroll_reference,sa.payroll_confirmed_at,p.full_name,p.email FROM public.subscription_authorizations sa JOIN public.profiles p ON p.user_id=sa.user_id WHERE sa.status='active' AND sa.payroll_status='confirmed' LOOP
  BEGIN
   INSERT INTO public.billing_transactions(billing_run_id,user_id,period_start,period_end,amount,currency,payment_method,payroll_reference,status,confirmed_at) VALUES(v_run.id,s.user_id,_billing_date,v_end,60,'ZMW','payroll',s.payroll_reference,'confirmed',coalesce(s.payroll_confirmed_at,now())) ON CONFLICT(user_id,period_start) DO NOTHING RETURNING * INTO v_tx;
   IF v_tx.id IS NULL THEN CONTINUE;END IF;n:=n+1;
   INSERT INTO public.payment_receipts(billing_transaction_id,user_id,receipt_number,customer_name,customer_email,amount,currency,billing_period_start,billing_period_end,payment_method,payroll_reference) VALUES(v_tx.id,s.user_id,'RB-'||to_char(_billing_date,'YYYYMM')||'-'||lpad(nextval('public.payment_receipt_number_seq')::text,8,'0'),coalesce(nullif(trim(s.full_name),''),'Riverbanc Subscriber'),s.email,60,'ZMW',_billing_date,v_end,'payroll',s.payroll_reference) RETURNING * INTO v_receipt;
   INSERT INTO public.receipt_deliveries(receipt_id,channel,status,delivered_at) VALUES(v_receipt.id,'dashboard','available',now()),(v_receipt.id,'email','pending',null);
   INSERT INTO public.audit_logs(user_id,role,action_performed,record_id,table_name,old_value,new_value) VALUES(s.user_id,'system','subscription_payment_receipted',v_receipt.id::text,'payment_receipts',null,jsonb_build_object('receipt_number',v_receipt.receipt_number,'amount',60,'currency','ZMW','payment_method','payroll','payroll_reference',s.payroll_reference,'billing_period_start',_billing_date,'billing_period_end',v_end));rc:=rc+1;
  EXCEPTION WHEN unique_violation THEN NULL;END;
 END LOOP;
 UPDATE public.billing_runs br SET eligible_count=e,confirmed_count=(SELECT count(*) FROM public.billing_transactions bt WHERE bt.billing_run_id=br.id AND bt.status='confirmed'),transaction_count=(SELECT count(*) FROM public.billing_transactions bt WHERE bt.billing_run_id=br.id),receipt_count=(SELECT count(*) FROM public.payment_receipts pr JOIN public.billing_transactions bt ON bt.id=pr.billing_transaction_id WHERE bt.billing_run_id=br.id),status='completed',completed_at=now(),updated_at=now() WHERE br.id=v_run.id RETURNING br.* INTO v_run;
 RETURN jsonb_build_object('billing_run_id',v_run.id,'status',v_run.status,'eligible',v_run.eligible_count,'confirmed',v_run.confirmed_count,'transactions',v_run.transaction_count,'receipts',v_run.receipt_count,'created_now',n,'receipts_created_now',rc,'idempotent',false);
END;$$;

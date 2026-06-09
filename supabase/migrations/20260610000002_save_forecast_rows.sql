-- Phase 5: atomic write path. save_forecast_rows(p jsonb) replaces the whole
-- relational dataset in ONE transaction from a decomposed {table: rows[]} payload
-- (produced by src/forecastTables.js decompose()). This preserves the old single
-- upsert's all-or-nothing semantics now that the tables are authoritative.
--
-- Gate: admin (browser) OR service_role (ops scripts). SECURITY DEFINER so the
-- function owner performs the writes, but the gate re-checks the CALLER's identity
-- so it never becomes an RLS bypass.

CREATE OR REPLACE FUNCTION public.save_forecast_rows(p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR coalesce(auth.jwt() ->> 'role', '') = 'service_role') THEN
    RAISE EXCEPTION 'save_forecast_rows: admin role required';
  END IF;

  -- Safety backstop: refuse to wipe the dataset from an empty/partial payload
  -- (a malformed `d` must never silently truncate the authoritative tables).
  IF jsonb_array_length(coalesce(p->'clients','[]'::jsonb)) = 0
     OR jsonb_array_length(coalesce(p->'team_members','[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'save_forecast_rows: refusing to wipe — empty clients/team payload';
  END IF;

  -- Wipe child -> parent (FK-safe), then repopulate parent -> child.
  -- WHERE true satisfies Supabase's safeupdate guard (bare DELETE is blocked).
  DELETE FROM payment_schedule WHERE true;
  DELETE FROM service_contracts WHERE true;
  DELETE FROM zoho_commissions WHERE true;
  DELETE FROM clients WHERE true;
  DELETE FROM scenarios WHERE true;
  DELETE FROM team_members WHERE true;
  DELETE FROM cost_lines WHERE true;
  DELETE FROM subscriptions WHERE true;
  DELETE FROM actuals WHERE true;
  DELETE FROM manual_revenue WHERE true;
  DELETE FROM rv_actuals WHERE true;
  DELETE FROM forecast_vectors WHERE true;
  DELETE FROM forecast_meta WHERE true;

  INSERT INTO forecast_meta (id,open_bal,cash_now,savings,s_loan,cc_owe,horizon)
    SELECT id,open_bal,cash_now,savings,s_loan,cc_owe,horizon
    FROM jsonb_populate_recordset(null::forecast_meta, coalesce(p->'forecast_meta','[]'::jsonb));
  INSERT INTO forecast_vectors (id,et,af,wf)
    SELECT id,et,af,wf
    FROM jsonb_populate_recordset(null::forecast_vectors, coalesce(p->'forecast_vectors','[]'::jsonb));
  INSERT INTO rv_actuals (stream,overrides)
    SELECT stream,overrides
    FROM jsonb_populate_recordset(null::rv_actuals, coalesce(p->'rv_actuals','[]'::jsonb));
  INSERT INTO manual_revenue (stream,v)
    SELECT stream,v
    FROM jsonb_populate_recordset(null::manual_revenue, coalesce(p->'manual_revenue','[]'::jsonb));
  INSERT INTO actuals (month_idx,closing_bal,total_in,total_out,chase_in,chase_out,stripe_in,stripe_payout,stripe_loan,wise_out,wise_fees,cc_spend,cc_fees,recon_date)
    SELECT month_idx,closing_bal,total_in,total_out,chase_in,chase_out,stripe_in,stripe_payout,stripe_loan,wise_out,wise_fees,cc_spend,cc_fees,recon_date
    FROM jsonb_populate_recordset(null::actuals, coalesce(p->'actuals','[]'::jsonb));
  INSERT INTO subscriptions (pos,n,a,start_mo,end_mo)
    SELECT pos,n,a,start_mo,end_mo
    FROM jsonb_populate_recordset(null::subscriptions, coalesce(p->'subscriptions','[]'::jsonb));
  INSERT INTO cost_lines (kind,pos,n,v)
    SELECT kind,pos,n,v
    FROM jsonb_populate_recordset(null::cost_lines, coalesce(p->'cost_lines','[]'::jsonb));
  INSERT INTO team_members (id,pos,nm,rl,dp,ct,co,on_flag,start_mo,end_mo,month_overrides)
    SELECT id,pos,nm,rl,dp,ct,co,on_flag,start_mo,end_mo,month_overrides
    FROM jsonb_populate_recordset(null::team_members, coalesce(p->'team_members','[]'::jsonb));
  INSERT INTO scenarios (id,pos,name,type,amount,start_mo,duration,on_flag)
    SELECT id,pos,name,type,amount,start_mo,duration,on_flag
    FROM jsonb_populate_recordset(null::scenarios, coalesce(p->'scenarios','[]'::jsonb));
  INSERT INTO clients (id,pos,nm,email,notes,last_edited_at,last_edited_by)
    SELECT id,pos,nm,email,notes,last_edited_at,last_edited_by
    FROM jsonb_populate_recordset(null::clients, coalesce(p->'clients','[]'::jsonb));
  INSERT INTO service_contracts (client_id,type,segment,monthly_amount,monthly_renewal_day,start_date,end_date,status,in_forecast)
    SELECT client_id,type,segment,monthly_amount,monthly_renewal_day,start_date,end_date,status,in_forecast
    FROM jsonb_populate_recordset(null::service_contracts, coalesce(p->'service_contracts','[]'::jsonb));
  INSERT INTO payment_schedule (client_id,pos,due_date,amount,paid,paid_date,note,status)
    SELECT client_id,pos,due_date,amount,paid,paid_date,note,status
    FROM jsonb_populate_recordset(null::payment_schedule, coalesce(p->'payment_schedule','[]'::jsonb));
  INSERT INTO zoho_commissions (client_id,zoho_product,licenses,frequency,monthly_amount,annual_amount,renewal_date,renewal_day,status,in_forecast,note)
    SELECT client_id,zoho_product,licenses,frequency,monthly_amount,annual_amount,renewal_date,renewal_day,status,in_forecast,note
    FROM jsonb_populate_recordset(null::zoho_commissions, coalesce(p->'zoho_commissions','[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.save_forecast_rows(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_forecast_rows(jsonb) TO authenticated, service_role;

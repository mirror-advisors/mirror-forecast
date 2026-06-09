-- Rollback for 0001_relational_schema.sql. Drops everything it created.
-- forecast_data and profiles are NOT touched. Run only if reverting Phase 1.
DROP TABLE IF EXISTS actuals, scenarios, zoho_commissions, payment_schedule,
  service_contracts, clients, team_members, cost_lines, subscriptions,
  rv_actuals, manual_revenue, forecast_vectors, forecast_meta CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_member() CASCADE;
DROP TYPE IF EXISTS contract_type, entity_status, pay_status, zoho_frequency,
  team_country, team_dept, scenario_type, oc_kind, rv_stream CASCADE;

-- ============================================================================
-- mirror-forecast — relational schema (Phase 1, ADDITIVE).
-- Replaces the single forecast_data.data jsonb blob with proper tables.
-- Design: "hybrid-vectors" — relational entities + numeric[] for dense 24-month
-- vectors + jsonb for sparse monthIdx->amount maps. compute.js & UI stay frozen
-- (loadData reassembles the exact `d` object; saveData decomposes it).
--
-- SAFE TO RUN: creates new objects only; does NOT touch forecast_data or profiles.
-- Rollback: see 0001_rollback.sql (DROP everything created here).
-- Single org/tenant: singletons are id=1 rows (matches forecast_data id=1).
-- ============================================================================

-- ---------- ENUMS (closed domains lifted from compute.js) -------------------
CREATE TYPE contract_type  AS ENUM ('retainer','support-retainer','bank-of-hours','project','one-time');
CREATE TYPE entity_status  AS ENUM ('active','at-risk','churned','pipeline');
CREATE TYPE pay_status     AS ENUM ('P','U','L','C');          -- paymentSchedule[].status (optional in d)
CREATE TYPE zoho_frequency AS ENUM ('monthly','annual');
CREATE TYPE team_country   AS ENUM ('US','PH','IN');
CREATE TYPE team_dept      AS ENUM ('Development','Marketing','Operations','Leadership');
CREATE TYPE scenario_type  AS ENUM ('revenue','expense');
CREATE TYPE oc_kind        AS ENUM ('oc','db');                -- which expense array a line belongs to
CREATE TYPE rv_stream      AS ENUM ('mk','ot','pCruzy','pPatson'); -- manual streams (za/zm are DERIVED, never stored)

-- ---------- RLS HELPERS (read existing public.profiles.role) ----------------
-- Mirrors AuthContext: isAdmin = role='admin', isViewer = role='viewer'.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'); $$;

CREATE OR REPLACE FUNCTION public.is_member() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','viewer')); $$;

-- ---------- SINGLETON: scalars + horizon (id=1) -----------------------------
-- horizon is INFORMATIONAL ONLY (compute.js hardcodes N=24); loadData uses
-- array_length, not this column. Kept for documentation / future use.
CREATE TABLE forecast_meta (
  id         smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  open_bal   numeric NOT NULL DEFAULT 0,   -- d.openBal
  cash_now   numeric NOT NULL DEFAULT 0,   -- d.cashNow
  savings    numeric NOT NULL DEFAULT 0,   -- d.savings
  s_loan     numeric NOT NULL DEFAULT 0,   -- d.sLoan
  cc_owe     numeric NOT NULL DEFAULT 0,   -- d.ccOwe (negative in data)
  horizon    smallint NOT NULL DEFAULT 24 CHECK (horizon BETWEEN 1 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- SINGLETON: top-level dense vectors et/af/wf (id=1) ---------------
CREATE TABLE forecast_vectors (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  et numeric[] NOT NULL DEFAULT '{}',  -- d.et (ADP taxes, negative)
  af numeric[] NOT NULL DEFAULT '{}',  -- d.af (ADP fees, negative)
  wf numeric[] NOT NULL DEFAULT '{}',  -- d.wf (Wise fees, negative)
  CONSTRAINT vec_len_chk CHECK (
    array_length(et,1) IS NOT DISTINCT FROM array_length(af,1)
    AND array_length(af,1) IS NOT DISTINCT FROM array_length(wf,1)
  )
);

-- ---------- MANUAL REVENUE STREAMS (d.rv.mk/ot/pCruzy/pPatson) --------------
-- ot is stored & round-tripped though compute IGNORES it. za/zm NOT here (derived from cl[]).
CREATE TABLE manual_revenue (
  stream rv_stream PRIMARY KEY,
  v      numeric[] NOT NULL DEFAULT '{}'
);

-- ---------- rvActuals (Q1 overrides, SPARSE monthIdx->amount) ---------------
-- jsonb keeps 0-based STRING keys exactly as d ({"0":5453,...}); compute parseInts them.
CREATE TABLE rv_actuals (
  stream    text PRIMARY KEY CHECK (stream IN ('im','za','zm')),
  overrides jsonb NOT NULL DEFAULT '{}'
);

-- ---------- SUBSCRIPTIONS (d.sb[]) — display only ---------------------------
-- s/e are OPTIONAL in d; reassembly omits the key when null.
CREATE TABLE subscriptions (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pos      int     NOT NULL UNIQUE,   -- preserves sb[] order
  n        text    NOT NULL,
  a        numeric NOT NULL,
  start_mo int,                       -- d.sb[].s
  end_mo   int                        -- d.sb[].e
);

-- ---------- COST / DEBT LINES (d.oc[] and d.db[]) ---------------------------
CREATE TABLE cost_lines (
  id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind oc_kind NOT NULL,              -- 'oc'|'db'
  pos  int     NOT NULL,              -- order within its kind
  n    text    NOT NULL,
  v    numeric[] NOT NULL DEFAULT '{}',
  UNIQUE (kind, pos)
);

-- ---------- TEAM (d.tm[]) ---------------------------------------------------
CREATE TABLE team_members (
  id              text PRIMARY KEY,          -- "p1".."p14" (compute hardcodes some by nm)
  pos             int  NOT NULL UNIQUE,
  nm              text NOT NULL,
  rl              text NOT NULL,
  dp              team_dept    NOT NULL,
  ct              team_country NOT NULL,
  co              numeric NOT NULL DEFAULT 0,
  on_flag         boolean NOT NULL DEFAULT true,  -- d.tm[].on
  start_mo        int,
  end_mo          int,
  month_overrides jsonb NOT NULL DEFAULT '{}'     -- sparse {"4":88}
);

-- ---------- CLIENTS (d.cl[]) ------------------------------------------------
CREATE TABLE clients (
  id             text PRIMARY KEY,           -- "c1".."c22"
  pos            int  NOT NULL UNIQUE,        -- preserves cl[] order (stable rvBreakdown)
  nm             text NOT NULL,
  email          text,                        -- nullable
  notes          text NOT NULL DEFAULT '',
  last_edited_at timestamptz,
  last_edited_by text
);

CREATE TABLE service_contracts (
  client_id           text PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  type                contract_type NOT NULL,
  segment             text          NOT NULL,
  monthly_amount      numeric,
  monthly_renewal_day int CHECK (monthly_renewal_day BETWEEN 1 AND 31),
  start_date          date,
  end_date            date,
  status              entity_status NOT NULL,
  in_forecast         boolean       NOT NULL DEFAULT true
);

CREATE TABLE payment_schedule (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id  text NOT NULL REFERENCES service_contracts(client_id) ON DELETE CASCADE,
  pos        int  NOT NULL,
  due_date   date NOT NULL,
  amount     numeric NOT NULL,
  paid       boolean NOT NULL DEFAULT false,
  paid_date  text,                             -- string|null in d — TEXT to round-trip exactly
  note       text NOT NULL DEFAULT '',
  status     pay_status,                       -- optional in d (omit on reassembly when null)
  UNIQUE (client_id, pos)
);

CREATE TABLE zoho_commissions (
  client_id      text PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  zoho_product   text NOT NULL,
  licenses       int  NOT NULL DEFAULT 0,
  frequency      zoho_frequency NOT NULL,
  monthly_amount numeric NOT NULL DEFAULT 0,
  annual_amount  numeric NOT NULL DEFAULT 0,
  renewal_date   date,
  renewal_day    int CHECK (renewal_day BETWEEN 1 AND 31),
  status         entity_status NOT NULL,
  in_forecast    boolean NOT NULL DEFAULT true,
  note           text NOT NULL DEFAULT ''
);

-- ---------- SCENARIOS (d.scenarios[]) ---------------------------------------
CREATE TABLE scenarios (
  id       text PRIMARY KEY,
  pos      int  NOT NULL UNIQUE,
  name     text NOT NULL,
  type     scenario_type NOT NULL,
  amount   numeric NOT NULL CHECK (amount >= 0),
  start_mo int  NOT NULL DEFAULT 0,
  duration int  NOT NULL DEFAULT 0,            -- 0 = ongoing
  on_flag  boolean NOT NULL DEFAULT true
);

-- ---------- ACTUALS (d.actuals{monthIdx:{...}}) — Reconcile tab -------------
CREATE TABLE actuals (
  month_idx     int PRIMARY KEY CHECK (month_idx >= 0),
  closing_bal   numeric,
  total_in      numeric,
  total_out     numeric,
  chase_in      numeric,
  chase_out     numeric,
  stripe_in     numeric,
  stripe_payout numeric,
  stripe_loan   numeric,
  wise_out      numeric,
  wise_fees     numeric,
  cc_spend      numeric,
  cc_fees       numeric,
  recon_date    text
);

-- ============================================================================
-- RLS — every data table: authenticated members read, admins write, anon none.
-- service_role bypasses RLS (ops patch scripts keep working).
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'forecast_meta','forecast_vectors','manual_revenue','rv_actuals','subscriptions',
    'cost_lines','team_members','clients','service_contracts','payment_schedule',
    'zoho_commissions','scenarios','actuals'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY sel_%1$s ON %1$I FOR SELECT TO authenticated USING (public.is_member())', t);
    EXECUTE format('CREATE POLICY mod_%1$s ON %1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: icecream_erp; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA "icecream_erp";


ALTER SCHEMA "icecream_erp" OWNER TO "supabase_admin";

--
-- Name: account_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."account_type" AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE',
    'COST_OF_SALES'
);


ALTER TYPE "icecream_erp"."account_type" OWNER TO "supabase_admin";

--
-- Name: approval_level; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."approval_level" AS ENUM (
    'LEVEL1_SUPERVISOR',
    'LEVEL2_MANAGER',
    'LEVEL3_FINANCE_MANAGER',
    'LEVEL4_MANAGING_DIRECTOR'
);


ALTER TYPE "icecream_erp"."approval_level" OWNER TO "supabase_admin";

--
-- Name: approval_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."approval_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'ESCALATED'
);


ALTER TYPE "icecream_erp"."approval_status" OWNER TO "supabase_admin";

--
-- Name: batch_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."batch_status" AS ENUM (
    'DRAFT',
    'PLANNED',
    'MATERIALS_REQUESTED',
    'MATERIALS_APPROVED',
    'IN_PROGRESS',
    'WIP',
    'QUALITY_CHECK',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."batch_status" OWNER TO "supabase_admin";

--
-- Name: branch_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."branch_status" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'CLOSED'
);


ALTER TYPE "icecream_erp"."branch_status" OWNER TO "supabase_admin";

--
-- Name: budget_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."budget_status" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'ACTIVE',
    'CLOSED'
);


ALTER TYPE "icecream_erp"."budget_status" OWNER TO "supabase_admin";

--
-- Name: customer_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."customer_status" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'BLACKLISTED'
);


ALTER TYPE "icecream_erp"."customer_status" OWNER TO "supabase_admin";

--
-- Name: employee_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."employee_status" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ON_LEAVE',
    'TERMINATED'
);


ALTER TYPE "icecream_erp"."employee_status" OWNER TO "supabase_admin";

--
-- Name: grn_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."grn_status" AS ENUM (
    'DRAFT',
    'RECEIVED',
    'QUALITY_INSPECTION',
    'QUALITY_PASSED',
    'QUALITY_FAILED',
    'POSTED',
    'REJECTED'
);


ALTER TYPE "icecream_erp"."grn_status" OWNER TO "supabase_admin";

--
-- Name: invoice_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."invoice_status" AS ENUM (
    'DRAFT',
    'SENT',
    'PARTIAL_PAID',
    'PAID',
    'OVERDUE',
    'DISPUTED',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."invoice_status" OWNER TO "supabase_admin";

--
-- Name: item_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."item_type" AS ENUM (
    'RAW_MATERIAL',
    'PACKAGING_MATERIAL',
    'FINISHED_GOOD',
    'WORK_IN_PROGRESS',
    'CONSUMABLE',
    'SPARE_PART'
);


ALTER TYPE "icecream_erp"."item_type" OWNER TO "supabase_admin";

--
-- Name: leave_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."leave_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."leave_status" OWNER TO "supabase_admin";

--
-- Name: maintenance_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."maintenance_status" AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."maintenance_status" OWNER TO "supabase_admin";

--
-- Name: maintenance_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."maintenance_type" AS ENUM (
    'PREVENTIVE',
    'CORRECTIVE',
    'BREAKDOWN',
    'INSPECTION'
);


ALTER TYPE "icecream_erp"."maintenance_type" OWNER TO "supabase_admin";

--
-- Name: payment_method; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."payment_method" AS ENUM (
    'CASH',
    'ECOCASH',
    'CARD',
    'BANK_TRANSFER',
    'CREDIT',
    'PETTY_CASH'
);


ALTER TYPE "icecream_erp"."payment_method" OWNER TO "supabase_admin";

--
-- Name: po_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."po_status" AS ENUM (
    'DRAFT',
    'AWAITING_APPROVAL',
    'LEVEL1_APPROVED',
    'LEVEL2_APPROVED',
    'APPROVED',
    'SENT_TO_SUPPLIER',
    'PARTIAL_RECEIVED',
    'FULLY_RECEIVED',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."po_status" OWNER TO "supabase_admin";

--
-- Name: quality_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."quality_status" AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED',
    'CONDITIONAL_RELEASE',
    'QUARANTINE'
);


ALTER TYPE "icecream_erp"."quality_status" OWNER TO "supabase_admin";

--
-- Name: recipe_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."recipe_status" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE "icecream_erp"."recipe_status" OWNER TO "supabase_admin";

--
-- Name: sales_order_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."sales_order_status" AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'CREDIT_CHECK',
    'PICKING',
    'DISPATCHED',
    'DELIVERED',
    'INVOICED',
    'PARTIALLY_PAID',
    'PAID',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."sales_order_status" OWNER TO "supabase_admin";

--
-- Name: shift_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."shift_type" AS ENUM (
    'DAY',
    'NIGHT'
);


ALTER TYPE "icecream_erp"."shift_type" OWNER TO "supabase_admin";

--
-- Name: stock_movement_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."stock_movement_type" AS ENUM (
    'PURCHASE_RECEIVE',
    'PRODUCTION_ISSUE',
    'PRODUCTION_OUTPUT',
    'WIP_TRANSFER',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'SALES_ISSUE',
    'RETURN_IN',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'DAMAGE',
    'EXPIRY_WRITE_OFF',
    'WASTAGE',
    'SPILLAGE',
    'MACHINE_LOSS',
    'PACKAGING_LOSS'
);


ALTER TYPE "icecream_erp"."stock_movement_type" OWNER TO "supabase_admin";

--
-- Name: supplier_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."supplier_status" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'BLACKLISTED'
);


ALTER TYPE "icecream_erp"."supplier_status" OWNER TO "supabase_admin";

--
-- Name: transaction_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."transaction_status" AS ENUM (
    'DRAFT',
    'POSTED',
    'APPROVED',
    'LOCKED',
    'VOIDED'
);


ALTER TYPE "icecream_erp"."transaction_status" OWNER TO "supabase_admin";

--
-- Name: transfer_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."transfer_status" AS ENUM (
    'DRAFT',
    'IN_TRANSIT',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE "icecream_erp"."transfer_status" OWNER TO "supabase_admin";

--
-- Name: user_status; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."user_status" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


ALTER TYPE "icecream_erp"."user_status" OWNER TO "supabase_admin";

--
-- Name: warehouse_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."warehouse_type" AS ENUM (
    'MAIN',
    'BRANCH',
    'COLD_ROOM'
);


ALTER TYPE "icecream_erp"."warehouse_type" OWNER TO "supabase_admin";

--
-- Name: wastage_type; Type: TYPE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TYPE "icecream_erp"."wastage_type" AS ENUM (
    'MATERIAL_WASTAGE',
    'PRODUCT_LOSS',
    'SPILLAGE',
    'MACHINE_LOSS',
    'PACKAGING_LOSS',
    'QUALITY_REJECTION',
    'EXPIRY_LOSS'
);


ALTER TYPE "icecream_erp"."wastage_type" OWNER TO "supabase_admin";

--
-- Name: sync_audit_logs_compat(); Type: FUNCTION; Schema: icecream_erp; Owner: supabase_admin
--

CREATE FUNCTION "icecream_erp"."sync_audit_logs_compat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.entity_type is null then
    new.entity_type := new.table_name;
  end if;
  if new.table_name is null then
    new.table_name := coalesce(new.entity_type, 'system');
  end if;
  if new.entity_id is null then
    new.entity_id := new.record_id;
  end if;
  if new.record_id is null then
    new.record_id := new.entity_id;
  end if;
  if new.user_profile_id is null then
    new.user_profile_id := new.user_id;
  end if;
  if new.user_id is null then
    new.user_id := new.user_profile_id;
  end if;
  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "icecream_erp"."sync_audit_logs_compat"() OWNER TO "supabase_admin";

--
-- Name: sync_production_batch_outputs_compat(); Type: FUNCTION; Schema: icecream_erp; Owner: supabase_admin
--

CREATE FUNCTION "icecream_erp"."sync_production_batch_outputs_compat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.output_item_id is null then
    new.output_item_id := new.item_id;
  end if;
  if new.item_id is null then
    new.item_id := new.output_item_id;
  end if;
  if new.quantity_approved is null then
    new.quantity_approved := coalesce(new.actual_quantity, 0);
  end if;
  if new.quality_status is null then
    new.quality_status := 'PENDING';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "icecream_erp"."sync_production_batch_outputs_compat"() OWNER TO "supabase_admin";

--
-- Name: sync_production_batches_compat(); Type: FUNCTION; Schema: icecream_erp; Owner: supabase_admin
--

CREATE FUNCTION "icecream_erp"."sync_production_batches_compat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.shift is null then
    new.shift := 'DAY'::icecream_erp.shift_type;
  end if;

  if new.planned_quantity is null or new.planned_quantity = 0 then
    new.planned_quantity := coalesce(new.planned_qty, 0);
  end if;
  if new.planned_qty is null then
    new.planned_qty := coalesce(new.planned_quantity, 0);
  end if;

  if new.expected_output is null or new.expected_output = 0 then
    new.expected_output := coalesce(new.planned_quantity, new.planned_qty, 0);
  end if;

  if new.production_date is null and new.planned_date is not null then
    new.production_date := new.planned_date::timestamptz;
  end if;
  if new.planned_date is null and new.production_date is not null then
    new.planned_date := new.production_date::date;
  end if;

  if new.actual_output is null or new.actual_output = 0 then
    new.actual_output := coalesce(new.actual_quantity, new.actual_qty, 0);
  end if;
  if new.actual_quantity is null or new.actual_quantity = 0 then
    new.actual_quantity := coalesce(new.actual_output, new.actual_qty, 0);
  end if;
  if new.actual_qty is null then
    new.actual_qty := coalesce(new.actual_output, new.actual_quantity, 0);
  end if;

  if new.wastage_quantity is null or new.wastage_quantity = 0 then
    new.wastage_quantity := coalesce(new.wastage_qty, 0);
  end if;
  if new.wastage_qty is null then
    new.wastage_qty := coalesce(new.wastage_quantity, 0);
  end if;

  if new.efficiency_percentage is null or new.efficiency_percentage = 0 then
    new.efficiency_percentage := coalesce(new.actual_yield_percentage, new.yield_percent, 0);
  end if;
  if new.actual_yield_percentage is null or new.actual_yield_percentage = 0 then
    new.actual_yield_percentage := coalesce(new.efficiency_percentage, new.yield_percent, 0);
  end if;
  if new.yield_percent is null then
    new.yield_percent := coalesce(new.efficiency_percentage, new.actual_yield_percentage, 0);
  end if;

  if new.material_cost is null or new.material_cost = 0 then
    new.material_cost := coalesce(new.total_material_cost, 0);
  end if;
  if new.total_material_cost is null then
    new.total_material_cost := coalesce(new.material_cost, 0);
  end if;

  if new.labour_cost is null or new.labour_cost = 0 then
    new.labour_cost := coalesce(new.total_labour_cost, 0);
  end if;
  if new.total_labour_cost is null then
    new.total_labour_cost := coalesce(new.labour_cost, 0);
  end if;

  if new.overhead_cost is null or new.overhead_cost = 0 then
    new.overhead_cost := coalesce(new.total_overhead_cost, 0);
  end if;
  if new.total_overhead_cost is null then
    new.total_overhead_cost := coalesce(new.overhead_cost, 0);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "icecream_erp"."sync_production_batches_compat"() OWNER TO "supabase_admin";

--
-- Name: sync_stock_transfer_items_compat(); Type: FUNCTION; Schema: icecream_erp; Owner: supabase_admin
--

CREATE FUNCTION "icecream_erp"."sync_stock_transfer_items_compat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.quantity_requested is null then
    new.quantity_requested := coalesce(new.quantity, new.quantity_sent, new.quantity_received, 0);
  end if;
  if new.quantity_sent is null or new.quantity_sent = 0 then
    new.quantity_sent := coalesce(new.quantity, new.quantity_requested, 0);
  end if;
  if new.quantity_received is null or new.quantity_received = 0 then
    new.quantity_received := coalesce(new.quantity, new.quantity_sent, new.quantity_requested, 0);
  end if;
  if new.quantity is null then
    new.quantity := coalesce(new.quantity_requested, new.quantity_sent, new.quantity_received, 0);
  end if;
  if new.notes is null then
    new.notes := new.remarks;
  end if;
  if new.remarks is null then
    new.remarks := new.notes;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "icecream_erp"."sync_stock_transfer_items_compat"() OWNER TO "supabase_admin";

--
-- Name: sync_stock_transfers_compat(); Type: FUNCTION; Schema: icecream_erp; Owner: supabase_admin
--

CREATE FUNCTION "icecream_erp"."sync_stock_transfers_compat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.from_warehouse_id is null then
    new.from_warehouse_id := new.from_warehouse;
  end if;
  if new.from_warehouse is null then
    new.from_warehouse := new.from_warehouse_id;
  end if;
  if new.to_warehouse_id is null then
    new.to_warehouse_id := new.to_warehouse;
  end if;
  if new.to_warehouse is null then
    new.to_warehouse := new.to_warehouse_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "icecream_erp"."sync_stock_transfers_compat"() OWNER TO "supabase_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: accounts; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "icecream_erp"."account_type" NOT NULL,
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."accounts" OWNER TO "supabase_admin";

--
-- Name: approval_actions; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."approval_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "approval_request_id" "uuid" NOT NULL,
    "step_number" integer,
    "level" "text",
    "role_id" "uuid",
    "action_by" "uuid",
    "action" "text" NOT NULL,
    "comments" "text",
    "acted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_type" "text",
    "document_id" "text",
    "ip_address" "text",
    "action_status" "text",
    "action_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."approval_actions" OWNER TO "supabase_admin";

--
-- Name: approval_requests; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."approval_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "workflow_id" "uuid",
    "module_name" "text",
    "document_type" "text",
    "document_reference" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "request_reason" "text",
    "requested_by" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approver_role_id" "uuid",
    "approver_role_name" "text",
    "approver_user_id" "uuid",
    "approval_date" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "submitted_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejected_reason" "text",
    "current_step" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."approval_requests" OWNER TO "supabase_admin";

--
-- Name: approval_workflow_steps; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."approval_workflow_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workflow_id" "uuid" NOT NULL,
    "step_name" "text",
    "step_number" integer NOT NULL,
    "approval_level" integer,
    "level" "text",
    "role_id" "uuid",
    "approver_role_name" "text",
    "minimum_amount" numeric(18,2),
    "maximum_amount" numeric(18,2),
    "escalation_hours" integer,
    "is_required" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."approval_workflow_steps" OWNER TO "supabase_admin";

--
-- Name: approval_workflows; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."approval_workflows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "module_name" "text",
    "document_type" "text",
    "action_name" "text",
    "self_approval_allowed" boolean DEFAULT false NOT NULL,
    "minimum_amount" numeric(18,2),
    "maximum_amount" numeric(18,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid"
);


ALTER TABLE "icecream_erp"."approval_workflows" OWNER TO "supabase_admin";

--
-- Name: attendances; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."attendances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "attendance_date" "date" NOT NULL,
    "shift" "icecream_erp"."shift_type" NOT NULL,
    "clock_in" timestamp with time zone,
    "clock_out" timestamp with time zone,
    "hours_worked" numeric(5,2),
    "overtime_hours" numeric(5,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'PRESENT'::"text" NOT NULL,
    "notes" "text"
);


ALTER TABLE "icecream_erp"."attendances" OWNER TO "supabase_admin";

--
-- Name: audit_logs; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" DEFAULT 'system'::"text",
    "record_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "user_profile_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "icecream_erp"."audit_logs" OWNER TO "supabase_admin";

--
-- Name: auth_sessions; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."auth_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_account_id" "uuid",
    "token" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."auth_sessions" OWNER TO "supabase_admin";

--
-- Name: batch_material_usage; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."batch_material_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "standard_qty" numeric(15,4) NOT NULL,
    "actual_qty" numeric(15,4) NOT NULL,
    "variance_qty" numeric(15,4),
    "unit_cost" numeric(15,4),
    "total_cost" numeric(15,2),
    "notes" "text"
);


ALTER TABLE "icecream_erp"."batch_material_usage" OWNER TO "supabase_admin";

--
-- Name: batch_worker_output; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."batch_worker_output" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "worker_id" "uuid",
    "worker_name" "text" NOT NULL,
    "cones_produced" integer DEFAULT 0 NOT NULL,
    "hours_worked" numeric(5,2),
    "productivity_score" numeric(5,2),
    "notes" "text"
);


ALTER TABLE "icecream_erp"."batch_worker_output" OWNER TO "supabase_admin";

--
-- Name: branch_sales; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."branch_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "sale_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "shift" "icecream_erp"."shift_type" DEFAULT 'DAY'::"icecream_erp"."shift_type" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_price" numeric(15,4) NOT NULL,
    "total_amount" numeric(15,2) NOT NULL,
    "payment_method" "icecream_erp"."payment_method" DEFAULT 'CASH'::"icecream_erp"."payment_method" NOT NULL,
    "served_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."branch_sales" OWNER TO "supabase_admin";

--
-- Name: branch_shift_closes; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."branch_shift_closes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "shift_date" "date" NOT NULL,
    "shift" "icecream_erp"."shift_type" NOT NULL,
    "opening_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_sales" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_expenses" numeric(15,2) DEFAULT 0 NOT NULL,
    "closing_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "cash_counted" numeric(15,2),
    "variance" numeric(15,2),
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "notes" "text",
    "closed_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."branch_shift_closes" OWNER TO "supabase_admin";

--
-- Name: branches; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "manager_id" "uuid",
    "status" "icecream_erp"."branch_status" DEFAULT 'ACTIVE'::"icecream_erp"."branch_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."branches" OWNER TO "supabase_admin";

--
-- Name: budget_lines; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."budget_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "budget_id" "uuid" NOT NULL,
    "account_id" "uuid",
    "description" "text" NOT NULL,
    "budgeted_amount" numeric(15,2) NOT NULL,
    "actual_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "variance" numeric(15,2) DEFAULT 0 NOT NULL,
    "month" integer
);


ALTER TABLE "icecream_erp"."budget_lines" OWNER TO "supabase_admin";

--
-- Name: budgets; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "department" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "icecream_erp"."budget_status" DEFAULT 'DRAFT'::"icecream_erp"."budget_status" NOT NULL,
    "total_budget" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_actual" numeric(15,2) DEFAULT 0 NOT NULL,
    "variance" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."budgets" OWNER TO "supabase_admin";

--
-- Name: customers; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "credit_limit" numeric(15,2) DEFAULT 0 NOT NULL,
    "credit_days" integer DEFAULT 0 NOT NULL,
    "outstanding_balance" numeric(15,2) DEFAULT 0 NOT NULL,
    "status" "icecream_erp"."customer_status" DEFAULT 'ACTIVE'::"icecream_erp"."customer_status" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."customers" OWNER TO "supabase_admin";

--
-- Name: employees; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "employee_number" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "department" "text",
    "position" "text",
    "shift" "icecream_erp"."shift_type",
    "hire_date" "date",
    "basic_salary" numeric(15,2),
    "status" "icecream_erp"."employee_status" DEFAULT 'ACTIVE'::"icecream_erp"."employee_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."employees" OWNER TO "supabase_admin";

--
-- Name: finished_goods_transfers; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."finished_goods_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_batch_id" "uuid" NOT NULL,
    "source_warehouse_id" "uuid" NOT NULL,
    "destination_warehouse_id" "uuid" NOT NULL,
    "quantity_transferred" numeric(18,4) DEFAULT 0 NOT NULL,
    "received_by" "uuid",
    "transfer_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."finished_goods_transfers" OWNER TO "supabase_admin";

--
-- Name: goods_received_note_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."goods_received_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_id" "uuid" NOT NULL,
    "goods_received_note_id" "uuid",
    "item_id" "uuid" NOT NULL,
    "po_item_id" "uuid",
    "purchase_order_item_id" "uuid",
    "quantity_expected" numeric(18,3) DEFAULT 0 NOT NULL,
    "quantity_received" numeric(18,3) DEFAULT 0 NOT NULL,
    "quantity_rejected" numeric(18,3) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(18,2) DEFAULT 0 NOT NULL,
    "batch_number" "text",
    "expiry_date" "date",
    "quality_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_quantity" numeric(18,3) DEFAULT 0 NOT NULL,
    "damaged_quantity" numeric(18,3) DEFAULT 0 NOT NULL,
    "shortage_quantity" numeric(18,3) DEFAULT 0 NOT NULL,
    "remarks" "text"
);


ALTER TABLE "icecream_erp"."goods_received_note_items" OWNER TO "supabase_admin";

--
-- Name: goods_received_notes; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."goods_received_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "grn_number" "text" NOT NULL,
    "po_id" "uuid",
    "supplier_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "received_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "icecream_erp"."grn_status" DEFAULT 'DRAFT'::"icecream_erp"."grn_status" NOT NULL,
    "delivery_note" "text",
    "invoice_ref" "text",
    "notes" "text",
    "received_by" "uuid",
    "posted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "purchase_order_id" "uuid",
    "quality_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "quality_notes" "text",
    "deleted_at" timestamp with time zone,
    "delivery_note_number" "text",
    "posted_by" "uuid",
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "entry_mode" "text" DEFAULT 'po_linked'::"text" NOT NULL
);


ALTER TABLE "icecream_erp"."goods_received_notes" OWNER TO "supabase_admin";

--
-- Name: grn_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."grn_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "po_item_id" "uuid",
    "ordered_qty" numeric(15,4),
    "received_qty" numeric(15,4) NOT NULL,
    "rejected_qty" numeric(15,4) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(15,4) NOT NULL,
    "batch_number" "text",
    "expiry_date" "date",
    "quality_status" "icecream_erp"."quality_status" DEFAULT 'PENDING'::"icecream_erp"."quality_status" NOT NULL,
    "quality_notes" "text"
);


ALTER TABLE "icecream_erp"."grn_items" OWNER TO "supabase_admin";

--
-- Name: hr_production_worker_outputs; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."hr_production_worker_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "schedule_id" "uuid",
    "product_id" "uuid",
    "shift_name" "text" NOT NULL,
    "quantity_produced" numeric(18,3) DEFAULT 0 NOT NULL,
    "accepted_quantity" numeric(18,3) DEFAULT 0 NOT NULL,
    "rejected_quantity" numeric(18,3) DEFAULT 0 NOT NULL,
    "hours_worked_snapshot" numeric(8,2) DEFAULT 0 NOT NULL,
    "remarks" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."hr_production_worker_outputs" OWNER TO "supabase_admin";

--
-- Name: invoices; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "order_id" "uuid",
    "customer_id" "uuid",
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "status" "icecream_erp"."invoice_status" DEFAULT 'DRAFT'::"icecream_erp"."invoice_status" NOT NULL,
    "subtotal" numeric(15,2) NOT NULL,
    "tax_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(15,2) NOT NULL,
    "paid_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "balance_due" numeric(15,2) NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "warehouse_id" "uuid",
    "sales_order_id" "uuid"
);


ALTER TABLE "icecream_erp"."invoices" OWNER TO "supabase_admin";

--
-- Name: item_categories; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."item_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."item_categories" OWNER TO "supabase_admin";

--
-- Name: items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "type" "icecream_erp"."item_type" NOT NULL,
    "category_id" "uuid",
    "unit_id" "uuid",
    "standard_cost" numeric(15,4) DEFAULT 0 NOT NULL,
    "selling_price" numeric(15,4),
    "reorder_level" numeric(12,3),
    "reorder_qty" numeric(12,3),
    "shelf_life_days" integer,
    "requires_quality_check" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "item_type" "text",
    "unit_of_measure_id" "uuid",
    "unit_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "default_warehouse_id" "uuid",
    "production_category" "text"
);


ALTER TABLE "icecream_erp"."items" OWNER TO "supabase_admin";

--
-- Name: journal_entries; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "entry_number" "text" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text" NOT NULL,
    "reference" "text",
    "status" "icecream_erp"."transaction_status" DEFAULT 'DRAFT'::"icecream_erp"."transaction_status" NOT NULL,
    "total_debit" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_credit" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."journal_entries" OWNER TO "supabase_admin";

--
-- Name: journal_lines; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."journal_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "debit" numeric(15,2) DEFAULT 0 NOT NULL,
    "credit" numeric(15,2) DEFAULT 0 NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "icecream_erp"."journal_lines" OWNER TO "supabase_admin";

--
-- Name: login_attempts; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."login_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid",
    "work_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."login_attempts" OWNER TO "supabase_admin";

--
-- Name: machines; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."machines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "asset_number" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "purchase_date" "date",
    "purchase_cost" numeric(15,2),
    "status" "text" DEFAULT 'OPERATIONAL'::"text" NOT NULL,
    "last_maintenance" "date",
    "next_maintenance" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."machines" OWNER TO "supabase_admin";

--
-- Name: maintenance_records; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."maintenance_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "machine_id" "uuid" NOT NULL,
    "maintenance_type" "icecream_erp"."maintenance_type" DEFAULT 'PREVENTIVE'::"icecream_erp"."maintenance_type" NOT NULL,
    "scheduled_date" "date",
    "completed_date" "date",
    "status" "icecream_erp"."maintenance_status" DEFAULT 'SCHEDULED'::"icecream_erp"."maintenance_status" NOT NULL,
    "description" "text" NOT NULL,
    "technician" "text",
    "downtime_hours" numeric(5,2),
    "cost" numeric(15,2),
    "parts_used" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."maintenance_records" OWNER TO "supabase_admin";

--
-- Name: notifications; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "type" "text" DEFAULT 'INFO'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "reference_type" "text",
    "reference_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."notifications" OWNER TO "supabase_admin";

--
-- Name: organizations; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "tax_number" "text",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "financial_year_start" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."organizations" OWNER TO "supabase_admin";

--
-- Name: payroll_records; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."payroll_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "pay_period_start" "date" NOT NULL,
    "pay_period_end" "date" NOT NULL,
    "basic_salary" numeric(15,2) NOT NULL,
    "overtime_pay" numeric(15,2) DEFAULT 0 NOT NULL,
    "allowances" numeric(15,2) DEFAULT 0 NOT NULL,
    "deductions" numeric(15,2) DEFAULT 0 NOT NULL,
    "tax_deduction" numeric(15,2) DEFAULT 0 NOT NULL,
    "net_pay" numeric(15,2) NOT NULL,
    "status" "icecream_erp"."approval_status" DEFAULT 'PENDING'::"icecream_erp"."approval_status" NOT NULL,
    "approved_by" "uuid",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."payroll_records" OWNER TO "supabase_admin";

--
-- Name: permissions; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "module" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."permissions" OWNER TO "supabase_admin";

--
-- Name: production_batch_materials; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_batch_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "quantity_required" numeric(18,4) DEFAULT 0 NOT NULL,
    "quantity_issued" numeric(18,4) DEFAULT 0 NOT NULL,
    "quantity_actual" numeric(18,4) DEFAULT 0 NOT NULL,
    "quantity_remaining" numeric(18,4) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "total_cost" numeric(18,2) DEFAULT 0 NOT NULL,
    "variance" numeric(18,4) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "item_type" "text"
);


ALTER TABLE "icecream_erp"."production_batch_materials" OWNER TO "supabase_admin";

--
-- Name: production_batch_outputs; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_batch_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "expected_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "actual_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "wastage_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "output_item_id" "uuid",
    "quality_status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "quantity_approved" numeric(18,4) DEFAULT 0 NOT NULL
);


ALTER TABLE "icecream_erp"."production_batch_outputs" OWNER TO "supabase_admin";

--
-- Name: production_batches; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "batch_number" "text" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "shift" "icecream_erp"."shift_type" DEFAULT 'DAY'::"icecream_erp"."shift_type" NOT NULL,
    "planned_date" "date" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "planned_qty" numeric(12,3) NOT NULL,
    "actual_qty" numeric(12,3),
    "rejected_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "wastage_qty" numeric(12,3) DEFAULT 0 NOT NULL,
    "yield_percent" numeric(5,2),
    "status" "icecream_erp"."batch_status" DEFAULT 'DRAFT'::"icecream_erp"."batch_status" NOT NULL,
    "total_material_cost" numeric(15,2),
    "total_labour_cost" numeric(15,2),
    "total_overhead_cost" numeric(15,2),
    "cost_per_unit" numeric(15,4),
    "notes" "text",
    "started_by" "uuid",
    "closed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "production_date" timestamp with time zone,
    "production_line" "text",
    "production_category" "text" DEFAULT 'ICE_CREAM_MAKING'::"text" NOT NULL,
    "planned_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "expected_output" numeric(18,4) DEFAULT 0 NOT NULL,
    "actual_output" numeric(18,4) DEFAULT 0 NOT NULL,
    "quality_status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "quality_notes" "text",
    "wastage_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "wastage_percentage" numeric(8,3) DEFAULT 0 NOT NULL,
    "efficiency_percentage" numeric(8,3) DEFAULT 0 NOT NULL,
    "worker_count" integer DEFAULT 0 NOT NULL,
    "people_off_count" integer DEFAULT 0 NOT NULL,
    "labour_cost" numeric(18,2) DEFAULT 0 NOT NULL,
    "overhead_cost" numeric(18,2) DEFAULT 0 NOT NULL,
    "material_cost" numeric(18,2) DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "wastage_reason" "text",
    "actual_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "actual_yield_percentage" numeric(8,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "icecream_erp"."production_batches" OWNER TO "supabase_admin";

--
-- Name: production_cost_overrides; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_cost_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "batch_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "item_id" "uuid" NOT NULL,
    "previous_unit_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "adjusted_unit_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "adjustment_reason" "text",
    "adjusted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."production_cost_overrides" OWNER TO "supabase_admin";

--
-- Name: production_plan_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_plan_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "production_plan_id" "uuid" NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "planned_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "expected_output" numeric(18,4) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."production_plan_items" OWNER TO "supabase_admin";

--
-- Name: production_plans; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "plan_number" "text" NOT NULL,
    "plan_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "shift" "text" DEFAULT 'DAY'::"text" NOT NULL,
    "production_line" "text",
    "production_category" "text" DEFAULT 'ICE_CREAM_MAKING'::"text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."production_plans" OWNER TO "supabase_admin";

--
-- Name: production_stock_closures; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_stock_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "batch_id" "uuid",
    "item_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "closure_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "opening_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "additional_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "used_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "remaining_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "closing_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(18,4) DEFAULT 0 NOT NULL,
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."production_stock_closures" OWNER TO "supabase_admin";

--
-- Name: production_worker_assignments; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."production_worker_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "batch_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "worker_name" "text",
    "shift_name" "text" DEFAULT 'DAY'::"text" NOT NULL,
    "attendance_status" "text" DEFAULT 'PRESENT'::"text" NOT NULL,
    "is_off_shift" boolean DEFAULT false NOT NULL,
    "hours_worked" numeric(8,2) DEFAULT 0 NOT NULL,
    "output_quantity" numeric(18,4) DEFAULT 0 NOT NULL,
    "remarks" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."production_worker_assignments" OWNER TO "supabase_admin";

--
-- Name: purchase_order_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_price" numeric(15,4) NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(15,2) NOT NULL,
    "received_qty" numeric(15,4) DEFAULT 0 NOT NULL,
    "purchase_order_id" "uuid",
    "unit_of_measure_id" "uuid",
    "quantity_ordered" numeric(18,3),
    "quantity_received" numeric(18,3) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(18,2),
    "total_cost" numeric(18,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."purchase_order_items" OWNER TO "supabase_admin";

--
-- Name: purchase_orders; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "po_number" "text" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "pr_id" "uuid",
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "expected_date" "date",
    "status" "icecream_erp"."po_status" DEFAULT 'DRAFT'::"icecream_erp"."po_status" NOT NULL,
    "subtotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requisition_id" "uuid",
    "expected_delivery_date" "date",
    "discount_amount" numeric(18,2) DEFAULT 0 NOT NULL,
    "total" numeric(18,2),
    "deleted_at" timestamp with time zone,
    "approver_user_id" "uuid",
    "rejected_by" "uuid",
    "rejected_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."purchase_orders" OWNER TO "supabase_admin";

--
-- Name: purchase_requisition_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."purchase_requisition_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pr_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "estimated_cost" numeric(15,4),
    "notes" "text",
    "requisition_id" "uuid",
    "unit_of_measure_id" "uuid",
    "quantity_requested" numeric(18,3),
    "quantity_approved" numeric(18,3),
    "estimated_unit_cost" numeric(18,2),
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."purchase_requisition_items" OWNER TO "supabase_admin";

--
-- Name: purchase_requisitions; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."purchase_requisitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "pr_number" "text" NOT NULL,
    "requested_by" "uuid",
    "department" "text",
    "required_date" "date",
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "priority" "text" DEFAULT 'NORMAL'::"text" NOT NULL,
    "notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requisition_number" "text",
    "request_date" "date",
    "needed_by_date" "date",
    "approval_status" "text",
    "remarks" "text",
    "deleted_at" timestamp with time zone,
    "approver_user_id" "uuid",
    "rejected_by" "uuid",
    "rejected_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."purchase_requisitions" OWNER TO "supabase_admin";

--
-- Name: quality_checks; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."quality_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reference_type" "text" NOT NULL,
    "reference_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "check_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "checked_by" "uuid",
    "status" "icecream_erp"."quality_status" DEFAULT 'PENDING'::"icecream_erp"."quality_status" NOT NULL,
    "temperature" numeric(5,2),
    "ph_level" numeric(4,2),
    "appearance" "text",
    "taste_result" "text",
    "microbial_test" "text",
    "approved_qty" numeric(15,4),
    "rejected_qty" numeric(15,4) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."quality_checks" OWNER TO "supabase_admin";

--
-- Name: recipe_ingredients; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."recipe_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_id" "uuid",
    "is_optional" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "icecream_erp"."recipe_ingredients" OWNER TO "supabase_admin";

--
-- Name: recipe_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."recipe_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity_required" numeric(18,4) DEFAULT 0 NOT NULL,
    "unit_id" "uuid",
    "wastage_allowance_percent" numeric(8,3) DEFAULT 0 NOT NULL,
    "production_category" "text" DEFAULT 'ICE_CREAM_MAKING'::"text" NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."recipe_items" OWNER TO "supabase_admin";

--
-- Name: recipe_packaging_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."recipe_packaging_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity_required" numeric(18,4) DEFAULT 0 NOT NULL,
    "unit_id" "uuid",
    "wastage_allowance_percent" numeric(8,3) DEFAULT 0 NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."recipe_packaging_items" OWNER TO "supabase_admin";

--
-- Name: recipes; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "finished_item_id" "uuid" NOT NULL,
    "batch_size" numeric(12,3) NOT NULL,
    "batch_unit_id" "uuid",
    "expected_yield" numeric(5,2) DEFAULT 100 NOT NULL,
    "status" "icecream_erp"."recipe_status" DEFAULT 'DRAFT'::"icecream_erp"."recipe_status" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expected_output_quantity" numeric(18,4) DEFAULT 1 NOT NULL,
    "output_unit_id" "uuid",
    "instructions" "text",
    "packaging_requirement" "text",
    "production_category" "text" DEFAULT 'ICE_CREAM_MAKING'::"text" NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."recipes" OWNER TO "supabase_admin";

--
-- Name: report_definitions; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."report_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "report_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "required_permission" "text" NOT NULL,
    "route_path" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."report_definitions" OWNER TO "supabase_admin";

--
-- Name: report_exports; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."report_exports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid" NOT NULL,
    "report_category" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "branch_id" "uuid",
    "export_format" "text" DEFAULT 'CSV'::"text" NOT NULL,
    "file_name" "text" NOT NULL,
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'EXPORTED'::"text" NOT NULL,
    "exported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "exported_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."report_exports" OWNER TO "supabase_admin";

--
-- Name: report_run_histories; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."report_run_histories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid" NOT NULL,
    "report_category" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "branch_id" "uuid",
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'READY'::"text" NOT NULL,
    "export_format" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."report_run_histories" OWNER TO "supabase_admin";

--
-- Name: role_permissions; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."role_permissions" OWNER TO "supabase_admin";

--
-- Name: roles; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system_role" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."roles" OWNER TO "supabase_admin";

--
-- Name: sales_order_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "batch_number" "text",
    "quantity" numeric(15,4) NOT NULL,
    "unit_price" numeric(15,4) NOT NULL,
    "discount_pct" numeric(5,2) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(15,2) NOT NULL,
    "cogs" numeric(15,2)
);


ALTER TABLE "icecream_erp"."sales_order_items" OWNER TO "supabase_admin";

--
-- Name: sales_orders; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "order_number" "text" NOT NULL,
    "customer_id" "uuid",
    "branch_id" "uuid",
    "warehouse_id" "uuid" NOT NULL,
    "order_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "delivery_date" "date",
    "status" "icecream_erp"."sales_order_status" DEFAULT 'DRAFT'::"icecream_erp"."sales_order_status" NOT NULL,
    "subtotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(15,2) DEFAULT 0 NOT NULL,
    "payment_method" "icecream_erp"."payment_method",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."sales_orders" OWNER TO "supabase_admin";

--
-- Name: saved_report_filters; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."saved_report_filters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid" NOT NULL,
    "role_name" "text",
    "report_category" "text" NOT NULL,
    "report_type" "text" NOT NULL,
    "filter_name" "text" NOT NULL,
    "filter_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."saved_report_filters" OWNER TO "supabase_admin";

--
-- Name: security_events; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "user_profile_id" "uuid",
    "event_type" "text" NOT NULL,
    "status" "text" DEFAULT 'SUCCESS'::"text" NOT NULL,
    "details" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."security_events" OWNER TO "supabase_admin";

--
-- Name: session_activities; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."session_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_token" "text" NOT NULL,
    "user_profile_id" "uuid",
    "activity_type" "text" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."session_activities" OWNER TO "supabase_admin";

--
-- Name: stock_balances; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."stock_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) DEFAULT 0 NOT NULL,
    "reserved_qty" numeric(15,4) DEFAULT 0 NOT NULL,
    "avg_cost" numeric(15,4) DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quantity_on_hand" numeric(18,4) DEFAULT 0 NOT NULL,
    "quantity_available" numeric(18,4) DEFAULT 0 NOT NULL,
    "quantity_reserved" numeric(18,4) DEFAULT 0 NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."stock_balances" OWNER TO "supabase_admin";

--
-- Name: stock_movements; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "movement_type" "icecream_erp"."stock_movement_type" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_cost" numeric(15,4),
    "total_cost" numeric(15,4),
    "reference_type" "text",
    "reference_id" "uuid",
    "batch_number" "text",
    "expiry_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "running_balance" numeric(18,3) DEFAULT 0 NOT NULL,
    "source_warehouse_id" "uuid",
    "destination_warehouse_id" "uuid"
);


ALTER TABLE "icecream_erp"."stock_movements" OWNER TO "supabase_admin";

--
-- Name: stock_transfer_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."stock_transfer_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transfer_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_cost" numeric(15,4),
    "batch_number" "text",
    "expiry_date" "date",
    "remarks" "text",
    "quantity_requested" numeric(18,3),
    "quantity_sent" numeric(18,3) DEFAULT 0 NOT NULL,
    "quantity_received" numeric(18,3) DEFAULT 0 NOT NULL,
    "notes" "text"
);


ALTER TABLE "icecream_erp"."stock_transfer_items" OWNER TO "supabase_admin";

--
-- Name: stock_transfers; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."stock_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "transfer_number" "text" NOT NULL,
    "from_warehouse" "uuid" NOT NULL,
    "to_warehouse" "uuid" NOT NULL,
    "transfer_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "icecream_erp"."transfer_status" DEFAULT 'DRAFT'::"icecream_erp"."transfer_status" NOT NULL,
    "notes" "text",
    "requested_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "from_warehouse_id" "uuid",
    "to_warehouse_id" "uuid"
);


ALTER TABLE "icecream_erp"."stock_transfers" OWNER TO "supabase_admin";

--
-- Name: supplier_categories; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."supplier_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."supplier_categories" OWNER TO "supabase_admin";

--
-- Name: supplier_invoice_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."supplier_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_invoice_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity_invoiced" numeric(18,3) DEFAULT 0 NOT NULL,
    "unit_cost" numeric(18,2) DEFAULT 0 NOT NULL,
    "po_unit_cost" numeric(18,2),
    "unit_cost_reference" numeric(18,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."supplier_invoice_items" OWNER TO "supabase_admin";

--
-- Name: supplier_invoices; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."supplier_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "purchase_order_id" "uuid",
    "goods_received_note_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "invoice_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date",
    "subtotal" numeric(18,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(18,2) DEFAULT 0 NOT NULL,
    "invoice_total" numeric(18,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."supplier_invoices" OWNER TO "supabase_admin";

--
-- Name: supplier_payments; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."supplier_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "supplier_invoice_id" "uuid" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference_number" "text",
    "amount_paid" numeric(18,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'POSTED'::"text" NOT NULL,
    "remarks" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."supplier_payments" OWNER TO "supabase_admin";

--
-- Name: supplier_return_items; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."supplier_return_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_return_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "quantity_returned" numeric(18,3) DEFAULT 0 NOT NULL,
    "reason" "text" NOT NULL,
    "qc_status" "text" DEFAULT 'PENDING_QC'::"text" NOT NULL,
    "qc_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."supplier_return_items" OWNER TO "supabase_admin";

--
-- Name: supplier_returns; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."supplier_returns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "grn_id" "uuid",
    "return_number" "text" NOT NULL,
    "return_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "reason" "text" NOT NULL,
    "total_value" numeric(18,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending_qc'::"text" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."supplier_returns" OWNER TO "supabase_admin";

--
-- Name: suppliers; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "contact_person" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "category_id" "uuid",
    "credit_limit" numeric(15,2),
    "credit_days" integer DEFAULT 30,
    "payment_terms" "text",
    "status" "icecream_erp"."supplier_status" DEFAULT 'ACTIVE'::"icecream_erp"."supplier_status" NOT NULL,
    "rating" numeric(3,1),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_name" "text",
    "document_url" "text"
);


ALTER TABLE "icecream_erp"."suppliers" OWNER TO "supabase_admin";

--
-- Name: system_settings; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "module_name" "text" DEFAULT 'settings'::"text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deactivated_at" timestamp with time zone,
    "deactivated_by" "uuid"
);


ALTER TABLE "icecream_erp"."system_settings" OWNER TO "supabase_admin";

--
-- Name: units_of_measure; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."units_of_measure" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "abbreviation" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."units_of_measure" OWNER TO "supabase_admin";

--
-- Name: user_accounts; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."user_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_id" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "id_number" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "failed_login_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "icecream_erp"."user_accounts" OWNER TO "supabase_admin";

--
-- Name: user_branch_assignments; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."user_branch_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "role_name" "text",
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."user_branch_assignments" OWNER TO "supabase_admin";

--
-- Name: user_roles; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."user_roles" OWNER TO "supabase_admin";

--
-- Name: user_warehouse_assignments; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."user_warehouse_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_profile_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "access_level" "text",
    "effective_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."user_warehouse_assignments" OWNER TO "supabase_admin";

--
-- Name: users; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_id" "uuid",
    "work_id" character varying(20) NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "first_name" character varying(100),
    "last_name" character varying(100),
    "phone" character varying(50),
    "avatar_url" "text",
    "role" character varying(30) DEFAULT 'staff'::character varying NOT NULL,
    "branch_id" "uuid",
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "id_number" character varying(100),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "failed_login_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "last_login" timestamp with time zone,
    "user_account_id" "uuid",
    CONSTRAINT "users_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['super_admin'::character varying, 'branch_manager'::character varying, 'manager'::character varying, 'staff'::character varying])::"text"[]))),
    CONSTRAINT "users_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::"text"[])))
);


ALTER TABLE "icecream_erp"."users" OWNER TO "supabase_admin";

--
-- Name: warehouses; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "icecream_erp"."warehouse_type" DEFAULT 'MAIN'::"icecream_erp"."warehouse_type" NOT NULL,
    "address" "text",
    "capacity_kg" numeric(12,3),
    "temperature_min" numeric(5,2),
    "temperature_max" numeric(5,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "warehouse_type" "text",
    "production_role" "text",
    "is_production_warehouse" boolean DEFAULT false NOT NULL
);


ALTER TABLE "icecream_erp"."warehouses" OWNER TO "supabase_admin";

--
-- Name: wastage_records; Type: TABLE; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TABLE "icecream_erp"."wastage_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "batch_id" "uuid",
    "item_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "wastage_type" "icecream_erp"."wastage_type" NOT NULL,
    "quantity" numeric(15,4) NOT NULL,
    "unit_cost" numeric(15,4),
    "total_cost" numeric(15,2),
    "reason" "text",
    "recorded_by" "uuid",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "icecream_erp"."wastage_records" OWNER TO "supabase_admin";

--
-- Name: accounts accounts_organization_id_code_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."accounts"
    ADD CONSTRAINT "accounts_organization_id_code_key" UNIQUE ("organization_id", "code");


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");


--
-- Name: approval_actions approval_actions_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_actions"
    ADD CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id");


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id");


--
-- Name: approval_workflow_steps approval_workflow_steps_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflow_steps"
    ADD CONSTRAINT "approval_workflow_steps_pkey" PRIMARY KEY ("id");


--
-- Name: approval_workflow_steps approval_workflow_steps_workflow_id_step_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflow_steps"
    ADD CONSTRAINT "approval_workflow_steps_workflow_id_step_number_key" UNIQUE ("workflow_id", "step_number");


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflows"
    ADD CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id");


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."attendances"
    ADD CONSTRAINT "attendances_pkey" PRIMARY KEY ("id");


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id");


--
-- Name: auth_sessions auth_sessions_token_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."auth_sessions"
    ADD CONSTRAINT "auth_sessions_token_key" UNIQUE ("token");


--
-- Name: batch_material_usage batch_material_usage_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."batch_material_usage"
    ADD CONSTRAINT "batch_material_usage_pkey" PRIMARY KEY ("id");


--
-- Name: batch_worker_output batch_worker_output_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."batch_worker_output"
    ADD CONSTRAINT "batch_worker_output_pkey" PRIMARY KEY ("id");


--
-- Name: branch_sales branch_sales_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_sales"
    ADD CONSTRAINT "branch_sales_pkey" PRIMARY KEY ("id");


--
-- Name: branch_shift_closes branch_shift_closes_branch_id_shift_date_shift_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_shift_closes"
    ADD CONSTRAINT "branch_shift_closes_branch_id_shift_date_shift_key" UNIQUE ("branch_id", "shift_date", "shift");


--
-- Name: branch_shift_closes branch_shift_closes_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_shift_closes"
    ADD CONSTRAINT "branch_shift_closes_pkey" PRIMARY KEY ("id");


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");


--
-- Name: budget_lines budget_lines_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."budget_lines"
    ADD CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id");


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");


--
-- Name: customers customers_organization_id_code_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."customers"
    ADD CONSTRAINT "customers_organization_id_code_key" UNIQUE ("organization_id", "code");


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");


--
-- Name: employees employees_organization_id_employee_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."employees"
    ADD CONSTRAINT "employees_organization_id_employee_number_key" UNIQUE ("organization_id", "employee_number");


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");


--
-- Name: finished_goods_transfers finished_goods_transfers_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."finished_goods_transfers"
    ADD CONSTRAINT "finished_goods_transfers_pkey" PRIMARY KEY ("id");


--
-- Name: goods_received_note_items goods_received_note_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_note_items"
    ADD CONSTRAINT "goods_received_note_items_pkey" PRIMARY KEY ("id");


--
-- Name: goods_received_notes goods_received_notes_organization_id_grn_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_organization_id_grn_number_key" UNIQUE ("organization_id", "grn_number");


--
-- Name: goods_received_notes goods_received_notes_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_pkey" PRIMARY KEY ("id");


--
-- Name: grn_items grn_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."grn_items"
    ADD CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id");


--
-- Name: hr_production_worker_outputs hr_production_worker_outputs_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."hr_production_worker_outputs"
    ADD CONSTRAINT "hr_production_worker_outputs_pkey" PRIMARY KEY ("id");


--
-- Name: invoices invoices_organization_id_invoice_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."invoices"
    ADD CONSTRAINT "invoices_organization_id_invoice_number_key" UNIQUE ("organization_id", "invoice_number");


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");


--
-- Name: item_categories item_categories_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."item_categories"
    ADD CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id");


--
-- Name: items items_organization_id_code_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."items"
    ADD CONSTRAINT "items_organization_id_code_key" UNIQUE ("organization_id", "code");


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");


--
-- Name: journal_entries journal_entries_organization_id_entry_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_entries"
    ADD CONSTRAINT "journal_entries_organization_id_entry_number_key" UNIQUE ("organization_id", "entry_number");


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_lines"
    ADD CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id");


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."login_attempts"
    ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");


--
-- Name: machines machines_organization_id_asset_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."machines"
    ADD CONSTRAINT "machines_organization_id_asset_number_key" UNIQUE ("organization_id", "asset_number");


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."machines"
    ADD CONSTRAINT "machines_pkey" PRIMARY KEY ("id");


--
-- Name: maintenance_records maintenance_records_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."maintenance_records"
    ADD CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id");


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");


--
-- Name: payroll_records payroll_records_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."payroll_records"
    ADD CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id");


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");


--
-- Name: production_batch_materials production_batch_materials_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batch_materials"
    ADD CONSTRAINT "production_batch_materials_pkey" PRIMARY KEY ("id");


--
-- Name: production_batch_outputs production_batch_outputs_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batch_outputs"
    ADD CONSTRAINT "production_batch_outputs_pkey" PRIMARY KEY ("id");


--
-- Name: production_batches production_batches_organization_id_batch_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_organization_id_batch_number_key" UNIQUE ("organization_id", "batch_number");


--
-- Name: production_batches production_batches_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id");


--
-- Name: production_cost_overrides production_cost_overrides_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_cost_overrides"
    ADD CONSTRAINT "production_cost_overrides_pkey" PRIMARY KEY ("id");


--
-- Name: production_plan_items production_plan_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_plan_items"
    ADD CONSTRAINT "production_plan_items_pkey" PRIMARY KEY ("id");


--
-- Name: production_plans production_plans_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_plans"
    ADD CONSTRAINT "production_plans_pkey" PRIMARY KEY ("id");


--
-- Name: production_stock_closures production_stock_closures_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_stock_closures"
    ADD CONSTRAINT "production_stock_closures_pkey" PRIMARY KEY ("id");


--
-- Name: production_worker_assignments production_worker_assignments_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_worker_assignments"
    ADD CONSTRAINT "production_worker_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");


--
-- Name: purchase_orders purchase_orders_organization_id_po_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_organization_id_po_number_key" UNIQUE ("organization_id", "po_number");


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");


--
-- Name: purchase_requisition_items purchase_requisition_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisition_items"
    ADD CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id");


--
-- Name: purchase_requisitions purchase_requisitions_organization_id_pr_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_organization_id_pr_number_key" UNIQUE ("organization_id", "pr_number");


--
-- Name: purchase_requisitions purchase_requisitions_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id");


--
-- Name: quality_checks quality_checks_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."quality_checks"
    ADD CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id");


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id");


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipe_items"
    ADD CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id");


--
-- Name: recipe_packaging_items recipe_packaging_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipe_packaging_items"
    ADD CONSTRAINT "recipe_packaging_items_pkey" PRIMARY KEY ("id");


--
-- Name: recipes recipes_organization_id_code_version_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_organization_id_code_version_key" UNIQUE ("organization_id", "code", "version");


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");


--
-- Name: report_definitions report_definitions_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_definitions"
    ADD CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id");


--
-- Name: report_exports report_exports_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_exports"
    ADD CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id");


--
-- Name: report_run_histories report_run_histories_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_run_histories"
    ADD CONSTRAINT "report_run_histories_pkey" PRIMARY KEY ("id");


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id");


--
-- Name: roles roles_organization_id_name_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."roles"
    ADD CONSTRAINT "roles_organization_id_name_key" UNIQUE ("organization_id", "name");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");


--
-- Name: sales_orders sales_orders_organization_id_order_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_organization_id_order_number_key" UNIQUE ("organization_id", "order_number");


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");


--
-- Name: saved_report_filters saved_report_filters_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."saved_report_filters"
    ADD CONSTRAINT "saved_report_filters_pkey" PRIMARY KEY ("id");


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");


--
-- Name: session_activities session_activities_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."session_activities"
    ADD CONSTRAINT "session_activities_pkey" PRIMARY KEY ("id");


--
-- Name: stock_balances stock_balances_item_id_warehouse_id_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_balances"
    ADD CONSTRAINT "stock_balances_item_id_warehouse_id_key" UNIQUE ("item_id", "warehouse_id");


--
-- Name: stock_balances stock_balances_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_balances"
    ADD CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id");


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");


--
-- Name: stock_transfer_items stock_transfer_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id");


--
-- Name: stock_transfers stock_transfers_organization_id_transfer_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_organization_id_transfer_number_key" UNIQUE ("organization_id", "transfer_number");


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_categories supplier_categories_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_invoice_items supplier_invoice_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_invoices supplier_invoices_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_payments supplier_payments_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_return_items supplier_return_items_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_pkey" PRIMARY KEY ("id");


--
-- Name: supplier_returns supplier_returns_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id");


--
-- Name: suppliers suppliers_organization_id_code_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."suppliers"
    ADD CONSTRAINT "suppliers_organization_id_code_key" UNIQUE ("organization_id", "code");


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");


--
-- Name: units_of_measure units_of_measure_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."units_of_measure"
    ADD CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id");


--
-- Name: user_accounts user_accounts_email_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_accounts"
    ADD CONSTRAINT "user_accounts_email_key" UNIQUE ("email");


--
-- Name: user_accounts user_accounts_id_number_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_accounts"
    ADD CONSTRAINT "user_accounts_id_number_key" UNIQUE ("id_number");


--
-- Name: user_accounts user_accounts_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_accounts"
    ADD CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id");


--
-- Name: user_accounts user_accounts_work_id_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_accounts"
    ADD CONSTRAINT "user_accounts_work_id_key" UNIQUE ("work_id");


--
-- Name: user_branch_assignments user_branch_assignments_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_user_profile_id_role_id_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_roles"
    ADD CONSTRAINT "user_roles_user_profile_id_role_id_key" UNIQUE ("user_profile_id", "role_id");


--
-- Name: user_warehouse_assignments user_warehouse_assignments_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_warehouse_assignments"
    ADD CONSTRAINT "user_warehouse_assignments_pkey" PRIMARY KEY ("id");


--
-- Name: users users_auth_id_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: users users_work_id_key; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."users"
    ADD CONSTRAINT "users_work_id_key" UNIQUE ("work_id");


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");


--
-- Name: wastage_records wastage_records_pkey; Type: CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."wastage_records"
    ADD CONSTRAINT "wastage_records_pkey" PRIMARY KEY ("id");


--
-- Name: idx_approval_actions_document; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_approval_actions_document" ON "icecream_erp"."approval_actions" USING "btree" ("document_type", "document_id", "acted_at" DESC);


--
-- Name: idx_approval_actions_request; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_approval_actions_request" ON "icecream_erp"."approval_actions" USING "btree" ("approval_request_id", "acted_at" DESC);


--
-- Name: idx_approval_requests_entity_lookup; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_approval_requests_entity_lookup" ON "icecream_erp"."approval_requests" USING "btree" ("entity_type", "entity_id", "status");


--
-- Name: idx_approval_requests_workflow_lookup; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_approval_requests_workflow_lookup" ON "icecream_erp"."approval_requests" USING "btree" ("organization_id", "module_name", "document_type", "status", "requested_by");


--
-- Name: idx_approval_workflow_steps_lookup; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_approval_workflow_steps_lookup" ON "icecream_erp"."approval_workflow_steps" USING "btree" ("workflow_id", "is_active", "approval_level");


--
-- Name: idx_approval_workflows_workflow_lookup; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_approval_workflows_workflow_lookup" ON "icecream_erp"."approval_workflows" USING "btree" ("organization_id", "module_name", "document_type", "action_name", "is_active");


--
-- Name: idx_audit_logs_user_profile_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_audit_logs_user_profile_id" ON "icecream_erp"."audit_logs" USING "btree" ("user_profile_id");


--
-- Name: idx_auth_sessions_expires_at; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_auth_sessions_expires_at" ON "icecream_erp"."auth_sessions" USING "btree" ("expires_at");


--
-- Name: idx_auth_sessions_token; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_auth_sessions_token" ON "icecream_erp"."auth_sessions" USING "btree" ("token");


--
-- Name: idx_auth_sessions_user_account_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_auth_sessions_user_account_id" ON "icecream_erp"."auth_sessions" USING "btree" ("user_account_id", "updated_at" DESC);


--
-- Name: idx_finished_goods_transfers_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_finished_goods_transfers_batch" ON "icecream_erp"."finished_goods_transfers" USING "btree" ("production_batch_id");


--
-- Name: idx_goods_received_note_items_grn_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_goods_received_note_items_grn_id" ON "icecream_erp"."goods_received_note_items" USING "btree" ("grn_id");


--
-- Name: idx_goods_received_note_items_item_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_goods_received_note_items_item_id" ON "icecream_erp"."goods_received_note_items" USING "btree" ("item_id");


--
-- Name: idx_goods_received_note_items_po_item_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_goods_received_note_items_po_item_id" ON "icecream_erp"."goods_received_note_items" USING "btree" ("po_item_id");


--
-- Name: idx_goods_received_notes_entry_mode; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_goods_received_notes_entry_mode" ON "icecream_erp"."goods_received_notes" USING "btree" ("organization_id", "entry_mode");


--
-- Name: idx_goods_received_notes_purchase_order_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_goods_received_notes_purchase_order_id" ON "icecream_erp"."goods_received_notes" USING "btree" ("purchase_order_id");


--
-- Name: idx_goods_received_notes_supplier_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_goods_received_notes_supplier_id" ON "icecream_erp"."goods_received_notes" USING "btree" ("supplier_id");


--
-- Name: idx_hr_production_worker_outputs_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_hr_production_worker_outputs_batch" ON "icecream_erp"."hr_production_worker_outputs" USING "btree" ("batch_id", "employee_id");


--
-- Name: idx_hr_production_worker_outputs_org_created; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_hr_production_worker_outputs_org_created" ON "icecream_erp"."hr_production_worker_outputs" USING "btree" ("organization_id", "created_at" DESC);


--
-- Name: idx_hr_production_worker_outputs_product; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_hr_production_worker_outputs_product" ON "icecream_erp"."hr_production_worker_outputs" USING "btree" ("product_id", "shift_name");


--
-- Name: idx_ice_audit_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_audit_org" ON "icecream_erp"."audit_logs" USING "btree" ("organization_id", "created_at");


--
-- Name: idx_ice_batch_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_batch_org" ON "icecream_erp"."production_batches" USING "btree" ("organization_id", "status");


--
-- Name: idx_ice_branch_sales; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_branch_sales" ON "icecream_erp"."branch_sales" USING "btree" ("branch_id", "sale_date");


--
-- Name: idx_ice_grn_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_grn_org" ON "icecream_erp"."goods_received_notes" USING "btree" ("organization_id", "status");


--
-- Name: idx_ice_items_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_items_org" ON "icecream_erp"."items" USING "btree" ("organization_id");


--
-- Name: idx_ice_po_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_po_org" ON "icecream_erp"."purchase_orders" USING "btree" ("organization_id", "status");


--
-- Name: idx_ice_so_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_so_org" ON "icecream_erp"."sales_orders" USING "btree" ("organization_id", "status");


--
-- Name: idx_ice_stock_bal; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_stock_bal" ON "icecream_erp"."stock_balances" USING "btree" ("item_id", "warehouse_id");


--
-- Name: idx_ice_stock_mov; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_ice_stock_mov" ON "icecream_erp"."stock_movements" USING "btree" ("organization_id", "created_at");


--
-- Name: idx_icecream_users_auth_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_icecream_users_auth_id" ON "icecream_erp"."users" USING "btree" ("auth_id");


--
-- Name: idx_icecream_users_work_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_icecream_users_work_id" ON "icecream_erp"."users" USING "btree" ("work_id");


--
-- Name: idx_invoices_sales_order; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_invoices_sales_order" ON "icecream_erp"."invoices" USING "btree" ("sales_order_id");


--
-- Name: idx_invoices_warehouse; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_invoices_warehouse" ON "icecream_erp"."invoices" USING "btree" ("warehouse_id");


--
-- Name: idx_login_attempts_ip; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_login_attempts_ip" ON "icecream_erp"."login_attempts" USING "btree" ("ip_address", "created_at" DESC);


--
-- Name: idx_login_attempts_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_login_attempts_user" ON "icecream_erp"."login_attempts" USING "btree" ("user_profile_id", "created_at" DESC);


--
-- Name: idx_login_attempts_work_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_login_attempts_work_id" ON "icecream_erp"."login_attempts" USING "btree" ("work_id", "created_at" DESC);


--
-- Name: idx_permissions_module; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_permissions_module" ON "icecream_erp"."permissions" USING "btree" ("module");


--
-- Name: idx_production_batch_materials_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_production_batch_materials_batch" ON "icecream_erp"."production_batch_materials" USING "btree" ("batch_id", "item_id");


--
-- Name: idx_production_batch_outputs_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_production_batch_outputs_batch" ON "icecream_erp"."production_batch_outputs" USING "btree" ("batch_id", "item_id");


--
-- Name: idx_production_cost_overrides_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_production_cost_overrides_batch" ON "icecream_erp"."production_cost_overrides" USING "btree" ("batch_id", "item_id");


--
-- Name: idx_production_plan_items_plan; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_production_plan_items_plan" ON "icecream_erp"."production_plan_items" USING "btree" ("production_plan_id");


--
-- Name: idx_production_stock_closures_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_production_stock_closures_batch" ON "icecream_erp"."production_stock_closures" USING "btree" ("batch_id", "closure_date");


--
-- Name: idx_production_worker_assignments_batch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_production_worker_assignments_batch" ON "icecream_erp"."production_worker_assignments" USING "btree" ("batch_id", "attendance_status");


--
-- Name: idx_purchase_order_items_purchase_order_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_purchase_order_items_purchase_order_id" ON "icecream_erp"."purchase_order_items" USING "btree" ("purchase_order_id");


--
-- Name: idx_purchase_orders_approver_user_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_purchase_orders_approver_user_id" ON "icecream_erp"."purchase_orders" USING "btree" ("approver_user_id");


--
-- Name: idx_purchase_orders_requisition_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_purchase_orders_requisition_id" ON "icecream_erp"."purchase_orders" USING "btree" ("requisition_id");


--
-- Name: idx_purchase_requisition_items_requisition_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_purchase_requisition_items_requisition_id" ON "icecream_erp"."purchase_requisition_items" USING "btree" ("requisition_id");


--
-- Name: idx_purchase_requisitions_approver_user_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_purchase_requisitions_approver_user_id" ON "icecream_erp"."purchase_requisitions" USING "btree" ("approver_user_id");


--
-- Name: idx_purchase_requisitions_requisition_number; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_purchase_requisitions_requisition_number" ON "icecream_erp"."purchase_requisitions" USING "btree" ("organization_id", "requisition_number") WHERE ("requisition_number" IS NOT NULL);


--
-- Name: idx_recipe_items_recipe; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_recipe_items_recipe" ON "icecream_erp"."recipe_items" USING "btree" ("recipe_id", "sort_order");


--
-- Name: idx_recipe_packaging_items_recipe; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_recipe_packaging_items_recipe" ON "icecream_erp"."recipe_packaging_items" USING "btree" ("recipe_id", "sort_order");


--
-- Name: idx_report_definitions_category; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_report_definitions_category" ON "icecream_erp"."report_definitions" USING "btree" ("category", "is_active");


--
-- Name: idx_report_definitions_unique; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_report_definitions_unique" ON "icecream_erp"."report_definitions" USING "btree" ("category", "report_code");


--
-- Name: idx_report_exports_type; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_report_exports_type" ON "icecream_erp"."report_exports" USING "btree" ("report_category", "report_type", "status");


--
-- Name: idx_report_exports_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_report_exports_user" ON "icecream_erp"."report_exports" USING "btree" ("user_profile_id", "exported_at" DESC);


--
-- Name: idx_report_run_histories_branch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_report_run_histories_branch" ON "icecream_erp"."report_run_histories" USING "btree" ("branch_id", "generated_at" DESC);


--
-- Name: idx_report_run_histories_type; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_report_run_histories_type" ON "icecream_erp"."report_run_histories" USING "btree" ("report_category", "report_type", "status");


--
-- Name: idx_report_run_histories_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_report_run_histories_user" ON "icecream_erp"."report_run_histories" USING "btree" ("user_profile_id", "generated_at" DESC);


--
-- Name: idx_role_permissions_permission_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_role_permissions_permission_id" ON "icecream_erp"."role_permissions" USING "btree" ("permission_id");


--
-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_role_permissions_role_id" ON "icecream_erp"."role_permissions" USING "btree" ("role_id");


--
-- Name: idx_roles_organization_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_roles_organization_id" ON "icecream_erp"."roles" USING "btree" ("organization_id");


--
-- Name: idx_saved_report_filters_type; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_saved_report_filters_type" ON "icecream_erp"."saved_report_filters" USING "btree" ("report_category", "report_type");


--
-- Name: idx_saved_report_filters_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_saved_report_filters_user" ON "icecream_erp"."saved_report_filters" USING "btree" ("user_profile_id", "created_at" DESC);


--
-- Name: idx_security_events_ip; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_security_events_ip" ON "icecream_erp"."security_events" USING "btree" ("ip_address", "created_at" DESC);


--
-- Name: idx_security_events_org; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_security_events_org" ON "icecream_erp"."security_events" USING "btree" ("organization_id", "created_at" DESC);


--
-- Name: idx_security_events_type; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_security_events_type" ON "icecream_erp"."security_events" USING "btree" ("event_type", "created_at" DESC);


--
-- Name: idx_security_events_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_security_events_user" ON "icecream_erp"."security_events" USING "btree" ("user_profile_id", "created_at" DESC);


--
-- Name: idx_session_activities_token; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_session_activities_token" ON "icecream_erp"."session_activities" USING "btree" ("session_token", "created_at" DESC);


--
-- Name: idx_session_activities_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_session_activities_user" ON "icecream_erp"."session_activities" USING "btree" ("user_profile_id", "created_at" DESC);


--
-- Name: idx_stock_movements_reference_guard; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_stock_movements_reference_guard" ON "icecream_erp"."stock_movements" USING "btree" ("reference_type", "reference_id", "movement_type", "warehouse_id", "item_id") WHERE (("reference_type" IS NOT NULL) AND ("reference_id" IS NOT NULL));


--
-- Name: idx_stock_transfers_org_transfer_number_unique; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_stock_transfers_org_transfer_number_unique" ON "icecream_erp"."stock_transfers" USING "btree" ("organization_id", "transfer_number");


--
-- Name: idx_supplier_invoice_items_invoice; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_invoice_items_invoice" ON "icecream_erp"."supplier_invoice_items" USING "btree" ("supplier_invoice_id");


--
-- Name: idx_supplier_invoice_items_item; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_invoice_items_item" ON "icecream_erp"."supplier_invoice_items" USING "btree" ("item_id");


--
-- Name: idx_supplier_invoices_number; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_supplier_invoices_number" ON "icecream_erp"."supplier_invoices" USING "btree" ("organization_id", "invoice_number");


--
-- Name: idx_supplier_invoices_purchase_order; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_invoices_purchase_order" ON "icecream_erp"."supplier_invoices" USING "btree" ("purchase_order_id");


--
-- Name: idx_supplier_invoices_status; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_invoices_status" ON "icecream_erp"."supplier_invoices" USING "btree" ("organization_id", "status", "invoice_date");


--
-- Name: idx_supplier_invoices_supplier; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_invoices_supplier" ON "icecream_erp"."supplier_invoices" USING "btree" ("supplier_id");


--
-- Name: idx_supplier_payments_date; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_payments_date" ON "icecream_erp"."supplier_payments" USING "btree" ("organization_id", "payment_date");


--
-- Name: idx_supplier_payments_invoice; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_payments_invoice" ON "icecream_erp"."supplier_payments" USING "btree" ("supplier_invoice_id");


--
-- Name: idx_supplier_payments_supplier; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_payments_supplier" ON "icecream_erp"."supplier_payments" USING "btree" ("supplier_id");


--
-- Name: idx_supplier_return_items_item; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_return_items_item" ON "icecream_erp"."supplier_return_items" USING "btree" ("item_id");


--
-- Name: idx_supplier_return_items_return; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_return_items_return" ON "icecream_erp"."supplier_return_items" USING "btree" ("supplier_return_id");


--
-- Name: idx_supplier_returns_number; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_supplier_returns_number" ON "icecream_erp"."supplier_returns" USING "btree" ("organization_id", "return_number");


--
-- Name: idx_supplier_returns_status; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_returns_status" ON "icecream_erp"."supplier_returns" USING "btree" ("organization_id", "status");


--
-- Name: idx_supplier_returns_supplier; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_supplier_returns_supplier" ON "icecream_erp"."supplier_returns" USING "btree" ("supplier_id", "return_date");


--
-- Name: idx_system_settings_module; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_system_settings_module" ON "icecream_erp"."system_settings" USING "btree" ("organization_id", "module_name", "is_active");


--
-- Name: idx_system_settings_unique_key; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_system_settings_unique_key" ON "icecream_erp"."system_settings" USING "btree" ("setting_key");


--
-- Name: idx_user_branch_assignments_branch; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_user_branch_assignments_branch" ON "icecream_erp"."user_branch_assignments" USING "btree" ("branch_id", "is_active");


--
-- Name: idx_user_branch_assignments_unique_active; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_user_branch_assignments_unique_active" ON "icecream_erp"."user_branch_assignments" USING "btree" ("user_profile_id", "branch_id");


--
-- Name: idx_user_branch_assignments_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_user_branch_assignments_user" ON "icecream_erp"."user_branch_assignments" USING "btree" ("user_profile_id", "is_active");


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_user_roles_role_id" ON "icecream_erp"."user_roles" USING "btree" ("role_id");


--
-- Name: idx_user_roles_user_profile_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_user_roles_user_profile_id" ON "icecream_erp"."user_roles" USING "btree" ("user_profile_id");


--
-- Name: idx_user_warehouse_assignments_unique_active; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_user_warehouse_assignments_unique_active" ON "icecream_erp"."user_warehouse_assignments" USING "btree" ("user_profile_id", "warehouse_id");


--
-- Name: idx_user_warehouse_assignments_user; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_user_warehouse_assignments_user" ON "icecream_erp"."user_warehouse_assignments" USING "btree" ("user_profile_id", "is_active");


--
-- Name: idx_user_warehouse_assignments_warehouse; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_user_warehouse_assignments_warehouse" ON "icecream_erp"."user_warehouse_assignments" USING "btree" ("warehouse_id", "is_active");


--
-- Name: idx_users_failed_login_attempts; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_users_failed_login_attempts" ON "icecream_erp"."users" USING "btree" ("failed_login_attempts");


--
-- Name: idx_users_locked_until; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_users_locked_until" ON "icecream_erp"."users" USING "btree" ("locked_until");


--
-- Name: idx_users_user_account_id; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE INDEX "idx_users_user_account_id" ON "icecream_erp"."users" USING "btree" ("user_account_id");


--
-- Name: idx_warehouses_org_code_unique; Type: INDEX; Schema: icecream_erp; Owner: supabase_admin
--

CREATE UNIQUE INDEX "idx_warehouses_org_code_unique" ON "icecream_erp"."warehouses" USING "btree" ("organization_id", "code");


--
-- Name: audit_logs trg_sync_audit_logs_compat; Type: TRIGGER; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TRIGGER "trg_sync_audit_logs_compat" BEFORE INSERT OR UPDATE ON "icecream_erp"."audit_logs" FOR EACH ROW EXECUTE FUNCTION "icecream_erp"."sync_audit_logs_compat"();


--
-- Name: production_batch_outputs trg_sync_production_batch_outputs_compat; Type: TRIGGER; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TRIGGER "trg_sync_production_batch_outputs_compat" BEFORE INSERT OR UPDATE ON "icecream_erp"."production_batch_outputs" FOR EACH ROW EXECUTE FUNCTION "icecream_erp"."sync_production_batch_outputs_compat"();


--
-- Name: production_batches trg_sync_production_batches_compat; Type: TRIGGER; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TRIGGER "trg_sync_production_batches_compat" BEFORE INSERT OR UPDATE ON "icecream_erp"."production_batches" FOR EACH ROW EXECUTE FUNCTION "icecream_erp"."sync_production_batches_compat"();


--
-- Name: stock_transfer_items trg_sync_stock_transfer_items_compat; Type: TRIGGER; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TRIGGER "trg_sync_stock_transfer_items_compat" BEFORE INSERT OR UPDATE ON "icecream_erp"."stock_transfer_items" FOR EACH ROW EXECUTE FUNCTION "icecream_erp"."sync_stock_transfer_items_compat"();


--
-- Name: stock_transfers trg_sync_stock_transfers_compat; Type: TRIGGER; Schema: icecream_erp; Owner: supabase_admin
--

CREATE TRIGGER "trg_sync_stock_transfers_compat" BEFORE INSERT OR UPDATE ON "icecream_erp"."stock_transfers" FOR EACH ROW EXECUTE FUNCTION "icecream_erp"."sync_stock_transfers_compat"();


--
-- Name: accounts accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."accounts"
    ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: accounts accounts_parent_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."accounts"
    ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "icecream_erp"."accounts"("id");


--
-- Name: approval_actions approval_actions_action_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_actions"
    ADD CONSTRAINT "approval_actions_action_by_fkey" FOREIGN KEY ("action_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: approval_actions approval_actions_approval_request_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_actions"
    ADD CONSTRAINT "approval_actions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "icecream_erp"."approval_requests"("id") ON DELETE CASCADE;


--
-- Name: approval_actions approval_actions_role_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_actions"
    ADD CONSTRAINT "approval_actions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "icecream_erp"."roles"("id") ON DELETE SET NULL;


--
-- Name: approval_requests approval_requests_approver_role_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_approver_role_id_fkey" FOREIGN KEY ("approver_role_id") REFERENCES "icecream_erp"."roles"("id") ON DELETE SET NULL;


--
-- Name: approval_requests approval_requests_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: approval_requests approval_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id") ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_rejected_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: approval_requests approval_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "icecream_erp"."users"("id") ON DELETE RESTRICT;


--
-- Name: approval_requests approval_requests_submitted_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: approval_requests approval_requests_workflow_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_requests"
    ADD CONSTRAINT "approval_requests_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "icecream_erp"."approval_workflows"("id") ON DELETE SET NULL;


--
-- Name: approval_workflow_steps approval_workflow_steps_role_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflow_steps"
    ADD CONSTRAINT "approval_workflow_steps_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "icecream_erp"."roles"("id") ON DELETE SET NULL;


--
-- Name: approval_workflow_steps approval_workflow_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflow_steps"
    ADD CONSTRAINT "approval_workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "icecream_erp"."approval_workflows"("id") ON DELETE CASCADE;


--
-- Name: approval_workflows approval_workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflows"
    ADD CONSTRAINT "approval_workflows_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: approval_workflows approval_workflows_deleted_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflows"
    ADD CONSTRAINT "approval_workflows_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: approval_workflows approval_workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflows"
    ADD CONSTRAINT "approval_workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id") ON DELETE CASCADE;


--
-- Name: approval_workflows approval_workflows_updated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."approval_workflows"
    ADD CONSTRAINT "approval_workflows_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: attendances attendances_employee_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."attendances"
    ADD CONSTRAINT "attendances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "icecream_erp"."employees"("id");


--
-- Name: attendances attendances_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."attendances"
    ADD CONSTRAINT "attendances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: audit_logs audit_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: audit_logs audit_logs_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: batch_material_usage batch_material_usage_batch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."batch_material_usage"
    ADD CONSTRAINT "batch_material_usage_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "icecream_erp"."production_batches"("id") ON DELETE CASCADE;


--
-- Name: batch_material_usage batch_material_usage_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."batch_material_usage"
    ADD CONSTRAINT "batch_material_usage_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: batch_worker_output batch_worker_output_batch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."batch_worker_output"
    ADD CONSTRAINT "batch_worker_output_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "icecream_erp"."production_batches"("id") ON DELETE CASCADE;


--
-- Name: batch_worker_output batch_worker_output_worker_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."batch_worker_output"
    ADD CONSTRAINT "batch_worker_output_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: branch_sales branch_sales_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_sales"
    ADD CONSTRAINT "branch_sales_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id");


--
-- Name: branch_sales branch_sales_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_sales"
    ADD CONSTRAINT "branch_sales_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: branch_sales branch_sales_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_sales"
    ADD CONSTRAINT "branch_sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: branch_sales branch_sales_served_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_sales"
    ADD CONSTRAINT "branch_sales_served_by_fkey" FOREIGN KEY ("served_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: branch_shift_closes branch_shift_closes_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_shift_closes"
    ADD CONSTRAINT "branch_shift_closes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: branch_shift_closes branch_shift_closes_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_shift_closes"
    ADD CONSTRAINT "branch_shift_closes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id");


--
-- Name: branch_shift_closes branch_shift_closes_closed_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_shift_closes"
    ADD CONSTRAINT "branch_shift_closes_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: branch_shift_closes branch_shift_closes_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branch_shift_closes"
    ADD CONSTRAINT "branch_shift_closes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: branches branches_manager_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branches"
    ADD CONSTRAINT "branches_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: branches branches_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."branches"
    ADD CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: budget_lines budget_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."budget_lines"
    ADD CONSTRAINT "budget_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "icecream_erp"."accounts"("id");


--
-- Name: budget_lines budget_lines_budget_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."budget_lines"
    ADD CONSTRAINT "budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "icecream_erp"."budgets"("id") ON DELETE CASCADE;


--
-- Name: budgets budgets_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."budgets"
    ADD CONSTRAINT "budgets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: budgets budgets_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."budgets"
    ADD CONSTRAINT "budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: customers customers_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."customers"
    ADD CONSTRAINT "customers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."customers"
    ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: employees employees_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."employees"
    ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id");


--
-- Name: employees employees_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."employees"
    ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: goods_received_note_items goods_received_note_items_goods_received_note_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_note_items"
    ADD CONSTRAINT "goods_received_note_items_goods_received_note_id_fkey" FOREIGN KEY ("goods_received_note_id") REFERENCES "icecream_erp"."goods_received_notes"("id") ON DELETE CASCADE;


--
-- Name: goods_received_note_items goods_received_note_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_note_items"
    ADD CONSTRAINT "goods_received_note_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "icecream_erp"."goods_received_notes"("id") ON DELETE CASCADE;


--
-- Name: goods_received_note_items goods_received_note_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_note_items"
    ADD CONSTRAINT "goods_received_note_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: goods_received_note_items goods_received_note_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_note_items"
    ADD CONSTRAINT "goods_received_note_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "icecream_erp"."purchase_order_items"("id");


--
-- Name: goods_received_note_items goods_received_note_items_purchase_order_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_note_items"
    ADD CONSTRAINT "goods_received_note_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "icecream_erp"."purchase_order_items"("id");


--
-- Name: goods_received_notes goods_received_notes_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: goods_received_notes goods_received_notes_po_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "icecream_erp"."purchase_orders"("id");


--
-- Name: goods_received_notes goods_received_notes_received_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: goods_received_notes goods_received_notes_supplier_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "icecream_erp"."suppliers"("id");


--
-- Name: goods_received_notes goods_received_notes_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."goods_received_notes"
    ADD CONSTRAINT "goods_received_notes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: grn_items grn_items_grn_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."grn_items"
    ADD CONSTRAINT "grn_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "icecream_erp"."goods_received_notes"("id") ON DELETE CASCADE;


--
-- Name: grn_items grn_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."grn_items"
    ADD CONSTRAINT "grn_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: grn_items grn_items_po_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."grn_items"
    ADD CONSTRAINT "grn_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "icecream_erp"."purchase_order_items"("id");


--
-- Name: hr_production_worker_outputs hr_production_worker_outputs_batch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."hr_production_worker_outputs"
    ADD CONSTRAINT "hr_production_worker_outputs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "icecream_erp"."production_batches"("id");


--
-- Name: hr_production_worker_outputs hr_production_worker_outputs_employee_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."hr_production_worker_outputs"
    ADD CONSTRAINT "hr_production_worker_outputs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "icecream_erp"."employees"("id");


--
-- Name: hr_production_worker_outputs hr_production_worker_outputs_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."hr_production_worker_outputs"
    ADD CONSTRAINT "hr_production_worker_outputs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: hr_production_worker_outputs hr_production_worker_outputs_product_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."hr_production_worker_outputs"
    ADD CONSTRAINT "hr_production_worker_outputs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."invoices"
    ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "icecream_erp"."customers"("id");


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "icecream_erp"."sales_orders"("id");


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."invoices"
    ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: item_categories item_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."item_categories"
    ADD CONSTRAINT "item_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: items items_category_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."items"
    ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "icecream_erp"."item_categories"("id");


--
-- Name: items items_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."items"
    ADD CONSTRAINT "items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: items items_unit_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."items"
    ADD CONSTRAINT "items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "icecream_erp"."units_of_measure"("id");


--
-- Name: journal_entries journal_entries_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_entries"
    ADD CONSTRAINT "journal_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: journal_entries journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_entries"
    ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: journal_entries journal_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_entries"
    ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: journal_lines journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_lines"
    ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "icecream_erp"."accounts"("id");


--
-- Name: journal_lines journal_lines_entry_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."journal_lines"
    ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "icecream_erp"."journal_entries"("id") ON DELETE CASCADE;


--
-- Name: login_attempts login_attempts_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."login_attempts"
    ADD CONSTRAINT "login_attempts_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: machines machines_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."machines"
    ADD CONSTRAINT "machines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: maintenance_records maintenance_records_machine_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."maintenance_records"
    ADD CONSTRAINT "maintenance_records_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "icecream_erp"."machines"("id");


--
-- Name: maintenance_records maintenance_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."maintenance_records"
    ADD CONSTRAINT "maintenance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: payroll_records payroll_records_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."payroll_records"
    ADD CONSTRAINT "payroll_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: payroll_records payroll_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."payroll_records"
    ADD CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "icecream_erp"."employees"("id");


--
-- Name: payroll_records payroll_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."payroll_records"
    ADD CONSTRAINT "payroll_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: production_batches production_batches_closed_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: production_batches production_batches_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: production_batches production_batches_recipe_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "icecream_erp"."recipes"("id");


--
-- Name: production_batches production_batches_started_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: production_batches production_batches_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."production_batches"
    ADD CONSTRAINT "production_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: purchase_order_items purchase_order_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: purchase_order_items purchase_order_items_po_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "icecream_erp"."purchase_orders"("id") ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: purchase_orders purchase_orders_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "icecream_erp"."users"("id");


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: purchase_orders purchase_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: purchase_orders purchase_orders_pr_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "icecream_erp"."purchase_requisitions"("id");


--
-- Name: purchase_orders purchase_orders_rejected_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "icecream_erp"."users"("id");


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "icecream_erp"."suppliers"("id");


--
-- Name: purchase_requisition_items purchase_requisition_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisition_items"
    ADD CONSTRAINT "purchase_requisition_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: purchase_requisition_items purchase_requisition_items_pr_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisition_items"
    ADD CONSTRAINT "purchase_requisition_items_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "icecream_erp"."purchase_requisitions"("id") ON DELETE CASCADE;


--
-- Name: purchase_requisitions purchase_requisitions_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: purchase_requisitions purchase_requisitions_approver_user_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "icecream_erp"."users"("id");


--
-- Name: purchase_requisitions purchase_requisitions_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: purchase_requisitions purchase_requisitions_rejected_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "icecream_erp"."users"("id");


--
-- Name: purchase_requisitions purchase_requisitions_requested_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."purchase_requisitions"
    ADD CONSTRAINT "purchase_requisitions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: quality_checks quality_checks_checked_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."quality_checks"
    ADD CONSTRAINT "quality_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: quality_checks quality_checks_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."quality_checks"
    ADD CONSTRAINT "quality_checks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: quality_checks quality_checks_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."quality_checks"
    ADD CONSTRAINT "quality_checks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: recipe_ingredients recipe_ingredients_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "icecream_erp"."recipes"("id") ON DELETE CASCADE;


--
-- Name: recipe_ingredients recipe_ingredients_unit_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipe_ingredients"
    ADD CONSTRAINT "recipe_ingredients_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "icecream_erp"."units_of_measure"("id");


--
-- Name: recipes recipes_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: recipes recipes_batch_unit_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_batch_unit_id_fkey" FOREIGN KEY ("batch_unit_id") REFERENCES "icecream_erp"."units_of_measure"("id");


--
-- Name: recipes recipes_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: recipes recipes_finished_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_finished_item_id_fkey" FOREIGN KEY ("finished_item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: recipes recipes_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."recipes"
    ADD CONSTRAINT "recipes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: report_definitions report_definitions_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_definitions"
    ADD CONSTRAINT "report_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: report_definitions report_definitions_updated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_definitions"
    ADD CONSTRAINT "report_definitions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: report_exports report_exports_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_exports"
    ADD CONSTRAINT "report_exports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id") ON DELETE SET NULL;


--
-- Name: report_exports report_exports_exported_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_exports"
    ADD CONSTRAINT "report_exports_exported_by_fkey" FOREIGN KEY ("exported_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: report_exports report_exports_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_exports"
    ADD CONSTRAINT "report_exports_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE CASCADE;


--
-- Name: report_run_histories report_run_histories_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_run_histories"
    ADD CONSTRAINT "report_run_histories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id") ON DELETE SET NULL;


--
-- Name: report_run_histories report_run_histories_generated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_run_histories"
    ADD CONSTRAINT "report_run_histories_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: report_run_histories report_run_histories_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."report_run_histories"
    ADD CONSTRAINT "report_run_histories_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "icecream_erp"."permissions"("id") ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "icecream_erp"."roles"("id") ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."roles"
    ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: sales_order_items sales_order_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: sales_order_items sales_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "icecream_erp"."sales_orders"("id") ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id");


--
-- Name: sales_orders sales_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: sales_orders sales_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "icecream_erp"."customers"("id");


--
-- Name: sales_orders sales_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: sales_orders sales_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."sales_orders"
    ADD CONSTRAINT "sales_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: saved_report_filters saved_report_filters_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."saved_report_filters"
    ADD CONSTRAINT "saved_report_filters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: saved_report_filters saved_report_filters_updated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."saved_report_filters"
    ADD CONSTRAINT "saved_report_filters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: saved_report_filters saved_report_filters_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."saved_report_filters"
    ADD CONSTRAINT "saved_report_filters_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE CASCADE;


--
-- Name: security_events security_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."security_events"
    ADD CONSTRAINT "security_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id") ON DELETE SET NULL;


--
-- Name: security_events security_events_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."security_events"
    ADD CONSTRAINT "security_events_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: session_activities session_activities_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."session_activities"
    ADD CONSTRAINT "session_activities_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: stock_balances stock_balances_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_balances"
    ADD CONSTRAINT "stock_balances_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: stock_balances stock_balances_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_balances"
    ADD CONSTRAINT "stock_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: stock_balances stock_balances_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_balances"
    ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: stock_movements stock_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_movements"
    ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: stock_movements stock_movements_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_movements"
    ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: stock_transfer_items stock_transfer_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: stock_transfer_items stock_transfer_items_transfer_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfer_items"
    ADD CONSTRAINT "stock_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "icecream_erp"."stock_transfers"("id") ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_approved_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: stock_transfers stock_transfers_from_warehouse_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_from_warehouse_fkey" FOREIGN KEY ("from_warehouse") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: stock_transfers stock_transfers_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "icecream_erp"."warehouses"("id") NOT VALID;


--
-- Name: stock_transfers stock_transfers_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: stock_transfers stock_transfers_requested_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: stock_transfers stock_transfers_to_warehouse_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_to_warehouse_fkey" FOREIGN KEY ("to_warehouse") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: stock_transfers stock_transfers_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."stock_transfers"
    ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "icecream_erp"."warehouses"("id") NOT VALID;


--
-- Name: supplier_categories supplier_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_categories"
    ADD CONSTRAINT "supplier_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: supplier_invoice_items supplier_invoice_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: supplier_invoice_items supplier_invoice_items_supplier_invoice_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoice_items"
    ADD CONSTRAINT "supplier_invoice_items_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "icecream_erp"."supplier_invoices"("id") ON DELETE CASCADE;


--
-- Name: supplier_invoices supplier_invoices_goods_received_note_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_goods_received_note_id_fkey" FOREIGN KEY ("goods_received_note_id") REFERENCES "icecream_erp"."goods_received_notes"("id");


--
-- Name: supplier_invoices supplier_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: supplier_invoices supplier_invoices_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "icecream_erp"."purchase_orders"("id");


--
-- Name: supplier_invoices supplier_invoices_supplier_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_invoices"
    ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "icecream_erp"."suppliers"("id");


--
-- Name: supplier_payments supplier_payments_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: supplier_payments supplier_payments_supplier_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "icecream_erp"."suppliers"("id");


--
-- Name: supplier_payments supplier_payments_supplier_invoice_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_payments"
    ADD CONSTRAINT "supplier_payments_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "icecream_erp"."supplier_invoices"("id");


--
-- Name: supplier_return_items supplier_return_items_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: supplier_return_items supplier_return_items_supplier_return_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_return_items"
    ADD CONSTRAINT "supplier_return_items_supplier_return_id_fkey" FOREIGN KEY ("supplier_return_id") REFERENCES "icecream_erp"."supplier_returns"("id") ON DELETE CASCADE;


--
-- Name: supplier_returns supplier_returns_grn_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "icecream_erp"."goods_received_notes"("id");


--
-- Name: supplier_returns supplier_returns_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: supplier_returns supplier_returns_supplier_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."supplier_returns"
    ADD CONSTRAINT "supplier_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "icecream_erp"."suppliers"("id");


--
-- Name: suppliers suppliers_category_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."suppliers"
    ADD CONSTRAINT "suppliers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "icecream_erp"."supplier_categories"("id");


--
-- Name: suppliers suppliers_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."suppliers"
    ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: system_settings system_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."system_settings"
    ADD CONSTRAINT "system_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: system_settings system_settings_deactivated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."system_settings"
    ADD CONSTRAINT "system_settings_deactivated_by_fkey" FOREIGN KEY ("deactivated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: system_settings system_settings_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."system_settings"
    ADD CONSTRAINT "system_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id") ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: units_of_measure units_of_measure_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."units_of_measure"
    ADD CONSTRAINT "units_of_measure_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: user_accounts user_accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_accounts"
    ADD CONSTRAINT "user_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: user_accounts user_accounts_role_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_accounts"
    ADD CONSTRAINT "user_accounts_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "icecream_erp"."roles"("id");


--
-- Name: user_branch_assignments user_branch_assignments_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id") ON DELETE CASCADE;


--
-- Name: user_branch_assignments user_branch_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: user_branch_assignments user_branch_assignments_updated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: user_branch_assignments user_branch_assignments_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_branch_assignments"
    ADD CONSTRAINT "user_branch_assignments_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "icecream_erp"."roles"("id") ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_roles"
    ADD CONSTRAINT "user_roles_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE CASCADE;


--
-- Name: user_warehouse_assignments user_warehouse_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_warehouse_assignments"
    ADD CONSTRAINT "user_warehouse_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: user_warehouse_assignments user_warehouse_assignments_updated_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_warehouse_assignments"
    ADD CONSTRAINT "user_warehouse_assignments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: user_warehouse_assignments user_warehouse_assignments_user_profile_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_warehouse_assignments"
    ADD CONSTRAINT "user_warehouse_assignments_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "icecream_erp"."users"("id") ON DELETE CASCADE;


--
-- Name: user_warehouse_assignments user_warehouse_assignments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."user_warehouse_assignments"
    ADD CONSTRAINT "user_warehouse_assignments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id") ON DELETE CASCADE;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."users"
    ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "icecream_erp"."users"("id") ON DELETE SET NULL;


--
-- Name: warehouses warehouses_branch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."warehouses"
    ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "icecream_erp"."branches"("id");


--
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."warehouses"
    ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: wastage_records wastage_records_batch_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."wastage_records"
    ADD CONSTRAINT "wastage_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "icecream_erp"."production_batches"("id");


--
-- Name: wastage_records wastage_records_item_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."wastage_records"
    ADD CONSTRAINT "wastage_records_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "icecream_erp"."items"("id");


--
-- Name: wastage_records wastage_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."wastage_records"
    ADD CONSTRAINT "wastage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "icecream_erp"."organizations"("id");


--
-- Name: wastage_records wastage_records_recorded_by_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."wastage_records"
    ADD CONSTRAINT "wastage_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "icecream_erp"."user_accounts"("id");


--
-- Name: wastage_records wastage_records_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE ONLY "icecream_erp"."wastage_records"
    ADD CONSTRAINT "wastage_records_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "icecream_erp"."warehouses"("id");


--
-- Name: accounts; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_actions; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."approval_actions" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_actions approval_actions_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_actions_deny_anon" ON "icecream_erp"."approval_actions" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: approval_actions approval_actions_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_actions_service_role_full_access" ON "icecream_erp"."approval_actions" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: approval_requests; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."approval_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_requests approval_requests_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_requests_deny_anon" ON "icecream_erp"."approval_requests" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: approval_requests approval_requests_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_requests_service_role_full_access" ON "icecream_erp"."approval_requests" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: approval_workflow_steps; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."approval_workflow_steps" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_workflow_steps approval_workflow_steps_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_workflow_steps_deny_anon" ON "icecream_erp"."approval_workflow_steps" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: approval_workflow_steps approval_workflow_steps_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_workflow_steps_service_role_full_access" ON "icecream_erp"."approval_workflow_steps" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: approval_workflows; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."approval_workflows" ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_workflows approval_workflows_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_workflows_deny_anon" ON "icecream_erp"."approval_workflows" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: approval_workflows approval_workflows_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "approval_workflows_service_role_full_access" ON "icecream_erp"."approval_workflows" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: attendances; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."attendances" ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."audit_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_sessions; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."auth_sessions" ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_sessions auth_sessions_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "auth_sessions_deny_anon" ON "icecream_erp"."auth_sessions" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: auth_sessions auth_sessions_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "auth_sessions_service_role_full_access" ON "icecream_erp"."auth_sessions" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: users authenticated_read_own; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "authenticated_read_own" ON "icecream_erp"."users" FOR SELECT TO "authenticated" USING (("auth_id" = "auth"."uid"()));


--
-- Name: permissions authenticated_read_permissions; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "authenticated_read_permissions" ON "icecream_erp"."permissions" FOR SELECT TO "authenticated" USING (true);


--
-- Name: roles authenticated_read_roles; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "authenticated_read_roles" ON "icecream_erp"."roles" FOR SELECT TO "authenticated" USING (true);


--
-- Name: batch_material_usage; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."batch_material_usage" ENABLE ROW LEVEL SECURITY;

--
-- Name: batch_worker_output; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."batch_worker_output" ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_sales; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."branch_sales" ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_shift_closes; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."branch_shift_closes" ENABLE ROW LEVEL SECURITY;

--
-- Name: branches; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."branches" ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_lines; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."budget_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: budgets; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."budgets" ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."customers" ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."accounts" TO "anon" USING (false);


--
-- Name: attendances deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."attendances" TO "anon" USING (false);


--
-- Name: audit_logs deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."audit_logs" TO "anon" USING (false);


--
-- Name: batch_material_usage deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."batch_material_usage" TO "anon" USING (false);


--
-- Name: batch_worker_output deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."batch_worker_output" TO "anon" USING (false);


--
-- Name: branch_sales deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."branch_sales" TO "anon" USING (false);


--
-- Name: branch_shift_closes deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."branch_shift_closes" TO "anon" USING (false);


--
-- Name: branches deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."branches" TO "anon" USING (false);


--
-- Name: budget_lines deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."budget_lines" TO "anon" USING (false);


--
-- Name: budgets deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."budgets" TO "anon" USING (false);


--
-- Name: customers deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."customers" TO "anon" USING (false);


--
-- Name: employees deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."employees" TO "anon" USING (false);


--
-- Name: goods_received_notes deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."goods_received_notes" TO "anon" USING (false);


--
-- Name: grn_items deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."grn_items" TO "anon" USING (false);


--
-- Name: invoices deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."invoices" TO "anon" USING (false);


--
-- Name: item_categories deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."item_categories" TO "anon" USING (false);


--
-- Name: items deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."items" TO "anon" USING (false);


--
-- Name: journal_entries deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."journal_entries" TO "anon" USING (false);


--
-- Name: journal_lines deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."journal_lines" TO "anon" USING (false);


--
-- Name: machines deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."machines" TO "anon" USING (false);


--
-- Name: maintenance_records deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."maintenance_records" TO "anon" USING (false);


--
-- Name: notifications deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."notifications" TO "anon" USING (false);


--
-- Name: organizations deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."organizations" TO "anon" USING (false);


--
-- Name: payroll_records deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."payroll_records" TO "anon" USING (false);


--
-- Name: production_batches deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."production_batches" TO "anon" USING (false);


--
-- Name: purchase_order_items deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."purchase_order_items" TO "anon" USING (false);


--
-- Name: purchase_orders deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."purchase_orders" TO "anon" USING (false);


--
-- Name: purchase_requisition_items deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."purchase_requisition_items" TO "anon" USING (false);


--
-- Name: purchase_requisitions deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."purchase_requisitions" TO "anon" USING (false);


--
-- Name: quality_checks deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."quality_checks" TO "anon" USING (false);


--
-- Name: recipe_ingredients deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."recipe_ingredients" TO "anon" USING (false);


--
-- Name: recipes deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."recipes" TO "anon" USING (false);


--
-- Name: roles deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."roles" TO "anon" USING (false);


--
-- Name: sales_order_items deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."sales_order_items" TO "anon" USING (false);


--
-- Name: sales_orders deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."sales_orders" TO "anon" USING (false);


--
-- Name: stock_balances deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."stock_balances" TO "anon" USING (false);


--
-- Name: stock_movements deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."stock_movements" TO "anon" USING (false);


--
-- Name: stock_transfer_items deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."stock_transfer_items" TO "anon" USING (false);


--
-- Name: stock_transfers deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."stock_transfers" TO "anon" USING (false);


--
-- Name: supplier_categories deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."supplier_categories" TO "anon" USING (false);


--
-- Name: suppliers deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."suppliers" TO "anon" USING (false);


--
-- Name: units_of_measure deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."units_of_measure" TO "anon" USING (false);


--
-- Name: user_accounts deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."user_accounts" TO "anon" USING (false);


--
-- Name: users deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."users" TO "anon" USING (false);


--
-- Name: warehouses deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."warehouses" TO "anon" USING (false);


--
-- Name: wastage_records deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "deny_anon" ON "icecream_erp"."wastage_records" TO "anon" USING (false);


--
-- Name: employees; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."employees" ENABLE ROW LEVEL SECURITY;

--
-- Name: goods_received_notes; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."goods_received_notes" ENABLE ROW LEVEL SECURITY;

--
-- Name: grn_items; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."grn_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."invoices" ENABLE ROW LEVEL SECURITY;

--
-- Name: item_categories; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."item_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: items; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."items" ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entries; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."journal_entries" ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_lines; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."journal_lines" ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."login_attempts" ENABLE ROW LEVEL SECURITY;

--
-- Name: login_attempts login_attempts_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "login_attempts_deny_anon" ON "icecream_erp"."login_attempts" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: login_attempts login_attempts_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "login_attempts_service_role_full_access" ON "icecream_erp"."login_attempts" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: machines; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."machines" ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_records; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."maintenance_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."organizations" ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_records; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."payroll_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: permissions; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: production_batches; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."production_batches" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."purchase_order_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."purchase_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_requisition_items; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."purchase_requisition_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_requisitions; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."purchase_requisitions" ENABLE ROW LEVEL SECURITY;

--
-- Name: quality_checks; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."quality_checks" ENABLE ROW LEVEL SECURITY;

--
-- Name: recipe_ingredients; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."recipe_ingredients" ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."recipes" ENABLE ROW LEVEL SECURITY;

--
-- Name: report_definitions; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."report_definitions" ENABLE ROW LEVEL SECURITY;

--
-- Name: report_definitions report_definitions_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "report_definitions_deny_anon" ON "icecream_erp"."report_definitions" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: report_definitions report_definitions_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "report_definitions_service_role_full_access" ON "icecream_erp"."report_definitions" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: report_exports; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."report_exports" ENABLE ROW LEVEL SECURITY;

--
-- Name: report_exports report_exports_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "report_exports_deny_anon" ON "icecream_erp"."report_exports" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: report_exports report_exports_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "report_exports_service_role_full_access" ON "icecream_erp"."report_exports" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: report_run_histories; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."report_run_histories" ENABLE ROW LEVEL SECURITY;

--
-- Name: report_run_histories report_run_histories_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "report_run_histories_deny_anon" ON "icecream_erp"."report_run_histories" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: report_run_histories report_run_histories_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "report_run_histories_service_role_full_access" ON "icecream_erp"."report_run_histories" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."role_permissions" ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_order_items; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."sales_order_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: sales_orders; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."sales_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_report_filters; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."saved_report_filters" ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_report_filters saved_report_filters_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "saved_report_filters_deny_anon" ON "icecream_erp"."saved_report_filters" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: saved_report_filters saved_report_filters_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "saved_report_filters_service_role_full_access" ON "icecream_erp"."saved_report_filters" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: security_events; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."security_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: security_events security_events_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "security_events_deny_anon" ON "icecream_erp"."security_events" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: security_events security_events_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "security_events_service_role_full_access" ON "icecream_erp"."security_events" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: accounts service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."accounts" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: attendances service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."attendances" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: audit_logs service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."audit_logs" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: batch_material_usage service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."batch_material_usage" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: batch_worker_output service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."batch_worker_output" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: branch_sales service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."branch_sales" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: branch_shift_closes service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."branch_shift_closes" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: branches service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."branches" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: budget_lines service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."budget_lines" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: budgets service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."budgets" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: customers service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."customers" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: employees service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."employees" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: goods_received_notes service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."goods_received_notes" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: grn_items service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."grn_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: invoices service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."invoices" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: item_categories service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."item_categories" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: items service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: journal_entries service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."journal_entries" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: journal_lines service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."journal_lines" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: machines service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."machines" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: maintenance_records service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."maintenance_records" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: notifications service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."notifications" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: organizations service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."organizations" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: payroll_records service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."payroll_records" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: permissions service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."permissions" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: production_batches service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."production_batches" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: purchase_order_items service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."purchase_order_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: purchase_orders service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."purchase_orders" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: purchase_requisition_items service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."purchase_requisition_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: purchase_requisitions service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."purchase_requisitions" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: quality_checks service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."quality_checks" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: recipe_ingredients service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."recipe_ingredients" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: recipes service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."recipes" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: role_permissions service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."role_permissions" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: roles service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."roles" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: sales_order_items service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."sales_order_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: sales_orders service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."sales_orders" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_balances service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."stock_balances" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_movements service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."stock_movements" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_transfer_items service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."stock_transfer_items" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_transfers service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."stock_transfers" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: supplier_categories service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."supplier_categories" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: suppliers service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."suppliers" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: units_of_measure service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."units_of_measure" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: user_accounts service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."user_accounts" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: user_roles service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."user_roles" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: users service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."users" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: warehouses service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."warehouses" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: wastage_records service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "service_role_full_access" ON "icecream_erp"."wastage_records" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: session_activities; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."session_activities" ENABLE ROW LEVEL SECURITY;

--
-- Name: session_activities session_activities_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "session_activities_deny_anon" ON "icecream_erp"."session_activities" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: session_activities session_activities_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "session_activities_service_role_full_access" ON "icecream_erp"."session_activities" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: stock_balances; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."stock_balances" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."stock_movements" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_transfer_items; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."stock_transfer_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_transfers; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."stock_transfers" ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_categories; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."supplier_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."suppliers" ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."system_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "system_settings_deny_anon" ON "icecream_erp"."system_settings" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: system_settings system_settings_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "system_settings_service_role_full_access" ON "icecream_erp"."system_settings" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: units_of_measure; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."units_of_measure" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_accounts; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."user_accounts" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_branch_assignments; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."user_branch_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_branch_assignments user_branch_assignments_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "user_branch_assignments_deny_anon" ON "icecream_erp"."user_branch_assignments" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: user_branch_assignments user_branch_assignments_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "user_branch_assignments_service_role_full_access" ON "icecream_erp"."user_branch_assignments" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: user_roles; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_warehouse_assignments; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."user_warehouse_assignments" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_warehouse_assignments user_warehouse_assignments_deny_anon; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "user_warehouse_assignments_deny_anon" ON "icecream_erp"."user_warehouse_assignments" TO "anon" USING (false) WITH CHECK (false);


--
-- Name: user_warehouse_assignments user_warehouse_assignments_service_role_full_access; Type: POLICY; Schema: icecream_erp; Owner: supabase_admin
--

CREATE POLICY "user_warehouse_assignments_service_role_full_access" ON "icecream_erp"."user_warehouse_assignments" TO "service_role" USING (true) WITH CHECK (true);


--
-- Name: users; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."users" ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouses; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."warehouses" ENABLE ROW LEVEL SECURITY;

--
-- Name: wastage_records; Type: ROW SECURITY; Schema: icecream_erp; Owner: supabase_admin
--

ALTER TABLE "icecream_erp"."wastage_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA "icecream_erp"; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA "icecream_erp" TO "anon";
GRANT USAGE ON SCHEMA "icecream_erp" TO "authenticated";
GRANT USAGE ON SCHEMA "icecream_erp" TO "service_role";


--
-- Name: TABLE "accounts"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."accounts" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."accounts" TO "authenticated";


--
-- Name: TABLE "approval_actions"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."approval_actions" TO "service_role";


--
-- Name: TABLE "approval_requests"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."approval_requests" TO "service_role";


--
-- Name: TABLE "approval_workflow_steps"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."approval_workflow_steps" TO "service_role";


--
-- Name: TABLE "approval_workflows"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."approval_workflows" TO "service_role";


--
-- Name: TABLE "attendances"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."attendances" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."attendances" TO "authenticated";


--
-- Name: TABLE "audit_logs"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."audit_logs" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."audit_logs" TO "authenticated";


--
-- Name: TABLE "auth_sessions"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."auth_sessions" TO "service_role";


--
-- Name: TABLE "batch_material_usage"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."batch_material_usage" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."batch_material_usage" TO "authenticated";


--
-- Name: TABLE "batch_worker_output"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."batch_worker_output" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."batch_worker_output" TO "authenticated";


--
-- Name: TABLE "branch_sales"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."branch_sales" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."branch_sales" TO "authenticated";


--
-- Name: TABLE "branch_shift_closes"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."branch_shift_closes" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."branch_shift_closes" TO "authenticated";


--
-- Name: TABLE "branches"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."branches" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."branches" TO "authenticated";


--
-- Name: TABLE "budget_lines"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."budget_lines" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."budget_lines" TO "authenticated";


--
-- Name: TABLE "budgets"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."budgets" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."budgets" TO "authenticated";


--
-- Name: TABLE "customers"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."customers" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."customers" TO "authenticated";


--
-- Name: TABLE "employees"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."employees" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."employees" TO "authenticated";


--
-- Name: TABLE "finished_goods_transfers"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."finished_goods_transfers" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."finished_goods_transfers" TO "service_role";


--
-- Name: TABLE "goods_received_note_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."goods_received_note_items" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."goods_received_note_items" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."goods_received_note_items" TO "service_role";


--
-- Name: TABLE "goods_received_notes"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."goods_received_notes" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."goods_received_notes" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."goods_received_notes" TO "anon";


--
-- Name: TABLE "grn_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."grn_items" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."grn_items" TO "authenticated";


--
-- Name: TABLE "hr_production_worker_outputs"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."hr_production_worker_outputs" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."hr_production_worker_outputs" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."hr_production_worker_outputs" TO "service_role";


--
-- Name: TABLE "invoices"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."invoices" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."invoices" TO "authenticated";


--
-- Name: TABLE "item_categories"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."item_categories" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."item_categories" TO "authenticated";


--
-- Name: TABLE "items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."items" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."items" TO "authenticated";


--
-- Name: TABLE "journal_entries"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."journal_entries" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."journal_entries" TO "authenticated";


--
-- Name: TABLE "journal_lines"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."journal_lines" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."journal_lines" TO "authenticated";


--
-- Name: TABLE "login_attempts"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."login_attempts" TO "service_role";


--
-- Name: TABLE "machines"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."machines" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."machines" TO "authenticated";


--
-- Name: TABLE "maintenance_records"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."maintenance_records" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."maintenance_records" TO "authenticated";


--
-- Name: TABLE "notifications"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."notifications" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."notifications" TO "authenticated";


--
-- Name: TABLE "organizations"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."organizations" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."organizations" TO "authenticated";


--
-- Name: TABLE "payroll_records"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."payroll_records" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."payroll_records" TO "authenticated";


--
-- Name: TABLE "permissions"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."permissions" TO "service_role";
GRANT SELECT ON TABLE "icecream_erp"."permissions" TO "authenticated";


--
-- Name: TABLE "production_batch_materials"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_batch_materials" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_batch_materials" TO "service_role";


--
-- Name: TABLE "production_batch_outputs"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_batch_outputs" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_batch_outputs" TO "service_role";


--
-- Name: TABLE "production_batches"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_batches" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."production_batches" TO "authenticated";


--
-- Name: TABLE "production_cost_overrides"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_cost_overrides" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_cost_overrides" TO "service_role";


--
-- Name: TABLE "production_plan_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_plan_items" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_plan_items" TO "service_role";


--
-- Name: TABLE "production_plans"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_plans" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_plans" TO "service_role";


--
-- Name: TABLE "production_stock_closures"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_stock_closures" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_stock_closures" TO "service_role";


--
-- Name: TABLE "production_worker_assignments"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."production_worker_assignments" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."production_worker_assignments" TO "service_role";


--
-- Name: TABLE "purchase_order_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."purchase_order_items" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."purchase_order_items" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."purchase_order_items" TO "anon";


--
-- Name: TABLE "purchase_orders"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."purchase_orders" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."purchase_orders" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."purchase_orders" TO "anon";


--
-- Name: TABLE "purchase_requisition_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."purchase_requisition_items" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."purchase_requisition_items" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."purchase_requisition_items" TO "anon";


--
-- Name: TABLE "purchase_requisitions"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."purchase_requisitions" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."purchase_requisitions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."purchase_requisitions" TO "anon";


--
-- Name: TABLE "quality_checks"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."quality_checks" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."quality_checks" TO "authenticated";


--
-- Name: TABLE "recipe_ingredients"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."recipe_ingredients" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."recipe_ingredients" TO "authenticated";


--
-- Name: TABLE "recipe_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."recipe_items" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."recipe_items" TO "service_role";


--
-- Name: TABLE "recipe_packaging_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."recipe_packaging_items" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."recipe_packaging_items" TO "service_role";


--
-- Name: TABLE "recipes"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."recipes" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."recipes" TO "authenticated";


--
-- Name: TABLE "report_definitions"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."report_definitions" TO "service_role";


--
-- Name: TABLE "report_exports"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."report_exports" TO "service_role";


--
-- Name: TABLE "report_run_histories"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."report_run_histories" TO "service_role";


--
-- Name: TABLE "role_permissions"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."role_permissions" TO "service_role";


--
-- Name: TABLE "roles"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."roles" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."roles" TO "authenticated";


--
-- Name: TABLE "sales_order_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."sales_order_items" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."sales_order_items" TO "authenticated";


--
-- Name: TABLE "sales_orders"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."sales_orders" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."sales_orders" TO "authenticated";


--
-- Name: TABLE "saved_report_filters"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."saved_report_filters" TO "service_role";


--
-- Name: TABLE "security_events"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."security_events" TO "service_role";


--
-- Name: TABLE "session_activities"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."session_activities" TO "service_role";


--
-- Name: TABLE "stock_balances"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."stock_balances" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."stock_balances" TO "authenticated";


--
-- Name: TABLE "stock_movements"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."stock_movements" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."stock_movements" TO "authenticated";


--
-- Name: TABLE "stock_transfer_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."stock_transfer_items" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."stock_transfer_items" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."stock_transfer_items" TO "anon";


--
-- Name: TABLE "stock_transfers"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."stock_transfers" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."stock_transfers" TO "authenticated";


--
-- Name: TABLE "supplier_categories"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."supplier_categories" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."supplier_categories" TO "authenticated";


--
-- Name: TABLE "supplier_invoice_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."supplier_invoice_items" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."supplier_invoice_items" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."supplier_invoice_items" TO "service_role";


--
-- Name: TABLE "supplier_invoices"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."supplier_invoices" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."supplier_invoices" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."supplier_invoices" TO "service_role";


--
-- Name: TABLE "supplier_payments"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."supplier_payments" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."supplier_payments" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."supplier_payments" TO "service_role";


--
-- Name: TABLE "supplier_return_items"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."supplier_return_items" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."supplier_return_items" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."supplier_return_items" TO "service_role";


--
-- Name: TABLE "supplier_returns"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "icecream_erp"."supplier_returns" TO "anon";
GRANT ALL ON TABLE "icecream_erp"."supplier_returns" TO "authenticated";
GRANT ALL ON TABLE "icecream_erp"."supplier_returns" TO "service_role";


--
-- Name: TABLE "suppliers"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."suppliers" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."suppliers" TO "authenticated";


--
-- Name: TABLE "system_settings"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."system_settings" TO "service_role";


--
-- Name: TABLE "units_of_measure"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."units_of_measure" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."units_of_measure" TO "authenticated";


--
-- Name: TABLE "user_accounts"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."user_accounts" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."user_accounts" TO "authenticated";


--
-- Name: TABLE "user_branch_assignments"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."user_branch_assignments" TO "service_role";


--
-- Name: TABLE "user_roles"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."user_roles" TO "service_role";


--
-- Name: TABLE "user_warehouse_assignments"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."user_warehouse_assignments" TO "service_role";


--
-- Name: TABLE "users"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."users" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."users" TO "authenticated";


--
-- Name: TABLE "warehouses"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."warehouses" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."warehouses" TO "authenticated";


--
-- Name: TABLE "wastage_records"; Type: ACL; Schema: icecream_erp; Owner: supabase_admin
--

GRANT ALL ON TABLE "icecream_erp"."wastage_records" TO "service_role";
GRANT ALL ON TABLE "icecream_erp"."wastage_records" TO "authenticated";


--
-- PostgreSQL database dump complete
--


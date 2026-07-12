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
-- Data for Name: organizations; Type: TABLE DATA; Schema: icecream_erp; Owner: supabase_admin
--

INSERT INTO "icecream_erp"."organizations" ("id", "name", "logo_url", "address", "phone", "email", "tax_number", "currency", "financial_year_start", "created_at", "updated_at") VALUES ('d81ad59c-f207-40cd-8842-a0c6da10da1c', 'Absolute Ice Cream', NULL, NULL, NULL, NULL, NULL, 'USD', 1, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');


--
-- Data for Name: branches; Type: TABLE DATA; Schema: icecream_erp; Owner: supabase_admin
--

INSERT INTO "icecream_erp"."branches" ("id", "organization_id", "code", "name", "address", "phone", "manager_id", "status", "created_at", "updated_at", "deleted_at") VALUES ('ef4f9ede-9afc-4758-bc3f-01f628e6adb2', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'BR-MAIN', 'Main Branch', 'Main Operations', NULL, NULL, 'ACTIVE', '2026-07-10 07:54:40.169164+00', '2026-07-10 07:54:40.169164+00', NULL);


--
-- Data for Name: roles; Type: TABLE DATA; Schema: icecream_erp; Owner: supabase_admin
--

INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('d96b92f2-0ac3-4436-b3f0-044e8c63de54', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Super Admin', 'Super Admin role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('b3e69c23-3e3c-4f79-9d43-812bcff7c6c8', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Procurement Officer', 'Procurement Officer role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('38a6d1f4-71aa-4366-8af9-18cd6cf70f55', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Store Keeper', 'Store Keeper role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('126a999d-0f14-4a11-b093-d706586952cf', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Production Manager', 'Production Manager role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('1795123d-6535-4745-8994-b1e5d901021f', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Production Worker', 'Production Worker role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('be506c84-8486-42e2-a48d-d9d45c932a80', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Sales Representative', 'Sales Representative role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('0dd7ad64-7516-40c0-b356-0bbfcafae83f', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Branch Manager', 'Branch Manager role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('de0dafc2-27e4-4b66-8228-30793d786e02', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Accountant', 'Accountant role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');
INSERT INTO "icecream_erp"."roles" ("id", "organization_id", "name", "description", "is_system_role", "created_at", "updated_at") VALUES ('be203f30-b6b5-4f13-b438-c543b957e1ed', 'd81ad59c-f207-40cd-8842-a0c6da10da1c', 'Auditor', 'Auditor role', true, '2026-07-09 16:17:33.430362+00', '2026-07-09 16:17:33.430362+00');


--
-- PostgreSQL database dump complete
--


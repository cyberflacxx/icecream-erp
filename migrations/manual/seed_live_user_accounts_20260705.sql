WITH sample_accounts(work_id, email, first_name, last_name, id_number, role_name) AS (
  VALUES
    ('AQI-20261001', 'sample.superadmin@absoluteicecream.co.zw', 'System', 'Owner', '63-610001-A01', 'Super Admin'),
    ('AQI-20261002', 'sample.procurement@absoluteicecream.co.zw', 'Patience', 'Buyer', '63-610002-A02', 'Procurement Officer'),
    ('AQI-20261003', 'sample.storekeeper@absoluteicecream.co.zw', 'Tawanda', 'Store', '63-610003-A03', 'Store Keeper'),
    ('AQI-20261004', 'sample.productionmanager@absoluteicecream.co.zw', 'Nyasha', 'Plant', '63-610004-A04', 'Production Manager'),
    ('AQI-20261005', 'sample.productionworker@absoluteicecream.co.zw', 'Tino', 'Operator', '63-610005-A05', 'Production Worker'),
    ('AQI-20261006', 'sample.salesrep@absoluteicecream.co.zw', 'Rudo', 'Sales', '63-610006-A06', 'Sales Representative'),
    ('AQI-20261007', 'sample.branchmanager@absoluteicecream.co.zw', 'Tapiwa', 'Branch', '63-610007-A07', 'Branch Manager'),
    ('AQI-20261008', 'sample.accountant@absoluteicecream.co.zw', 'Farai', 'Books', '63-610008-A08', 'Accountant'),
    ('AQI-20261009', 'sample.auditor@absoluteicecream.co.zw', 'Munya', 'Audit', '63-610009-A09', 'Auditor')
),
matched_users AS (
  SELECT
    u.id AS user_id,
    u.work_id,
    lower(u.email) AS email,
    coalesce(nullif(u.first_name, ''), sa.first_name) AS first_name,
    coalesce(nullif(u.last_name, ''), sa.last_name) AS last_name,
    coalesce(nullif(u.id_number, ''), sa.id_number) AS id_number,
    r.id AS role_id,
    r.organization_id
  FROM icecream_erp.users u
  JOIN sample_accounts sa
    ON sa.work_id = u.work_id
  JOIN icecream_erp.user_roles ur
    ON ur.user_profile_id = u.id
  JOIN icecream_erp.roles r
    ON r.id = ur.role_id
),
inserted AS (
  INSERT INTO icecream_erp.user_accounts (
    id,
    work_id,
    first_name,
    last_name,
    id_number,
    email,
    password_hash,
    role_id,
    organization_id,
    is_active,
    created_at,
    updated_at
  )
  SELECT
    mu.user_id,
    mu.work_id,
    mu.first_name,
    mu.last_name,
    mu.id_number,
    mu.email,
    'SUPABASE_AUTH_MANAGED',
    mu.role_id,
    mu.organization_id,
    true,
    now(),
    now()
  FROM matched_users mu
  WHERE NOT EXISTS (
    SELECT 1
    FROM icecream_erp.user_accounts ua
    WHERE ua.work_id = mu.work_id
       OR lower(ua.email) = mu.email
  )
  RETURNING id, work_id, email
),
all_accounts AS (
  SELECT id, work_id, lower(email) AS email
  FROM icecream_erp.user_accounts
  WHERE work_id IN (SELECT work_id FROM sample_accounts)
     OR lower(email) IN (SELECT lower(email) FROM sample_accounts)
)
UPDATE icecream_erp.users u
SET user_account_id = aa.id
FROM all_accounts aa
WHERE u.work_id = aa.work_id
  AND (u.user_account_id IS DISTINCT FROM aa.id);

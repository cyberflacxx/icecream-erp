# Database Model Audit Report
Generated: 2026-06-01T05:26:49.014Z
Schema: MySQL + PostgreSQL (dual)

## Summary
Total models: 99
Total enums: 36
Total fields across all models: 1555
Models with soft delete: 44
Models with audit trail: 99

---

## ENUMS

### AccountType
Values: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, COST_OF_SALES
Used in models: Account.accountType
Consistent between MySQL and PG: YES
Differences: NONE

### ApprovalLevel
Values: LEVEL1_SUPERVISOR, LEVEL2_MANAGER, LEVEL3_FINANCE_MANAGER, LEVEL4_MANAGING_DIRECTOR
Used in models: ApprovalWorkflowStep.level, ApprovalAction.level
Consistent between MySQL and PG: YES
Differences: NONE

### ApprovalStatus
Values: PENDING, APPROVED, REJECTED, ESCALATED
Used in models: ApprovalRequest.status, ApprovalAction.action, ProductionMaterialRequest.status, PettyCashRequest.status
Consistent between MySQL and PG: YES
Differences: NONE

### BranchShiftStatus
Values: OPEN, SUBMITTED, REVIEWED, APPROVED, REJECTED
Used in models: BranchShiftClose.status, ShiftReport.status
Consistent between MySQL and PG: YES
Differences: NONE

### BranchStatus
Values: ACTIVE, INACTIVE, CLOSED
Used in models: Branch.status
Consistent between MySQL and PG: YES
Differences: NONE

### BudgetStatus
Values: DRAFT, SUBMITTED, APPROVED, ACTIVE, CLOSED
Used in models: Budget.status
Consistent between MySQL and PG: YES
Differences: NONE

### CustomerStatus
Values: ACTIVE, INACTIVE, BLACKLISTED
Used in models: Customer.status
Consistent between MySQL and PG: YES
Differences: NONE

### DeliveryNoteStatus
Values: DRAFT, DISPATCHED, DELIVERED, CANCELLED
Used in models: DeliveryNote.status
Consistent between MySQL and PG: YES
Differences: NONE

### EmployeeStatus
Values: ACTIVE, INACTIVE, ON_LEAVE, TERMINATED
Used in models: Employee.status
Consistent between MySQL and PG: YES
Differences: NONE

### GRNStatus
Values: DRAFT, RECEIVED, QUALITY_INSPECTION, QUALITY_PASSED, QUALITY_FAILED, POSTED, REJECTED
Used in models: GoodsReceivedNote.status
Consistent between MySQL and PG: YES
Differences: NONE

### InventoryBatchStatus
Values: ACTIVE, EXPIRED, DEPLETED, QUARANTINE
Used in models: InventoryBatch.status
Consistent between MySQL and PG: YES
Differences: NONE

### InvoiceStatus
Values: DRAFT, SENT, PARTIAL_PAID, PAID, OVERDUE, DISPUTED, CANCELLED
Used in models: Invoice.status
Consistent between MySQL and PG: YES
Differences: NONE

### ItemType
Values: RAW_MATERIAL, PACKAGING_MATERIAL, FINISHED_GOOD, WORK_IN_PROGRESS, CONSUMABLE, SPARE_PART
Used in models: Item.itemType
Consistent between MySQL and PG: YES
Differences: NONE

### LeaveStatus
Values: PENDING, APPROVED, REJECTED, CANCELLED
Used in models: LeaveRequest.status
Consistent between MySQL and PG: YES
Differences: NONE

### MaintenanceStatus
Values: SCHEDULED, IN_PROGRESS, COMPLETED, OVERDUE, CANCELLED
Used in models: MaintenanceSchedule.status, MachineBreakdown.status
Consistent between MySQL and PG: YES
Differences: NONE

### MaintenanceType
Values: PREVENTIVE, CORRECTIVE, BREAKDOWN, INSPECTION
Used in models: MaintenanceSchedule.maintenanceType
Consistent between MySQL and PG: YES
Differences: NONE

### NotificationType
Values: INFO, SUCCESS, WARNING, ERROR, ACTION_REQUIRED
Used in models: Notification.type
Consistent between MySQL and PG: YES
Differences: NONE

### PaymentMethod
Values: CASH, ECOCASH, CARD, BANK_TRANSFER, CREDIT, PETTY_CASH
Used in models: Payment.paymentMethod, BranchSale.paymentMethod, BranchExpense.paymentMethod
Consistent between MySQL and PG: YES
Differences: NONE

### PayrollStatus
Values: DRAFT, APPROVED, PAID, CANCELLED
Used in models: PayrollRecord.status
Consistent between MySQL and PG: YES
Differences: NONE

### ProductionBatchStatus
Values: DRAFT, PLANNED, MATERIALS_REQUESTED, MATERIALS_APPROVED, MATERIALS_RESERVED, IN_PROGRESS, WIP, QUALITY_CHECK, COMPLETED, CANCELLED
Used in models: ProductionBatch.status
Consistent between MySQL and PG: YES
Differences: NONE

### ProductionPlanStatus
Values: DRAFT, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED
Used in models: ProductionPlan.status
Consistent between MySQL and PG: YES
Differences: NONE

### PurchaseOrderStatus
Values: DRAFT, AWAITING_APPROVAL, LEVEL1_APPROVED, LEVEL2_APPROVED, LEVEL3_APPROVED, APPROVED, SENT_TO_SUPPLIER, PARTIAL_RECEIVED, FULLY_RECEIVED, CANCELLED
Used in models: PurchaseOrder.status
Consistent between MySQL and PG: YES
Differences: NONE

### PurchaseRequisitionStatus
Values: DRAFT, SUBMITTED, LEVEL1_APPROVED, LEVEL2_APPROVED, LEVEL3_APPROVED, LEVEL4_APPROVED, REJECTED, CANCELLED, PO_CREATED
Used in models: PurchaseRequisition.status, PurchaseRequisition.approvalStatus
Consistent between MySQL and PG: YES
Differences: NONE

### QualityStatus
Values: PENDING, PASSED, FAILED, CONDITIONAL_RELEASE, QUARANTINE
Used in models: GoodsReceivedNote.qualityStatus, ProductionBatch.qualityStatus, QualityCheck.status
Consistent between MySQL and PG: YES
Differences: NONE

### QuotationStatus
Values: DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CANCELLED
Used in models: Quotation.status
Consistent between MySQL and PG: YES
Differences: NONE

### RecipeStatus
Values: DRAFT, ACTIVE, INACTIVE
Used in models: Recipe.status
Consistent between MySQL and PG: YES
Differences: NONE

### ReturnStatus
Values: DRAFT, APPROVED, COMPLETED, CANCELLED
Used in models: SupplierReturn.status, CustomerReturn.status
Consistent between MySQL and PG: YES
Differences: NONE

### SalesOrderStatus
Values: DRAFT, CONFIRMED, CREDIT_CHECK, PICKING, DISPATCHED, DELIVERED, INVOICED, PARTIALLY_PAID, PAID, CANCELLED
Used in models: SalesOrder.status
Consistent between MySQL and PG: YES
Differences: NONE

### ShiftType
Values: DAY, NIGHT
Used in models: ProductionPlan.shift, ProductionBatch.shift, ProductionWorkerAssignment.shift, BranchSale.shift, BranchShiftClose.shiftType, Attendance.shift, ShiftReport.shiftType
Consistent between MySQL and PG: YES
Differences: NONE

### StockMovementType
Values: PURCHASE_RECEIVE, PRODUCTION_ISSUE, PRODUCTION_OUTPUT, WIP_TRANSFER, TRANSFER_OUT, TRANSFER_IN, SALES_ISSUE, RETURN_IN, ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGE, EXPIRY_WRITE_OFF, WASTAGE, SPILLAGE, MACHINE_LOSS, PACKAGING_LOSS
Used in models: StockMovement.movementType, StockAdjustmentItem.movementType
Consistent between MySQL and PG: YES
Differences: NONE

### SupplierStatus
Values: ACTIVE, INACTIVE, BLACKLISTED
Used in models: Supplier.status
Consistent between MySQL and PG: YES
Differences: NONE

### TransactionStatus
Values: DRAFT, POSTED, APPROVED, LOCKED, VOIDED
Used in models: StockAdjustment.status, PettyCashReplenishment.status
Consistent between MySQL and PG: YES
Differences: NONE

### TransferStatus
Values: DRAFT, IN_TRANSIT, COMPLETED, CANCELLED
Used in models: StockTransfer.status
Consistent between MySQL and PG: YES
Differences: NONE

### UserStatus
Values: ACTIVE, INACTIVE, SUSPENDED
Used in models: UserProfile.status
Consistent between MySQL and PG: YES
Differences: NONE

### WarehouseType
Values: MAIN, BRANCH, COLD_ROOM
Used in models: Warehouse.type
Consistent between MySQL and PG: YES
Differences: NONE

### WastageType
Values: MATERIAL_WASTAGE, PRODUCT_LOSS, SPILLAGE, MACHINE_LOSS, PACKAGING_LOSS, QUALITY_REJECTION, EXPIRY_LOSS
Used in models: ProductionWastage.wastageType
Consistent between MySQL and PG: YES
Differences: NONE

---

## MODELS

### Account
Table: accounts

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| accountCode | String | YES | NO | - | YES | - |
| accountName | String | YES | NO | - | YES | - |
| accountType | AccountType | YES | NO | - | YES | - |
| parentAccountId | String | NO | NO | - | YES | - |
| isActive | Boolean | YES | NO | true | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| parentAccount | Account | NO | NO | - | YES | Account.id |
| childAccounts | Account[] | NO | NO | - | NO | Account.id |
| journalEntryLines | JournalEntryLine[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Account via parentAccount
  - has many Account via childAccounts

Unique constraints:
  - @@unique([organizationId, accountCode])

Indexes:
  - @@index([organizationId])
  - @@index([parentAccountId])
  - @@index([accountType])
  - @@index([accountName])
  - @@index([isActive])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - parentAccountId: MySQL `parentAccountId String? @map("parent_account_id")` vs PG `parentAccountId String? @db.Uuid @map("parent_account_id")`

Potential issues:
  - nullable relation key parentAccountId (verify business requirement)

### AdminKey
Table: admin_keys

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| keyValue | String | YES | YES | - | YES | - |
| description | String | NO | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| usageCount | Int | YES | NO | 0 | NO | - |
| maxUsage | Int | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| expiresAt | DateTime | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([isActive])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`

Potential issues:
  - NONE

### ApprovalAction
Table: approval_actions

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| approvalRequestId | String | YES | NO | - | YES | - |
| stepNumber | Int | YES | NO | - | NO | - |
| level | ApprovalLevel | YES | NO | - | NO | - |
| actionBy | String | YES | NO | - | YES | - |
| action | ApprovalStatus | YES | NO | - | YES | - |
| comments | String | NO | NO | - | NO | - |
| actedAt | DateTime | YES | NO | now( | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| approvalRequest | ApprovalRequest | YES | NO | - | YES | ApprovalRequest.id |

Relations:
  - belongs to ApprovalRequest via approvalRequest

Unique constraints:
  - NONE

Indexes:
  - @@index([approvalRequestId])
  - @@index([actionBy])
  - @@index([action])
  - @@index([actedAt])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - approvalRequestId: MySQL `approvalRequestId String @map("approval_request_id")` vs PG `approvalRequestId String @db.Uuid @map("approval_request_id")`
  - actionBy: MySQL `actionBy String @map("action_by")` vs PG `actionBy String @db.Uuid @map("action_by")`

Potential issues:
  - NONE

### ApprovalRequest
Table: approval_requests

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| workflowId | String | YES | NO | - | YES | - |
| entityType | String | YES | NO | - | YES | - |
| entityId | String | YES | NO | - | YES | - |
| currentStep | Int | YES | NO | 1 | NO | - |
| status | ApprovalStatus | YES | NO | - | YES | - |
| requestedBy | String | YES | NO | - | YES | - |
| requestedAt | DateTime | YES | NO | now( | YES | - |
| completedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| workflow | ApprovalWorkflow | YES | NO | - | YES | ApprovalWorkflow.id |
| actions | ApprovalAction[] | NO | NO | - | NO | - |

Relations:
  - belongs to ApprovalWorkflow via workflow

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([workflowId])
  - @@index([entityType, entityId])
  - @@index([status])
  - @@index([requestedBy])
  - @@index([requestedAt])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - workflowId: MySQL `workflowId String @map("workflow_id")` vs PG `workflowId String @db.Uuid @map("workflow_id")`
  - requestedBy: MySQL `requestedBy String @map("requested_by")` vs PG `requestedBy String @db.Uuid @map("requested_by")`

Potential issues:
  - NONE

### ApprovalWorkflow
Table: approval_workflows

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| entityType | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| steps | ApprovalWorkflowStep[] | NO | NO | - | NO | - |
| requests | ApprovalRequest[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([entityType])
  - @@index([name])
  - @@index([isActive])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### ApprovalWorkflowStep
Table: approval_workflow_steps

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| workflowId | String | YES | NO | - | YES | - |
| stepNumber | Int | YES | NO | - | YES | - |
| level | ApprovalLevel | YES | NO | - | YES | - |
| roleId | String | YES | NO | - | YES | - |
| isRequired | Boolean | YES | NO | true | NO | - |
| escalationHours | Int | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| workflow | ApprovalWorkflow | YES | NO | - | YES | ApprovalWorkflow.id |

Relations:
  - belongs to ApprovalWorkflow via workflow

Unique constraints:
  - @@unique([workflowId, stepNumber])

Indexes:
  - @@index([workflowId])
  - @@index([roleId])
  - @@index([level])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - workflowId: MySQL `workflowId String @map("workflow_id")` vs PG `workflowId String @db.Uuid @map("workflow_id")`
  - roleId: MySQL `roleId String @map("role_id")` vs PG `roleId String @db.Uuid @map("role_id")`

Potential issues:
  - NONE

### AssetDepreciation
Table: asset_depreciation

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| assetId | String | YES | NO | - | YES | - |
| periodStart | DateTime | YES | NO | - | YES | - |
| periodEnd | DateTime | YES | NO | - | YES | - |
| depreciationAmount | Decimal | YES | NO | - | NO | - |
| accumulatedTotal | Decimal | YES | NO | - | NO | - |
| bookValue | Decimal | YES | NO | - | NO | - |
| journalEntryId | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| asset | FixedAsset | YES | NO | - | YES | FixedAsset.id |

Relations:
  - belongs to FixedAsset via asset

Unique constraints:
  - NONE

Indexes:
  - @@index([assetId])
  - @@index([periodStart])
  - @@index([periodEnd])
  - @@index([journalEntryId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - assetId: MySQL `assetId String @map("asset_id")` vs PG `assetId String @db.Uuid @map("asset_id")`
  - journalEntryId: MySQL `journalEntryId String? @map("journal_entry_id")` vs PG `journalEntryId String? @db.Uuid @map("journal_entry_id")`

Potential issues:
  - nullable relation key journalEntryId (verify business requirement)

### Attendance
Table: attendances

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| employeeId | String | YES | NO | - | YES | - |
| attendanceDate | DateTime | YES | NO | - | YES | - |
| shift | ShiftType | YES | NO | - | YES | - |
| checkIn | DateTime | NO | NO | - | NO | - |
| checkOut | DateTime | NO | NO | - | NO | - |
| hoursWorked | Decimal | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| employee | Employee | YES | NO | - | YES | Employee.id |

Relations:
  - belongs to Organization via organization
  - belongs to Employee via employee

Unique constraints:
  - @@unique([employeeId, attendanceDate, shift])

Indexes:
  - @@index([organizationId])
  - @@index([employeeId])
  - @@index([attendanceDate])
  - @@index([shift])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - employeeId: MySQL `employeeId String @map("employee_id")` vs PG `employeeId String @db.Uuid @map("employee_id")`

Potential issues:
  - NONE

### AuditLog
Table: audit_logs

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| userProfileId | String | NO | NO | - | YES | - |
| action | String | YES | NO | - | YES | - |
| entityType | String | YES | NO | - | YES | - |
| entityId | String | YES | NO | - | YES | - |
| oldValues | Json | NO | NO | - | NO | - |
| newValues | Json | NO | NO | - | NO | - |
| ipAddress | String | NO | NO | - | NO | - |
| userAgent | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | YES | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| userProfile | UserProfile | NO | NO | - | YES | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via userProfile

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([userProfileId])
  - @@index([action])
  - @@index([entityType, entityId])
  - @@index([createdAt])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - userProfileId: MySQL `userProfileId String? @map("user_profile_id")` vs PG `userProfileId String? @db.Uuid @map("user_profile_id")`

Potential issues:
  - nullable relation key userProfileId (verify business requirement)

### AuthSession
Table: auth_sessions

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| userAccountId | String | YES | NO | - | YES | - |
| userAccount | UserAccount | YES | NO | - | YES | UserAccount.id |
| token | String | YES | YES | - | YES | - |
| ipAddress | String | NO | NO | - | NO | - |
| userAgent | String | NO | NO | - | NO | - |
| expiresAt | DateTime | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |

Relations:
  - belongs to UserAccount via userAccount

Unique constraints:
  - NONE

Indexes:
  - @@index([userAccountId])
  - @@index([expiresAt])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - userAccountId: MySQL `userAccountId String @map("user_account_id")` vs PG `userAccountId String @db.Uuid @map("user_account_id")`

Potential issues:
  - NONE

### BankAccount
Table: bank_accounts

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| accountId | String | YES | NO | - | YES | - |
| accountName | String | YES | NO | - | NO | - |
| bankName | String | YES | NO | - | YES | - |
| accountNumber | String | YES | NO | - | YES | - |
| branchName | String | NO | NO | - | NO | - |
| swiftCode | String | NO | NO | - | NO | - |
| currency | String | YES | NO | "USD" | NO | - |
| currentBalance | Decimal | YES | NO | 0 | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| reconciliations | BankReconciliation[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, accountNumber])

Indexes:
  - @@index([organizationId])
  - @@index([accountId])
  - @@index([bankName])
  - @@index([isActive])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - accountId: MySQL `accountId String @map("account_id")` vs PG `accountId String @db.Uuid @map("account_id")`

Potential issues:
  - NONE

### BankReconciliation
Table: bank_reconciliations

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| bankAccountId | String | YES | NO | - | YES | - |
| periodStart | DateTime | YES | NO | - | YES | - |
| periodEnd | DateTime | YES | NO | - | YES | - |
| openingBalance | Decimal | YES | NO | - | NO | - |
| closingBalance | Decimal | YES | NO | - | NO | - |
| statementBalance | Decimal | YES | NO | - | NO | - |
| outstandingDeposits | Decimal | YES | NO | 0 | NO | - |
| outstandingPayments | Decimal | YES | NO | 0 | NO | - |
| reconciledBalance | Decimal | YES | NO | - | NO | - |
| isReconciled | Boolean | YES | NO | false | YES | - |
| reconciledBy | String | NO | NO | - | NO | - |
| reconciledAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| bankAccount | BankAccount | YES | NO | - | YES | BankAccount.id |

Relations:
  - belongs to BankAccount via bankAccount

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([bankAccountId])
  - @@index([periodStart])
  - @@index([periodEnd])
  - @@index([isReconciled])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - bankAccountId: MySQL `bankAccountId String @map("bank_account_id")` vs PG `bankAccountId String @db.Uuid @map("bank_account_id")`
  - reconciledBy: MySQL `reconciledBy String? @map("reconciled_by")` vs PG `reconciledBy String? @db.Uuid @map("reconciled_by")`

Potential issues:
  - NONE

### Branch
Table: branches

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| address | String | NO | NO | - | NO | - |
| phone | String | NO | NO | - | NO | - |
| managerId | String | NO | NO | - | YES | - |
| status | BranchStatus | YES | NO | ACTIVE | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| manager | UserProfile | NO | NO | - | YES | UserProfile.id |
| userProfiles | UserProfile[] | NO | NO | - | NO | UserProfile.id |
| employees | Employee[] | NO | NO | - | NO | - |
| warehouses | Warehouse[] | NO | NO | - | NO | - |
| salesOrders | SalesOrder[] | NO | NO | - | NO | - |
| branchSales | BranchSale[] | NO | NO | - | NO | - |
| branchExpenses | BranchExpense[] | NO | NO | - | NO | - |
| branchShiftCloses | BranchShiftClose[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via manager
  - has many UserProfile via userProfiles

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([managerId])
  - @@index([status])
  - @@index([name])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - managerId: MySQL `managerId String? @map("manager_id")` vs PG `managerId String? @db.Uuid @map("manager_id")`

Potential issues:
  - nullable relation key managerId (verify business requirement)

### BranchExpense
Table: branch_expenses

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| branchId | String | YES | NO | - | YES | - |
| expenseDate | DateTime | YES | NO | - | YES | - |
| category | String | YES | NO | - | YES | - |
| description | String | YES | NO | - | NO | - |
| amount | Decimal | YES | NO | - | NO | - |
| paymentMethod | PaymentMethod | YES | NO | - | YES | - |
| receiptUrl | String | NO | NO | - | NO | - |
| approvedBy | String | NO | NO | - | YES | - |
| createdBy | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| branch | Branch | YES | NO | - | YES | Branch.id |
| approvedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| createdByUser | UserProfile | YES | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to Branch via branch
  - belongs to UserProfile via approvedByUser
  - belongs to UserProfile via createdByUser

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([approvedBy])
  - @@index([createdBy])
  - @@index([paymentMethod])
  - @@index([expenseDate])
  - @@index([category])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - branchId: MySQL `branchId String @map("branch_id")` vs PG `branchId String @db.Uuid @map("branch_id")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### BranchSale
Table: branch_sales

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| branchId | String | YES | NO | - | YES | - |
| saleNumber | String | YES | NO | - | YES | - |
| saleDate | DateTime | YES | NO | - | YES | - |
| shift | ShiftType | YES | NO | - | YES | - |
| customerId | String | NO | NO | - | YES | - |
| totalAmount | Decimal | YES | NO | - | NO | - |
| paymentMethod | PaymentMethod | YES | NO | - | YES | - |
| paymentReference | String | NO | NO | - | NO | - |
| servedBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| branch | Branch | YES | NO | - | YES | Branch.id |
| customer | Customer | NO | NO | - | YES | Customer.id |
| servedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | BranchSaleItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Branch via branch
  - belongs to Customer via customer
  - belongs to UserProfile via servedByUser

Unique constraints:
  - @@unique([organizationId, saleNumber])

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([customerId])
  - @@index([servedBy])
  - @@index([paymentMethod])
  - @@index([saleDate])
  - @@index([shift])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - branchId: MySQL `branchId String @map("branch_id")` vs PG `branchId String @db.Uuid @map("branch_id")`
  - customerId: MySQL `customerId String? @map("customer_id")` vs PG `customerId String? @db.Uuid @map("customer_id")`
  - servedBy: MySQL `servedBy String? @map("served_by")` vs PG `servedBy String? @db.Uuid @map("served_by")`

Potential issues:
  - nullable relation key customerId (verify business requirement)

### BranchSaleItem
Table: branch_sale_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| branchSaleId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitPrice | Decimal | YES | NO | - | NO | - |
| totalPrice | Decimal | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| branchSale | BranchSale | YES | NO | - | YES | BranchSale.id |
| item | Item | YES | NO | - | YES | Item.id |

Relations:
  - belongs to BranchSale via branchSale
  - belongs to Item via item

Unique constraints:
  - NONE

Indexes:
  - @@index([branchSaleId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - branchSaleId: MySQL `branchSaleId String @map("branch_sale_id")` vs PG `branchSaleId String @db.Uuid @map("branch_sale_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### BranchShiftClose
Table: branch_shift_closes

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| branchId | String | YES | NO | - | YES | - |
| shiftDate | DateTime | YES | NO | - | YES | - |
| shiftType | ShiftType | YES | NO | - | YES | - |
| openingStockValue | Decimal | YES | NO | - | NO | - |
| stockReceivedValue | Decimal | YES | NO | - | NO | - |
| stockSoldValue | Decimal | YES | NO | - | NO | - |
| damagedStockValue | Decimal | YES | NO | - | NO | - |
| closingStockValue | Decimal | YES | NO | - | NO | - |
| expectedCash | Decimal | YES | NO | - | NO | - |
| actualCash | Decimal | YES | NO | - | NO | - |
| ecocashTotal | Decimal | YES | NO | - | NO | - |
| cardTotal | Decimal | YES | NO | - | NO | - |
| expensesTotal | Decimal | YES | NO | - | NO | - |
| cashVariance | Decimal | YES | NO | - | NO | - |
| stockVariance | Decimal | YES | NO | - | NO | - |
| status | BranchShiftStatus | YES | NO | OPEN | YES | - |
| notes | String | NO | NO | - | NO | - |
| closedBy | String | YES | NO | - | YES | - |
| approvedBy | String | NO | NO | - | YES | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| branch | Branch | YES | NO | - | YES | Branch.id |
| closedByUser | UserProfile | YES | NO | - | NO | UserProfile.id |
| approvedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to Branch via branch
  - belongs to UserProfile via closedByUser
  - belongs to UserProfile via approvedByUser

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([closedBy])
  - @@index([approvedBy])
  - @@index([status])
  - @@index([shiftDate])
  - @@index([shiftType])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - branchId: MySQL `branchId String @map("branch_id")` vs PG `branchId String @db.Uuid @map("branch_id")`
  - closedBy: MySQL `closedBy String @map("closed_by")` vs PG `closedBy String @db.Uuid @map("closed_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - NONE

### Budget
Table: budgets

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| budgetCode | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | NO | - |
| budgetYear | Int | YES | NO | - | YES | - |
| budgetType | String | YES | NO | - | NO | - |
| departmentId | String | NO | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| status | BudgetStatus | YES | NO | - | YES | - |
| totalBudgeted | Decimal | YES | NO | 0 | NO | - |
| approvalRequestId | String | NO | NO | - | NO | - |
| approvedBy | String | NO | NO | - | NO | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| createdBy | String | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| lines | BudgetLine[] | NO | NO | - | NO | - |
| revisions | BudgetRevision[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, budgetCode])

Indexes:
  - @@index([organizationId])
  - @@index([budgetYear])
  - @@index([status])
  - @@index([departmentId])
  - @@index([branchId])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - departmentId: MySQL `departmentId String? @map("department_id")` vs PG `departmentId String? @db.Uuid @map("department_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`
  - approvalRequestId: MySQL `approvalRequestId String? @map("approval_request_id")` vs PG `approvalRequestId String? @db.Uuid @map("approval_request_id")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`

Potential issues:
  - missing index on FK-like field approvalRequestId
  - nullable relation key departmentId (verify business requirement)
  - nullable relation key branchId (verify business requirement)
  - nullable relation key approvalRequestId (verify business requirement)

### BudgetLine
Table: budget_lines

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| budgetId | String | YES | NO | - | YES | - |
| accountId | String | YES | NO | - | YES | - |
| january | Decimal | YES | NO | 0 | NO | - |
| february | Decimal | YES | NO | 0 | NO | - |
| march | Decimal | YES | NO | 0 | NO | - |
| april | Decimal | YES | NO | 0 | NO | - |
| may | Decimal | YES | NO | 0 | NO | - |
| june | Decimal | YES | NO | 0 | NO | - |
| july | Decimal | YES | NO | 0 | NO | - |
| august | Decimal | YES | NO | 0 | NO | - |
| september | Decimal | YES | NO | 0 | NO | - |
| october | Decimal | YES | NO | 0 | NO | - |
| november | Decimal | YES | NO | 0 | NO | - |
| december | Decimal | YES | NO | 0 | NO | - |
| annualTotal | Decimal | YES | NO | 0 | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| budget | Budget | YES | NO | - | YES | Budget.id |

Relations:
  - belongs to Budget via budget

Unique constraints:
  - NONE

Indexes:
  - @@index([budgetId])
  - @@index([accountId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - budgetId: MySQL `budgetId String @map("budget_id")` vs PG `budgetId String @db.Uuid @map("budget_id")`
  - accountId: MySQL `accountId String @map("account_id")` vs PG `accountId String @db.Uuid @map("account_id")`

Potential issues:
  - NONE

### BudgetRevision
Table: budget_revisions

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| budgetId | String | YES | NO | - | YES | - |
| revisionNumber | Int | YES | NO | - | YES | - |
| reason | String | YES | NO | - | NO | - |
| revisedBy | String | YES | NO | - | YES | - |
| approvalRequestId | String | NO | NO | - | NO | - |
| approvedBy | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| budget | Budget | YES | NO | - | YES | Budget.id |

Relations:
  - belongs to Budget via budget

Unique constraints:
  - @@unique([budgetId, revisionNumber])

Indexes:
  - @@index([budgetId])
  - @@index([revisedBy])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - budgetId: MySQL `budgetId String @map("budget_id")` vs PG `budgetId String @db.Uuid @map("budget_id")`
  - revisedBy: MySQL `revisedBy String @map("revised_by")` vs PG `revisedBy String @db.Uuid @map("revised_by")`
  - approvalRequestId: MySQL `approvalRequestId String? @map("approval_request_id")` vs PG `approvalRequestId String? @db.Uuid @map("approval_request_id")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - missing index on FK-like field approvalRequestId
  - nullable relation key approvalRequestId (verify business requirement)

### CashAccount
Table: cash_accounts

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| accountId | String | YES | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| balance | Decimal | YES | NO | 0 | NO | - |
| isActive | Boolean | YES | NO | true | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([accountId])
  - @@index([branchId])
  - @@index([name])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - accountId: MySQL `accountId String @map("account_id")` vs PG `accountId String @db.Uuid @map("account_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`

Potential issues:
  - nullable relation key branchId (verify business requirement)

### Customer
Table: customers

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| customerType | String | YES | NO | - | NO | - |
| phone | String | NO | NO | - | YES | - |
| email | String | NO | NO | - | YES | - |
| address | String | NO | NO | - | NO | - |
| creditLimit | Decimal | NO | NO | - | NO | - |
| currentBalance | Decimal | NO | NO | 0 | NO | - |
| paymentTerms | String | NO | NO | - | NO | - |
| status | CustomerStatus | YES | NO | ACTIVE | YES | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| quotations | Quotation[] | NO | NO | - | NO | - |
| salesOrders | SalesOrder[] | NO | NO | - | NO | - |
| invoices | Invoice[] | NO | NO | - | NO | - |
| payments | Payment[] | NO | NO | - | NO | - |
| customerReturns | CustomerReturn[] | NO | NO | - | NO | - |
| branchSales | BranchSale[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([status])
  - @@index([name])
  - @@index([email])
  - @@index([phone])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### CustomerComplaint
Table: customer_complaints

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| customerId | String | YES | NO | - | YES | - |
| invoiceId | String | NO | NO | - | YES | - |
| complaintDate | DateTime | YES | NO | - | YES | - |
| title | String | YES | NO | - | NO | - |
| details | String | YES | NO | - | NO | - |
| status | String | YES | NO | - | YES | - |
| resolvedBy | String | NO | NO | - | NO | - |
| resolvedAt | DateTime | NO | NO | - | NO | - |
| resolutionNote | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([customerId])
  - @@index([invoiceId])
  - @@index([status])
  - @@index([complaintDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - customerId: MySQL `customerId String @map("customer_id")` vs PG `customerId String @db.Uuid @map("customer_id")`
  - invoiceId: MySQL `invoiceId String? @map("invoice_id")` vs PG `invoiceId String? @db.Uuid @map("invoice_id")`
  - resolvedBy: MySQL `resolvedBy String? @map("resolved_by")` vs PG `resolvedBy String? @db.Uuid @map("resolved_by")`

Potential issues:
  - nullable relation key invoiceId (verify business requirement)

### CustomerReturn
Table: customer_returns

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| returnNumber | String | YES | NO | - | YES | - |
| customerId | String | YES | NO | - | YES | - |
| invoiceId | String | NO | NO | - | YES | - |
| returnDate | DateTime | YES | NO | - | YES | - |
| reason | String | YES | NO | - | NO | - |
| totalValue | Decimal | YES | NO | - | NO | - |
| status | ReturnStatus | YES | NO | DRAFT | YES | - |
| createdBy | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| customer | Customer | YES | NO | - | YES | Customer.id |
| invoice | Invoice | NO | NO | - | YES | Invoice.id |
| createdByUser | UserProfile | YES | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to Customer via customer
  - belongs to Invoice via invoice
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, returnNumber])

Indexes:
  - @@index([organizationId])
  - @@index([customerId])
  - @@index([invoiceId])
  - @@index([status])
  - @@index([returnDate])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - customerId: MySQL `customerId String @map("customer_id")` vs PG `customerId String @db.Uuid @map("customer_id")`
  - invoiceId: MySQL `invoiceId String? @map("invoice_id")` vs PG `invoiceId String? @db.Uuid @map("invoice_id")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key invoiceId (verify business requirement)

### DeliveryNote
Table: delivery_notes

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| deliveryNumber | String | YES | NO | - | YES | - |
| salesOrderId | String | YES | NO | - | YES | - |
| deliveryDate | DateTime | YES | NO | - | YES | - |
| deliveredBy | String | NO | NO | - | YES | - |
| status | DeliveryNoteStatus | YES | NO | DRAFT | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| salesOrder | SalesOrder | YES | NO | - | YES | SalesOrder.id |
| deliveredByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| deliveryItems | DeliveryNoteItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to SalesOrder via salesOrder
  - belongs to UserProfile via deliveredByUser

Unique constraints:
  - @@unique([organizationId, deliveryNumber])

Indexes:
  - @@index([organizationId])
  - @@index([salesOrderId])
  - @@index([deliveredBy])
  - @@index([status])
  - @@index([deliveryDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - salesOrderId: MySQL `salesOrderId String @map("sales_order_id")` vs PG `salesOrderId String @db.Uuid @map("sales_order_id")`
  - deliveredBy: MySQL `deliveredBy String? @map("delivered_by")` vs PG `deliveredBy String? @db.Uuid @map("delivered_by")`

Potential issues:
  - NONE

### DeliveryNoteItem
Table: delivery_note_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| deliveryNoteId | String | YES | NO | - | YES | - |
| salesOrderItemId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deliveryNote | DeliveryNote | YES | NO | - | YES | DeliveryNote.id |

Relations:
  - belongs to DeliveryNote via deliveryNote

Unique constraints:
  - NONE

Indexes:
  - @@index([deliveryNoteId])
  - @@index([salesOrderItemId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - deliveryNoteId: MySQL `deliveryNoteId String @map("delivery_note_id")` vs PG `deliveryNoteId String @db.Uuid @map("delivery_note_id")`
  - salesOrderItemId: MySQL `salesOrderItemId String @map("sales_order_item_id")` vs PG `salesOrderItemId String @db.Uuid @map("sales_order_item_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### Department
Table: departments

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, code])
  - @@unique([organizationId, name])

Indexes:
  - @@index([organizationId])
  - @@index([name])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### DocumentFile
Table: document_files

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| referenceType | String | YES | NO | - | YES | - |
| referenceId | String | YES | NO | - | YES | - |
| fileName | String | YES | NO | - | YES | - |
| fileUrl | String | YES | NO | - | NO | - |
| fileType | String | YES | NO | - | NO | - |
| fileSize | Int | YES | NO | - | NO | - |
| uploadedBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| uploadedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via uploadedByUser

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([uploadedBy])
  - @@index([referenceType, referenceId])
  - @@index([fileName])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - uploadedBy: MySQL `uploadedBy String? @map("uploaded_by")` vs PG `uploadedBy String? @db.Uuid @map("uploaded_by")`

Potential issues:
  - NONE

### Employee
Table: employees

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| employeeNumber | String | YES | NO | - | YES | - |
| firstName | String | YES | NO | - | YES | - |
| lastName | String | YES | NO | - | YES | - |
| phone | String | NO | NO | - | NO | - |
| email | String | NO | NO | - | NO | - |
| department | String | NO | NO | - | YES | - |
| jobTitle | String | NO | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| status | EmployeeStatus | YES | NO | ACTIVE | YES | - |
| hireDate | DateTime | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| branch | Branch | NO | NO | - | YES | Branch.id |
| userProfile | UserProfile | NO | NO | - | NO | UserProfile.id |
| workerAssignments | ProductionWorkerAssignment[] | NO | NO | - | NO | - |
| attendances | Attendance[] | NO | NO | - | NO | - |
| payrollRecords | PayrollRecord[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Branch via branch
  - belongs to UserProfile via userProfile

Unique constraints:
  - @@unique([organizationId, employeeNumber])

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([status])
  - @@index([department])
  - @@index([jobTitle])
  - @@index([hireDate])
  - @@index([firstName, lastName])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`

Potential issues:
  - nullable relation key branchId (verify business requirement)

### FixedAsset
Table: fixed_assets

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| assetCode | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | NO | - |
| description | String | NO | NO | - | NO | - |
| category | String | YES | NO | - | YES | - |
| location | String | NO | NO | - | NO | - |
| purchaseDate | DateTime | YES | NO | - | YES | - |
| purchaseCost | Decimal | YES | NO | - | NO | - |
| usefulLifeYears | Int | YES | NO | - | NO | - |
| residualValue | Decimal | YES | NO | 0 | NO | - |
| depreciationMethod | String | YES | NO | - | NO | - |
| currentValue | Decimal | YES | NO | - | NO | - |
| accumulatedDep | Decimal | YES | NO | 0 | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| disposalDate | DateTime | NO | NO | - | NO | - |
| disposalValue | Decimal | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| depreciations | AssetDepreciation[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, assetCode])

Indexes:
  - @@index([organizationId])
  - @@index([category])
  - @@index([isActive])
  - @@index([purchaseDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### GoodsReceivedNote
Table: goods_received_notes

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| grnNumber | String | YES | NO | - | YES | - |
| purchaseOrderId | String | YES | NO | - | YES | - |
| warehouseId | String | YES | NO | - | YES | - |
| receivedDate | DateTime | YES | NO | - | YES | - |
| receivedBy | String | YES | NO | - | YES | - |
| status | GRNStatus | YES | NO | DRAFT | YES | - |
| qualityStatus | QualityStatus | YES | NO | PENDING | YES | - |
| qualityNotes | String | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| purchaseOrder | PurchaseOrder | YES | NO | - | YES | PurchaseOrder.id |
| warehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| receivedByUser | UserProfile | YES | NO | - | NO | UserProfile.id |
| items | GoodsReceivedNoteItem[] | NO | NO | - | NO | - |
| supplierReturns | SupplierReturn[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to PurchaseOrder via purchaseOrder
  - belongs to Warehouse via warehouse
  - belongs to UserProfile via receivedByUser

Unique constraints:
  - @@unique([organizationId, grnNumber])

Indexes:
  - @@index([organizationId])
  - @@index([purchaseOrderId])
  - @@index([warehouseId])
  - @@index([receivedBy])
  - @@index([status])
  - @@index([qualityStatus])
  - @@index([receivedDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - purchaseOrderId: MySQL `purchaseOrderId String @map("purchase_order_id")` vs PG `purchaseOrderId String @db.Uuid @map("purchase_order_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`
  - receivedBy: MySQL `receivedBy String @map("received_by")` vs PG `receivedBy String @db.Uuid @map("received_by")`

Potential issues:
  - NONE

### GoodsReceivedNoteItem
Table: goods_received_note_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| grnId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| poItemId | String | YES | NO | - | YES | - |
| quantityExpected | Decimal | YES | NO | - | NO | - |
| quantityReceived | Decimal | YES | NO | - | NO | - |
| quantityRejected | Decimal | YES | NO | 0 | NO | - |
| unitCost | Decimal | YES | NO | - | NO | - |
| batchNumber | String | NO | NO | - | NO | - |
| expiryDate | DateTime | NO | NO | - | YES | - |
| qualityNotes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| grn | GoodsReceivedNote | YES | NO | - | YES | GoodsReceivedNote.id |
| item | Item | YES | NO | - | YES | Item.id |
| poItem | PurchaseOrderItem | YES | NO | - | YES | PurchaseOrderItem.id |

Relations:
  - belongs to GoodsReceivedNote via grn
  - belongs to Item via item
  - belongs to PurchaseOrderItem via poItem

Unique constraints:
  - NONE

Indexes:
  - @@index([grnId])
  - @@index([itemId])
  - @@index([poItemId])
  - @@index([expiryDate])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - grnId: MySQL `grnId String @map("grn_id")` vs PG `grnId String @db.Uuid @map("grn_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - poItemId: MySQL `poItemId String @map("po_item_id")` vs PG `poItemId String @db.Uuid @map("po_item_id")`

Potential issues:
  - NONE

### InventoryBatch
Table: inventory_batches

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| warehouseId | String | YES | NO | - | YES | - |
| batchNumber | String | YES | NO | - | YES | - |
| manufacturedDate | DateTime | NO | NO | - | YES | - |
| expiryDate | DateTime | NO | NO | - | YES | - |
| quantityReceived | Decimal | YES | NO | - | NO | - |
| quantityRemaining | Decimal | YES | NO | - | NO | - |
| unitCost | Decimal | YES | NO | - | NO | - |
| supplierId | String | NO | NO | - | YES | - |
| status | InventoryBatchStatus | YES | NO | ACTIVE | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| item | Item | YES | NO | - | YES | Item.id |
| warehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| supplier | Supplier | NO | NO | - | YES | Supplier.id |
| stockMovements | StockMovement[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Item via item
  - belongs to Warehouse via warehouse
  - belongs to Supplier via supplier

Unique constraints:
  - @@unique([warehouseId, itemId, batchNumber])

Indexes:
  - @@index([organizationId])
  - @@index([itemId])
  - @@index([warehouseId])
  - @@index([supplierId])
  - @@index([status])
  - @@index([manufacturedDate])
  - @@index([expiryDate])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`
  - supplierId: MySQL `supplierId String? @map("supplier_id")` vs PG `supplierId String? @db.Uuid @map("supplier_id")`

Potential issues:
  - nullable relation key supplierId (verify business requirement)

### Invoice
Table: invoices

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| invoiceNumber | String | YES | NO | - | YES | - |
| customerId | String | YES | NO | - | YES | - |
| salesOrderId | String | NO | NO | - | YES | - |
| invoiceDate | DateTime | YES | NO | - | YES | - |
| dueDate | DateTime | NO | NO | - | YES | - |
| status | InvoiceStatus | YES | NO | DRAFT | YES | - |
| subtotal | Decimal | YES | NO | - | NO | - |
| taxAmount | Decimal | YES | NO | 0 | NO | - |
| discountAmount | Decimal | YES | NO | 0 | NO | - |
| total | Decimal | YES | NO | - | NO | - |
| amountPaid | Decimal | YES | NO | 0 | NO | - |
| balanceDue | Decimal | YES | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| customer | Customer | YES | NO | - | YES | Customer.id |
| salesOrder | SalesOrder | NO | NO | - | YES | SalesOrder.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | InvoiceItem[] | NO | NO | - | NO | - |
| customerReturns | CustomerReturn[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Customer via customer
  - belongs to SalesOrder via salesOrder
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, invoiceNumber])

Indexes:
  - @@index([organizationId])
  - @@index([customerId])
  - @@index([salesOrderId])
  - @@index([status])
  - @@index([invoiceDate])
  - @@index([dueDate])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - customerId: MySQL `customerId String @map("customer_id")` vs PG `customerId String @db.Uuid @map("customer_id")`
  - salesOrderId: MySQL `salesOrderId String? @map("sales_order_id")` vs PG `salesOrderId String? @db.Uuid @map("sales_order_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key salesOrderId (verify business requirement)

### InvoiceItem
Table: invoice_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| invoiceId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitPrice | Decimal | YES | NO | - | NO | - |
| discountPercent | Decimal | NO | NO | - | NO | - |
| totalPrice | Decimal | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| invoice | Invoice | YES | NO | - | YES | Invoice.id |
| item | Item | YES | NO | - | YES | Item.id |

Relations:
  - belongs to Invoice via invoice
  - belongs to Item via item

Unique constraints:
  - NONE

Indexes:
  - @@index([invoiceId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - invoiceId: MySQL `invoiceId String @map("invoice_id")` vs PG `invoiceId String @db.Uuid @map("invoice_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### Item
Table: items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| itemType | ItemType | YES | NO | - | YES | - |
| categoryId | String | YES | NO | - | YES | - |
| unitOfMeasureId | String | YES | NO | - | YES | - |
| reorderLevel | Decimal | NO | NO | - | NO | - |
| reorderQuantity | Decimal | NO | NO | - | NO | - |
| unitCost | Decimal | NO | NO | - | NO | - |
| sellingPrice | Decimal | NO | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| trackExpiry | Boolean | YES | NO | false | NO | - |
| imageUrl | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| category | ItemCategory | YES | NO | - | YES | ItemCategory.id |
| unitOfMeasure | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |
| inventoryBatches | InventoryBatch[] | NO | NO | - | NO | - |
| stockBalances | StockBalance[] | NO | NO | - | NO | - |
| stockMovements | StockMovement[] | NO | NO | - | NO | - |
| stockTransferItems | StockTransferItem[] | NO | NO | - | NO | - |
| requisitionItems | PurchaseRequisitionItem[] | NO | NO | - | NO | - |
| purchaseOrderItems | PurchaseOrderItem[] | NO | NO | - | NO | - |
| grnItems | GoodsReceivedNoteItem[] | NO | NO | - | NO | - |
| recipeAsFinishedGood | Recipe[] | NO | NO | - | NO | Recipe.id |
| recipeMaterials | RecipeItem[] | NO | NO | - | NO | RecipeItem.id |
| recipeSubstitutions | RecipeItem[] | NO | NO | - | NO | RecipeItem.id |
| productionBatchMaterials | ProductionBatchMaterial[] | NO | NO | - | NO | - |
| productionBatchOutputs | ProductionBatchOutput[] | NO | NO | - | NO | - |
| quotationItems | QuotationItem[] | NO | NO | - | NO | - |
| salesOrderItems | SalesOrderItem[] | NO | NO | - | NO | - |
| invoiceItems | InvoiceItem[] | NO | NO | - | NO | - |
| branchSaleItems | BranchSaleItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to ItemCategory via category
  - belongs to UnitOfMeasure via unitOfMeasure
  - has many Recipe via recipeAsFinishedGood
  - has many RecipeItem via recipeMaterials
  - has many RecipeItem via recipeSubstitutions

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([categoryId])
  - @@index([unitOfMeasureId])
  - @@index([itemType])
  - @@index([name])
  - @@index([isActive])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - categoryId: MySQL `categoryId String @map("category_id")` vs PG `categoryId String @db.Uuid @map("category_id")`
  - unitOfMeasureId: MySQL `unitOfMeasureId String @map("unit_of_measure_id")` vs PG `unitOfMeasureId String @db.Uuid @map("unit_of_measure_id")`

Potential issues:
  - NONE

### ItemCategory
Table: item_categories

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| items | Item[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization

Unique constraints:
  - @@unique([organizationId, name])

Indexes:
  - @@index([organizationId])
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### JournalEntry
Table: journal_entries

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| entryNumber | String | YES | NO | - | YES | - |
| entryDate | DateTime | YES | NO | - | YES | - |
| description | String | YES | NO | - | NO | - |
| referenceType | String | NO | NO | - | YES | - |
| referenceId | String | NO | NO | - | YES | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| lines | JournalEntryLine[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, entryNumber])

Indexes:
  - @@index([organizationId])
  - @@index([entryDate])
  - @@index([createdBy])
  - @@index([referenceType, referenceId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key referenceId (verify business requirement)

### JournalEntryLine
Table: journal_entry_lines

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| journalEntryId | String | YES | NO | - | YES | - |
| accountId | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| debitAmount | Decimal | YES | NO | 0 | NO | - |
| creditAmount | Decimal | YES | NO | 0 | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| journalEntry | JournalEntry | YES | NO | - | YES | JournalEntry.id |
| account | Account | YES | NO | - | YES | Account.id |

Relations:
  - belongs to JournalEntry via journalEntry
  - belongs to Account via account

Unique constraints:
  - NONE

Indexes:
  - @@index([journalEntryId])
  - @@index([accountId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - journalEntryId: MySQL `journalEntryId String @map("journal_entry_id")` vs PG `journalEntryId String @db.Uuid @map("journal_entry_id")`
  - accountId: MySQL `accountId String @map("account_id")` vs PG `accountId String @db.Uuid @map("account_id")`

Potential issues:
  - NONE

### LeaveRequest
Table: leave_requests

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| employeeId | String | YES | NO | - | YES | - |
| leaveType | String | YES | NO | - | NO | - |
| startDate | DateTime | YES | NO | - | YES | - |
| endDate | DateTime | YES | NO | - | YES | - |
| daysRequested | Decimal | YES | NO | - | NO | - |
| reason | String | NO | NO | - | NO | - |
| status | LeaveStatus | YES | NO | - | YES | - |
| approvedBy | String | NO | NO | - | NO | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([employeeId])
  - @@index([status])
  - @@index([startDate])
  - @@index([endDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - employeeId: MySQL `employeeId String @map("employee_id")` vs PG `employeeId String @db.Uuid @map("employee_id")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - NONE

### Machine
Table: machines

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| location | String | NO | NO | - | NO | - |
| machineType | String | YES | NO | - | NO | - |
| status | String | YES | NO | - | YES | - |
| purchaseDate | DateTime | NO | NO | - | NO | - |
| warrantyExpiry | DateTime | NO | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| maintenanceSchedules | MaintenanceSchedule[] | NO | NO | - | NO | - |
| breakdowns | MachineBreakdown[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([status])
  - @@index([name])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### MachineBreakdown
Table: machine_breakdowns

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| machineId | String | YES | NO | - | YES | - |
| breakdownDate | DateTime | YES | NO | - | YES | - |
| description | String | YES | NO | - | NO | - |
| severity | String | YES | NO | - | NO | - |
| status | MaintenanceStatus | YES | NO | - | YES | - |
| reportedBy | String | YES | NO | - | NO | - |
| resolvedAt | DateTime | NO | NO | - | NO | - |
| downtimeHours | Decimal | NO | NO | - | NO | - |
| repairCost | Decimal | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| machine | Machine | YES | NO | - | YES | Machine.id |

Relations:
  - belongs to Machine via machine

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([machineId])
  - @@index([status])
  - @@index([breakdownDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - machineId: MySQL `machineId String @map("machine_id")` vs PG `machineId String @db.Uuid @map("machine_id")`
  - reportedBy: MySQL `reportedBy String @map("reported_by")` vs PG `reportedBy String @db.Uuid @map("reported_by")`

Potential issues:
  - NONE

### MaintenanceSchedule
Table: maintenance_schedules

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| machineId | String | YES | NO | - | YES | - |
| maintenanceType | MaintenanceType | YES | NO | - | YES | - |
| status | MaintenanceStatus | YES | NO | - | YES | - |
| scheduledDate | DateTime | YES | NO | - | YES | - |
| completedDate | DateTime | NO | NO | - | NO | - |
| performedBy | String | NO | NO | - | NO | - |
| cost | Decimal | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| machine | Machine | YES | NO | - | YES | Machine.id |

Relations:
  - belongs to Machine via machine

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([machineId])
  - @@index([maintenanceType])
  - @@index([status])
  - @@index([scheduledDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - machineId: MySQL `machineId String @map("machine_id")` vs PG `machineId String @db.Uuid @map("machine_id")`
  - performedBy: MySQL `performedBy String? @map("performed_by")` vs PG `performedBy String? @db.Uuid @map("performed_by")`

Potential issues:
  - NONE

### Notification
Table: notifications

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| userProfileId | String | YES | NO | - | YES | - |
| title | String | YES | NO | - | NO | - |
| message | String | YES | NO | - | NO | - |
| type | NotificationType | YES | NO | - | YES | - |
| isRead | Boolean | YES | NO | false | YES | - |
| referenceType | String | NO | NO | - | YES | - |
| referenceId | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | YES | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| userProfile | UserProfile | YES | NO | - | YES | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via userProfile

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([userProfileId])
  - @@index([type])
  - @@index([isRead])
  - @@index([createdAt])
  - @@index([referenceType, referenceId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - userProfileId: MySQL `userProfileId String @map("user_profile_id")` vs PG `userProfileId String @db.Uuid @map("user_profile_id")`

Potential issues:
  - nullable relation key referenceId (verify business requirement)

### NumberSeries
Table: number_series

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| seriesType | String | YES | NO | - | YES | - |
| prefix | String | YES | NO | - | NO | - |
| lastNumber | Int | YES | NO | 0 | NO | - |
| padding | Int | YES | NO | 4 | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, seriesType])

Indexes:
  - @@index([organizationId])
  - @@index([seriesType])
  - @@index([isActive])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### Organization
Table: organizations

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| name | String | YES | NO | - | YES | - |
| logoUrl | String | NO | NO | - | NO | - |
| address | String | NO | NO | - | NO | - |
| phone | String | NO | NO | - | NO | - |
| email | String | NO | NO | - | NO | - |
| taxNumber | String | NO | NO | - | NO | - |
| currency | String | YES | NO | "USD" | NO | - |
| financialYearStart | Int | YES | NO | 1 | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| userProfiles | UserProfile[] | NO | NO | - | NO | - |
| userAccounts | UserAccount[] | NO | NO | - | NO | - |
| roles | Role[] | NO | NO | - | NO | - |
| branches | Branch[] | NO | NO | - | NO | - |
| warehouses | Warehouse[] | NO | NO | - | NO | - |
| itemCategories | ItemCategory[] | NO | NO | - | NO | - |
| unitsOfMeasure | UnitOfMeasure[] | NO | NO | - | NO | - |
| items | Item[] | NO | NO | - | NO | - |
| inventoryBatches | InventoryBatch[] | NO | NO | - | NO | - |
| stockBalances | StockBalance[] | NO | NO | - | NO | - |
| stockMovements | StockMovement[] | NO | NO | - | NO | - |
| stockTransfers | StockTransfer[] | NO | NO | - | NO | - |
| supplierCategories | SupplierCategory[] | NO | NO | - | NO | - |
| suppliers | Supplier[] | NO | NO | - | NO | - |
| purchaseRequisitions | PurchaseRequisition[] | NO | NO | - | NO | - |
| purchaseOrders | PurchaseOrder[] | NO | NO | - | NO | - |
| goodsReceivedNotes | GoodsReceivedNote[] | NO | NO | - | NO | - |
| supplierReturns | SupplierReturn[] | NO | NO | - | NO | - |
| recipes | Recipe[] | NO | NO | - | NO | - |
| productionPlans | ProductionPlan[] | NO | NO | - | NO | - |
| productionBatches | ProductionBatch[] | NO | NO | - | NO | - |
| qualityChecks | QualityCheck[] | NO | NO | - | NO | - |
| customers | Customer[] | NO | NO | - | NO | - |
| quotations | Quotation[] | NO | NO | - | NO | - |
| salesOrders | SalesOrder[] | NO | NO | - | NO | - |
| deliveryNotes | DeliveryNote[] | NO | NO | - | NO | - |
| invoices | Invoice[] | NO | NO | - | NO | - |
| payments | Payment[] | NO | NO | - | NO | - |
| customerReturns | CustomerReturn[] | NO | NO | - | NO | - |
| branchSales | BranchSale[] | NO | NO | - | NO | - |
| branchExpenses | BranchExpense[] | NO | NO | - | NO | - |
| branchShiftCloses | BranchShiftClose[] | NO | NO | - | NO | - |
| employees | Employee[] | NO | NO | - | NO | - |
| attendances | Attendance[] | NO | NO | - | NO | - |
| payrollRecords | PayrollRecord[] | NO | NO | - | NO | - |
| accounts | Account[] | NO | NO | - | NO | - |
| journalEntries | JournalEntry[] | NO | NO | - | NO | - |
| documentFiles | DocumentFile[] | NO | NO | - | NO | - |
| notifications | Notification[] | NO | NO | - | NO | - |
| auditLogs | AuditLog[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`

Potential issues:
  - NONE

### PasswordResetToken
Table: password_reset_tokens

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| userAccountId | String | YES | NO | - | YES | - |
| userAccount | UserAccount | YES | NO | - | YES | UserAccount.id |
| token | String | YES | YES | - | YES | - |
| expiresAt | DateTime | YES | NO | - | YES | - |
| usedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |

Relations:
  - belongs to UserAccount via userAccount

Unique constraints:
  - NONE

Indexes:
  - @@index([userAccountId])
  - @@index([expiresAt])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - userAccountId: MySQL `userAccountId String @map("user_account_id")` vs PG `userAccountId String @db.Uuid @map("user_account_id")`

Potential issues:
  - NONE

### Payment
Table: payments

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| paymentNumber | String | YES | NO | - | YES | - |
| customerId | String | NO | NO | - | YES | - |
| supplierId | String | NO | NO | - | YES | - |
| paymentDate | DateTime | YES | NO | - | YES | - |
| amount | Decimal | YES | NO | - | NO | - |
| paymentMethod | PaymentMethod | YES | NO | - | YES | - |
| referenceNumber | String | NO | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| customer | Customer | NO | NO | - | YES | Customer.id |
| supplier | Supplier | NO | NO | - | YES | Supplier.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to Customer via customer
  - belongs to Supplier via supplier
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, paymentNumber])

Indexes:
  - @@index([organizationId])
  - @@index([customerId])
  - @@index([supplierId])
  - @@index([paymentMethod])
  - @@index([paymentDate])
  - @@index([referenceNumber])
  - @@index([createdBy])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - customerId: MySQL `customerId String? @map("customer_id")` vs PG `customerId String? @db.Uuid @map("customer_id")`
  - supplierId: MySQL `supplierId String? @map("supplier_id")` vs PG `supplierId String? @db.Uuid @map("supplier_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key customerId (verify business requirement)
  - nullable relation key supplierId (verify business requirement)

### PayrollRecord
Table: payroll_records

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| employeeId | String | YES | NO | - | YES | - |
| payPeriodStart | DateTime | YES | NO | - | YES | - |
| payPeriodEnd | DateTime | YES | NO | - | YES | - |
| basicSalary | Decimal | YES | NO | - | NO | - |
| allowances | Decimal | YES | NO | 0 | NO | - |
| deductions | Decimal | YES | NO | 0 | NO | - |
| netPay | Decimal | YES | NO | - | NO | - |
| status | PayrollStatus | YES | NO | DRAFT | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| employee | Employee | YES | NO | - | YES | Employee.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to Employee via employee
  - belongs to UserProfile via createdByUser

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([employeeId])
  - @@index([status])
  - @@index([payPeriodStart])
  - @@index([payPeriodEnd])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - employeeId: MySQL `employeeId String @map("employee_id")` vs PG `employeeId String @db.Uuid @map("employee_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### Permission
Table: permissions

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| code | String | YES | YES | - | YES | - |
| name | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| module | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| rolePermissions | RolePermission[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([module])
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`

Potential issues:
  - NONE

### PettyCashReplenishment
Table: petty_cash_replenishments

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| replenishmentNumber | String | YES | NO | - | YES | - |
| cashAccountId | String | YES | NO | - | YES | - |
| requestId | String | NO | NO | - | YES | - |
| replenishmentDate | DateTime | YES | NO | - | YES | - |
| amount | Decimal | YES | NO | - | NO | - |
| status | TransactionStatus | YES | NO | - | YES | - |
| approvedBy | String | NO | NO | - | NO | - |
| createdBy | String | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, replenishmentNumber])

Indexes:
  - @@index([organizationId])
  - @@index([cashAccountId])
  - @@index([requestId])
  - @@index([replenishmentDate])
  - @@index([status])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - cashAccountId: MySQL `cashAccountId String @map("cash_account_id")` vs PG `cashAccountId String @db.Uuid @map("cash_account_id")`
  - requestId: MySQL `requestId String? @map("request_id")` vs PG `requestId String? @db.Uuid @map("request_id")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key requestId (verify business requirement)

### PettyCashRequest
Table: petty_cash_requests

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| requestNumber | String | YES | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| requestedBy | String | YES | NO | - | YES | - |
| requestDate | DateTime | YES | NO | - | YES | - |
| amountRequested | Decimal | YES | NO | - | NO | - |
| purpose | String | YES | NO | - | NO | - |
| status | ApprovalStatus | YES | NO | - | YES | - |
| approvalRequestId | String | NO | NO | - | NO | - |
| approvedBy | String | NO | NO | - | NO | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| disbursedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, requestNumber])

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([requestedBy])
  - @@index([status])
  - @@index([requestDate])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`
  - requestedBy: MySQL `requestedBy String @map("requested_by")` vs PG `requestedBy String @db.Uuid @map("requested_by")`
  - approvalRequestId: MySQL `approvalRequestId String? @map("approval_request_id")` vs PG `approvalRequestId String? @db.Uuid @map("approval_request_id")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - missing index on FK-like field approvalRequestId
  - nullable relation key branchId (verify business requirement)
  - nullable relation key approvalRequestId (verify business requirement)

### ProductionBatch
Table: production_batches

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| batchNumber | String | YES | NO | - | YES | - |
| productionPlanId | String | NO | NO | - | YES | - |
| recipeId | String | YES | NO | - | YES | - |
| productionDate | DateTime | YES | NO | - | YES | - |
| shift | ShiftType | YES | NO | - | YES | - |
| productionLine | String | YES | NO | - | NO | - |
| warehouseId | String | YES | NO | - | YES | - |
| plannedQuantity | Decimal | YES | NO | - | NO | - |
| expectedOutput | Decimal | YES | NO | - | NO | - |
| actualOutput | Decimal | NO | NO | - | NO | - |
| wastageQuantity | Decimal | NO | NO | - | NO | - |
| wastagePercentage | Decimal | NO | NO | - | NO | - |
| efficiencyPercentage | Decimal | NO | NO | - | NO | - |
| status | ProductionBatchStatus | YES | NO | DRAFT | YES | - |
| qualityStatus | QualityStatus | YES | NO | PENDING | YES | - |
| wastageReason | String | NO | NO | - | NO | - |
| qualityNotes | String | NO | NO | - | NO | - |
| startedBy | String | NO | NO | - | YES | - |
| closedBy | String | NO | NO | - | YES | - |
| startTime | DateTime | NO | NO | - | NO | - |
| endTime | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| productionPlan | ProductionPlan | NO | NO | - | YES | ProductionPlan.id |
| recipe | Recipe | YES | NO | - | YES | Recipe.id |
| warehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| startedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| closedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| materials | ProductionBatchMaterial[] | NO | NO | - | NO | - |
| outputs | ProductionBatchOutput[] | NO | NO | - | NO | - |
| workerAssignments | ProductionWorkerAssignment[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to ProductionPlan via productionPlan
  - belongs to Recipe via recipe
  - belongs to Warehouse via warehouse
  - belongs to UserProfile via startedByUser
  - belongs to UserProfile via closedByUser

Unique constraints:
  - @@unique([organizationId, batchNumber])

Indexes:
  - @@index([organizationId])
  - @@index([productionPlanId])
  - @@index([recipeId])
  - @@index([warehouseId])
  - @@index([status])
  - @@index([qualityStatus])
  - @@index([productionDate])
  - @@index([shift])
  - @@index([startedBy])
  - @@index([closedBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - productionPlanId: MySQL `productionPlanId String? @map("production_plan_id")` vs PG `productionPlanId String? @db.Uuid @map("production_plan_id")`
  - recipeId: MySQL `recipeId String @map("recipe_id")` vs PG `recipeId String @db.Uuid @map("recipe_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`
  - startedBy: MySQL `startedBy String? @map("started_by")` vs PG `startedBy String? @db.Uuid @map("started_by")`
  - closedBy: MySQL `closedBy String? @map("closed_by")` vs PG `closedBy String? @db.Uuid @map("closed_by")`

Potential issues:
  - nullable relation key productionPlanId (verify business requirement)

### ProductionBatchMaterial
Table: production_batch_materials

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| batchId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequired | Decimal | YES | NO | - | NO | - |
| quantityIssued | Decimal | NO | NO | - | NO | - |
| quantityActual | Decimal | NO | NO | - | NO | - |
| variance | Decimal | NO | NO | - | NO | - |
| unitId | String | YES | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| batch | ProductionBatch | YES | NO | - | YES | ProductionBatch.id |
| item | Item | YES | NO | - | YES | Item.id |
| unit | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |

Relations:
  - belongs to ProductionBatch via batch
  - belongs to Item via item
  - belongs to UnitOfMeasure via unit

Unique constraints:
  - NONE

Indexes:
  - @@index([batchId])
  - @@index([itemId])
  - @@index([unitId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - batchId: MySQL `batchId String @map("batch_id")` vs PG `batchId String @db.Uuid @map("batch_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitId: MySQL `unitId String @map("unit_id")` vs PG `unitId String @db.Uuid @map("unit_id")`

Potential issues:
  - NONE

### ProductionBatchOutput
Table: production_batch_outputs

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| batchId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| expectedQuantity | Decimal | YES | NO | - | NO | - |
| actualQuantity | Decimal | NO | NO | - | NO | - |
| wastageQuantity | Decimal | NO | NO | - | NO | - |
| unitId | String | YES | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| batch | ProductionBatch | YES | NO | - | YES | ProductionBatch.id |
| item | Item | YES | NO | - | YES | Item.id |
| unit | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |

Relations:
  - belongs to ProductionBatch via batch
  - belongs to Item via item
  - belongs to UnitOfMeasure via unit

Unique constraints:
  - NONE

Indexes:
  - @@index([batchId])
  - @@index([itemId])
  - @@index([unitId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - batchId: MySQL `batchId String @map("batch_id")` vs PG `batchId String @db.Uuid @map("batch_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitId: MySQL `unitId String @map("unit_id")` vs PG `unitId String @db.Uuid @map("unit_id")`

Potential issues:
  - NONE

### ProductionMaterialRequest
Table: production_material_requests

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| requestNumber | String | YES | NO | - | YES | - |
| productionBatchId | String | YES | NO | - | YES | - |
| requestDate | DateTime | YES | NO | - | YES | - |
| status | ApprovalStatus | YES | NO | PENDING | YES | - |
| approvalRequestId | String | NO | NO | - | YES | - |
| requestedBy | String | YES | NO | - | YES | - |
| approvedBy | String | NO | NO | - | NO | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| items | ProductionMaterialRequestItem[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, requestNumber])

Indexes:
  - @@index([organizationId])
  - @@index([productionBatchId])
  - @@index([status])
  - @@index([requestDate])
  - @@index([approvalRequestId])
  - @@index([requestedBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - productionBatchId: MySQL `productionBatchId String @map("production_batch_id")` vs PG `productionBatchId String @db.Uuid @map("production_batch_id")`
  - approvalRequestId: MySQL `approvalRequestId String? @map("approval_request_id")` vs PG `approvalRequestId String? @db.Uuid @map("approval_request_id")`
  - requestedBy: MySQL `requestedBy String @map("requested_by")` vs PG `requestedBy String @db.Uuid @map("requested_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - nullable relation key approvalRequestId (verify business requirement)

### ProductionMaterialRequestItem
Table: production_material_request_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| productionMaterialRequestId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequested | Decimal | YES | NO | - | NO | - |
| quantityApproved | Decimal | NO | NO | - | NO | - |
| quantityIssued | Decimal | NO | NO | - | NO | - |
| unitOfMeasureId | String | YES | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| productionMaterialRequest | ProductionMaterialRequest | YES | NO | - | YES | ProductionMaterialRequest.id |

Relations:
  - belongs to ProductionMaterialRequest via productionMaterialRequest

Unique constraints:
  - NONE

Indexes:
  - @@index([productionMaterialRequestId])
  - @@index([itemId])
  - @@index([unitOfMeasureId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - productionMaterialRequestId: MySQL `productionMaterialRequestId String @map("production_material_request_id")` vs PG `productionMaterialRequestId String @db.Uuid @map("production_material_request_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitOfMeasureId: MySQL `unitOfMeasureId String @map("unit_of_measure_id")` vs PG `unitOfMeasureId String @db.Uuid @map("unit_of_measure_id")`

Potential issues:
  - NONE

### ProductionPlan
Table: production_plans

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| planNumber | String | YES | NO | - | YES | - |
| planDate | DateTime | YES | NO | - | YES | - |
| shift | ShiftType | YES | NO | - | YES | - |
| productionLine | String | YES | NO | - | YES | - |
| status | ProductionPlanStatus | YES | NO | DRAFT | YES | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| batches | ProductionBatch[] | NO | NO | - | NO | - |
| planItems | ProductionPlanItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, planNumber])

Indexes:
  - @@index([organizationId])
  - @@index([status])
  - @@index([planDate])
  - @@index([shift])
  - @@index([productionLine])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### ProductionPlanItem
Table: production_plan_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| productionPlanId | String | YES | NO | - | YES | - |
| recipeId | String | YES | NO | - | YES | - |
| plannedQuantity | Decimal | YES | NO | - | NO | - |
| expectedOutput | Decimal | YES | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| productionPlan | ProductionPlan | YES | NO | - | YES | ProductionPlan.id |

Relations:
  - belongs to ProductionPlan via productionPlan

Unique constraints:
  - NONE

Indexes:
  - @@index([productionPlanId])
  - @@index([recipeId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - productionPlanId: MySQL `productionPlanId String @map("production_plan_id")` vs PG `productionPlanId String @db.Uuid @map("production_plan_id")`
  - recipeId: MySQL `recipeId String @map("recipe_id")` vs PG `recipeId String @db.Uuid @map("recipe_id")`

Potential issues:
  - NONE

### ProductionWastage
Table: production_wastage

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| productionBatchId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| wastageType | WastageType | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitCost | Decimal | YES | NO | - | NO | - |
| totalCost | Decimal | YES | NO | - | NO | - |
| reason | String | NO | NO | - | NO | - |
| reportedBy | String | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | YES | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([productionBatchId])
  - @@index([itemId])
  - @@index([wastageType])
  - @@index([createdAt])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - productionBatchId: MySQL `productionBatchId String @map("production_batch_id")` vs PG `productionBatchId String @db.Uuid @map("production_batch_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - reportedBy: MySQL `reportedBy String @map("reported_by")` vs PG `reportedBy String @db.Uuid @map("reported_by")`

Potential issues:
  - NONE

### ProductionWorkerAssignment
Table: production_worker_assignments

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| batchId | String | YES | NO | - | YES | - |
| employeeId | String | YES | NO | - | YES | - |
| shift | ShiftType | YES | NO | - | YES | - |
| roleInProduction | String | YES | NO | - | YES | - |
| startTime | DateTime | NO | NO | - | NO | - |
| endTime | DateTime | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| batch | ProductionBatch | YES | NO | - | YES | ProductionBatch.id |
| employee | Employee | YES | NO | - | YES | Employee.id |

Relations:
  - belongs to ProductionBatch via batch
  - belongs to Employee via employee

Unique constraints:
  - NONE

Indexes:
  - @@index([batchId])
  - @@index([employeeId])
  - @@index([shift])
  - @@index([roleInProduction])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - batchId: MySQL `batchId String @map("batch_id")` vs PG `batchId String @db.Uuid @map("batch_id")`
  - employeeId: MySQL `employeeId String @map("employee_id")` vs PG `employeeId String @db.Uuid @map("employee_id")`

Potential issues:
  - NONE

### PurchaseOrder
Table: purchase_orders

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| poNumber | String | YES | NO | - | YES | - |
| supplierId | String | YES | NO | - | YES | - |
| requisitionId | String | NO | NO | - | YES | - |
| orderDate | DateTime | YES | NO | - | YES | - |
| expectedDeliveryDate | DateTime | NO | NO | - | YES | - |
| status | PurchaseOrderStatus | YES | NO | DRAFT | YES | - |
| subtotal | Decimal | YES | NO | - | NO | - |
| taxAmount | Decimal | YES | NO | 0 | NO | - |
| discountAmount | Decimal | YES | NO | 0 | NO | - |
| total | Decimal | YES | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| approvedBy | String | NO | NO | - | YES | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| supplier | Supplier | YES | NO | - | YES | Supplier.id |
| requisition | PurchaseRequisition | NO | NO | - | YES | PurchaseRequisition.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| approvedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | PurchaseOrderItem[] | NO | NO | - | NO | - |
| goodsReceivedNotes | GoodsReceivedNote[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Supplier via supplier
  - belongs to PurchaseRequisition via requisition
  - belongs to UserProfile via createdByUser
  - belongs to UserProfile via approvedByUser

Unique constraints:
  - @@unique([organizationId, poNumber])

Indexes:
  - @@index([organizationId])
  - @@index([supplierId])
  - @@index([requisitionId])
  - @@index([status])
  - @@index([orderDate])
  - @@index([expectedDeliveryDate])
  - @@index([createdBy])
  - @@index([approvedBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - supplierId: MySQL `supplierId String @map("supplier_id")` vs PG `supplierId String @db.Uuid @map("supplier_id")`
  - requisitionId: MySQL `requisitionId String? @map("requisition_id")` vs PG `requisitionId String? @db.Uuid @map("requisition_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - nullable relation key requisitionId (verify business requirement)

### PurchaseOrderItem
Table: purchase_order_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| purchaseOrderId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityOrdered | Decimal | YES | NO | - | NO | - |
| quantityReceived | Decimal | YES | NO | 0 | NO | - |
| unitCost | Decimal | YES | NO | - | NO | - |
| totalCost | Decimal | YES | NO | - | NO | - |
| unitOfMeasureId | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| purchaseOrder | PurchaseOrder | YES | NO | - | YES | PurchaseOrder.id |
| item | Item | YES | NO | - | YES | Item.id |
| unitOfMeasure | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |
| grnItems | GoodsReceivedNoteItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to PurchaseOrder via purchaseOrder
  - belongs to Item via item
  - belongs to UnitOfMeasure via unitOfMeasure

Unique constraints:
  - NONE

Indexes:
  - @@index([purchaseOrderId])
  - @@index([itemId])
  - @@index([unitOfMeasureId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - purchaseOrderId: MySQL `purchaseOrderId String @map("purchase_order_id")` vs PG `purchaseOrderId String @db.Uuid @map("purchase_order_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitOfMeasureId: MySQL `unitOfMeasureId String @map("unit_of_measure_id")` vs PG `unitOfMeasureId String @db.Uuid @map("unit_of_measure_id")`

Potential issues:
  - NONE

### PurchaseRequisition
Table: purchase_requisitions

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| requisitionNumber | String | YES | NO | - | YES | - |
| requestedBy | String | YES | NO | - | YES | - |
| department | String | YES | NO | - | YES | - |
| requestDate | DateTime | YES | NO | - | YES | - |
| neededByDate | DateTime | NO | NO | - | YES | - |
| status | PurchaseRequisitionStatus | YES | NO | DRAFT | YES | - |
| approvalStatus | PurchaseRequisitionStatus | YES | NO | DRAFT | YES | - |
| approvedBy | String | NO | NO | - | YES | - |
| approvedAt | DateTime | NO | NO | - | NO | - |
| remarks | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| requestedByUser | UserProfile | YES | NO | - | NO | UserProfile.id |
| approvedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | PurchaseRequisitionItem[] | NO | NO | - | NO | - |
| purchaseOrders | PurchaseOrder[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via requestedByUser
  - belongs to UserProfile via approvedByUser

Unique constraints:
  - @@unique([organizationId, requisitionNumber])

Indexes:
  - @@index([organizationId])
  - @@index([requestedBy])
  - @@index([approvedBy])
  - @@index([status])
  - @@index([approvalStatus])
  - @@index([requestDate])
  - @@index([neededByDate])
  - @@index([department])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - requestedBy: MySQL `requestedBy String @map("requested_by")` vs PG `requestedBy String @db.Uuid @map("requested_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - NONE

### PurchaseRequisitionItem
Table: purchase_requisition_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| requisitionId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequested | Decimal | YES | NO | - | NO | - |
| quantityApproved | Decimal | NO | NO | - | NO | - |
| unitOfMeasureId | String | YES | NO | - | YES | - |
| estimatedUnitCost | Decimal | NO | NO | - | NO | - |
| remarks | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| requisition | PurchaseRequisition | YES | NO | - | YES | PurchaseRequisition.id |
| item | Item | YES | NO | - | YES | Item.id |
| unitOfMeasure | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |

Relations:
  - belongs to PurchaseRequisition via requisition
  - belongs to Item via item
  - belongs to UnitOfMeasure via unitOfMeasure

Unique constraints:
  - NONE

Indexes:
  - @@index([requisitionId])
  - @@index([itemId])
  - @@index([unitOfMeasureId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - requisitionId: MySQL `requisitionId String @map("requisition_id")` vs PG `requisitionId String @db.Uuid @map("requisition_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitOfMeasureId: MySQL `unitOfMeasureId String @map("unit_of_measure_id")` vs PG `unitOfMeasureId String @db.Uuid @map("unit_of_measure_id")`

Potential issues:
  - NONE

### QualityCheck
Table: quality_checks

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| referenceType | String | YES | NO | - | YES | - |
| referenceId | String | YES | NO | - | YES | - |
| checkedBy | String | NO | NO | - | YES | - |
| checkDate | DateTime | YES | NO | - | YES | - |
| status | QualityStatus | YES | NO | PENDING | YES | - |
| notes | String | NO | NO | - | NO | - |
| passedQuantity | Decimal | NO | NO | - | NO | - |
| failedQuantity | Decimal | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| checkedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to UserProfile via checkedByUser

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([checkedBy])
  - @@index([status])
  - @@index([checkDate])
  - @@index([referenceType, referenceId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - checkedBy: MySQL `checkedBy String? @map("checked_by")` vs PG `checkedBy String? @db.Uuid @map("checked_by")`

Potential issues:
  - NONE

### Quotation
Table: quotations

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| quotationNumber | String | YES | NO | - | YES | - |
| customerId | String | YES | NO | - | YES | - |
| quotationDate | DateTime | YES | NO | - | YES | - |
| validUntil | DateTime | NO | NO | - | YES | - |
| status | QuotationStatus | YES | NO | DRAFT | YES | - |
| subtotal | Decimal | YES | NO | - | NO | - |
| taxAmount | Decimal | YES | NO | 0 | NO | - |
| discountAmount | Decimal | YES | NO | 0 | NO | - |
| total | Decimal | YES | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| customer | Customer | YES | NO | - | YES | Customer.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | QuotationItem[] | NO | NO | - | NO | - |
| salesOrders | SalesOrder[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Customer via customer
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, quotationNumber])

Indexes:
  - @@index([organizationId])
  - @@index([customerId])
  - @@index([status])
  - @@index([quotationDate])
  - @@index([validUntil])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - customerId: MySQL `customerId String @map("customer_id")` vs PG `customerId String @db.Uuid @map("customer_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### QuotationItem
Table: quotation_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| quotationId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitPrice | Decimal | YES | NO | - | NO | - |
| discountPercent | Decimal | NO | NO | - | NO | - |
| totalPrice | Decimal | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| quotation | Quotation | YES | NO | - | YES | Quotation.id |
| item | Item | YES | NO | - | YES | Item.id |

Relations:
  - belongs to Quotation via quotation
  - belongs to Item via item

Unique constraints:
  - NONE

Indexes:
  - @@index([quotationId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - quotationId: MySQL `quotationId String @map("quotation_id")` vs PG `quotationId String @db.Uuid @map("quotation_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### RFQItem
Table: rfq_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| rfqId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequired | Decimal | YES | NO | - | NO | - |
| unitOfMeasureId | String | YES | NO | - | YES | - |
| specifications | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| rfq | RequestForQuotation | YES | NO | - | YES | RequestForQuotation.id |

Relations:
  - belongs to RequestForQuotation via rfq

Unique constraints:
  - NONE

Indexes:
  - @@index([rfqId])
  - @@index([itemId])
  - @@index([unitOfMeasureId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - rfqId: MySQL `rfqId String @map("rfq_id")` vs PG `rfqId String @db.Uuid @map("rfq_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitOfMeasureId: MySQL `unitOfMeasureId String @map("unit_of_measure_id")` vs PG `unitOfMeasureId String @db.Uuid @map("unit_of_measure_id")`

Potential issues:
  - NONE

### RFQSupplier
Table: rfq_suppliers

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| rfqId | String | YES | NO | - | YES | - |
| supplierId | String | YES | NO | - | YES | - |
| sentAt | DateTime | NO | NO | - | NO | - |
| responseReceived | Boolean | YES | NO | false | YES | - |
| responseDate | DateTime | NO | NO | - | NO | - |
| quotedAmount | Decimal | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| rfq | RequestForQuotation | YES | NO | - | YES | RequestForQuotation.id |

Relations:
  - belongs to RequestForQuotation via rfq

Unique constraints:
  - @@unique([rfqId, supplierId])

Indexes:
  - @@index([rfqId])
  - @@index([supplierId])
  - @@index([responseReceived])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - rfqId: MySQL `rfqId String @map("rfq_id")` vs PG `rfqId String @db.Uuid @map("rfq_id")`
  - supplierId: MySQL `supplierId String @map("supplier_id")` vs PG `supplierId String @db.Uuid @map("supplier_id")`

Potential issues:
  - NONE

### Recipe
Table: recipes

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| finishedItemId | String | YES | NO | - | YES | - |
| expectedOutputQuantity | Decimal | YES | NO | - | NO | - |
| outputUnitId | String | YES | NO | - | YES | - |
| version | Int | YES | NO | 1 | NO | - |
| status | RecipeStatus | YES | NO | ACTIVE | YES | - |
| instructions | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| finishedItem | Item | YES | NO | - | YES | Item.id |
| outputUnit | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | RecipeItem[] | NO | NO | - | NO | - |
| packagingItems | RecipePackaging[] | NO | NO | - | NO | - |
| productionBatches | ProductionBatch[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Item via finishedItem
  - belongs to UnitOfMeasure via outputUnit
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([finishedItemId])
  - @@index([outputUnitId])
  - @@index([status])
  - @@index([name])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - finishedItemId: MySQL `finishedItemId String @map("finished_item_id")` vs PG `finishedItemId String @db.Uuid @map("finished_item_id")`
  - outputUnitId: MySQL `outputUnitId String @map("output_unit_id")` vs PG `outputUnitId String @db.Uuid @map("output_unit_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### RecipeItem
Table: recipe_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| recipeId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequired | Decimal | YES | NO | - | NO | - |
| unitId | String | YES | NO | - | YES | - |
| wastageAllowancePercent | Decimal | NO | NO | - | NO | - |
| isOptional | Boolean | YES | NO | false | NO | - |
| substituteItemId | String | NO | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| recipe | Recipe | YES | NO | - | YES | Recipe.id |
| item | Item | YES | NO | - | YES | Item.id |
| unit | UnitOfMeasure | YES | NO | - | YES | UnitOfMeasure.id |
| substituteItem | Item | NO | NO | - | YES | Item.id |

Relations:
  - belongs to Recipe via recipe
  - belongs to Item via item
  - belongs to UnitOfMeasure via unit
  - belongs to Item via substituteItem

Unique constraints:
  - NONE

Indexes:
  - @@index([recipeId])
  - @@index([itemId])
  - @@index([unitId])
  - @@index([substituteItemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - recipeId: MySQL `recipeId String @map("recipe_id")` vs PG `recipeId String @db.Uuid @map("recipe_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitId: MySQL `unitId String @map("unit_id")` vs PG `unitId String @db.Uuid @map("unit_id")`
  - substituteItemId: MySQL `substituteItemId String? @map("substitute_item_id")` vs PG `substituteItemId String? @db.Uuid @map("substitute_item_id")`

Potential issues:
  - nullable relation key substituteItemId (verify business requirement)

### RecipePackaging
Table: recipe_packaging

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| recipeId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequired | Decimal | YES | NO | - | NO | - |
| unitId | String | YES | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| recipe | Recipe | YES | NO | - | YES | Recipe.id |

Relations:
  - belongs to Recipe via recipe

Unique constraints:
  - NONE

Indexes:
  - @@index([recipeId])
  - @@index([itemId])
  - @@index([unitId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - recipeId: MySQL `recipeId String @map("recipe_id")` vs PG `recipeId String @db.Uuid @map("recipe_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - unitId: MySQL `unitId String @map("unit_id")` vs PG `unitId String @db.Uuid @map("unit_id")`

Potential issues:
  - NONE

### RequestForQuotation
Table: request_for_quotations

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| rfqNumber | String | YES | NO | - | YES | - |
| requisitionId | String | NO | NO | - | YES | - |
| issueDate | DateTime | YES | NO | - | YES | - |
| closingDate | DateTime | YES | NO | - | YES | - |
| status | String | YES | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| rfqSuppliers | RFQSupplier[] | NO | NO | - | NO | - |
| rfqItems | RFQItem[] | NO | NO | - | NO | - |
| quotations | SupplierQuotation[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, rfqNumber])

Indexes:
  - @@index([organizationId])
  - @@index([requisitionId])
  - @@index([status])
  - @@index([issueDate])
  - @@index([closingDate])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - requisitionId: MySQL `requisitionId String? @map("requisition_id")` vs PG `requisitionId String? @db.Uuid @map("requisition_id")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key requisitionId (verify business requirement)

### Role
Table: roles

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| isSystemRole | Boolean | YES | NO | false | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| permissions | RolePermission[] | NO | NO | - | NO | - |
| users | UserRole[] | NO | NO | - | NO | - |
| userAccounts | UserAccount[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization

Unique constraints:
  - @@unique([organizationId, name])

Indexes:
  - @@index([organizationId])
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### RolePermission
Table: role_permissions

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| roleId | String | YES | NO | - | YES | - |
| permissionId | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| role | Role | YES | NO | - | YES | Role.id |
| permission | Permission | YES | NO | - | YES | Permission.id |

Relations:
  - belongs to Role via role
  - belongs to Permission via permission

Unique constraints:
  - @@unique([roleId, permissionId])

Indexes:
  - @@index([roleId])
  - @@index([permissionId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - roleId: MySQL `roleId String @map("role_id")` vs PG `roleId String @db.Uuid @map("role_id")`
  - permissionId: MySQL `permissionId String @map("permission_id")` vs PG `permissionId String @db.Uuid @map("permission_id")`

Potential issues:
  - NONE

### SalesOrder
Table: sales_orders

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| orderNumber | String | YES | NO | - | YES | - |
| customerId | String | YES | NO | - | YES | - |
| quotationId | String | NO | NO | - | YES | - |
| orderDate | DateTime | YES | NO | - | YES | - |
| requiredDate | DateTime | NO | NO | - | YES | - |
| status | SalesOrderStatus | YES | NO | DRAFT | YES | - |
| subtotal | Decimal | YES | NO | - | NO | - |
| taxAmount | Decimal | YES | NO | 0 | NO | - |
| discountAmount | Decimal | YES | NO | 0 | NO | - |
| total | Decimal | YES | NO | - | NO | - |
| warehouseId | String | YES | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| customer | Customer | YES | NO | - | YES | Customer.id |
| quotation | Quotation | NO | NO | - | YES | Quotation.id |
| warehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| branch | Branch | NO | NO | - | YES | Branch.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | SalesOrderItem[] | NO | NO | - | NO | - |
| deliveryNotes | DeliveryNote[] | NO | NO | - | NO | - |
| invoices | Invoice[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Customer via customer
  - belongs to Quotation via quotation
  - belongs to Warehouse via warehouse
  - belongs to Branch via branch
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, orderNumber])

Indexes:
  - @@index([organizationId])
  - @@index([customerId])
  - @@index([quotationId])
  - @@index([warehouseId])
  - @@index([branchId])
  - @@index([status])
  - @@index([orderDate])
  - @@index([requiredDate])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - customerId: MySQL `customerId String @map("customer_id")` vs PG `customerId String @db.Uuid @map("customer_id")`
  - quotationId: MySQL `quotationId String? @map("quotation_id")` vs PG `quotationId String? @db.Uuid @map("quotation_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key quotationId (verify business requirement)
  - nullable relation key branchId (verify business requirement)

### SalesOrderItem
Table: sales_order_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| salesOrderId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityOrdered | Decimal | YES | NO | - | NO | - |
| quantityDelivered | Decimal | YES | NO | 0 | NO | - |
| unitPrice | Decimal | YES | NO | - | NO | - |
| discountPercent | Decimal | NO | NO | - | NO | - |
| totalPrice | Decimal | YES | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| salesOrder | SalesOrder | YES | NO | - | YES | SalesOrder.id |
| item | Item | YES | NO | - | YES | Item.id |

Relations:
  - belongs to SalesOrder via salesOrder
  - belongs to Item via item

Unique constraints:
  - NONE

Indexes:
  - @@index([salesOrderId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - salesOrderId: MySQL `salesOrderId String @map("sales_order_id")` vs PG `salesOrderId String @db.Uuid @map("sales_order_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### ShiftReport
Table: shift_reports

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| productionBatchId | String | NO | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| reportDate | DateTime | YES | NO | - | YES | - |
| shiftType | ShiftType | YES | NO | - | YES | - |
| status | BranchShiftStatus | YES | NO | - | YES | - |
| preparedBy | String | YES | NO | - | YES | - |
| approvedBy | String | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([productionBatchId])
  - @@index([branchId])
  - @@index([reportDate])
  - @@index([shiftType])
  - @@index([status])
  - @@index([preparedBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - productionBatchId: MySQL `productionBatchId String? @map("production_batch_id")` vs PG `productionBatchId String? @db.Uuid @map("production_batch_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`
  - preparedBy: MySQL `preparedBy String @map("prepared_by")` vs PG `preparedBy String @db.Uuid @map("prepared_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - nullable relation key productionBatchId (verify business requirement)
  - nullable relation key branchId (verify business requirement)

### SparePart
Table: spare_parts

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| itemId | String | NO | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| machineType | String | NO | NO | - | NO | - |
| quantityOnHand | Decimal | YES | NO | 0 | NO | - |
| reorderLevel | Decimal | YES | NO | 0 | NO | - |
| unitCost | Decimal | YES | NO | 0 | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([itemId])
  - @@index([name])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - itemId: MySQL `itemId String? @map("item_id")` vs PG `itemId String? @db.Uuid @map("item_id")`

Potential issues:
  - nullable relation key itemId (verify business requirement)

### StockAdjustment
Table: stock_adjustments

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| adjustmentNumber | String | YES | NO | - | YES | - |
| warehouseId | String | YES | NO | - | YES | - |
| adjustmentDate | DateTime | YES | NO | - | YES | - |
| reason | String | YES | NO | - | NO | - |
| status | TransactionStatus | YES | NO | - | YES | - |
| approvalRequestId | String | NO | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | YES | NO | - | YES | - |
| approvedBy | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| items | StockAdjustmentItem[] | NO | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, adjustmentNumber])

Indexes:
  - @@index([organizationId])
  - @@index([warehouseId])
  - @@index([status])
  - @@index([adjustmentDate])
  - @@index([approvalRequestId])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`
  - approvalRequestId: MySQL `approvalRequestId String? @map("approval_request_id")` vs PG `approvalRequestId String? @db.Uuid @map("approval_request_id")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - nullable relation key approvalRequestId (verify business requirement)

### StockAdjustmentItem
Table: stock_adjustment_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| adjustmentId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityBefore | Decimal | YES | NO | - | NO | - |
| quantityAdjusted | Decimal | YES | NO | - | NO | - |
| quantityAfter | Decimal | YES | NO | - | NO | - |
| unitCost | Decimal | YES | NO | - | NO | - |
| movementType | StockMovementType | YES | NO | - | YES | - |
| reason | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| adjustment | StockAdjustment | YES | NO | - | YES | StockAdjustment.id |

Relations:
  - belongs to StockAdjustment via adjustment

Unique constraints:
  - NONE

Indexes:
  - @@index([adjustmentId])
  - @@index([itemId])
  - @@index([movementType])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - adjustmentId: MySQL `adjustmentId String @map("adjustment_id")` vs PG `adjustmentId String @db.Uuid @map("adjustment_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### StockBalance
Table: stock_balances

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| warehouseId | String | YES | NO | - | YES | - |
| quantityOnHand | Decimal | YES | NO | - | NO | - |
| quantityReserved | Decimal | YES | NO | 0 | NO | - |
| quantityAvailable | Decimal | YES | NO | - | NO | - |
| lastUpdated | DateTime | YES | NO | now( | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| item | Item | YES | NO | - | YES | Item.id |
| warehouse | Warehouse | YES | NO | - | YES | Warehouse.id |

Relations:
  - belongs to Organization via organization
  - belongs to Item via item
  - belongs to Warehouse via warehouse

Unique constraints:
  - @@unique([itemId, warehouseId])

Indexes:
  - @@index([organizationId])
  - @@index([itemId])
  - @@index([warehouseId])
  - @@index([lastUpdated])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`

Potential issues:
  - NONE

### StockMovement
Table: stock_movements

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| warehouseId | String | YES | NO | - | YES | - |
| movementType | StockMovementType | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitCost | Decimal | NO | NO | - | NO | - |
| totalCost | Decimal | NO | NO | - | NO | - |
| referenceType | String | YES | NO | - | YES | - |
| referenceId | String | YES | NO | - | YES | - |
| batchId | String | NO | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | YES | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| item | Item | YES | NO | - | YES | Item.id |
| warehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| batch | InventoryBatch | NO | NO | - | YES | InventoryBatch.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to Organization via organization
  - belongs to Item via item
  - belongs to Warehouse via warehouse
  - belongs to InventoryBatch via batch
  - belongs to UserProfile via createdByUser

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([itemId])
  - @@index([warehouseId])
  - @@index([movementType])
  - @@index([batchId])
  - @@index([createdBy])
  - @@index([createdAt])
  - @@index([referenceType, referenceId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`
  - warehouseId: MySQL `warehouseId String @map("warehouse_id")` vs PG `warehouseId String @db.Uuid @map("warehouse_id")`
  - batchId: MySQL `batchId String? @map("batch_id")` vs PG `batchId String? @db.Uuid @map("batch_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key batchId (verify business requirement)

### StockTransfer
Table: stock_transfers

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| transferNumber | String | YES | NO | - | YES | - |
| fromWarehouseId | String | YES | NO | - | YES | - |
| toWarehouseId | String | YES | NO | - | YES | - |
| transferDate | DateTime | YES | NO | - | YES | - |
| status | TransferStatus | YES | NO | DRAFT | YES | - |
| notes | String | NO | NO | - | NO | - |
| requestedBy | String | NO | NO | - | YES | - |
| approvedBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| fromWarehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| toWarehouse | Warehouse | YES | NO | - | YES | Warehouse.id |
| requestedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| approvedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| items | StockTransferItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Warehouse via fromWarehouse
  - belongs to Warehouse via toWarehouse
  - belongs to UserProfile via requestedByUser
  - belongs to UserProfile via approvedByUser

Unique constraints:
  - @@unique([organizationId, transferNumber])

Indexes:
  - @@index([organizationId])
  - @@index([fromWarehouseId])
  - @@index([toWarehouseId])
  - @@index([status])
  - @@index([transferDate])
  - @@index([requestedBy])
  - @@index([approvedBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - fromWarehouseId: MySQL `fromWarehouseId String @map("from_warehouse_id")` vs PG `fromWarehouseId String @db.Uuid @map("from_warehouse_id")`
  - toWarehouseId: MySQL `toWarehouseId String @map("to_warehouse_id")` vs PG `toWarehouseId String @db.Uuid @map("to_warehouse_id")`
  - requestedBy: MySQL `requestedBy String? @map("requested_by")` vs PG `requestedBy String? @db.Uuid @map("requested_by")`
  - approvedBy: MySQL `approvedBy String? @map("approved_by")` vs PG `approvedBy String? @db.Uuid @map("approved_by")`

Potential issues:
  - NONE

### StockTransferItem
Table: stock_transfer_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| transferId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantityRequested | Decimal | YES | NO | - | NO | - |
| quantitySent | Decimal | NO | NO | - | NO | - |
| quantityReceived | Decimal | NO | NO | - | NO | - |
| unitCost | Decimal | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| transfer | StockTransfer | YES | NO | - | YES | StockTransfer.id |
| item | Item | YES | NO | - | YES | Item.id |

Relations:
  - belongs to StockTransfer via transfer
  - belongs to Item via item

Unique constraints:
  - NONE

Indexes:
  - @@index([transferId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - transferId: MySQL `transferId String @map("transfer_id")` vs PG `transferId String @db.Uuid @map("transfer_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### Supplier
Table: suppliers

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| categoryId | String | YES | NO | - | YES | - |
| contactPerson | String | NO | NO | - | NO | - |
| phone | String | NO | NO | - | YES | - |
| email | String | NO | NO | - | YES | - |
| address | String | NO | NO | - | NO | - |
| taxNumber | String | NO | NO | - | NO | - |
| paymentTerms | String | NO | NO | - | NO | - |
| creditLimit | Decimal | NO | NO | - | NO | - |
| currentBalance | Decimal | NO | NO | 0 | NO | - |
| status | SupplierStatus | YES | NO | ACTIVE | YES | - |
| createdBy | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| category | SupplierCategory | YES | NO | - | YES | SupplierCategory.id |
| createdByUser | UserProfile | NO | NO | - | NO | UserProfile.id |
| inventoryBatches | InventoryBatch[] | NO | NO | - | NO | - |
| purchaseOrders | PurchaseOrder[] | NO | NO | - | NO | - |
| supplierReturns | SupplierReturn[] | NO | NO | - | NO | - |
| payments | Payment[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to SupplierCategory via category
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([categoryId])
  - @@index([status])
  - @@index([name])
  - @@index([email])
  - @@index([phone])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - categoryId: MySQL `categoryId String @map("category_id")` vs PG `categoryId String @db.Uuid @map("category_id")`
  - createdBy: MySQL `createdBy String? @map("created_by")` vs PG `createdBy String? @db.Uuid @map("created_by")`

Potential issues:
  - NONE

### SupplierCategory
Table: supplier_categories

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| description | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| suppliers | Supplier[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization

Unique constraints:
  - @@unique([organizationId, name])

Indexes:
  - @@index([organizationId])
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### SupplierPerformance
Table: supplier_performance

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| supplierId | String | YES | NO | - | YES | - |
| evaluationDate | DateTime | YES | NO | - | YES | - |
| onTimeDelivery | Int | YES | NO | - | NO | - |
| qualityScore | Int | YES | NO | - | NO | - |
| priceCompetitiveness | Int | YES | NO | - | NO | - |
| communicationScore | Int | YES | NO | - | NO | - |
| overallScore | Int | YES | NO | - | YES | - |
| notes | String | NO | NO | - | NO | - |
| evaluatedBy | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |

Relations:
  - NONE

Unique constraints:
  - NONE

Indexes:
  - @@index([supplierId])
  - @@index([evaluationDate])
  - @@index([overallScore])
  - @@index([evaluatedBy])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - supplierId: MySQL `supplierId String @map("supplier_id")` vs PG `supplierId String @db.Uuid @map("supplier_id")`
  - evaluatedBy: MySQL `evaluatedBy String @map("evaluated_by")` vs PG `evaluatedBy String @db.Uuid @map("evaluated_by")`

Potential issues:
  - NONE

### SupplierQuotation
Table: supplier_quotations

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| rfqId | String | YES | NO | - | YES | - |
| supplierId | String | YES | NO | - | YES | - |
| quotationDate | DateTime | YES | NO | - | YES | - |
| validUntil | DateTime | YES | NO | - | NO | - |
| totalAmount | Decimal | YES | NO | - | NO | - |
| deliveryDays | Int | NO | NO | - | NO | - |
| paymentTerms | String | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| isSelected | Boolean | YES | NO | false | YES | - |
| selectedBy | String | NO | NO | - | NO | - |
| selectedAt | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| rfq | RequestForQuotation | YES | NO | - | YES | RequestForQuotation.id |
| items | SupplierQuotationItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to RequestForQuotation via rfq

Unique constraints:
  - NONE

Indexes:
  - @@index([rfqId])
  - @@index([supplierId])
  - @@index([quotationDate])
  - @@index([isSelected])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - rfqId: MySQL `rfqId String @map("rfq_id")` vs PG `rfqId String @db.Uuid @map("rfq_id")`
  - supplierId: MySQL `supplierId String @map("supplier_id")` vs PG `supplierId String @db.Uuid @map("supplier_id")`
  - selectedBy: MySQL `selectedBy String? @map("selected_by")` vs PG `selectedBy String? @db.Uuid @map("selected_by")`

Potential issues:
  - NONE

### SupplierQuotationItem
Table: supplier_quotation_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| quotationId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitPrice | Decimal | YES | NO | - | NO | - |
| totalPrice | Decimal | YES | NO | - | NO | - |
| deliveryDays | Int | NO | NO | - | NO | - |
| notes | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| quotation | SupplierQuotation | YES | NO | - | YES | SupplierQuotation.id |

Relations:
  - belongs to SupplierQuotation via quotation

Unique constraints:
  - NONE

Indexes:
  - @@index([quotationId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - quotationId: MySQL `quotationId String @map("quotation_id")` vs PG `quotationId String @db.Uuid @map("quotation_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### SupplierReturn
Table: supplier_returns

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| returnNumber | String | YES | NO | - | YES | - |
| supplierId | String | YES | NO | - | YES | - |
| grnId | String | NO | NO | - | YES | - |
| returnDate | DateTime | YES | NO | - | YES | - |
| reason | String | YES | NO | - | NO | - |
| totalValue | Decimal | YES | NO | - | NO | - |
| status | ReturnStatus | YES | NO | DRAFT | YES | - |
| createdBy | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| supplier | Supplier | YES | NO | - | YES | Supplier.id |
| grn | GoodsReceivedNote | NO | NO | - | YES | GoodsReceivedNote.id |
| createdByUser | UserProfile | YES | NO | - | NO | UserProfile.id |
| returnItems | SupplierReturnItem[] | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Supplier via supplier
  - belongs to GoodsReceivedNote via grn
  - belongs to UserProfile via createdByUser

Unique constraints:
  - @@unique([organizationId, returnNumber])

Indexes:
  - @@index([organizationId])
  - @@index([supplierId])
  - @@index([grnId])
  - @@index([status])
  - @@index([returnDate])
  - @@index([createdBy])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - supplierId: MySQL `supplierId String @map("supplier_id")` vs PG `supplierId String @db.Uuid @map("supplier_id")`
  - grnId: MySQL `grnId String? @map("grn_id")` vs PG `grnId String? @db.Uuid @map("grn_id")`
  - createdBy: MySQL `createdBy String @map("created_by")` vs PG `createdBy String @db.Uuid @map("created_by")`

Potential issues:
  - nullable relation key grnId (verify business requirement)

### SupplierReturnItem
Table: supplier_return_items

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| returnId | String | YES | NO | - | YES | - |
| itemId | String | YES | NO | - | YES | - |
| quantity | Decimal | YES | NO | - | NO | - |
| unitCost | Decimal | YES | NO | - | NO | - |
| totalCost | Decimal | YES | NO | - | NO | - |
| reason | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| supplierReturn | SupplierReturn | YES | NO | - | NO | SupplierReturn.id |

Relations:
  - belongs to SupplierReturn via supplierReturn

Unique constraints:
  - NONE

Indexes:
  - @@index([returnId])
  - @@index([itemId])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - returnId: MySQL `returnId String @map("return_id")` vs PG `returnId String @db.Uuid @map("return_id")`
  - itemId: MySQL `itemId String @map("item_id")` vs PG `itemId String @db.Uuid @map("item_id")`

Potential issues:
  - NONE

### TaxRate
Table: tax_rates

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| rate | Decimal | YES | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | YES | - |
| appliesToSales | Boolean | YES | NO | true | NO | - |
| appliesToPurchase | Boolean | YES | NO | true | NO | - |
| accountId | String | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |

Relations:
  - NONE

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([name])
  - @@index([isActive])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - accountId: MySQL `accountId String? @map("account_id")` vs PG `accountId String? @db.Uuid @map("account_id")`

Potential issues:
  - missing index on FK-like field accountId
  - nullable relation key accountId (verify business requirement)

### UnitOfMeasure
Table: units_of_measure

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| abbreviation | String | YES | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| items | Item[] | NO | NO | - | NO | - |
| requisitionItems | PurchaseRequisitionItem[] | NO | NO | - | NO | - |
| purchaseOrderItems | PurchaseOrderItem[] | NO | NO | - | NO | - |
| recipesAsOutput | Recipe[] | NO | NO | - | NO | Recipe.id |
| recipeItems | RecipeItem[] | NO | NO | - | NO | RecipeItem.id |
| productionBatchMaterials | ProductionBatchMaterial[] | NO | NO | - | NO | ProductionBatchMaterial.id |
| productionBatchOutputs | ProductionBatchOutput[] | NO | NO | - | NO | ProductionBatchOutput.id |

Relations:
  - belongs to Organization via organization
  - has many Recipe via recipesAsOutput
  - has many RecipeItem via recipeItems
  - has many ProductionBatchMaterial via productionBatchMaterials
  - has many ProductionBatchOutput via productionBatchOutputs

Unique constraints:
  - @@unique([organizationId, abbreviation])

Indexes:
  - @@index([organizationId])
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`

Potential issues:
  - NONE

### UserAccount
Table: user_accounts

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| workId | String | YES | YES | - | YES | - |
| firstName | String | YES | NO | - | NO | - |
| lastName | String | YES | NO | - | NO | - |
| idNumber | String | YES | YES | - | YES | - |
| email | String | YES | YES | - | YES | - |
| passwordHash | String | YES | NO | - | NO | - |
| roleId | String | YES | NO | - | YES | - |
| role | Role | YES | NO | - | YES | Role.id |
| organizationId | String | YES | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| userProfileId | String | NO | YES | - | YES | - |
| userProfile | UserProfile | NO | NO | - | NO | UserProfile.id |
| isActive | Boolean | YES | NO | true | YES | - |
| failedLoginAttempts | Int | YES | NO | 0 | NO | - |
| lockedUntil | DateTime | NO | NO | - | NO | - |
| lastLogin | DateTime | NO | NO | - | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| sessions | AuthSession[] | NO | NO | - | NO | - |
| passwordResetTokens | PasswordResetToken[] | NO | NO | - | NO | - |

Relations:
  - belongs to Role via role
  - belongs to Organization via organization
  - belongs to UserProfile via userProfile

Unique constraints:
  - NONE

Indexes:
  - @@index([organizationId])
  - @@index([roleId])
  - @@index([isActive])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - roleId: MySQL `roleId String @map("role_id")` vs PG `roleId String @db.Uuid @map("role_id")`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - userProfileId: MySQL `userProfileId String? @unique @map("user_profile_id")` vs PG `userProfileId String? @unique @db.Uuid @map("user_profile_id")`

Potential issues:
  - nullable relation key userProfileId (verify business requirement)

### UserProfile
Table: user_profiles

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| clerkUserId | String | YES | YES | - | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| employeeId | String | NO | YES | - | YES | - |
| firstName | String | YES | NO | - | YES | - |
| lastName | String | YES | NO | - | YES | - |
| email | String | YES | NO | - | YES | - |
| phone | String | NO | NO | - | NO | - |
| avatarUrl | String | NO | NO | - | NO | - |
| status | UserStatus | YES | NO | ACTIVE | YES | - |
| branchId | String | NO | NO | - | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| deletedAt | DateTime | NO | NO | - | YES | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| employee | Employee | NO | NO | - | NO | Employee.id |
| branch | Branch | NO | NO | - | YES | Branch.id |
| managedBranches | Branch[] | NO | NO | - | NO | Branch.id |
| roleAssignments | UserRole[] | NO | NO | - | NO | UserRole.id |
| rolesAssigned | UserRole[] | NO | NO | - | NO | UserRole.id |
| createdSuppliers | Supplier[] | NO | NO | - | NO | Supplier.id |
| requestedRequisitions | PurchaseRequisition[] | NO | NO | - | NO | PurchaseRequisition.id |
| approvedRequisitions | PurchaseRequisition[] | NO | NO | - | NO | PurchaseRequisition.id |
| createdPurchaseOrders | PurchaseOrder[] | NO | NO | - | NO | PurchaseOrder.id |
| approvedPurchaseOrders | PurchaseOrder[] | NO | NO | - | NO | PurchaseOrder.id |
| receivedGrns | GoodsReceivedNote[] | NO | NO | - | NO | GoodsReceivedNote.id |
| createdSupplierReturns | SupplierReturn[] | NO | NO | - | NO | SupplierReturn.id |
| createdRecipes | Recipe[] | NO | NO | - | NO | Recipe.id |
| createdProductionPlans | ProductionPlan[] | NO | NO | - | NO | ProductionPlan.id |
| startedBatches | ProductionBatch[] | NO | NO | - | NO | ProductionBatch.id |
| closedBatches | ProductionBatch[] | NO | NO | - | NO | ProductionBatch.id |
| qualityChecks | QualityCheck[] | NO | NO | - | NO | QualityCheck.id |
| createdCustomers | Customer[] | NO | NO | - | NO | Customer.id |
| createdQuotations | Quotation[] | NO | NO | - | NO | Quotation.id |
| createdSalesOrders | SalesOrder[] | NO | NO | - | NO | SalesOrder.id |
| deliveredNotes | DeliveryNote[] | NO | NO | - | NO | DeliveryNote.id |
| createdInvoices | Invoice[] | NO | NO | - | NO | Invoice.id |
| createdPayments | Payment[] | NO | NO | - | NO | Payment.id |
| createdCustomerReturns | CustomerReturn[] | NO | NO | - | NO | CustomerReturn.id |
| servedBranchSales | BranchSale[] | NO | NO | - | NO | BranchSale.id |
| approvedBranchExpenses | BranchExpense[] | NO | NO | - | NO | BranchExpense.id |
| createdBranchExpenses | BranchExpense[] | NO | NO | - | NO | BranchExpense.id |
| closedShiftCloses | BranchShiftClose[] | NO | NO | - | NO | BranchShiftClose.id |
| approvedShiftCloses | BranchShiftClose[] | NO | NO | - | NO | BranchShiftClose.id |
| createdPayrollRecords | PayrollRecord[] | NO | NO | - | NO | PayrollRecord.id |
| createdJournalEntries | JournalEntry[] | NO | NO | - | NO | JournalEntry.id |
| uploadedFiles | DocumentFile[] | NO | NO | - | NO | DocumentFile.id |
| notifications | Notification[] | NO | NO | - | NO | - |
| auditLogs | AuditLog[] | NO | NO | - | NO | - |
| createdStockMovements | StockMovement[] | NO | NO | - | NO | StockMovement.id |
| requestedTransfers | StockTransfer[] | NO | NO | - | NO | StockTransfer.id |
| approvedTransfers | StockTransfer[] | NO | NO | - | NO | StockTransfer.id |
| userAccount | UserAccount | NO | NO | - | NO | - |

Relations:
  - belongs to Organization via organization
  - belongs to Employee via employee
  - belongs to Branch via branch
  - has many Branch via managedBranches
  - has many UserRole via roleAssignments
  - has many UserRole via rolesAssigned
  - has many Supplier via createdSuppliers
  - has many PurchaseRequisition via requestedRequisitions
  - has many PurchaseRequisition via approvedRequisitions
  - has many PurchaseOrder via createdPurchaseOrders
  - has many PurchaseOrder via approvedPurchaseOrders
  - has many GoodsReceivedNote via receivedGrns
  - has many SupplierReturn via createdSupplierReturns
  - has many Recipe via createdRecipes
  - has many ProductionPlan via createdProductionPlans
  - has many ProductionBatch via startedBatches
  - has many ProductionBatch via closedBatches
  - has many QualityCheck via qualityChecks
  - has many Customer via createdCustomers
  - has many Quotation via createdQuotations
  - has many SalesOrder via createdSalesOrders
  - has many DeliveryNote via deliveredNotes
  - has many Invoice via createdInvoices
  - has many Payment via createdPayments
  - has many CustomerReturn via createdCustomerReturns
  - has many BranchSale via servedBranchSales
  - has many BranchExpense via approvedBranchExpenses
  - has many BranchExpense via createdBranchExpenses
  - has many BranchShiftClose via closedShiftCloses
  - has many BranchShiftClose via approvedShiftCloses
  - has many PayrollRecord via createdPayrollRecords
  - has many JournalEntry via createdJournalEntries
  - has many DocumentFile via uploadedFiles
  - has many StockMovement via createdStockMovements
  - has many StockTransfer via requestedTransfers
  - has many StockTransfer via approvedTransfers

Unique constraints:
  - @@unique([organizationId, email])

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([status])
  - @@index([firstName, lastName])
  - @@index([email])
  - @@index([deletedAt])

Soft delete: YES (deleted_at)
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - employeeId: MySQL `employeeId String? @unique @map("employee_id")` vs PG `employeeId String? @unique @db.Uuid @map("employee_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`

Potential issues:
  - nullable relation key employeeId (verify business requirement)
  - nullable relation key branchId (verify business requirement)

### UserRole
Table: user_roles

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| userProfileId | String | YES | NO | - | YES | - |
| roleId | String | YES | NO | - | YES | - |
| assignedBy | String | NO | NO | - | YES | - |
| assignedAt | DateTime | YES | NO | now( | YES | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| userProfile | UserProfile | YES | NO | - | YES | UserProfile.id |
| role | Role | YES | NO | - | YES | Role.id |
| assignedByUser | UserProfile | NO | NO | - | NO | UserProfile.id |

Relations:
  - belongs to UserProfile via userProfile
  - belongs to Role via role
  - belongs to UserProfile via assignedByUser

Unique constraints:
  - @@unique([userProfileId, roleId])

Indexes:
  - @@index([userProfileId])
  - @@index([roleId])
  - @@index([assignedBy])
  - @@index([assignedAt])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - userProfileId: MySQL `userProfileId String @map("user_profile_id")` vs PG `userProfileId String @db.Uuid @map("user_profile_id")`
  - roleId: MySQL `roleId String @map("role_id")` vs PG `roleId String @db.Uuid @map("role_id")`
  - assignedBy: MySQL `assignedBy String? @map("assigned_by")` vs PG `assignedBy String? @db.Uuid @map("assigned_by")`

Potential issues:
  - NONE

### Warehouse
Table: warehouses

| Field | Type | Required | Unique | Default | Index | FK to |
|-------|------|----------|--------|---------|-------|-------|
| id | String | YES | YES | uuid( | YES | - |
| organizationId | String | YES | NO | - | YES | - |
| branchId | String | NO | NO | - | YES | - |
| code | String | YES | NO | - | YES | - |
| name | String | YES | NO | - | YES | - |
| type | WarehouseType | YES | NO | - | YES | - |
| address | String | NO | NO | - | NO | - |
| isActive | Boolean | YES | NO | true | NO | - |
| createdAt | DateTime | YES | NO | now( | NO | - |
| updatedAt | DateTime | YES | NO | - | NO | - |
| organization | Organization | YES | NO | - | YES | Organization.id |
| branch | Branch | NO | NO | - | YES | Branch.id |
| inventoryBatches | InventoryBatch[] | NO | NO | - | NO | - |
| stockBalances | StockBalance[] | NO | NO | - | NO | - |
| stockMovements | StockMovement[] | NO | NO | - | NO | - |
| goodsReceivedNotes | GoodsReceivedNote[] | NO | NO | - | NO | - |
| productionBatches | ProductionBatch[] | NO | NO | - | NO | - |
| salesOrders | SalesOrder[] | NO | NO | - | NO | - |
| fromTransfers | StockTransfer[] | NO | NO | - | NO | StockTransfer.id |
| toTransfers | StockTransfer[] | NO | NO | - | NO | StockTransfer.id |

Relations:
  - belongs to Organization via organization
  - belongs to Branch via branch
  - has many StockTransfer via fromTransfers
  - has many StockTransfer via toTransfers

Unique constraints:
  - @@unique([organizationId, code])

Indexes:
  - @@index([organizationId])
  - @@index([branchId])
  - @@index([type])
  - @@index([name])

Soft delete: NO
Has created_at: YES
Has updated_at: YES

MySQL vs PostgreSQL differences:
  - id: MySQL `id String @id @default(uuid())` vs PG `id String @id @default(uuid()) @db.Uuid`
  - organizationId: MySQL `organizationId String @map("organization_id")` vs PG `organizationId String @db.Uuid @map("organization_id")`
  - branchId: MySQL `branchId String? @map("branch_id")` vs PG `branchId String? @db.Uuid @map("branch_id")`

Potential issues:
  - nullable relation key branchId (verify business requirement)

---

## SYNC CHECKLIST

| Model | API Route | Zod Schema | Frontend Hook | Frontend Page | All In Sync |
|-------|-----------|------------|---------------|---------------|------------|
| Account | - | - | - | - | ? |
| AdminKey | - | - | - | - | ? |
| ApprovalAction | - | - | - | - | ? |
| ApprovalRequest | - | - | - | - | ? |
| ApprovalWorkflow | - | - | - | - | ? |
| ApprovalWorkflowStep | - | - | - | - | ? |
| AssetDepreciation | - | - | - | - | ? |
| Attendance | - | - | - | - | ? |
| AuditLog | - | - | - | - | ? |
| AuthSession | - | - | - | - | ? |
| BankAccount | - | - | - | - | ? |
| BankReconciliation | - | - | - | - | ? |
| Branch | - | - | - | - | ? |
| BranchExpense | - | - | - | - | ? |
| BranchSale | - | - | - | - | ? |
| BranchSaleItem | - | - | - | - | ? |
| BranchShiftClose | - | - | - | - | ? |
| Budget | - | - | - | - | ? |
| BudgetLine | - | - | - | - | ? |
| BudgetRevision | - | - | - | - | ? |
| CashAccount | - | - | - | - | ? |
| Customer | - | - | - | - | ? |
| CustomerComplaint | - | - | - | - | ? |
| CustomerReturn | - | - | - | - | ? |
| DeliveryNote | - | - | - | - | ? |
| DeliveryNoteItem | - | - | - | - | ? |
| Department | - | - | - | - | ? |
| DocumentFile | - | - | - | - | ? |
| Employee | - | - | - | - | ? |
| FixedAsset | - | - | - | - | ? |
| GoodsReceivedNote | - | - | - | - | ? |
| GoodsReceivedNoteItem | - | - | - | - | ? |
| InventoryBatch | - | - | - | - | ? |
| Invoice | - | - | - | - | ? |
| InvoiceItem | - | - | - | - | ? |
| Item | - | - | - | - | ? |
| ItemCategory | - | - | - | - | ? |
| JournalEntry | - | - | - | - | ? |
| JournalEntryLine | - | - | - | - | ? |
| LeaveRequest | - | - | - | - | ? |
| Machine | - | - | - | - | ? |
| MachineBreakdown | - | - | - | - | ? |
| MaintenanceSchedule | - | - | - | - | ? |
| Notification | - | - | - | - | ? |
| NumberSeries | - | - | - | - | ? |
| Organization | - | - | - | - | ? |
| PasswordResetToken | - | - | - | - | ? |
| Payment | - | - | - | - | ? |
| PayrollRecord | - | - | - | - | ? |
| Permission | - | - | - | - | ? |
| PettyCashReplenishment | - | - | - | - | ? |
| PettyCashRequest | - | - | - | - | ? |
| ProductionBatch | - | - | - | - | ? |
| ProductionBatchMaterial | - | - | - | - | ? |
| ProductionBatchOutput | - | - | - | - | ? |
| ProductionMaterialRequest | - | - | - | - | ? |
| ProductionMaterialRequestItem | - | - | - | - | ? |
| ProductionPlan | - | - | - | - | ? |
| ProductionPlanItem | - | - | - | - | ? |
| ProductionWastage | - | - | - | - | ? |
| ProductionWorkerAssignment | - | - | - | - | ? |
| PurchaseOrder | - | - | - | - | ? |
| PurchaseOrderItem | - | - | - | - | ? |
| PurchaseRequisition | - | - | - | - | ? |
| PurchaseRequisitionItem | - | - | - | - | ? |
| QualityCheck | - | - | - | - | ? |
| Quotation | - | - | - | - | ? |
| QuotationItem | - | - | - | - | ? |
| RFQItem | - | - | - | - | ? |
| RFQSupplier | - | - | - | - | ? |
| Recipe | - | - | - | - | ? |
| RecipeItem | - | - | - | - | ? |
| RecipePackaging | - | - | - | - | ? |
| RequestForQuotation | - | - | - | - | ? |
| Role | - | - | - | - | ? |
| RolePermission | - | - | - | - | ? |
| SalesOrder | - | - | - | - | ? |
| SalesOrderItem | - | - | - | - | ? |
| ShiftReport | - | - | - | - | ? |
| SparePart | - | - | - | - | ? |
| StockAdjustment | - | - | - | - | ? |
| StockAdjustmentItem | - | - | - | - | ? |
| StockBalance | /api/inventory/stock-balances | inventory.schemas.ts | useStockBalances | /inventory/stock-balances | YES |
| StockMovement | /api/inventory/stock-movements | inventory.schemas.ts | useStockMovements | /inventory/stock-movements | YES |
| StockTransfer | - | - | - | - | ? |
| StockTransferItem | - | - | - | - | ? |
| Supplier | /api/procurement/suppliers | suppliers.schemas.ts | useSuppliers/useSupplier/useSupplierPurchaseHistory | /procurement/suppliers, /procurement/suppliers/[id] | YES |
| SupplierCategory | - | - | - | - | ? |
| SupplierPerformance | - | - | - | - | ? |
| SupplierQuotation | - | - | - | - | ? |
| SupplierQuotationItem | - | - | - | - | ? |
| SupplierReturn | - | - | - | - | ? |
| SupplierReturnItem | - | - | - | - | ? |
| TaxRate | - | - | - | - | ? |
| UnitOfMeasure | - | - | - | - | ? |
| UserAccount | - | - | - | - | ? |
| UserProfile | - | - | - | - | ? |
| UserRole | - | - | - | - | ? |
| Warehouse | - | - | - | - | ? |

---

## MISSING INDEXES

Model: Budget
Field: approvalRequestId
References: -
Fix: Add @@index([approvalRequestId])

Model: BudgetRevision
Field: approvalRequestId
References: -
Fix: Add @@index([approvalRequestId])

Model: PettyCashRequest
Field: approvalRequestId
References: -
Fix: Add @@index([approvalRequestId])

Model: TaxRate
Field: accountId
References: -
Fix: Add @@index([accountId])

---

## SCHEMA DIFFERENCES (MySQL vs PostgreSQL)

| Model | Field | MySQL Type | PG Type | Safe | Action |
|-------|-------|------------|---------|------|--------|
| Account | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Account | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Account | parentAccountId | parentAccountId String? @map("parent_account_id") | parentAccountId String? @db.Uuid @map("parent_account_id") | YES | Review db-specific attrs |
| AdminKey | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ApprovalAction | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ApprovalAction | approvalRequestId | approvalRequestId String @map("approval_request_id") | approvalRequestId String @db.Uuid @map("approval_request_id") | YES | Review db-specific attrs |
| ApprovalAction | actionBy | actionBy String @map("action_by") | actionBy String @db.Uuid @map("action_by") | YES | Review db-specific attrs |
| ApprovalRequest | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ApprovalRequest | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ApprovalRequest | workflowId | workflowId String @map("workflow_id") | workflowId String @db.Uuid @map("workflow_id") | YES | Review db-specific attrs |
| ApprovalRequest | requestedBy | requestedBy String @map("requested_by") | requestedBy String @db.Uuid @map("requested_by") | YES | Review db-specific attrs |
| ApprovalWorkflow | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ApprovalWorkflow | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ApprovalWorkflowStep | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ApprovalWorkflowStep | workflowId | workflowId String @map("workflow_id") | workflowId String @db.Uuid @map("workflow_id") | YES | Review db-specific attrs |
| ApprovalWorkflowStep | roleId | roleId String @map("role_id") | roleId String @db.Uuid @map("role_id") | YES | Review db-specific attrs |
| AssetDepreciation | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| AssetDepreciation | assetId | assetId String @map("asset_id") | assetId String @db.Uuid @map("asset_id") | YES | Review db-specific attrs |
| AssetDepreciation | journalEntryId | journalEntryId String? @map("journal_entry_id") | journalEntryId String? @db.Uuid @map("journal_entry_id") | YES | Review db-specific attrs |
| Attendance | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Attendance | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Attendance | employeeId | employeeId String @map("employee_id") | employeeId String @db.Uuid @map("employee_id") | YES | Review db-specific attrs |
| AuditLog | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| AuditLog | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| AuditLog | userProfileId | userProfileId String? @map("user_profile_id") | userProfileId String? @db.Uuid @map("user_profile_id") | YES | Review db-specific attrs |
| AuthSession | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| AuthSession | userAccountId | userAccountId String @map("user_account_id") | userAccountId String @db.Uuid @map("user_account_id") | YES | Review db-specific attrs |
| BankAccount | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BankAccount | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| BankAccount | accountId | accountId String @map("account_id") | accountId String @db.Uuid @map("account_id") | YES | Review db-specific attrs |
| BankReconciliation | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BankReconciliation | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| BankReconciliation | bankAccountId | bankAccountId String @map("bank_account_id") | bankAccountId String @db.Uuid @map("bank_account_id") | YES | Review db-specific attrs |
| BankReconciliation | reconciledBy | reconciledBy String? @map("reconciled_by") | reconciledBy String? @db.Uuid @map("reconciled_by") | YES | Review db-specific attrs |
| Branch | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Branch | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Branch | managerId | managerId String? @map("manager_id") | managerId String? @db.Uuid @map("manager_id") | YES | Review db-specific attrs |
| BranchExpense | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BranchExpense | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| BranchExpense | branchId | branchId String @map("branch_id") | branchId String @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| BranchExpense | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| BranchExpense | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| BranchSale | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BranchSale | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| BranchSale | branchId | branchId String @map("branch_id") | branchId String @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| BranchSale | customerId | customerId String? @map("customer_id") | customerId String? @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| BranchSale | servedBy | servedBy String? @map("served_by") | servedBy String? @db.Uuid @map("served_by") | YES | Review db-specific attrs |
| BranchSaleItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BranchSaleItem | branchSaleId | branchSaleId String @map("branch_sale_id") | branchSaleId String @db.Uuid @map("branch_sale_id") | YES | Review db-specific attrs |
| BranchSaleItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| BranchShiftClose | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BranchShiftClose | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| BranchShiftClose | branchId | branchId String @map("branch_id") | branchId String @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| BranchShiftClose | closedBy | closedBy String @map("closed_by") | closedBy String @db.Uuid @map("closed_by") | YES | Review db-specific attrs |
| BranchShiftClose | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| Budget | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Budget | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Budget | departmentId | departmentId String? @map("department_id") | departmentId String? @db.Uuid @map("department_id") | YES | Review db-specific attrs |
| Budget | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| Budget | approvalRequestId | approvalRequestId String? @map("approval_request_id") | approvalRequestId String? @db.Uuid @map("approval_request_id") | YES | Review db-specific attrs |
| Budget | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| Budget | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| BudgetLine | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BudgetLine | budgetId | budgetId String @map("budget_id") | budgetId String @db.Uuid @map("budget_id") | YES | Review db-specific attrs |
| BudgetLine | accountId | accountId String @map("account_id") | accountId String @db.Uuid @map("account_id") | YES | Review db-specific attrs |
| BudgetRevision | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| BudgetRevision | budgetId | budgetId String @map("budget_id") | budgetId String @db.Uuid @map("budget_id") | YES | Review db-specific attrs |
| BudgetRevision | revisedBy | revisedBy String @map("revised_by") | revisedBy String @db.Uuid @map("revised_by") | YES | Review db-specific attrs |
| BudgetRevision | approvalRequestId | approvalRequestId String? @map("approval_request_id") | approvalRequestId String? @db.Uuid @map("approval_request_id") | YES | Review db-specific attrs |
| BudgetRevision | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| CashAccount | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| CashAccount | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| CashAccount | accountId | accountId String @map("account_id") | accountId String @db.Uuid @map("account_id") | YES | Review db-specific attrs |
| CashAccount | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| Customer | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Customer | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Customer | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| CustomerComplaint | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| CustomerComplaint | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| CustomerComplaint | customerId | customerId String @map("customer_id") | customerId String @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| CustomerComplaint | invoiceId | invoiceId String? @map("invoice_id") | invoiceId String? @db.Uuid @map("invoice_id") | YES | Review db-specific attrs |
| CustomerComplaint | resolvedBy | resolvedBy String? @map("resolved_by") | resolvedBy String? @db.Uuid @map("resolved_by") | YES | Review db-specific attrs |
| CustomerReturn | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| CustomerReturn | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| CustomerReturn | customerId | customerId String @map("customer_id") | customerId String @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| CustomerReturn | invoiceId | invoiceId String? @map("invoice_id") | invoiceId String? @db.Uuid @map("invoice_id") | YES | Review db-specific attrs |
| CustomerReturn | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| DeliveryNote | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| DeliveryNote | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| DeliveryNote | salesOrderId | salesOrderId String @map("sales_order_id") | salesOrderId String @db.Uuid @map("sales_order_id") | YES | Review db-specific attrs |
| DeliveryNote | deliveredBy | deliveredBy String? @map("delivered_by") | deliveredBy String? @db.Uuid @map("delivered_by") | YES | Review db-specific attrs |
| DeliveryNoteItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| DeliveryNoteItem | deliveryNoteId | deliveryNoteId String @map("delivery_note_id") | deliveryNoteId String @db.Uuid @map("delivery_note_id") | YES | Review db-specific attrs |
| DeliveryNoteItem | salesOrderItemId | salesOrderItemId String @map("sales_order_item_id") | salesOrderItemId String @db.Uuid @map("sales_order_item_id") | YES | Review db-specific attrs |
| DeliveryNoteItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| Department | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Department | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| DocumentFile | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| DocumentFile | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| DocumentFile | uploadedBy | uploadedBy String? @map("uploaded_by") | uploadedBy String? @db.Uuid @map("uploaded_by") | YES | Review db-specific attrs |
| Employee | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Employee | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Employee | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| FixedAsset | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| FixedAsset | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| GoodsReceivedNote | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| GoodsReceivedNote | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| GoodsReceivedNote | purchaseOrderId | purchaseOrderId String @map("purchase_order_id") | purchaseOrderId String @db.Uuid @map("purchase_order_id") | YES | Review db-specific attrs |
| GoodsReceivedNote | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| GoodsReceivedNote | receivedBy | receivedBy String @map("received_by") | receivedBy String @db.Uuid @map("received_by") | YES | Review db-specific attrs |
| GoodsReceivedNoteItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| GoodsReceivedNoteItem | grnId | grnId String @map("grn_id") | grnId String @db.Uuid @map("grn_id") | YES | Review db-specific attrs |
| GoodsReceivedNoteItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| GoodsReceivedNoteItem | poItemId | poItemId String @map("po_item_id") | poItemId String @db.Uuid @map("po_item_id") | YES | Review db-specific attrs |
| InventoryBatch | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| InventoryBatch | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| InventoryBatch | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| InventoryBatch | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| InventoryBatch | supplierId | supplierId String? @map("supplier_id") | supplierId String? @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| Invoice | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Invoice | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Invoice | customerId | customerId String @map("customer_id") | customerId String @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| Invoice | salesOrderId | salesOrderId String? @map("sales_order_id") | salesOrderId String? @db.Uuid @map("sales_order_id") | YES | Review db-specific attrs |
| Invoice | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| InvoiceItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| InvoiceItem | invoiceId | invoiceId String @map("invoice_id") | invoiceId String @db.Uuid @map("invoice_id") | YES | Review db-specific attrs |
| InvoiceItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| Item | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Item | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Item | categoryId | categoryId String @map("category_id") | categoryId String @db.Uuid @map("category_id") | YES | Review db-specific attrs |
| Item | unitOfMeasureId | unitOfMeasureId String @map("unit_of_measure_id") | unitOfMeasureId String @db.Uuid @map("unit_of_measure_id") | YES | Review db-specific attrs |
| ItemCategory | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ItemCategory | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| JournalEntry | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| JournalEntry | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| JournalEntry | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| JournalEntryLine | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| JournalEntryLine | journalEntryId | journalEntryId String @map("journal_entry_id") | journalEntryId String @db.Uuid @map("journal_entry_id") | YES | Review db-specific attrs |
| JournalEntryLine | accountId | accountId String @map("account_id") | accountId String @db.Uuid @map("account_id") | YES | Review db-specific attrs |
| LeaveRequest | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| LeaveRequest | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| LeaveRequest | employeeId | employeeId String @map("employee_id") | employeeId String @db.Uuid @map("employee_id") | YES | Review db-specific attrs |
| LeaveRequest | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| Machine | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Machine | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| MachineBreakdown | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| MachineBreakdown | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| MachineBreakdown | machineId | machineId String @map("machine_id") | machineId String @db.Uuid @map("machine_id") | YES | Review db-specific attrs |
| MachineBreakdown | reportedBy | reportedBy String @map("reported_by") | reportedBy String @db.Uuid @map("reported_by") | YES | Review db-specific attrs |
| MaintenanceSchedule | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| MaintenanceSchedule | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| MaintenanceSchedule | machineId | machineId String @map("machine_id") | machineId String @db.Uuid @map("machine_id") | YES | Review db-specific attrs |
| MaintenanceSchedule | performedBy | performedBy String? @map("performed_by") | performedBy String? @db.Uuid @map("performed_by") | YES | Review db-specific attrs |
| Notification | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Notification | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Notification | userProfileId | userProfileId String @map("user_profile_id") | userProfileId String @db.Uuid @map("user_profile_id") | YES | Review db-specific attrs |
| NumberSeries | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| NumberSeries | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Organization | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PasswordResetToken | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PasswordResetToken | userAccountId | userAccountId String @map("user_account_id") | userAccountId String @db.Uuid @map("user_account_id") | YES | Review db-specific attrs |
| Payment | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Payment | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Payment | customerId | customerId String? @map("customer_id") | customerId String? @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| Payment | supplierId | supplierId String? @map("supplier_id") | supplierId String? @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| Payment | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| PayrollRecord | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PayrollRecord | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| PayrollRecord | employeeId | employeeId String @map("employee_id") | employeeId String @db.Uuid @map("employee_id") | YES | Review db-specific attrs |
| PayrollRecord | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| Permission | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PettyCashReplenishment | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PettyCashReplenishment | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| PettyCashReplenishment | cashAccountId | cashAccountId String @map("cash_account_id") | cashAccountId String @db.Uuid @map("cash_account_id") | YES | Review db-specific attrs |
| PettyCashReplenishment | requestId | requestId String? @map("request_id") | requestId String? @db.Uuid @map("request_id") | YES | Review db-specific attrs |
| PettyCashReplenishment | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| PettyCashReplenishment | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| PettyCashRequest | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PettyCashRequest | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| PettyCashRequest | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| PettyCashRequest | requestedBy | requestedBy String @map("requested_by") | requestedBy String @db.Uuid @map("requested_by") | YES | Review db-specific attrs |
| PettyCashRequest | approvalRequestId | approvalRequestId String? @map("approval_request_id") | approvalRequestId String? @db.Uuid @map("approval_request_id") | YES | Review db-specific attrs |
| PettyCashRequest | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| ProductionBatch | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionBatch | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ProductionBatch | productionPlanId | productionPlanId String? @map("production_plan_id") | productionPlanId String? @db.Uuid @map("production_plan_id") | YES | Review db-specific attrs |
| ProductionBatch | recipeId | recipeId String @map("recipe_id") | recipeId String @db.Uuid @map("recipe_id") | YES | Review db-specific attrs |
| ProductionBatch | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| ProductionBatch | startedBy | startedBy String? @map("started_by") | startedBy String? @db.Uuid @map("started_by") | YES | Review db-specific attrs |
| ProductionBatch | closedBy | closedBy String? @map("closed_by") | closedBy String? @db.Uuid @map("closed_by") | YES | Review db-specific attrs |
| ProductionBatchMaterial | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionBatchMaterial | batchId | batchId String @map("batch_id") | batchId String @db.Uuid @map("batch_id") | YES | Review db-specific attrs |
| ProductionBatchMaterial | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| ProductionBatchMaterial | unitId | unitId String @map("unit_id") | unitId String @db.Uuid @map("unit_id") | YES | Review db-specific attrs |
| ProductionBatchOutput | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionBatchOutput | batchId | batchId String @map("batch_id") | batchId String @db.Uuid @map("batch_id") | YES | Review db-specific attrs |
| ProductionBatchOutput | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| ProductionBatchOutput | unitId | unitId String @map("unit_id") | unitId String @db.Uuid @map("unit_id") | YES | Review db-specific attrs |
| ProductionMaterialRequest | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionMaterialRequest | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ProductionMaterialRequest | productionBatchId | productionBatchId String @map("production_batch_id") | productionBatchId String @db.Uuid @map("production_batch_id") | YES | Review db-specific attrs |
| ProductionMaterialRequest | approvalRequestId | approvalRequestId String? @map("approval_request_id") | approvalRequestId String? @db.Uuid @map("approval_request_id") | YES | Review db-specific attrs |
| ProductionMaterialRequest | requestedBy | requestedBy String @map("requested_by") | requestedBy String @db.Uuid @map("requested_by") | YES | Review db-specific attrs |
| ProductionMaterialRequest | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| ProductionMaterialRequestItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionMaterialRequestItem | productionMaterialRequestId | productionMaterialRequestId String @map("production_material_request_id") | productionMaterialRequestId String @db.Uuid @map("production_material_request_id") | YES | Review db-specific attrs |
| ProductionMaterialRequestItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| ProductionMaterialRequestItem | unitOfMeasureId | unitOfMeasureId String @map("unit_of_measure_id") | unitOfMeasureId String @db.Uuid @map("unit_of_measure_id") | YES | Review db-specific attrs |
| ProductionPlan | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionPlan | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ProductionPlan | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| ProductionPlanItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionPlanItem | productionPlanId | productionPlanId String @map("production_plan_id") | productionPlanId String @db.Uuid @map("production_plan_id") | YES | Review db-specific attrs |
| ProductionPlanItem | recipeId | recipeId String @map("recipe_id") | recipeId String @db.Uuid @map("recipe_id") | YES | Review db-specific attrs |
| ProductionWastage | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionWastage | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ProductionWastage | productionBatchId | productionBatchId String @map("production_batch_id") | productionBatchId String @db.Uuid @map("production_batch_id") | YES | Review db-specific attrs |
| ProductionWastage | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| ProductionWastage | reportedBy | reportedBy String @map("reported_by") | reportedBy String @db.Uuid @map("reported_by") | YES | Review db-specific attrs |
| ProductionWorkerAssignment | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ProductionWorkerAssignment | batchId | batchId String @map("batch_id") | batchId String @db.Uuid @map("batch_id") | YES | Review db-specific attrs |
| ProductionWorkerAssignment | employeeId | employeeId String @map("employee_id") | employeeId String @db.Uuid @map("employee_id") | YES | Review db-specific attrs |
| PurchaseOrder | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PurchaseOrder | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| PurchaseOrder | supplierId | supplierId String @map("supplier_id") | supplierId String @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| PurchaseOrder | requisitionId | requisitionId String? @map("requisition_id") | requisitionId String? @db.Uuid @map("requisition_id") | YES | Review db-specific attrs |
| PurchaseOrder | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| PurchaseOrder | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| PurchaseOrderItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PurchaseOrderItem | purchaseOrderId | purchaseOrderId String @map("purchase_order_id") | purchaseOrderId String @db.Uuid @map("purchase_order_id") | YES | Review db-specific attrs |
| PurchaseOrderItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| PurchaseOrderItem | unitOfMeasureId | unitOfMeasureId String @map("unit_of_measure_id") | unitOfMeasureId String @db.Uuid @map("unit_of_measure_id") | YES | Review db-specific attrs |
| PurchaseRequisition | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PurchaseRequisition | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| PurchaseRequisition | requestedBy | requestedBy String @map("requested_by") | requestedBy String @db.Uuid @map("requested_by") | YES | Review db-specific attrs |
| PurchaseRequisition | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| PurchaseRequisitionItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| PurchaseRequisitionItem | requisitionId | requisitionId String @map("requisition_id") | requisitionId String @db.Uuid @map("requisition_id") | YES | Review db-specific attrs |
| PurchaseRequisitionItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| PurchaseRequisitionItem | unitOfMeasureId | unitOfMeasureId String @map("unit_of_measure_id") | unitOfMeasureId String @db.Uuid @map("unit_of_measure_id") | YES | Review db-specific attrs |
| QualityCheck | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| QualityCheck | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| QualityCheck | checkedBy | checkedBy String? @map("checked_by") | checkedBy String? @db.Uuid @map("checked_by") | YES | Review db-specific attrs |
| Quotation | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Quotation | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Quotation | customerId | customerId String @map("customer_id") | customerId String @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| Quotation | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| QuotationItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| QuotationItem | quotationId | quotationId String @map("quotation_id") | quotationId String @db.Uuid @map("quotation_id") | YES | Review db-specific attrs |
| QuotationItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| RFQItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| RFQItem | rfqId | rfqId String @map("rfq_id") | rfqId String @db.Uuid @map("rfq_id") | YES | Review db-specific attrs |
| RFQItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| RFQItem | unitOfMeasureId | unitOfMeasureId String @map("unit_of_measure_id") | unitOfMeasureId String @db.Uuid @map("unit_of_measure_id") | YES | Review db-specific attrs |
| RFQSupplier | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| RFQSupplier | rfqId | rfqId String @map("rfq_id") | rfqId String @db.Uuid @map("rfq_id") | YES | Review db-specific attrs |
| RFQSupplier | supplierId | supplierId String @map("supplier_id") | supplierId String @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| Recipe | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Recipe | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Recipe | finishedItemId | finishedItemId String @map("finished_item_id") | finishedItemId String @db.Uuid @map("finished_item_id") | YES | Review db-specific attrs |
| Recipe | outputUnitId | outputUnitId String @map("output_unit_id") | outputUnitId String @db.Uuid @map("output_unit_id") | YES | Review db-specific attrs |
| Recipe | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| RecipeItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| RecipeItem | recipeId | recipeId String @map("recipe_id") | recipeId String @db.Uuid @map("recipe_id") | YES | Review db-specific attrs |
| RecipeItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| RecipeItem | unitId | unitId String @map("unit_id") | unitId String @db.Uuid @map("unit_id") | YES | Review db-specific attrs |
| RecipeItem | substituteItemId | substituteItemId String? @map("substitute_item_id") | substituteItemId String? @db.Uuid @map("substitute_item_id") | YES | Review db-specific attrs |
| RecipePackaging | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| RecipePackaging | recipeId | recipeId String @map("recipe_id") | recipeId String @db.Uuid @map("recipe_id") | YES | Review db-specific attrs |
| RecipePackaging | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| RecipePackaging | unitId | unitId String @map("unit_id") | unitId String @db.Uuid @map("unit_id") | YES | Review db-specific attrs |
| RequestForQuotation | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| RequestForQuotation | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| RequestForQuotation | requisitionId | requisitionId String? @map("requisition_id") | requisitionId String? @db.Uuid @map("requisition_id") | YES | Review db-specific attrs |
| RequestForQuotation | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| Role | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Role | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| RolePermission | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| RolePermission | roleId | roleId String @map("role_id") | roleId String @db.Uuid @map("role_id") | YES | Review db-specific attrs |
| RolePermission | permissionId | permissionId String @map("permission_id") | permissionId String @db.Uuid @map("permission_id") | YES | Review db-specific attrs |
| SalesOrder | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SalesOrder | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| SalesOrder | customerId | customerId String @map("customer_id") | customerId String @db.Uuid @map("customer_id") | YES | Review db-specific attrs |
| SalesOrder | quotationId | quotationId String? @map("quotation_id") | quotationId String? @db.Uuid @map("quotation_id") | YES | Review db-specific attrs |
| SalesOrder | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| SalesOrder | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| SalesOrder | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| SalesOrderItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SalesOrderItem | salesOrderId | salesOrderId String @map("sales_order_id") | salesOrderId String @db.Uuid @map("sales_order_id") | YES | Review db-specific attrs |
| SalesOrderItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| ShiftReport | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| ShiftReport | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| ShiftReport | productionBatchId | productionBatchId String? @map("production_batch_id") | productionBatchId String? @db.Uuid @map("production_batch_id") | YES | Review db-specific attrs |
| ShiftReport | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| ShiftReport | preparedBy | preparedBy String @map("prepared_by") | preparedBy String @db.Uuid @map("prepared_by") | YES | Review db-specific attrs |
| ShiftReport | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| SparePart | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SparePart | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| SparePart | itemId | itemId String? @map("item_id") | itemId String? @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| StockAdjustment | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| StockAdjustment | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| StockAdjustment | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| StockAdjustment | approvalRequestId | approvalRequestId String? @map("approval_request_id") | approvalRequestId String? @db.Uuid @map("approval_request_id") | YES | Review db-specific attrs |
| StockAdjustment | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| StockAdjustment | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| StockAdjustmentItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| StockAdjustmentItem | adjustmentId | adjustmentId String @map("adjustment_id") | adjustmentId String @db.Uuid @map("adjustment_id") | YES | Review db-specific attrs |
| StockAdjustmentItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| StockBalance | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| StockBalance | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| StockBalance | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| StockBalance | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| StockMovement | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| StockMovement | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| StockMovement | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| StockMovement | warehouseId | warehouseId String @map("warehouse_id") | warehouseId String @db.Uuid @map("warehouse_id") | YES | Review db-specific attrs |
| StockMovement | batchId | batchId String? @map("batch_id") | batchId String? @db.Uuid @map("batch_id") | YES | Review db-specific attrs |
| StockMovement | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| StockTransfer | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| StockTransfer | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| StockTransfer | fromWarehouseId | fromWarehouseId String @map("from_warehouse_id") | fromWarehouseId String @db.Uuid @map("from_warehouse_id") | YES | Review db-specific attrs |
| StockTransfer | toWarehouseId | toWarehouseId String @map("to_warehouse_id") | toWarehouseId String @db.Uuid @map("to_warehouse_id") | YES | Review db-specific attrs |
| StockTransfer | requestedBy | requestedBy String? @map("requested_by") | requestedBy String? @db.Uuid @map("requested_by") | YES | Review db-specific attrs |
| StockTransfer | approvedBy | approvedBy String? @map("approved_by") | approvedBy String? @db.Uuid @map("approved_by") | YES | Review db-specific attrs |
| StockTransferItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| StockTransferItem | transferId | transferId String @map("transfer_id") | transferId String @db.Uuid @map("transfer_id") | YES | Review db-specific attrs |
| StockTransferItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| Supplier | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Supplier | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Supplier | categoryId | categoryId String @map("category_id") | categoryId String @db.Uuid @map("category_id") | YES | Review db-specific attrs |
| Supplier | createdBy | createdBy String? @map("created_by") | createdBy String? @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| SupplierCategory | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SupplierCategory | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| SupplierPerformance | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SupplierPerformance | supplierId | supplierId String @map("supplier_id") | supplierId String @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| SupplierPerformance | evaluatedBy | evaluatedBy String @map("evaluated_by") | evaluatedBy String @db.Uuid @map("evaluated_by") | YES | Review db-specific attrs |
| SupplierQuotation | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SupplierQuotation | rfqId | rfqId String @map("rfq_id") | rfqId String @db.Uuid @map("rfq_id") | YES | Review db-specific attrs |
| SupplierQuotation | supplierId | supplierId String @map("supplier_id") | supplierId String @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| SupplierQuotation | selectedBy | selectedBy String? @map("selected_by") | selectedBy String? @db.Uuid @map("selected_by") | YES | Review db-specific attrs |
| SupplierQuotationItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SupplierQuotationItem | quotationId | quotationId String @map("quotation_id") | quotationId String @db.Uuid @map("quotation_id") | YES | Review db-specific attrs |
| SupplierQuotationItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| SupplierReturn | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SupplierReturn | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| SupplierReturn | supplierId | supplierId String @map("supplier_id") | supplierId String @db.Uuid @map("supplier_id") | YES | Review db-specific attrs |
| SupplierReturn | grnId | grnId String? @map("grn_id") | grnId String? @db.Uuid @map("grn_id") | YES | Review db-specific attrs |
| SupplierReturn | createdBy | createdBy String @map("created_by") | createdBy String @db.Uuid @map("created_by") | YES | Review db-specific attrs |
| SupplierReturnItem | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| SupplierReturnItem | returnId | returnId String @map("return_id") | returnId String @db.Uuid @map("return_id") | YES | Review db-specific attrs |
| SupplierReturnItem | itemId | itemId String @map("item_id") | itemId String @db.Uuid @map("item_id") | YES | Review db-specific attrs |
| TaxRate | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| TaxRate | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| TaxRate | accountId | accountId String? @map("account_id") | accountId String? @db.Uuid @map("account_id") | YES | Review db-specific attrs |
| UnitOfMeasure | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| UnitOfMeasure | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| UserAccount | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| UserAccount | roleId | roleId String @map("role_id") | roleId String @db.Uuid @map("role_id") | YES | Review db-specific attrs |
| UserAccount | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| UserAccount | userProfileId | userProfileId String? @unique @map("user_profile_id") | userProfileId String? @unique @db.Uuid @map("user_profile_id") | YES | Review db-specific attrs |
| UserProfile | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| UserProfile | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| UserProfile | employeeId | employeeId String? @unique @map("employee_id") | employeeId String? @unique @db.Uuid @map("employee_id") | YES | Review db-specific attrs |
| UserProfile | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |
| UserRole | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| UserRole | userProfileId | userProfileId String @map("user_profile_id") | userProfileId String @db.Uuid @map("user_profile_id") | YES | Review db-specific attrs |
| UserRole | roleId | roleId String @map("role_id") | roleId String @db.Uuid @map("role_id") | YES | Review db-specific attrs |
| UserRole | assignedBy | assignedBy String? @map("assigned_by") | assignedBy String? @db.Uuid @map("assigned_by") | YES | Review db-specific attrs |
| Warehouse | id | id String @id @default(uuid()) | id String @id @default(uuid()) @db.Uuid | YES | Review db-specific attrs |
| Warehouse | organizationId | organizationId String @map("organization_id") | organizationId String @db.Uuid @map("organization_id") | YES | Review db-specific attrs |
| Warehouse | branchId | branchId String? @map("branch_id") | branchId String? @db.Uuid @map("branch_id") | YES | Review db-specific attrs |

---

## OPEN CHECKLIST ITEMS

[ ] Full sync audit complete
[ ] API_ROUTES used in all hooks
[ ] API_ROUTES used in all pages
[ ] Inventory module sync verified
[ ] Procurement module sync verified
[x] Production module sync verified
[ ] Branch module sync verified
[x] Sales module sync verified
[x] Finance module sync verified
[ ] HR module sync verified
[ ] Maintenance module sync verified
[ ] Settings module sync verified
[ ] Auth module sync verified
[ ] All Zod schemas match Prisma models
[ ] All response shapes typed
[ ] All frontend tables use correct column accessors
[ ] Vercel API deploy fixed
[x] All tests passing

---

## MODULE SYNC COMPLETIONS

[x] Production module sync verified
    - Status transition guard added (`assertValidTransition`)
    - `reserveMaterials` atomicity fixed with full pre-check + serializable transaction
    - `cancelBatch` releases reserved stock
    - `closeBatch` transaction integrity enforced (quality gate + inventory issue/output flow)
    - Added 8 production tests
    - Timestamp: 2026-06-01

[x] Sales module sync verified
    - Credit limit enforcement added in `confirmOrder` for credit-term customers
    - `recordPayment` transaction hardened (`OVERPAYMENT`, cancelled/paid guards)
    - Invoice/customer balance updates validated in transaction
    - Added 6 sales tests
    - Timestamp: 2026-06-01

[x] Finance module sync verified
    - Journal balance validation added (`validateJournalBalance`)
    - Posted journal lock enforcement added (`POSTED_RECORD_LOCKED`)
    - Journal CRUD/post routes and schemas aligned
    - Added 4 finance tests
    - Timestamp: 2026-06-01

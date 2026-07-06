import { toNumber } from '@/lib/inventory';
import { salesErrorMessage } from '@/lib/sales-server';

type SalesService = {
  from: (table: string) => any;
};

export type CustomerBalanceSnapshot = {
  approvedCreditNotes: number;
  availableCredit: number;
  creditAllowed: boolean;
  creditLimit: number;
  outstandingBalance: number;
};

export type SalesCustomerRecord = {
  address?: string | null;
  code?: string | null;
  created_at?: string | null;
  current_balance?: number | string | null;
  customer_type?: string | null;
  email?: string | null;
  id?: string | null;
  name?: string | null;
  payment_terms?: string | null;
  phone?: string | null;
  outstanding_balance?: number | string | null;
  status?: string | null;
  updated_at?: string | null;
};

export function normalizeCustomerStatus(value: unknown) {
  const status = String(value ?? 'ACTIVE').trim().toUpperCase();
  if (status === 'INACTIVE' || status === 'BLACKLISTED') {
    return status;
  }

  return 'ACTIVE';
}

export function isCustomerInactiveStatus(value: unknown) {
  return normalizeCustomerStatus(value) !== 'ACTIVE';
}

export function deriveCustomerCreditAllowed(paymentTerms: unknown, creditLimit: unknown) {
  const terms = String(paymentTerms ?? '').trim().toLowerCase();
  return terms.includes('credit') || toNumber(creditLimit) > 0;
}

export function calculateAvailableCredit(creditLimit: unknown, outstandingBalance: unknown) {
  return Math.max(0, toNumber(creditLimit) - toNumber(outstandingBalance));
}

export async function loadCustomerBalanceSnapshot(
  service: SalesService,
  customerId: string,
  fallbackCurrentBalance?: unknown,
  fallbackCreditLimit?: unknown,
  fallbackPaymentTerms?: unknown,
): Promise<CustomerBalanceSnapshot> {
  let invoiceResult = await service
    .from('invoices')
    .select('status, balance_due, total, total_amount, amount_paid, paid_amount')
    .eq('customer_id', customerId)
    .is('deleted_at', null);
  const invoiceErrorMessage = salesErrorMessage(invoiceResult.error);
  if (
    invoiceResult.error &&
    (invoiceErrorMessage.includes('deleted_at') || invoiceErrorMessage.includes('total') || invoiceErrorMessage.includes('amount_paid'))
  ) {
    invoiceResult = await service
      .from('invoices')
      .select('status, balance_due, total_amount, paid_amount')
      .eq('customer_id', customerId);
  }
  if (invoiceResult.error) {
    throw new Error(invoiceResult.error.message);
  }

  let approvedCreditNotes = 0;
  try {
    const creditNotesResult = await service
      .from('credit_notes')
      .select('amount, status')
      .eq('customer_id', customerId);
    if (creditNotesResult.error) {
      throw creditNotesResult.error;
    }

    approvedCreditNotes = (creditNotesResult.data ?? []).reduce((sum: number, row: Record<string, unknown>) => {
      const status = String(row.status ?? '').toUpperCase();
      if (!['APPROVED', 'POSTED'].includes(status)) {
        return sum;
      }

      return sum + toNumber(row.amount);
    }, 0);
  } catch (error) {
    const message = salesErrorMessage(error);
    if (
      !message.includes("Could not find the table 'icecream_erp.credit_notes'") &&
      !message.includes('does not exist')
    ) {
      throw error;
    }
  }

  const invoiceOutstanding = (invoiceResult.data ?? []).reduce((sum: number, row: Record<string, unknown>) => {
    const status = String(row.status ?? '').toUpperCase();
    if (status === 'CANCELLED' || status === 'VOIDED') {
      return sum;
    }

    const openBalance = row.balance_due !== undefined && row.balance_due !== null
      ? toNumber(row.balance_due)
      : Math.max(0, toNumber(row.total ?? row.total_amount) - toNumber(row.amount_paid ?? row.paid_amount));
    return sum + openBalance;
  }, 0);

  const computedOutstanding = Math.max(0, invoiceOutstanding - approvedCreditNotes);
  const currentBalance = toNumber(fallbackCurrentBalance);
  const outstandingBalance = computedOutstanding > 0 || invoiceOutstanding > 0 || approvedCreditNotes > 0
    ? computedOutstanding
    : currentBalance;
  const creditLimit = toNumber(fallbackCreditLimit);

  return {
    approvedCreditNotes,
    availableCredit: calculateAvailableCredit(creditLimit, outstandingBalance),
    creditAllowed: deriveCustomerCreditAllowed(fallbackPaymentTerms, creditLimit),
    creditLimit,
    outstandingBalance,
  };
}

export function mapCustomerRow(
  customer: SalesCustomerRecord,
  balance: CustomerBalanceSnapshot,
) {
  return {
    address: customer.address ?? null,
    availableCredit: balance.availableCredit,
    code: String(customer.code ?? ''),
    creditAllowed: balance.creditAllowed,
    creditLimit: balance.creditLimit,
    currentBalance: balance.outstandingBalance,
    customerType: String(customer.customer_type ?? ''),
    email: customer.email ?? null,
    id: String(customer.id ?? ''),
    name: String(customer.name ?? ''),
    paymentTerms: customer.payment_terms ?? null,
    phone: customer.phone ?? null,
    status: normalizeCustomerStatus(customer.status),
  };
}

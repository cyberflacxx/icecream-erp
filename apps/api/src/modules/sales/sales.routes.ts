import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { salesController } from './sales.controller';

export const salesRouter = Router();

salesRouter.use(authenticateRequest);

salesRouter.get('/customers', requirePermission('customer.read'), salesController.listCustomers);
salesRouter.post('/customers', requirePermission('customer.manage'), salesController.createCustomer);
salesRouter.get('/customers/:id', requirePermission('customer.read'), salesController.getCustomer);
salesRouter.patch('/customers/:id', requirePermission('customer.manage'), salesController.updateCustomer);
salesRouter.delete('/customers/:id', requirePermission('customer.manage'), salesController.deleteCustomer);

salesRouter.get('/quotations', requirePermission('quotation.read'), salesController.listQuotations);
salesRouter.post('/quotations', requirePermission('quotation.create'), salesController.createQuotation);
salesRouter.get('/quotations/:id', requirePermission('quotation.read'), salesController.getQuotation);
salesRouter.patch('/quotations/:id', requirePermission('quotation.create'), salesController.updateQuotation);
salesRouter.post(
  '/quotations/:id/convert-to-order',
  requirePermission('sales_order.create'),
  salesController.convertQuotationToOrder,
);
salesRouter.get('/quotations/:id/pdf', requirePermission('quotation.read'), salesController.getQuotationPdf);

salesRouter.get('/orders', requirePermission('sales_order.read'), salesController.listSalesOrders);
salesRouter.post('/orders', requirePermission('sales_order.create'), salesController.createSalesOrder);
salesRouter.get('/orders/:id', requirePermission('sales_order.read'), salesController.getSalesOrder);
salesRouter.post('/orders/:id/confirm', requirePermission('sales_order.create'), salesController.confirmOrder);
salesRouter.post('/orders/:id/cancel', requirePermission('sales_order.create'), salesController.cancelOrder);

salesRouter.post('/delivery-notes', requirePermission('sales_order.create'), salesController.createDeliveryNote);
salesRouter.post(
  '/delivery-notes/:id/confirm',
  requirePermission('sales_order.create'),
  salesController.confirmDelivery,
);

salesRouter.get('/invoices', requirePermission('invoice.read'), salesController.listInvoices);
salesRouter.post('/invoices', requirePermission('invoice.create'), salesController.createInvoice);
salesRouter.get('/invoices/:id', requirePermission('invoice.read'), salesController.getInvoice);
salesRouter.patch('/invoices/:id', requirePermission('invoice.create'), salesController.updateInvoice);
salesRouter.post('/invoices/:id/payment', requirePermission('payment.create'), salesController.recordPayment);
salesRouter.get('/invoices/:id/pdf', requirePermission('invoice.read'), salesController.getInvoicePdf);

salesRouter.post('/customer-returns', requirePermission('invoice.create'), salesController.createCustomerReturn);

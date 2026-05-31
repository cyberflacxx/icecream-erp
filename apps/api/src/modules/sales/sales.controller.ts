import type { NextFunction, Request, Response } from 'express';

import { SalesService } from './sales.service';
import {
  createCustomerReturnSchema,
  createCustomerSchema,
  createDeliveryNoteSchema,
  createInvoiceSchema,
  createQuotationSchema,
  createSalesOrderSchema,
  customerIdParamsSchema,
  customersListQuerySchema,
  deliveryNoteIdParamsSchema,
  invoiceIdParamsSchema,
  invoicePaymentSchema,
  invoicesListQuerySchema,
  orderIdParamsSchema,
  ordersListQuerySchema,
  quotationIdParamsSchema,
  quotationsListQuerySchema,
  updateCustomerSchema,
  updateInvoiceSchema,
  updateQuotationSchema
} from './sales.schemas';

function getSalesContext(req: Request) {
  if (!req.authContext) {
    throw new Error('Unauthorized');
  }

  return {
    branchId: req.authContext.profile.branchId,
    isBranchScoped: req.authContext.isBranchScoped,
    organizationId: req.authContext.organizationId,
    userProfileId: req.authContext.profile.id
  };
}

export const salesController = {
  cancelOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = orderIdParamsSchema.parse(req.params);
      const result = await SalesService.cancelOrder(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  confirmDelivery: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = deliveryNoteIdParamsSchema.parse(req.params);
      const result = await SalesService.confirmDelivery(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  confirmOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = orderIdParamsSchema.parse(req.params);
      const result = await SalesService.confirmOrder(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  convertQuotationToOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = quotationIdParamsSchema.parse(req.params);
      const result = await SalesService.convertQuotationToOrder(context, params.id);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createCustomer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const body = createCustomerSchema.parse(req.body);
      const result = await SalesService.createCustomer(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createCustomerReturn: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const body = createCustomerReturnSchema.parse(req.body);
      const result = await SalesService.createCustomerReturn(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createDeliveryNote: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const body = createDeliveryNoteSchema.parse(req.body);
      const result = await SalesService.createDeliveryNote(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createInvoice: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const body = createInvoiceSchema.parse(req.body);
      const result = await SalesService.createInvoice(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createQuotation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const body = createQuotationSchema.parse(req.body);
      const result = await SalesService.createQuotation(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  createSalesOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const body = createSalesOrderSchema.parse(req.body);
      const result = await SalesService.createSalesOrder(context, body);

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },

  deleteCustomer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = customerIdParamsSchema.parse(req.params);
      const result = await SalesService.deleteCustomer(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getCustomer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = customerIdParamsSchema.parse(req.params);
      const result = await SalesService.getCustomer(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getInvoice: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = invoiceIdParamsSchema.parse(req.params);
      const result = await SalesService.getInvoice(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getInvoicePdf: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = invoiceIdParamsSchema.parse(req.params);
      const result = await SalesService.createInvoicePdf(context, params.id);

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

      return res.status(200).send(result.content);
    } catch (error) {
      return next(error);
    }
  },

  getQuotation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = quotationIdParamsSchema.parse(req.params);
      const result = await SalesService.getQuotation(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  getQuotationPdf: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = quotationIdParamsSchema.parse(req.params);
      const result = await SalesService.createQuotationPdf(context, params.id);

      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);

      return res.status(200).send(result.content);
    } catch (error) {
      return next(error);
    }
  },

  getSalesOrder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = orderIdParamsSchema.parse(req.params);
      const result = await SalesService.getSalesOrder(context, params.id);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listCustomers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const query = customersListQuerySchema.parse(req.query);
      const result = await SalesService.listCustomers(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listInvoices: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const query = invoicesListQuerySchema.parse(req.query);
      const result = await SalesService.listInvoices(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listQuotations: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const query = quotationsListQuerySchema.parse(req.query);
      const result = await SalesService.listQuotations(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  listSalesOrders: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const query = ordersListQuerySchema.parse(req.query);
      const result = await SalesService.listSalesOrders(context, query);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  recordPayment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = invoiceIdParamsSchema.parse(req.params);
      const body = invoicePaymentSchema.parse(req.body);
      const result = await SalesService.recordPayment(
        context,
        params.id,
        body.amount,
        body.method,
        body.reference,
      );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateCustomer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = customerIdParamsSchema.parse(req.params);
      const body = updateCustomerSchema.parse(req.body);
      const result = await SalesService.updateCustomer(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateInvoice: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = invoiceIdParamsSchema.parse(req.params);
      const body = updateInvoiceSchema.parse(req.body);
      const result = await SalesService.updateInvoice(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },

  updateQuotation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = getSalesContext(req);
      const params = quotationIdParamsSchema.parse(req.params);
      const body = updateQuotationSchema.parse(req.body);
      const result = await SalesService.updateQuotation(context, params.id, body);

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
};

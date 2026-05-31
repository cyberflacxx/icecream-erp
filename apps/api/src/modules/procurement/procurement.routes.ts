import { Router } from 'express';

import { authenticateRequest } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { procurementController } from './procurement.controller';

export const procurementRouter = Router();

procurementRouter.use(authenticateRequest);

procurementRouter.get(
  '/meta',
  requirePermission(['purchase_requisition.read', 'purchase_order.read', 'goods_received.read']),
  procurementController.getProcurementMeta,
);

procurementRouter.get(
  '/requisitions',
  requirePermission('purchase_requisition.read'),
  procurementController.listRequisitions,
);
procurementRouter.post(
  '/requisitions',
  requirePermission('purchase_requisition.create'),
  procurementController.createRequisition,
);
procurementRouter.patch(
  '/requisitions/:id',
  requirePermission('purchase_requisition.create'),
  procurementController.updateRequisition,
);
procurementRouter.post(
  '/requisitions/:id/submit',
  requirePermission('purchase_requisition.create'),
  procurementController.submitRequisition,
);
procurementRouter.post(
  '/requisitions/:id/approve',
  requirePermission('purchase_requisition.approve'),
  procurementController.approveRequisition,
);
procurementRouter.post(
  '/requisitions/:id/reject',
  requirePermission('purchase_requisition.approve'),
  procurementController.rejectRequisition,
);

procurementRouter.get(
  '/purchase-orders',
  requirePermission('purchase_order.read'),
  procurementController.listPurchaseOrders,
);
procurementRouter.post(
  '/purchase-orders',
  requirePermission('purchase_order.create'),
  procurementController.createPurchaseOrder,
);
procurementRouter.patch(
  '/purchase-orders/:id',
  requirePermission('purchase_order.create'),
  procurementController.updatePurchaseOrder,
);
procurementRouter.post(
  '/purchase-orders/:id/approve',
  requirePermission('purchase_order.approve'),
  procurementController.approvePurchaseOrder,
);
procurementRouter.post(
  '/purchase-orders/:id/send',
  requirePermission('purchase_order.approve'),
  procurementController.sendPurchaseOrder,
);
procurementRouter.get(
  '/purchase-orders/:id',
  requirePermission('purchase_order.read'),
  procurementController.getPurchaseOrder,
);
procurementRouter.get(
  '/purchase-orders/:id/pdf',
  requirePermission('purchase_order.read'),
  procurementController.getPurchaseOrderPdf,
);

procurementRouter.get(
  '/grns',
  requirePermission('goods_received.read'),
  procurementController.listGRNs,
);
procurementRouter.post(
  '/grns',
  requirePermission('goods_received.create'),
  procurementController.createGRN,
);
procurementRouter.post(
  '/grns/:id/receive',
  requirePermission('goods_received.create'),
  procurementController.receiveGRN,
);
procurementRouter.post(
  '/grns/:id/approve',
  requirePermission('goods_received.create'),
  procurementController.approveGRN,
);

procurementRouter.post(
  '/returns',
  requirePermission('purchase_order.create'),
  procurementController.createSupplierReturn,
);

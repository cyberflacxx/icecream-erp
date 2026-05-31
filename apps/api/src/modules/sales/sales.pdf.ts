import PDFDocument from 'pdfkit';

function createPdfDocument() {
  return new PDFDocument({
    margin: 40,
    size: 'A4'
  });
}

function toBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function drawCompanyHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(19).text('Absolute Quality Icecream', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#666').text('Address: Harare, Zimbabwe');
  doc.text('Tax Number: AQI-ERP-001');
  doc.moveDown(0.6);
  doc.fillColor('#111').fontSize(16).text(title, { align: 'right' });
  doc.moveDown(0.8);
}

function drawSummaryLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(10).fillColor('#444').text(label, { continued: true });
  doc.fillColor('#111').text(` ${value}`);
}

function drawItemsTable(
  doc: PDFKit.PDFDocument,
  items: Array<{
    discount?: number;
    item: string;
    qty: number;
    total: number;
    unitPrice: number;
  }>,
) {
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#111').text('Item', 40, doc.y, { continued: true });
  doc.text('Qty', 240, doc.y, { continued: true });
  doc.text('Unit Price', 300, doc.y, { continued: true });
  doc.text('Discount', 390, doc.y, { continued: true });
  doc.text('Total', 480, doc.y);
  doc.moveDown(0.2);
  doc.strokeColor('#ddd').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.2);

  items.forEach((row) => {
    doc.fillColor('#222').text(row.item, 40, doc.y, { continued: true });
    doc.text(row.qty.toFixed(3), 240, doc.y, { continued: true });
    doc.text(row.unitPrice.toFixed(2), 300, doc.y, { continued: true });
    doc.text(`${(row.discount ?? 0).toFixed(2)}%`, 390, doc.y, { continued: true });
    doc.text(row.total.toFixed(2), 480, doc.y);
    doc.moveDown(0.1);
  });
}

export async function buildInvoicePdf(input: {
  amountPaid: number;
  balanceDue: number;
  customerAddress?: string | null;
  customerName: string;
  discount: number;
  dueDate?: string | null;
  invoiceDate: string;
  invoiceNumber: string;
  items: Array<{
    discount?: number;
    item: string;
    qty: number;
    total: number;
    unitPrice: number;
  }>;
  paymentTerms?: string | null;
  subtotal: number;
  tax: number;
  total: number;
}) {
  const doc = createPdfDocument();
  drawCompanyHeader(doc, 'INVOICE');
  drawSummaryLine(doc, 'Invoice #:', input.invoiceNumber);
  drawSummaryLine(doc, 'Invoice Date:', input.invoiceDate);
  drawSummaryLine(doc, 'Due Date:', input.dueDate ?? '-');
  doc.moveDown(0.4);
  drawSummaryLine(doc, 'Customer:', input.customerName);
  drawSummaryLine(doc, 'Address:', input.customerAddress ?? '-');
  drawItemsTable(doc, input.items);
  doc.moveDown(0.5);
  drawSummaryLine(doc, 'Subtotal:', input.subtotal.toFixed(2));
  drawSummaryLine(doc, 'Tax:', input.tax.toFixed(2));
  drawSummaryLine(doc, 'Discount:', input.discount.toFixed(2));
  drawSummaryLine(doc, 'Grand Total:', input.total.toFixed(2));
  drawSummaryLine(doc, 'Payment Terms:', input.paymentTerms ?? '-');
  drawSummaryLine(doc, 'Paid Amount:', input.amountPaid.toFixed(2));
  drawSummaryLine(doc, 'Balance Due:', input.balanceDue.toFixed(2));
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#444').text('Thank you for your business.', { align: 'center' });

  return toBuffer(doc);
}

export async function buildQuotationPdf(input: {
  customerAddress?: string | null;
  customerName: string;
  discount: number;
  items: Array<{
    discount?: number;
    item: string;
    qty: number;
    total: number;
    unitPrice: number;
  }>;
  quotationDate: string;
  quotationNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  validUntil?: string | null;
}) {
  const doc = createPdfDocument();
  drawCompanyHeader(doc, 'QUOTATION');
  drawSummaryLine(doc, 'Quotation #:', input.quotationNumber);
  drawSummaryLine(doc, 'Quotation Date:', input.quotationDate);
  drawSummaryLine(doc, 'Valid Until:', input.validUntil ?? '-');
  doc.moveDown(0.4);
  drawSummaryLine(doc, 'Customer:', input.customerName);
  drawSummaryLine(doc, 'Address:', input.customerAddress ?? '-');
  drawItemsTable(doc, input.items);
  doc.moveDown(0.5);
  drawSummaryLine(doc, 'Subtotal:', input.subtotal.toFixed(2));
  drawSummaryLine(doc, 'Tax:', input.tax.toFixed(2));
  drawSummaryLine(doc, 'Discount:', input.discount.toFixed(2));
  drawSummaryLine(doc, 'Grand Total:', input.total.toFixed(2));

  return toBuffer(doc);
}

export async function buildDeliveryNotePdf(input: {
  deliveryAddress?: string | null;
  deliveryDate: string;
  deliveryNumber: string;
  items: Array<{
    item: string;
    qty: number;
  }>;
}) {
  const doc = createPdfDocument();
  drawCompanyHeader(doc, 'DELIVERY NOTE');
  drawSummaryLine(doc, 'Delivery #:', input.deliveryNumber);
  drawSummaryLine(doc, 'Delivery Date:', input.deliveryDate);
  drawSummaryLine(doc, 'Delivery Address:', input.deliveryAddress ?? '-');
  doc.moveDown(0.5);
  doc.fontSize(10).text('Item', 40, doc.y, { continued: true });
  doc.text('Quantity', 360, doc.y);
  doc.moveDown(0.2);
  doc.strokeColor('#ddd').moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.2);

  input.items.forEach((item) => {
    doc.text(item.item, 40, doc.y, { continued: true });
    doc.text(item.qty.toFixed(3), 360, doc.y);
  });

  doc.moveDown(2.2);
  doc.text('Driver Signature: __________________________');
  doc.moveDown(1.1);
  doc.text('Customer Signature: ________________________');

  return toBuffer(doc);
}

export async function buildReceiptPdf(input: {
  amountPaid: number;
  invoiceNumber: string;
  method: string;
  paymentDate: string;
  paymentNumber: string;
  reference?: string | null;
}) {
  const doc = createPdfDocument();
  drawCompanyHeader(doc, 'PAYMENT RECEIPT');
  drawSummaryLine(doc, 'Receipt #:', input.paymentNumber);
  drawSummaryLine(doc, 'Invoice #:', input.invoiceNumber);
  drawSummaryLine(doc, 'Payment Date:', input.paymentDate);
  drawSummaryLine(doc, 'Amount Paid:', input.amountPaid.toFixed(2));
  drawSummaryLine(doc, 'Method:', input.method);
  drawSummaryLine(doc, 'Reference:', input.reference ?? '-');
  doc.moveDown(1.5);
  doc.text('Payment confirmed. Thank you.', { align: 'center' });

  return toBuffer(doc);
}

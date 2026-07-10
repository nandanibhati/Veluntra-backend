const PDFDocument = require("pdfkit");

/** Streams a simple invoice PDF for an order directly to an HTTP response. */
function streamInvoice(res, { order, settings }) {
  const symbol = settings.currencySymbol || "£";
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.orderNumber}.pdf"`);
  doc.pipe(res);

  // Seller-branded, not platform-branded — the buyer should only ever see the store they
  // actually bought from. Falls back to platform Settings only if the store has no branding
  // set yet (Store.name is required, but the rest is optional until a seller fills it in).
  const brand = order.store || {};
  doc.fontSize(20).text(brand.name || settings.storeName || "Veluntra", { align: "left" });
  doc.fontSize(10).fillColor("#666").text("Invoice", { align: "left" });
  doc.moveDown(1.5);

  doc.fillColor("#000").fontSize(12).text(`Invoice #: ${order.orderNumber}`);
  doc.text(`Date: ${new Date(order.placedAt).toLocaleDateString()}`);
  doc.text(`Status: ${order.status}`);
  doc.moveDown();

  const brandAddressLines = [brand.addressLine1, brand.addressLine2, [brand.city, brand.state, brand.postalCode].filter(Boolean).join(", "), brand.country]
    .filter(Boolean);
  if (brand.name || brandAddressLines.length || brand.contactEmail || brand.contactPhone) {
    doc.font("Helvetica-Bold").text("Sold by:");
    doc.font("Helvetica");
    if (brand.name) doc.text(brand.name);
    for (const line of brandAddressLines) doc.text(line);
    if (brand.contactEmail) doc.text(brand.contactEmail);
    if (brand.contactPhone) doc.text(brand.contactPhone);
    doc.moveDown();
  }

  if (order.shippingAddress) {
    const a = order.shippingAddress;
    doc.font("Helvetica-Bold").text("Ship to:");
    doc
      .font("Helvetica")
      .text(`${a.firstName} ${a.lastName}`)
      .text(a.line1)
      .text(a.line2 || "")
      .text(`${a.city}, ${a.state || ""} ${a.postalCode}`)
      .text(a.country);
    doc.moveDown();
  }

  doc.font("Helvetica-Bold");
  const startY = doc.y;
  doc.text("Item", 50, startY, { width: 250 });
  doc.text("Qty", 310, startY, { width: 60 });
  doc.text("Price", 380, startY, { width: 80 });
  doc.text("Total", 470, startY, { width: 80 });
  doc.moveDown(0.5);
  doc.font("Helvetica");
  doc
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke();
  doc.moveDown(0.3);

  for (const item of order.items) {
    const rowY = doc.y;
    const lineTotal = (Number(item.priceSnapshot) * item.quantity).toFixed(2);
    doc.text(item.nameSnapshot, 50, rowY, { width: 250 });
    doc.text(String(item.quantity), 310, rowY, { width: 60 });
    doc.text(`${symbol}${Number(item.priceSnapshot).toFixed(2)}`, 380, rowY, { width: 80 });
    doc.text(`${symbol}${lineTotal}`, 470, rowY, { width: 80 });
    doc.moveDown(0.6);
  }

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  const totalsRow = (label, value) => {
    doc.text(label, 380, doc.y, { width: 80 });
    doc.text(value, 470, doc.y - doc.currentLineHeight(), { width: 80 });
    doc.moveDown(0.4);
  };

  totalsRow("Subtotal:", `${symbol}${Number(order.subtotal).toFixed(2)}`);
  if (Number(order.discount) > 0) totalsRow("Discount:", `-${symbol}${Number(order.discount).toFixed(2)}`);
  totalsRow("Shipping:", `${symbol}${Number(order.shippingCost).toFixed(2)}`);
  totalsRow("Tax:", `${symbol}${Number(order.tax).toFixed(2)}`);
  if (Number(order.platformFee) > 0) totalsRow("Platform fee:", `${symbol}${Number(order.platformFee).toFixed(2)}`);

  doc.font("Helvetica-Bold");
  totalsRow("Total:", `${symbol}${Number(order.total).toFixed(2)}`);

  doc.end();
}

module.exports = { streamInvoice };

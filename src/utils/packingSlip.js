const PDFDocument = require("pdfkit");

/** Streams a packing slip PDF for an order — an internal fulfillment document, so deliberately
 * no prices/totals (unlike the invoice). Seller-branded, same as the invoice: whoever packs the
 * order (seller or, once approved, Veluntra warehouse ops) never shows Veluntra branding to the
 * customer regardless of who actually fulfilled the item. */
function streamPackingSlip(res, { order }) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="packing-slip-${order.orderNumber}.pdf"`);
  doc.pipe(res);

  const brand = order.store || {};
  doc.fontSize(20).text(brand.name || "Veluntra", { align: "left" });
  doc.fontSize(10).fillColor("#666").text("Packing Slip", { align: "left" });
  doc.moveDown(1.5);

  doc.fillColor("#000").fontSize(12).text(`Order #: ${order.orderNumber}`);
  doc.text(`Date: ${new Date(order.placedAt).toLocaleDateString()}`);
  doc.moveDown();

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
  doc.text("Item", 50, startY, { width: 400 });
  doc.text("Qty", 470, startY, { width: 80 });
  doc.moveDown(0.5);
  doc.font("Helvetica");
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.3);

  for (const item of order.items) {
    const rowY = doc.y;
    doc.text(item.nameSnapshot, 50, rowY, { width: 400 });
    doc.text(String(item.quantity), 470, rowY, { width: 80 });
    doc.moveDown(0.6);
  }

  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

  doc.end();
}

module.exports = { streamPackingSlip };

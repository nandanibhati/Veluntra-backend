const PDFDocument = require("pdfkit");

/** Streams a plain shipping label PDF — human-readable text only, deliberately no scannable
 * barcode (no real carrier account exists yet to target a barcode standard against; the tracking
 * number/carrier are the same manual, admin/seller-entered fields already on Order). "From" is
 * always the seller's own branding, never Veluntra, regardless of who actually fulfilled it. */
function streamShippingLabel(res, { order }) {
  const doc = new PDFDocument({ margin: 50, size: [288, 432] }); // 4x6" label

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="shipping-label-${order.orderNumber}.pdf"`);
  doc.pipe(res);

  const brand = order.store || {};
  const brandAddressLines = [brand.addressLine1, brand.addressLine2, [brand.city, brand.state, brand.postalCode].filter(Boolean).join(", "), brand.country]
    .filter(Boolean);

  doc.fontSize(9).fillColor("#666").text("FROM", { align: "left" });
  doc.fontSize(12).fillColor("#000").font("Helvetica-Bold").text(brand.name || "Veluntra");
  doc.font("Helvetica").fontSize(10);
  for (const line of brandAddressLines) doc.text(line);
  doc.moveDown(1.5);

  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(9).fillColor("#666").text("TO");
  if (order.shippingAddress) {
    const a = order.shippingAddress;
    doc.fontSize(14).fillColor("#000").font("Helvetica-Bold").text(`${a.firstName} ${a.lastName}`);
    doc.font("Helvetica").fontSize(11);
    doc.text(a.line1);
    if (a.line2) doc.text(a.line2);
    doc.text(`${a.city}, ${a.state || ""} ${a.postalCode}`);
    doc.text(a.country);
  }
  doc.moveDown(2);

  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(9).fillColor("#666").text("ORDER");
  doc.fontSize(11).fillColor("#000").font("Helvetica-Bold").text(order.orderNumber);
  doc.font("Helvetica").fontSize(10);
  if (order.trackingCarrier) doc.text(`Carrier: ${order.trackingCarrier}`);
  if (order.trackingNumber) doc.text(`Tracking: ${order.trackingNumber}`);

  doc.end();
}

module.exports = { streamShippingLabel };

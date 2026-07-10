/**
 * Shipment-provider abstraction. Today there is exactly one provider — "manual", meaning an
 * admin/seller types in a carrier name, tracking number, and URL by hand via the existing
 * order-status-update endpoint (Order.trackingCarrier/trackingNumber/trackingUrl). This is the
 * seam a future real carrier integration (Shiprocket, Delhivery, etc.) plugs into later as an
 * additional provider with the same shape, without changing how orders.service.js calls this.
 */
const manualProvider = {
  name: "manual",
  /** No-op today beyond passing the given fields straight through — a real provider would call
   * an external carrier API here and could return a carrier-assigned tracking number/URL instead
   * of the admin/seller-entered ones. */
  async updateTracking(order, { trackingCarrier, trackingNumber, trackingUrl }) {
    return { trackingCarrier, trackingNumber, trackingUrl };
  },
};

/** Every order uses the manual provider today — a future warehouse/carrier-linked order type
 * would resolve a different provider here based on the order's fulfillment source. */
function resolveShipmentProvider(/* order */) {
  return manualProvider;
}

module.exports = { resolveShipmentProvider };

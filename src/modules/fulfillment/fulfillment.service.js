const inventoryService = require("../inventory/inventory.service");

/**
 * Fulfillment-source abstraction. Today there is exactly one source — "seller_stock", meaning
 * every order item is fulfilled from the owning store's own Product/ProductVariant stock — which
 * is all that exists anywhere in the platform right now. This is the seam a future
 * warehouse-fulfillment feature plugs into later (e.g. a "veluntra_warehouse" source with its own
 * dispatch branch below) without requiring order creation itself to be rewritten.
 */
async function fulfillOrderItem(tx, { source = "seller_stock", productId, variantId, quantity, productName, actorId = null, orderId = null }) {
  switch (source) {
    case "seller_stock":
      return inventoryService.decrementStock(tx, {
        productId,
        variantId,
        quantity,
        type: "order_deduct",
        actorId,
        orderId,
        notEnoughStockMessage: `"${productName}" no longer has enough stock — please update your cart.`,
      });
    default:
      throw new Error(`Unknown fulfillment source: ${source}`);
  }
}

module.exports = { fulfillOrderItem };

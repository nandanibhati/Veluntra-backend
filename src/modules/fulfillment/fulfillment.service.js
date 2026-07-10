const inventoryService = require("../inventory/inventory.service");
const warehouseInventoryService = require("../inventory/warehouseInventory.service");

/**
 * Fulfillment-source abstraction — "seller_stock" (the owning store's own Product/ProductVariant
 * stock) and "veluntra_warehouse" (the Veluntra-provisioned warehouse pool, used when a seller
 * requests warehouse fulfillment for an order item post-checkout — see
 * fulfillmentRequests.service.js). Each source dispatches to its own inventory module rather
 * than a single generalized decrement function, since the two pools are genuinely separate
 * tables/audit trails.
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
    case "veluntra_warehouse":
      return warehouseInventoryService.decrementStock(tx, {
        productId,
        variantId,
        quantity,
        actorId,
        orderId,
        notEnoughStockMessage: `Not enough warehouse stock provisioned for "${productName}".`,
      });
    default:
      throw new Error(`Unknown fulfillment source: ${source}`);
  }
}

module.exports = { fulfillOrderItem };

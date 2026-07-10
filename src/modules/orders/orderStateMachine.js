/**
 * Centralized order-status classification — replaces three previously-scattered constants
 * (RESTOCKING_STATUSES, RESTOCK_TYPE_BY_STATUS, CANCELLABLE_STATUSES that used to live inline in
 * orders.service.js) with one table. Purely descriptive today: updateStatus() still accepts any
 * OrderStatus value exactly as before (admin/seller override flexibility is unchanged, no new
 * transition enforcement was added here) — this only centralizes the *classification* logic into
 * one importable, documented place that a future order type (wholesale, dropship) can define its
 * own version of without touching orders.service.js's control flow.
 */
const ORDER_STATUS_META = {
  pending: { restocks: false, cancellableByCustomer: true },
  processing: { restocks: false, cancellableByCustomer: true },
  shipped: { restocks: false, cancellableByCustomer: false },
  delivered: { restocks: false, cancellableByCustomer: false },
  cancelled: { restocks: true, restockType: "cancel_restore", cancellableByCustomer: false },
  return_requested: { restocks: false, cancellableByCustomer: false },
  returned: { restocks: true, restockType: "return_restore", cancellableByCustomer: false },
  exchange_requested: { restocks: false, cancellableByCustomer: false },
  exchanged: { restocks: true, restockType: "return_restore", cancellableByCustomer: false },
};

/** True when moving TO `toStatus` should restock inventory, given the order isn't already in a
 * restocked (restocks: true) status — mirrors the original "!RESTOCKING_STATUSES.has(order.status)"
 * guard that prevented double-restocking an already-cancelled/returned/exchanged order. */
function isRestockingTransition(fromStatus, toStatus) {
  const toMeta = ORDER_STATUS_META[toStatus];
  return Boolean(toMeta?.restocks) && !ORDER_STATUS_META[fromStatus]?.restocks;
}

function restockTypeFor(status) {
  return ORDER_STATUS_META[status]?.restockType;
}

function isCancellableByCustomer(status) {
  return Boolean(ORDER_STATUS_META[status]?.cancellableByCustomer);
}

module.exports = { ORDER_STATUS_META, isRestockingTransition, restockTypeFor, isCancellableByCustomer };

/**
 * Central, reusable price calculator. Every place that needs to show or
 * charge a price (cart summary, checkout, order creation) goes through
 * these functions so "how discounts/tax/fees are computed" lives in
 * exactly one place — never hardcoded per-page.
 */

/** Does this promotion apply to the given product? */
function promotionAppliesTo(promotion, product) {
  if (!promotion.enabled) return false;
  const now = new Date();
  if (promotion.startsAt > now || promotion.endsAt < now) return false;
  switch (promotion.scope) {
    case "all":
      return true;
    case "category":
      return promotion.categoryId === product.categoryId;
    case "brand":
      return promotion.brandId === product.brandId;
    case "product":
      return promotion.productId === product.id;
    default:
      return false;
  }
}

/** Discount amount (in currency, not %) a single promotion yields for `quantity` units at `unitPrice`. */
function discountForPromotion(promotion, unitPrice, quantity) {
  switch (promotion.type) {
    case "bogo": {
      const buy = promotion.buyQuantity || 1;
      const get = promotion.getQuantity || 1;
      const groupSize = buy + get;
      const freeUnits = Math.floor(quantity / groupSize) * get;
      return freeUnits * unitPrice;
    }
    case "percentage":
    case "flash_sale":
    case "deal_of_day":
    case "category_discount":
    case "brand_discount":
    case "product_discount":
    case "festival":
      return unitPrice * quantity * (Number(promotion.value || 0) / 100);
    case "fixed":
      return Math.min(Number(promotion.value || 0) * quantity, unitPrice * quantity);
    case "first_order":
      // Handled by the caller (needs order-history context); no generic per-unit amount here.
      return 0;
    default:
      return 0;
  }
}

/** Picks the single best (highest-discount) active promotion for a cart line. */
function pickBestPromotion(promotions, product, unitPrice, quantity) {
  const applicable = promotions.filter((p) => promotionAppliesTo(p, product) && p.type !== "first_order");
  let best = null;
  let bestAmount = 0;
  for (const promo of applicable) {
    const amount = discountForPromotion(promo, unitPrice, quantity);
    if (amount > bestAmount) {
      best = promo;
      bestAmount = amount;
    }
  }
  return { promotion: best, discount: Math.round(bestAmount * 100) / 100 };
}

/** Coupon discount for a subtotal (percent/fixed; free_shipping is applied to shipping, not here). */
function couponDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  let amount = 0;
  if (coupon.type === "percent") amount = subtotal * (Number(coupon.value) / 100);
  else if (coupon.type === "fixed") amount = Math.min(Number(coupon.value), subtotal);
  if (coupon.maxDiscount) amount = Math.min(amount, Number(coupon.maxDiscount));
  return Math.round(amount * 100) / 100;
}

/**
 * Full order-level breakdown. `settings` is the Settings row (tax %,
 * platform fee %). Everything here is derived from database values —
 * nothing is a hardcoded constant.
 *
 * Pass `discountOverride` when the coupon discount was already computed
 * elsewhere (e.g. split proportionally across a multi-store order) —
 * this keeps tax/fee/total math in one place without recomputing a
 * fixed-amount coupon's discount per store group (which would double-count it).
 */
function calculateTotals({ subtotal, promotionDiscount = 0, coupon = null, shippingCost = 0, settings, discountOverride, codCharge = 0 }) {
  const afterPromotions = Math.max(subtotal - promotionDiscount, 0);
  const discount = discountOverride !== undefined ? Math.round(discountOverride * 100) / 100 : couponDiscount(coupon, afterPromotions);
  const taxable = Math.max(afterPromotions - discount, 0);
  const taxPercent = Number(settings?.taxPercent ?? 0);
  const platformFeePercent = Number(settings?.platformCommissionPercent ?? 0);
  const effectiveShipping = coupon?.type === "free_shipping" ? 0 : shippingCost;

  const tax = Math.round(taxable * (taxPercent / 100) * 100) / 100;
  const platformFee = Math.round(taxable * (platformFeePercent / 100) * 100) / 100;
  const total = Math.round((taxable + effectiveShipping + tax + platformFee + codCharge) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    promotionDiscount: Math.round(promotionDiscount * 100) / 100,
    discount,
    shippingCost: Math.round(effectiveShipping * 100) / 100,
    tax,
    platformFee,
    codCharge: Math.round(codCharge * 100) / 100,
    total,
  };
}

module.exports = { pickBestPromotion, couponDiscount, calculateTotals };

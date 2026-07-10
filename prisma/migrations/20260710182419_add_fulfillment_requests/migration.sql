-- CreateEnum
CREATE TYPE "FulfillmentSource" AS ENUM ('seller_stock', 'veluntra_warehouse');

-- CreateEnum
CREATE TYPE "FulfillmentRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'fulfilled');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "fulfillment_source" "FulfillmentSource" NOT NULL DEFAULT 'seller_stock';

-- CreateTable
CREATE TABLE "fulfillment_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "FulfillmentRequestStatus" NOT NULL DEFAULT 'pending',
    "seller_note" TEXT,
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "fulfillment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fulfillment_requests_status_idx" ON "fulfillment_requests"("status");

-- CreateIndex
CREATE INDEX "fulfillment_requests_order_id_idx" ON "fulfillment_requests"("order_id");

-- AddForeignKey
ALTER TABLE "fulfillment_requests" ADD CONSTRAINT "fulfillment_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requests" ADD CONSTRAINT "fulfillment_requests_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_requests" ADD CONSTRAINT "fulfillment_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

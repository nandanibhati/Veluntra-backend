-- CreateEnum
CREATE TYPE "DropshipOrderRequestStatus" AS ENUM ('new', 'processing', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "dropship_order_requests" (
    "id" TEXT NOT NULL,
    "dropshipper_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "shipping_service" TEXT,
    "customer_reference" TEXT,
    "special_instructions" TEXT,
    "status" "DropshipOrderRequestStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dropship_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dropship_order_requests_dropshipper_id_idx" ON "dropship_order_requests"("dropshipper_id");

-- CreateIndex
CREATE INDEX "dropship_order_requests_status_idx" ON "dropship_order_requests"("status");

-- AddForeignKey
ALTER TABLE "dropship_order_requests" ADD CONSTRAINT "dropship_order_requests_dropshipper_id_fkey" FOREIGN KEY ("dropshipper_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dropship_order_requests" ADD CONSTRAINT "dropship_order_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

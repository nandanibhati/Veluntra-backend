-- CreateEnum
CREATE TYPE "WholesaleOrderRequestStatus" AS ENUM ('new', 'processing', 'fulfilled', 'cancelled');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'wholesaler';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "wholesale_price" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "wholesale_order_requests" (
    "id" TEXT NOT NULL,
    "wholesaler_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "purchase_order_reference" TEXT,
    "special_instructions" TEXT,
    "status" "WholesaleOrderRequestStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wholesale_order_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wholesale_order_requests_wholesaler_id_idx" ON "wholesale_order_requests"("wholesaler_id");

-- CreateIndex
CREATE INDEX "wholesale_order_requests_status_idx" ON "wholesale_order_requests"("status");

-- AddForeignKey
ALTER TABLE "wholesale_order_requests" ADD CONSTRAINT "wholesale_order_requests_wholesaler_id_fkey" FOREIGN KEY ("wholesaler_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wholesale_order_requests" ADD CONSTRAINT "wholesale_order_requests_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

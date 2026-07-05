-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('pending', 'approved', 'suspended');

-- CreateEnum
CREATE TYPE "InventoryChangeType" AS ENUM ('order_deduct', 'cancel_restore', 'return_restore', 'bulk_import', 'bulk_adjustment', 'manual_adjustment', 'initial_stock');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'return_requested';
ALTER TYPE "OrderStatus" ADD VALUE 'exchange_requested';
ALTER TYPE "OrderStatus" ADD VALUE 'exchanged';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'cod';

-- AlterEnum
BEGIN;
CREATE TYPE "ProductStatus_new" AS ENUM ('draft', 'published', 'archived', 'hidden', 'upcoming', 'discontinued');
ALTER TABLE "public"."products" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "products" ALTER COLUMN "status" TYPE "ProductStatus_new" USING ("status"::text::"ProductStatus_new");
ALTER TYPE "ProductStatus" RENAME TO "ProductStatus_old";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";
DROP TYPE "public"."ProductStatus_old";
ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'superadmin';

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "meta_description" TEXT,
ADD COLUMN     "meta_title" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cod_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "delivered_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weight" DECIMAL(8,3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "canonical_url" TEXT,
ADD COLUMN     "cod_available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "country_of_origin" TEXT,
ADD COLUMN     "estimated_delivery_days" INTEGER,
ADD COLUMN     "gst_class" TEXT,
ADD COLUMN     "height" DECIMAL(8,2),
ADD COLUMN     "hsn_code" TEXT,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "length" DECIMAL(8,2),
ADD COLUMN     "og_image" TEXT,
ADD COLUMN     "reserved_stock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shipping_class" TEXT,
ADD COLUMN     "short_description" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warranty" TEXT,
ADD COLUMN     "weight" DECIMAL(8,3),
ADD COLUMN     "width" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "settings" DROP COLUMN "platform_fee_percent",
ADD COLUMN     "cancellation_window_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "cod_charge" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "exchange_window_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "feature_flags" JSONB,
ADD COLUMN     "free_shipping_threshold" DECIMAL(10,2),
ADD COLUMN     "loyalty_points_per_unit" DECIMAL(6,2) NOT NULL DEFAULT 1,
ADD COLUMN     "min_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "order_status_notify" JSONB,
ADD COLUMN     "platform_commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "referral_bonus_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "return_window_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "social_links" JSONB,
ADD COLUMN     "theme_colors" JSONB;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "commission_percent" DECIMAL(5,2),
ADD COLUMN     "status" "StoreStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "type" "InventoryChangeType" NOT NULL,
    "quantity_before" INTEGER NOT NULL,
    "quantity_after" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role", "permission");

-- CreateIndex
CREATE INDEX "inventory_transactions_product_id_idx" ON "inventory_transactions"("product_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


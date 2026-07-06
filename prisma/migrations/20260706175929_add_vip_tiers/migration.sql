-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "vip_tiers" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lifetime_spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vip_tier" TEXT;

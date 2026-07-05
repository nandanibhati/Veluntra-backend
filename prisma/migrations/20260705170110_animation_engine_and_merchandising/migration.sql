-- AlterTable
ALTER TABLE "homepage_sections" ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "starts_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "animation_override" JSONB,
ADD COLUMN     "is_best_seller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_trending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "animation_config" JSONB;


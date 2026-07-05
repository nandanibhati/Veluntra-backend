
-- CreateEnum
CREATE TYPE "HomepageSectionType" AS ENUM ('hero_banner', 'slider', 'categories', 'featured_products', 'trending_products', 'best_sellers', 'flash_sale', 'collections', 'brands', 'testimonials', 'announcement', 'ad_banner', 'custom');

-- AlterEnum
ALTER TYPE "ActivityScope" ADD VALUE 'homepage';

-- CreateTable
CREATE TABLE "homepage_sections" (
    "id" TEXT NOT NULL,
    "type" "HomepageSectionType" NOT NULL,
    "title" TEXT,
    "config" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homepage_sections_position_idx" ON "homepage_sections"("position");


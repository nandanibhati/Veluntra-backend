-- CreateEnum
CREATE TYPE "PartnerApplicationType" AS ENUM ('dropship', 'wholesale', 'affiliate');

-- CreateEnum
CREATE TYPE "PartnerApplicationStatus" AS ENUM ('new', 'reviewed', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "partner_applications" (
    "id" TEXT NOT NULL,
    "type" "PartnerApplicationType" NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company_name" TEXT,
    "website" TEXT,
    "tax_id" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "country" TEXT,
    "postal_code" TEXT,
    "referral_source" TEXT,
    "message" TEXT NOT NULL,
    "user_id" TEXT,
    "status" "PartnerApplicationStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_applications_type_idx" ON "partner_applications"("type");

-- CreateIndex
CREATE INDEX "partner_applications_status_idx" ON "partner_applications"("status");

-- AddForeignKey
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

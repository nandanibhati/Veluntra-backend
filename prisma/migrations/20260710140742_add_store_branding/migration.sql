-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "address_line1" TEXT,
ADD COLUMN     "address_line2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'GB',
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "state" TEXT;

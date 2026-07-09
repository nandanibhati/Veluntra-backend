-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('new', 'reviewed', 'archived');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'dropshipper';

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "user_id" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suggestions_status_idx" ON "suggestions"("status");

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

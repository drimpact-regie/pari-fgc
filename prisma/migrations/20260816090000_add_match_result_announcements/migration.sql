-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "lastResultsCheckAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AnnouncedSetResult" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncedSetResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncedSetResult_setId_key" ON "AnnouncedSetResult"("setId");

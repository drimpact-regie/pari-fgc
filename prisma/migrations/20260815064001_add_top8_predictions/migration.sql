-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "topEightLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TopEightPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "picks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopEightPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TopEightPick_userId_eventSlug_key" ON "TopEightPick"("userId", "eventSlug");

-- AddForeignKey
ALTER TABLE "TopEightPick" ADD CONSTRAINT "TopEightPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


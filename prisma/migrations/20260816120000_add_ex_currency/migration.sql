-- AlterTable
ALTER TABLE "User" ADD COLUMN "exBalance" INTEGER NOT NULL DEFAULT 10000;

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN "stake" INTEGER,
ADD COLUMN "odds" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ExAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "adminUsername" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExAdjustment_userId_idx" ON "ExAdjustment"("userId");

-- AddForeignKey
ALTER TABLE "ExAdjustment" ADD CONSTRAINT "ExAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

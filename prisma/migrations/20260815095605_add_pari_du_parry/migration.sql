-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "bracketResetActual" BOOLEAN,
ADD COLUMN     "bracketResetLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MvcBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "characterKey" TEXT NOT NULL,
    "predictedCount" INTEGER NOT NULL,
    "actualCount" INTEGER,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MvcBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketResetBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventSlug" TEXT NOT NULL,
    "predictedYes" BOOLEAN NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BracketResetBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MvcBet_eventSlug_characterKey_idx" ON "MvcBet"("eventSlug", "characterKey");

-- CreateIndex
CREATE UNIQUE INDEX "MvcBet_userId_eventSlug_key" ON "MvcBet"("userId", "eventSlug");

-- CreateIndex
CREATE UNIQUE INDEX "BracketResetBet_userId_eventSlug_key" ON "BracketResetBet"("userId", "eventSlug");

-- AddForeignKey
ALTER TABLE "MvcBet" ADD CONSTRAINT "MvcBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketResetBet" ADD CONSTRAINT "BracketResetBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


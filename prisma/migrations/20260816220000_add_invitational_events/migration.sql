-- CreateEnum
CREATE TYPE "InvitationalFormat" AS ENUM ('BRACKET_SINGLE', 'BRACKET_DOUBLE', 'ROUND_ROBIN', 'SWISS', 'POOLS', 'LIST');

-- CreateEnum
CREATE TYPE "InvitationalEventStatus" AS ENUM ('ACTIVE', 'PAST');

-- CreateEnum
CREATE TYPE "InvitationalMatchStatus" AS ENUM ('NOT_OPEN', 'OPEN', 'CLOSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitationalExBalance" INTEGER NOT NULL DEFAULT 10000;

-- CreateTable
CREATE TABLE "InvitationalEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "format" "InvitationalFormat" NOT NULL,
    "status" "InvitationalEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "twitchChannel" TEXT,
    "activeChatMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationalCompetitor" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "countryCode" TEXT,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationalCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationalMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "groupLabel" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "competitorAId" TEXT,
    "competitorBId" TEXT,
    "status" "InvitationalMatchStatus" NOT NULL DEFAULT 'NOT_OPEN',
    "winnerId" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "InvitationalMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationalBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "predictedCompetitorId" TEXT NOT NULL,
    "predictedCompetitorName" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "odds" DOUBLE PRECISION NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "InvitationalBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvitationalCompetitor_eventId_idx" ON "InvitationalCompetitor"("eventId");

-- CreateIndex
CREATE INDEX "InvitationalMatch_eventId_idx" ON "InvitationalMatch"("eventId");

-- CreateIndex
CREATE INDEX "InvitationalBet_matchId_idx" ON "InvitationalBet"("matchId");

-- CreateIndex
CREATE INDEX "InvitationalBet_eventId_idx" ON "InvitationalBet"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationalBet_userId_matchId_key" ON "InvitationalBet"("userId", "matchId");

-- AddForeignKey
ALTER TABLE "InvitationalCompetitor" ADD CONSTRAINT "InvitationalCompetitor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InvitationalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalMatch" ADD CONSTRAINT "InvitationalMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InvitationalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalMatch" ADD CONSTRAINT "InvitationalMatch_competitorAId_fkey" FOREIGN KEY ("competitorAId") REFERENCES "InvitationalCompetitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalMatch" ADD CONSTRAINT "InvitationalMatch_competitorBId_fkey" FOREIGN KEY ("competitorBId") REFERENCES "InvitationalCompetitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalMatch" ADD CONSTRAINT "InvitationalMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "InvitationalCompetitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalBet" ADD CONSTRAINT "InvitationalBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalBet" ADD CONSTRAINT "InvitationalBet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "InvitationalMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalBet" ADD CONSTRAINT "InvitationalBet_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InvitationalEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalBet" ADD CONSTRAINT "InvitationalBet_predictedCompetitorId_fkey" FOREIGN KEY ("predictedCompetitorId") REFERENCES "InvitationalCompetitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


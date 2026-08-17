-- CreateEnum
CREATE TYPE "InvitationalRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvitationalIdentMethod" AS ENUM ('TWITCH', 'MANUAL');

-- AlterTable
ALTER TABLE "InvitationalEvent" ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "partnerAccessToken" TEXT,
ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "InvitationalEventRequest" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "format" "InvitationalFormat" NOT NULL,
    "twitchChannel" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "identMethod" "InvitationalIdentMethod" NOT NULL,
    "clientName" TEXT,
    "email" TEXT,
    "requesterUserId" TEXT,
    "status" "InvitationalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationalEventRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvitationalEventRequest_status_idx" ON "InvitationalEventRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationalEvent_requestId_key" ON "InvitationalEvent"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationalEvent_partnerAccessToken_key" ON "InvitationalEvent"("partnerAccessToken");

-- AddForeignKey
ALTER TABLE "InvitationalEvent" ADD CONSTRAINT "InvitationalEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InvitationalEventRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalEvent" ADD CONSTRAINT "InvitationalEvent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalEventRequest" ADD CONSTRAINT "InvitationalEventRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationalEventRequest" ADD CONSTRAINT "InvitationalEventRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


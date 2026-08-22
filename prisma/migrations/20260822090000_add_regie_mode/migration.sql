-- AlterTable
ALTER TABLE "InvitationalEvent" ADD COLUMN     "linkedTournamentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InvitationalEvent_linkedTournamentId_key" ON "InvitationalEvent"("linkedTournamentId");

-- AddForeignKey
ALTER TABLE "InvitationalEvent" ADD CONSTRAINT "InvitationalEvent_linkedTournamentId_fkey" FOREIGN KEY ("linkedTournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;


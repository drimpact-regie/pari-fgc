-- AlterTable
ALTER TABLE "InvitationalEvent" ADD COLUMN     "activeOverlayMatchId" TEXT,
ADD COLUMN     "rundownMaxSecondsPerRound" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "rundownMinSecondsPerRound" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "rundownSetupSeconds" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "rundownStartAt" TIMESTAMP(3),
ADD COLUMN     "rundownVerifSeconds" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "InvitationalMatch" ADD COLUMN     "ftGames" INTEGER,
ADD COLUMN     "roundsPerGame" INTEGER,
ADD COLUMN     "verifManette" BOOLEAN;

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "opponentSeed" INTEGER,
ADD COLUMN     "predictedEntrantScore" INTEGER,
ADD COLUMN     "predictedEntrantSeed" INTEGER,
ADD COLUMN     "predictedOpponentScore" INTEGER,
ADD COLUMN     "totalGames" INTEGER;


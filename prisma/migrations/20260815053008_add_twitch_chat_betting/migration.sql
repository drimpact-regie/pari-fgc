-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "activeChatSetId" TEXT,
ADD COLUMN     "twitchSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twitchId" TEXT;

-- CreateTable
CREATE TABLE "TwitchBotToken" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "twitchUserId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchBotToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_twitchId_key" ON "User"("twitchId");


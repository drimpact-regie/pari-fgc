-- CreateTable
CREATE TABLE "ChatbotSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "helpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "classicBetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "invitationalBetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mvcBetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "resetBetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "top8BetEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoAnnounceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoResolveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leaderboardClimbEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so the webhook can always find it via a plain
-- findUnique, with every feature enabled by default.
INSERT INTO "ChatbotSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP);

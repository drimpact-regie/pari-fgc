-- CreateTable
CREATE TABLE "AuthorizedStreamer" (
    "id" TEXT NOT NULL,
    "twitchLogin" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorizedStreamer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizedStreamer_twitchLogin_key" ON "AuthorizedStreamer"("twitchLogin");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizedStreamer_twitchUserId_key" ON "AuthorizedStreamer"("twitchUserId");


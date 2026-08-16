-- CreateTable
CREATE TABLE "StreamerChannelAuthorization" (
    "id" TEXT NOT NULL,
    "twitchLogin" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "botLoginAtGrant" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamerChannelAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamerChannelAuthorization_twitchLogin_key" ON "StreamerChannelAuthorization"("twitchLogin");

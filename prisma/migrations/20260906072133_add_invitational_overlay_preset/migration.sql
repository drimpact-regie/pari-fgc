-- CreateTable
CREATE TABLE "InvitationalOverlayPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "overlayLayout" JSONB,
    "bracketOverlayLayout" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationalOverlayPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitationalOverlayPreset_name_key" ON "InvitationalOverlayPreset"("name");

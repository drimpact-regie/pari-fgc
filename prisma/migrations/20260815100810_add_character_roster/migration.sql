-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Character_game_name_key" ON "Character"("game", "name");

-- Seed du roster de lancement (20 personnages, 5 équipes) pour Marvel Tokon:
-- Fighting Souls, le jeu du tournoi fondateur de l'app. imageUrl laissé vide
-- (pas de source d'image fiable vérifiable depuis cet environnement) — à
-- compléter manuellement via l'admin si besoin.
INSERT INTO "Character" ("id", "game", "name") VALUES
    ('char_mtfs_storm', 'Marvel Tokon: Fighting Souls', 'Storm'),
    ('char_mtfs_wolverine', 'Marvel Tokon: Fighting Souls', 'Wolverine'),
    ('char_mtfs_magik', 'Marvel Tokon: Fighting Souls', 'Magik'),
    ('char_mtfs_danger', 'Marvel Tokon: Fighting Souls', 'Danger'),
    ('char_mtfs_ms_marvel', 'Marvel Tokon: Fighting Souls', 'Ms. Marvel'),
    ('char_mtfs_peni_parker', 'Marvel Tokon: Fighting Souls', 'Peni Parker'),
    ('char_mtfs_spider_man', 'Marvel Tokon: Fighting Souls', 'Spider-Man'),
    ('char_mtfs_star_lord', 'Marvel Tokon: Fighting Souls', 'Star-Lord'),
    ('char_mtfs_black_panther', 'Marvel Tokon: Fighting Souls', 'Black Panther'),
    ('char_mtfs_captain_america', 'Marvel Tokon: Fighting Souls', 'Captain America'),
    ('char_mtfs_hulk', 'Marvel Tokon: Fighting Souls', 'Hulk'),
    ('char_mtfs_iron_man', 'Marvel Tokon: Fighting Souls', 'Iron Man'),
    ('char_mtfs_doctor_doom', 'Marvel Tokon: Fighting Souls', 'Doctor Doom'),
    ('char_mtfs_magneto', 'Marvel Tokon: Fighting Souls', 'Magneto'),
    ('char_mtfs_green_goblin', 'Marvel Tokon: Fighting Souls', 'Green Goblin'),
    ('char_mtfs_carnage', 'Marvel Tokon: Fighting Souls', 'Carnage'),
    ('char_mtfs_ghost_rider', 'Marvel Tokon: Fighting Souls', 'Ghost Rider'),
    ('char_mtfs_blade', 'Marvel Tokon: Fighting Souls', 'Blade'),
    ('char_mtfs_deadpool', 'Marvel Tokon: Fighting Souls', 'Deadpool'),
    ('char_mtfs_loki', 'Marvel Tokon: Fighting Souls', 'Loki')
ON CONFLICT ("game", "name") DO NOTHING;

-- Les MvcBet existants (le cas échéant) référençaient un personnage en texte
-- libre, incompatible avec le nouveau schéma structuré ci-dessous : la
-- fonctionnalité vient d'être déployée, on repart d'une base vide plutôt que
-- de tenter une migration de données best-effort sur un texte non normalisé.
DELETE FROM "MvcBet";

-- DropIndex
DROP INDEX "MvcBet_eventSlug_characterKey_idx";

-- AlterTable
ALTER TABLE "MvcBet" DROP COLUMN "character",
DROP COLUMN "characterKey",
ADD COLUMN     "characterId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "MvcBet_eventSlug_characterId_idx" ON "MvcBet"("eventSlug", "characterId");

-- AddForeignKey
ALTER TABLE "MvcBet" ADD CONSTRAINT "MvcBet_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ajoute "Champion" au roster Marvel Tokon: Fighting Souls, absent du seed initial.
INSERT INTO "Character" ("id", "game", "name") VALUES
    ('char_mtfs_champion', 'Marvel Tokon: Fighting Souls', 'Champion')
ON CONFLICT ("game", "name") DO NOTHING;

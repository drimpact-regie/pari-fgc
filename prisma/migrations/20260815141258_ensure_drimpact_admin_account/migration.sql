-- La migration précédente supposait à tort que "DrImpact" existait déjà en
-- base (simple UPDATE, no-op silencieux si absent) — ce qui explique
-- l'échec de connexion. Celle-ci garantit le compte dans tous les cas :
-- le crée s'il n'existe pas, ou force son mot de passe + statut admin
-- s'il existe déjà.
INSERT INTO "User" (id, username, "passwordHash", "isAdmin", "createdAt")
VALUES (
    'usr_drimpact_recovery',
    'DrImpact',
    '$2b$12$I3FxcMaDKwGgZP25uOmi9Oq8ObWDygPSq5NwVQJHKJiHXz82iIvZC',
    true,
    now()
)
ON CONFLICT (username) DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash",
    "isAdmin" = true;

-- Promeut DrImpact administrateur (compte principal du propriétaire du site).
UPDATE "User" SET "isAdmin" = true WHERE username = 'DrImpact';

-- Supprime l'ancien compte "Impact" (créé automatiquement lors des tout
-- premiers tests de pari en chat), qui détient encore le twitchId du
-- propriétaire et bloque la liaison de ce compte Twitch à DrImpact. Les
-- paris/pronostics de ce compte (le cas échéant) sont supprimés en cascade
-- avec la ligne User (contraintes ON DELETE CASCADE déjà en place).
DELETE FROM "User" WHERE username = 'Impact';

-- Réinitialise le mot de passe de DrImpact après la suppression accidentelle
-- de son compte "Impact" (dont le mot de passe était irrécupérable, hashé).
-- Nouveau mot de passe communiqué hors-migration au propriétaire du site.
UPDATE "User" SET "passwordHash" = '$2b$12$cY8RFIOHcZFIBv1uFHqXHOQs21CKUGNZIRcxoAJB5w1jM51J5u.p.' WHERE username = 'DrImpact';

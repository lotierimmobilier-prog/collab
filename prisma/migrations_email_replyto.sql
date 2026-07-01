-- Reply-To des mails recus : permet de repondre a la bonne adresse quand elle
-- differe de l expediteur (ex. pointe envoyee depuis collab@ avec reponse vers
-- jerome.bouba@).
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS "replyTo" TEXT;

-- Boutique : photo uploadee stockee en base (base64) + type MIME.
-- La colonne image existante continue de servir de reference visuelle
-- (chemin vers cet endpoint, URL externe ou emoji de secours).
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "imageData" TEXT;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "imageMime" TEXT;

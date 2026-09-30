-- Structured producer type sits beside the legacy free-text ownership field.
-- Variety translations are cleared. Original Product and PurchaseRequest variety columns stay.

ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "producerType" TEXT;

UPDATE "Farm"
SET "producerType" = CASE
  WHEN lower(btrim("ownershipType")) = 'family' THEN 'family'
  WHEN lower(btrim("ownershipType")) = 'cooperative' THEN 'cooperative'
  WHEN lower(btrim("ownershipType")) IN ('private farm', 'частное хозяйство') THEN 'individual'
  ELSE "producerType"
END
WHERE "producerType" IS NULL
  AND "ownershipType" IS NOT NULL
  AND lower(btrim("ownershipType")) IN ('family', 'cooperative', 'private farm', 'частное хозяйство');

UPDATE "product_translations"
SET "variety" = NULL
WHERE "variety" IS NOT NULL;

UPDATE "purchase_request_translations"
SET "variety" = NULL
WHERE "variety" IS NOT NULL;

UPDATE "farm_translations"
SET "ownershipType" = NULL
WHERE "ownershipType" IS NOT NULL;

-- Public farm descriptions. Farm name and legal registry columns are not modified.

ALTER TABLE "Farm" ADD COLUMN "sourceLocale" "LocaleCode";

UPDATE "Farm" AS f
SET "sourceLocale" = CASE
  WHEN COALESCE(f.description, '') ~ '[ა-ჿ]'
    OR COALESCE(f.history, '') ~ '[ა-ჿ]'
    OR COALESCE(f."ownershipType", '') ~ '[ა-ჿ]'
    OR COALESCE(array_to_string(f."exportMarkets", ' '), '') ~ '[ა-ჿ]' THEN 'ka'::"LocaleCode"
  WHEN COALESCE(f.description, '') ~ '[А-Яа-яЁё]'
    OR COALESCE(f.history, '') ~ '[А-Яа-яЁё]'
    OR COALESCE(f."ownershipType", '') ~ '[А-Яа-яЁё]'
    OR COALESCE(array_to_string(f."exportMarkets", ' '), '') ~ '[А-Яа-яЁё]' THEN 'ru'::"LocaleCode"
  WHEN u.locale::text IN ('en', 'de', 'fr', 'it', 'es') THEN u.locale
  ELSE 'en'::"LocaleCode"
END
FROM "User" AS u
WHERE u.id = f."ownerId";

UPDATE "Farm" SET "sourceLocale" = 'en' WHERE "sourceLocale" IS NULL;

ALTER TABLE "Farm" ALTER COLUMN "sourceLocale" SET DEFAULT 'en';
ALTER TABLE "Farm" ALTER COLUMN "sourceLocale" SET NOT NULL;

CREATE INDEX "Farm_sourceLocale_idx" ON "Farm"("sourceLocale");

CREATE TABLE "farm_translations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "locale" "LocaleCode" NOT NULL,
    "description" TEXT,
    "history" TEXT,
    "ownershipType" TEXT,
    "exportMarkets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MessageTranslationStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT,
    "error" TEXT,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "farm_translations_farmId_locale_key" ON "farm_translations"("farmId", "locale");
CREATE INDEX "farm_translations_locale_status_idx" ON "farm_translations"("locale", "status");

ALTER TABLE "farm_translations" ADD CONSTRAINT "farm_translations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

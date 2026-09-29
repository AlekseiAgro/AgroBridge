-- Catalog translations. Original Product and purchase_requests text columns are not modified.

ALTER TABLE "Product" ADD COLUMN "sourceLocale" "LocaleCode";

UPDATE "Product" AS p
SET "sourceLocale" = CASE
  WHEN p.title ~ '[ა-ჿ]'
    OR COALESCE(p.description, '') ~ '[ა-ჿ]'
    OR COALESCE(p.variety, '') ~ '[ა-ჿ]'
    OR COALESCE(p."originPlace", '') ~ '[ა-ჿ]' THEN 'ka'::"LocaleCode"
  WHEN p.title ~ '[А-Яа-яЁё]'
    OR COALESCE(p.description, '') ~ '[А-Яа-яЁё]'
    OR COALESCE(p.variety, '') ~ '[А-Яа-яЁё]'
    OR COALESCE(p."originPlace", '') ~ '[А-Яа-яЁё]' THEN 'ru'::"LocaleCode"
  WHEN u.locale::text IN ('en', 'de', 'fr', 'it', 'es') THEN u.locale
  ELSE 'en'::"LocaleCode"
END
FROM "User" AS u
WHERE u.id = p."ownerUserId";

UPDATE "Product" SET "sourceLocale" = 'en' WHERE "sourceLocale" IS NULL;

ALTER TABLE "Product" ALTER COLUMN "sourceLocale" SET DEFAULT 'en';
ALTER TABLE "Product" ALTER COLUMN "sourceLocale" SET NOT NULL;

CREATE INDEX "Product_sourceLocale_idx" ON "Product"("sourceLocale");

CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locale" "LocaleCode" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "variety" TEXT,
    "originPlace" TEXT,
    "status" "MessageTranslationStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT,
    "error" TEXT,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_translations_productId_locale_key" ON "product_translations"("productId", "locale");
CREATE INDEX "product_translations_locale_status_idx" ON "product_translations"("locale", "status");

ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_requests" ADD COLUMN "sourceLocale" "LocaleCode";

UPDATE "purchase_requests" AS r
SET "sourceLocale" = CASE
  WHEN r.title ~ '[ა-ჿ]'
    OR COALESCE(r.variety, '') ~ '[ა-ჿ]'
    OR COALESCE(r.packaging, '') ~ '[ა-ჿ]'
    OR COALESCE(r."destinationCountry", '') ~ '[ა-ჿ]'
    OR COALESCE(r.message, '') ~ '[ა-ჿ]' THEN 'ka'::"LocaleCode"
  WHEN r.title ~ '[А-Яа-яЁё]'
    OR COALESCE(r.variety, '') ~ '[А-Яа-яЁё]'
    OR COALESCE(r.packaging, '') ~ '[А-Яа-яЁё]'
    OR COALESCE(r."destinationCountry", '') ~ '[А-Яа-яЁё]'
    OR COALESCE(r.message, '') ~ '[А-Яа-яЁё]' THEN 'ru'::"LocaleCode"
  WHEN u.locale::text IN ('en', 'de', 'fr', 'it', 'es') THEN u.locale
  ELSE 'en'::"LocaleCode"
END
FROM "User" AS u
WHERE u.id = r."buyerId";

UPDATE "purchase_requests" SET "sourceLocale" = 'en' WHERE "sourceLocale" IS NULL;

ALTER TABLE "purchase_requests" ALTER COLUMN "sourceLocale" SET DEFAULT 'en';
ALTER TABLE "purchase_requests" ALTER COLUMN "sourceLocale" SET NOT NULL;

CREATE INDEX "purchase_requests_sourceLocale_idx" ON "purchase_requests"("sourceLocale");

CREATE TABLE "purchase_request_translations" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "locale" "LocaleCode" NOT NULL,
    "title" TEXT,
    "variety" TEXT,
    "packaging" TEXT,
    "destinationCountry" TEXT,
    "message" TEXT,
    "status" "MessageTranslationStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT,
    "error" TEXT,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_request_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_request_translations_requestId_locale_key" ON "purchase_request_translations"("requestId", "locale");
CREATE INDEX "purchase_request_translations_locale_status_idx" ON "purchase_request_translations"("locale", "status");

ALTER TABLE "purchase_request_translations" ADD CONSTRAINT "purchase_request_translations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

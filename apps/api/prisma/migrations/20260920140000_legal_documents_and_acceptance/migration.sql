-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS', 'PRIVACY');

-- CreateEnum
CREATE TYPE "LegalDocumentStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "LegalDocumentLocale" AS ENUM ('ka', 'en');

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "locale" "LegalDocumentLocale" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LegalDocumentStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_locale_version_key" ON "legal_documents"("type", "locale", "version");

-- CreateIndex
CREATE INDEX "legal_documents_type_locale_status_idx" ON "legal_documents"("type", "locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "legal_acceptances_userId_documentId_key" ON "legal_acceptances"("userId", "documentId");

-- CreateIndex
CREATE INDEX "legal_acceptances_userId_acceptedAt_idx" ON "legal_acceptances"("userId", "acceptedAt");

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed identity rows for the first published versions. Bodies stay in the application.
-- Existing users are intentionally left without acceptance rows.
INSERT INTO "legal_documents" ("id", "type", "version", "locale", "title", "status", "publishedAt", "effectiveAt", "createdAt", "updatedAt")
VALUES
    ('legal_terms_1_0_ka', 'TERMS', '1.0', 'ka', 'გამოყენების პირობები', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('legal_terms_1_0_en', 'TERMS', '1.0', 'en', 'Terms of Use', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('legal_privacy_1_0_ka', 'PRIVACY', '1.0', 'ka', 'კონფიდენციალურობის პოლიტიკა', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('legal_privacy_1_0_en', 'PRIVACY', '1.0', 'en', 'Privacy Policy', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

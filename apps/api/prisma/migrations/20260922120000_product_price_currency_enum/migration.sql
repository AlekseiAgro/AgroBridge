-- Align Product.priceCurrency with the existing CurrencyCode enum.
-- Valid GEL / EUR / USD values are preserved as-is. priceFrom is not touched.
-- Unknown or empty text becomes NULL instead of being rewritten to another currency.

ALTER TABLE "Product"
  ALTER COLUMN "priceCurrency" TYPE "CurrencyCode"
  USING (
    CASE
      WHEN "priceCurrency" IN ('GEL', 'EUR', 'USD') THEN "priceCurrency"::"CurrencyCode"
      ELSE NULL
    END
  );

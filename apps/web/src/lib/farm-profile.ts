import { isPubliclyListedProduct, type FarmDetail, type ProductSummary } from '@agrobridge/shared';

/** Listings a visitor is allowed to see on a farm profile. */
export function isPublicFarmProduct(product: ProductSummary): boolean {
  return isPubliclyListedProduct(product);
}

/**
 * Strips owner-only fields so the profile view cannot render (or serialize) private
 * documents, registry internals, moderator notes, or unpublished listings.
 *
 * The public `GET /farms/:id` payload is already this shape; this helper is the
 * fallback when the owner dashboard has only `/farms/me`.
 */
export function toPublicFarmProfile(farm: FarmDetail): FarmDetail {
  const products = farm.products.filter(isPublicFarmProduct);
  return {
    id: farm.id,
    name: farm.name,
    region: farm.region,
    description: farm.description,
    verificationStatus: farm.verificationStatus,
    verified: farm.verified,
    foundedYear: farm.foundedYear,
    farmSizeHectares: farm.farmSizeHectares,
    ownershipType: farm.ownershipType,
    exportMarkets: farm.exportMarkets,
    history: farm.history,
    owner: farm.owner,
    productCount: products.length,
    photos: farm.photos,
    createdAt: farm.createdAt,
    verificationNote: null,
    verifiedAt: farm.verifiedAt,
    products,
  };
}

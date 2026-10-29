/** Approved English brand definition. */
export const BRAND_DEFINITION =
  'AgroBridge is a global B2B platform for agricultural trade, connecting Georgian producers with buyers in Georgia and international markets. Users can discover agricultural products, publish purchase requests, exchange offers and communicate directly.';

export const BRAND_ALTERNATE_NAME = 'AgroBridge Georgia';

/** Official social profiles. Canonical URLs only: no tracking parameters or share links. */
export const OFFICIAL_SOCIAL_PROFILES = [
  { name: 'Instagram', url: 'https://www.instagram.com/agrobridge.ge/' },
  { name: 'Facebook', url: 'https://www.facebook.com/people/AgroBridge-Georgia/61594968249897/' },
] as const;

export const OFFICIAL_SOCIAL_PROFILE_URLS: string[] = OFFICIAL_SOCIAL_PROFILES.map(
  (profile) => profile.url,
);

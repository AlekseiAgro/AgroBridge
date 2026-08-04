export const RATING_MIN_SCORE = 1;
export const RATING_MAX_SCORE = 5;

export type RatingSummary = {
  average: number | null;
  count: number;
};

export type RatingView = {
  id: string;
  rfqId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment: string | null;
  createdAt: string;
};

/** Public review left for a user after a completed deal. */
export type PublicRatingReview = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  fromUser: {
    id: string;
    displayName: string | null;
  };
};

export type PublicRatingReviews = {
  items: PublicRatingReview[];
};

export type CreateRatingInput = {
  rfqId: string;
  score: number;
  comment?: string;
};

export function isValidRatingScore(value: number): boolean {
  return Number.isInteger(value) && value >= RATING_MIN_SCORE && value <= RATING_MAX_SCORE;
}

export const MODERATION_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export function isModerationStatus(value: string): value is ModerationStatus {
  return (MODERATION_STATUSES as readonly string[]).includes(value);
}

export type ModeratedProduct = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  isPublished: boolean;
  moderationStatus: ModerationStatus;
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  farm: {
    id: string;
    name: string;
    region: string | null;
    owner: {
      id: string;
      displayName: string | null;
      email: string;
    };
  };
};

export type AdminStats = {
  productsPending: number;
  productsApproved: number;
  productsRejected: number;
  farmsTotal: number;
  usersTotal: number;
};

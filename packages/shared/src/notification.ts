export const USER_NOTIFICATION_TYPES = [
  'harvestAvailable',
  'harvestPreorderOpen',
] as const;

export type UserNotificationType = (typeof USER_NOTIFICATION_TYPES)[number];

export type UserNotificationItem = {
  id: string;
  type: UserNotificationType;
  productId: string | null;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

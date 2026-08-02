export const SUPPORT_EMAIL = 'support@agrobrid.ge';

export type SupportRequestPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type SupportRequestResponse = {
  ok: true;
};

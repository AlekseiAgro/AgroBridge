export const SUPPORT_EMAIL = 'support@agrobgid.ge';

export type SupportRequestPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type SupportRequestResponse = {
  ok: true;
};

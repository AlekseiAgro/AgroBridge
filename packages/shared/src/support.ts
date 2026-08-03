export const SUPPORT_EMAIL = 'gabo.m0619@gmail.com';

export type SupportRequestPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type SupportRequestResponse = {
  ok: true;
};

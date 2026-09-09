export class SmsDeliveryError extends Error {
  readonly kind: SmsDeliveryKind;
  readonly clientMessage: string;

  constructor(kind: SmsDeliveryKind, clientMessage: string) {
    super(clientMessage);
    this.name = 'SmsDeliveryError';
    this.kind = kind;
    this.clientMessage = clientMessage;
  }
}

export type SmsDeliveryKind =
  | 'unavailable'
  | 'timeout'
  | 'rejected'
  | 'invalid_destination'
  | 'config';

export const SMS_UNAVAILABLE_CLIENT_MESSAGE =
  'Could not send the SMS. Please try again later.';
export const SMS_INVALID_PHONE_CLIENT_MESSAGE =
  'Enter a valid phone number with a country code.';

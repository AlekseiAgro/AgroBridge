import { APP_LOCALES, type AppLocale } from '../i18n/locales';

/**
 * The account cabinet is read-only until the user opens an editor.
 * Name, password, and deletion stay off the main screen.
 */
export const accountInlineEditors = {
  name: false,
  password: false,
  deleteAccount: false,
} as const;

export type CabinetTradeRow = {
  id: 'myRequests' | 'myQuotes' | 'myRfqs' | 'rfqInbox';
  route: 'MyRequests' | 'MyQuotes' | 'MyRfqs' | 'RfqInbox';
  labelKey: 'requests.mine' | 'requests.myQuotes' | 'rfq.mineTitle' | 'rfq.inboxTitle';
  /** RFQ endpoints require a verified email. Purchase-request rows stay available before that. */
  verifiedOnly: boolean;
};

export const CABINET_TRADE_ROWS: readonly CabinetTradeRow[] = [
  { id: 'myRequests', route: 'MyRequests', labelKey: 'requests.mine', verifiedOnly: false },
  { id: 'myQuotes', route: 'MyQuotes', labelKey: 'requests.myQuotes', verifiedOnly: false },
  { id: 'myRfqs', route: 'MyRfqs', labelKey: 'rfq.mineTitle', verifiedOnly: true },
  { id: 'rfqInbox', route: 'RfqInbox', labelKey: 'rfq.inboxTitle', verifiedOnly: true },
];

export const CABINET_SELLING_ROWS = [
  { id: 'myProducts' as const, route: 'MyProducts' as const, labelKey: 'account.myProducts' as const },
  { id: 'farmProfile' as const, route: 'FarmProfile' as const, labelKey: 'account.farmProfile' as const },
];

export function visibleCabinetTradeRows(emailVerified: boolean): CabinetTradeRow[] {
  return CABINET_TRADE_ROWS.filter((row) => emailVerified || !row.verifiedOnly);
}

/**
 * Stack order for the RFQ cabinet and notification entries.
 * Each screen goes back to the previous entry with the native back action.
 */
export function rfqEntryStack(
  entry: 'myRfqs' | 'rfqInbox' | 'notificationDetail' | 'notificationInbox',
): readonly string[] {
  switch (entry) {
    case 'myRfqs':
      return ['Account', 'MyRfqs', 'RfqDetail'];
    case 'rfqInbox':
      return ['Account', 'RfqInbox', 'RfqDetail'];
    case 'notificationDetail':
      return ['Notifications', 'RfqDetail'];
    case 'notificationInbox':
      return ['Notifications', 'RfqInbox'];
  }
}

export function screenAfterBack(stack: readonly string[]): string {
  return stack.length > 1 ? stack[stack.length - 2] : stack[0] ?? '';
}

export function cabinetStackRoute(
  row:
    | 'myRequests'
    | 'myQuotes'
    | 'myRfqs'
    | 'rfqInbox'
    | 'myProducts'
    | 'farmProfile'
    | 'editName'
    | 'changePassword'
    | 'deleteAccount',
):
  | 'MyRequests'
  | 'MyQuotes'
  | 'MyRfqs'
  | 'RfqInbox'
  | 'MyProducts'
  | 'FarmProfile'
  | 'EditDisplayName'
  | 'ChangePassword'
  | 'DeleteAccount' {
  switch (row) {
    case 'myRequests':
      return 'MyRequests';
    case 'myQuotes':
      return 'MyQuotes';
    case 'myRfqs':
      return 'MyRfqs';
    case 'rfqInbox':
      return 'RfqInbox';
    case 'myProducts':
      return 'MyProducts';
    case 'farmProfile':
      return 'FarmProfile';
    case 'editName':
      return 'EditDisplayName';
    case 'changePassword':
      return 'ChangePassword';
    case 'deleteAccount':
      return 'DeleteAccount';
  }
}

export function languageSheetLocales(): readonly AppLocale[] {
  return APP_LOCALES;
}

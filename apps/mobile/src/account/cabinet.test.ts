import {
  CABINET_SELLING_ROWS,
  accountInlineEditors,
  cabinetStackRoute,
  languageSheetLocales,
  rfqEntryStack,
  screenAfterBack,
  visibleCabinetTradeRows,
} from './cabinet';

describe('account cabinet', () => {
  it('opens name, password, and deletion only from their own actions', () => {
    expect(accountInlineEditors).toEqual({
      name: false,
      password: false,
      deleteAccount: false,
    });
    expect(cabinetStackRoute('editName')).toBe('EditDisplayName');
    expect(cabinetStackRoute('changePassword')).toBe('ChangePassword');
    expect(cabinetStackRoute('deleteAccount')).toBe('DeleteAccount');
  });

  it('keeps purchases and selling as navigation', () => {
    expect(cabinetStackRoute('myRequests')).toBe('MyRequests');
    expect(cabinetStackRoute('myQuotes')).toBe('MyQuotes');
    expect(cabinetStackRoute('myProducts')).toBe('MyProducts');
    expect(cabinetStackRoute('farmProfile')).toBe('FarmProfile');
    expect(CABINET_SELLING_ROWS.map((row) => row.route)).toEqual(['MyProducts', 'FarmProfile']);
  });

  it('adds My RFQs and the existing RFQ inbox for a verified account', () => {
    expect(visibleCabinetTradeRows(false).map((row) => row.route)).toEqual(['MyRequests', 'MyQuotes']);
    const verified = visibleCabinetTradeRows(true);
    expect(verified.map((row) => row.labelKey)).toEqual([
      'requests.mine',
      'requests.myQuotes',
      'rfq.mineTitle',
      'rfq.inboxTitle',
    ]);
    expect(cabinetStackRoute('myRfqs')).toBe('MyRfqs');
    expect(cabinetStackRoute('rfqInbox')).toBe('RfqInbox');
    expect(verified.find((row) => row.id === 'rfqInbox')?.route).toBe('RfqInbox');
  });

  it('returns from an RFQ to the screen that opened it', () => {
    expect(screenAfterBack(rfqEntryStack('myRfqs'))).toBe('MyRfqs');
    expect(screenAfterBack(rfqEntryStack('rfqInbox'))).toBe('RfqInbox');
    expect(screenAfterBack(rfqEntryStack('notificationDetail'))).toBe('Notifications');
    expect(screenAfterBack(rfqEntryStack('notificationInbox'))).toBe('Notifications');
    expect(rfqEntryStack('myRfqs')).toEqual(['Account', 'MyRfqs', 'RfqDetail']);
    expect(rfqEntryStack('rfqInbox')).toEqual(['Account', 'RfqInbox', 'RfqDetail']);
  });

  it('offers every local language in the selector', () => {
    expect(languageSheetLocales()).toEqual(['ka', 'en', 'ru', 'de', 'fr', 'it', 'es']);
  });
});
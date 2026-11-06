import { requestsTabSections, showsCreateRequest } from './board';
import { cabinetStackRoute } from '../account/cabinet';

describe('requests board', () => {
  it('shows only open requests and the create action on the Requests tab', () => {
    expect(requestsTabSections()).toEqual(['open']);
    expect(showsCreateRequest('requestsTab')).toBe(true);
  });

  it('offers Create Request on My Requests and not on My Quotes', () => {
    expect(showsCreateRequest('myRequests')).toBe(true);
    expect(showsCreateRequest('myQuotes')).toBe(false);
  });

  it('opens personal requests and quotes from Account', () => {
    expect(cabinetStackRoute('myRequests')).toBe('MyRequests');
    expect(cabinetStackRoute('myQuotes')).toBe('MyQuotes');
  });
});

export type RequestSurface = 'requestsTab' | 'myRequests' | 'myQuotes';

/** The Requests tab is the public board of open purchase requests. */
export function requestsTabSections(): readonly ['open'] {
  return ['open'];
}

export function showsCreateRequest(surface: RequestSurface): boolean {
  return surface === 'requestsTab' || surface === 'myRequests';
}

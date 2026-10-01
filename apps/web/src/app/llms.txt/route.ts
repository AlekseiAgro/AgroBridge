import { buildLlmsTxt, LLMS_TXT_CONTENT_TYPE } from '../../lib/llms-txt';

/**
 * Public /llms.txt. The middleware matcher skips paths that contain a dot,
 * so this file is not redirected onto a locale prefix.
 */
export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    status: 200,
    headers: {
      'Content-Type': LLMS_TXT_CONTENT_TYPE,
    },
  });
}

/**
 * IndexNow key file. next.config rewrites `/{key}.txt` here after known
 * dotted routes such as /llms.txt and /robots.txt. Middleware skips paths
 * that contain a dot, so the public URL is not locale-prefixed and does not
 * require a session.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await context.params;
  const expected = process.env.INDEXNOW_KEY?.trim() ?? '';
  if (!expected || key !== expected) {
    return new Response(null, { status: 404 });
  }

  return new Response(expected, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

const LOCAL_WEB_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function mobileApiHeaders(request: Request): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");

  if (origin && LOCAL_WEB_ORIGIN.test(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Catalysts-Mutation-Id, X-Catalysts-Device-Token");
    headers.set("Access-Control-Max-Age", "600");
  }

  return headers;
}

export function mobileApiOptions(request: Request) {
  return new Response(null, { status: 204, headers: mobileApiHeaders(request) });
}

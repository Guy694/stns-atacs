type RouteContext = { params: Promise<{ id: string }> };

// Short URL printed in small QR stickers (fewer QR modules). Goes to the scan page, which requires login.
export async function GET(_request: Request, { params }: RouteContext) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 307, headers: { location: `/scan/assets/${id}`, "cache-control": "no-store" } });
}

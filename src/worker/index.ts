

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/') {
      return Response.json({ name: 'Cloudflare' })
    }
    return new Response('Not found', { status: 404 })
  },
}

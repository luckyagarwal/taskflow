// functions/api/auth.js
// Endpoint to force Cloudflare Access authentication and redirect back to the app.

export async function onRequestGet(context) {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

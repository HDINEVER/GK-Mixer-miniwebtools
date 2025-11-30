export async function onRequest(context) {
  return new Response(JSON.stringify({ status: 'ok', message: 'GK-Mixer API is running' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

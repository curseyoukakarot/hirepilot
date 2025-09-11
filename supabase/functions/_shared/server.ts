export type Handler = (req: Request) => Response | Promise<Response>;

export function server(handler: Handler) {
  Deno.serve(async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      console.error(err);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
}

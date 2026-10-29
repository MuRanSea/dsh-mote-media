import { ASSET_PATH } from '../media/artifacts.js';
import { ROUTE_PATH, createRouteHandler } from './api.js';
import { serveAsset } from './assets.js';

export function registerRoute(ctx, mote, diag, configStore, submissions) {
  let disposeRoute = null;
  let disposeAsset = null;

  const installAsset = (connection) => {
    if (disposeAsset !== null) return;
    try {
      disposeAsset = connection.fetch.register({
        path: ASSET_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: (request) => serveAsset(request, mote),
      });
    } catch (error) {
      diag.error = error instanceof Error ? error.message : String(error);
    }
  };

  const install = (scope) => {
    const connection = scope.get('connection');
    diag.connection = Boolean(connection);
    if (!connection || typeof connection.fetch?.register !== 'function') {
      diag.error = 'the connection service does not expose fetch.register()';
      return;
    }
    installAsset(connection);
    if (diag.registered) return;
    try {
      disposeRoute = connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: createRouteHandler(mote, ctx, diag, configStore, submissions),
      });
      diag.registered = true;
      diag.error = null;
    } catch (error) {
      diag.error = error instanceof Error ? error.message : String(error);
    }
  };

  install(ctx);
  try {
    ctx.inject(['connection'], (scope) => {
      install(scope);
    });
  } catch {
    /* an older Cordis without the inject helper keeps the direct attempt */
  }

  ctx.effect(
    () => () => {
      for (const dispose of [disposeRoute, disposeAsset]) {
        if (dispose === null) continue;
        try {
          dispose();
        } catch {
          /* already gone */
        }
      }
      disposeRoute = null;
      disposeAsset = null;
      diag.registered = false;
    },
    'mote-media: route cleanup',
  );

  // Loopback-only status probe: lets a person or a shell confirm that the panel
  // route is mounted, without a browser session. It carries no key material.
  const webServer = ctx.get('webServer');
  if (webServer && typeof webServer.register === 'function') {
    ctx.effect(
      () =>
        webServer.register({
          kind: 'exact',
          path: '/mote-media/status',
          handler: (request, response) => {
            const host = String(request.headers.host || '');
            const loopback = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
            if (!loopback) {
              response.writeHead(403);
              response.end('forbidden');
              return;
            }
            const body = {
              ok: true,
              route: ROUTE_PATH,
              assetRoute: ASSET_PATH,
              registered: diag.registered,
              connection: diag.connection,
              error: diag.error,
              configured: mote.status().configured,
              channels: mote.channels(),
              configEditor: Boolean(ctx.get('configEditor')),
            };
            response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            response.end(JSON.stringify(body));
          },
        }),
      'mote-media: status probe',
    );
  }
}

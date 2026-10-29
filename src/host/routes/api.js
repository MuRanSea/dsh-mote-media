import { trimTask } from '../media/task-view.js';

export const ROUTE_PATH = '/api/mote-media';
const ACTION_FAILURE = (error) => ({ ok: false, error: { message: error instanceof Error ? error.message : String(error), code: error.code } });

export function createRouteHandler(mote, ctx, diag, configStore, submissions) {
  return async function handle(request) {
    try {
      if (request.method === 'GET') return json({ ok: true, ...mote.status(), canEditConfig: Boolean(ctx.get('configEditor')) });
      const body = await request.json().catch(() => null);
      if (body === null || typeof body !== 'object') return json({ ok: false, error: { message: 'invalid JSON body' } }, 400);
      const action = typeof body.action === 'string' ? body.action : '';
      switch (action) {
        case 'state':
          return json({
            ok: true,
            ...mote.status(),
            canEditConfig: true,
            route: { path: ROUTE_PATH, registered: diag.registered, error: diag.error, connection: diag.connection },
          });
        case 'selftest':
          return json({
            ok: true,
            route: { path: ROUTE_PATH, registered: diag.registered, error: diag.error, connection: diag.connection },
            configEditor: Boolean(ctx.get('configEditor')),
            configured: mote.status().configured,
            overlayPath: configStore.overlayPath,
          });
        case 'models': {
          const models = await mote.listModels({
            category: body.category,
            refresh: body.refresh === true,
            channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
          });
          return json({ ok: true, models, channels: mote.channels() });
        }
        case 'prepare':
          return json({ ok: true, submission: submissions.prepare(body.submissionId, body.snapshot) });
        case 'generate': {
          try {
            const submission = await submissions.generate(body.submissionId);
            return json({ ok: true, submission, task: submission.task });
          } catch (error) {
            return json({ ...ACTION_FAILURE(error), error: { ...ACTION_FAILURE(error).error, submissionUnknown: true } });
          }
        }
        case 'submission':
          return json({ ok: true, submission: await submissions.get(body.submissionId, { includeSnapshot: body.includeSnapshot === true }) });
        case 'submissions': {
          const ids = [...new Set(Array.isArray(body.ids) ? body.ids : [])].slice(0, 50);
          const rows = await Promise.all(ids.map(async (id) => {
            try { return { id, submission: await submissions.get(id) }; }
            catch (error) { return { id, error: ACTION_FAILURE(error).error }; }
          }));
          return json({ ok: true, submissions: rows });
        }
        case 'chat_works':
          return json({ ok: true, submissions: submissions.listChat() });
        case 'tasks': {
          const rows = await mote.getTasks(Array.isArray(body.ids) ? body.ids : []);
          return json({
            ok: true,
            tasks: rows.map((row) => (row.task ? { id: row.id, task: trimTask(row.task) } : { id: row.id, error: row.error })),
          });
        }
        case 'task': {
          const task = await mote.getTask(body.id);
          return json({ ok: true, task: trimTask(task) });
        }
        case 'cancel': {
          const task = await mote.cancelTask(body.id);
          return json({ ok: true, task: trimTask(task) });
        }
        case 'download': {
          const task = body.submissionId ? submissions.task(body.submissionId) : await mote.getTask(body.id, body.channelId);
          const result = body.submissionId ? await submissions.save(body.submissionId, { artifactIndex: body.artifactIndex }) : await mote.saveArtifacts(task, { artifactIndex: body.artifactIndex });
          return json({ ok: true, dir: result.dir, saved: result.saved, task: trimTask(task) });
        }
        case 'probe': {
          const result = await mote.discoverModels({
            driver: typeof body.driver === 'string' ? body.driver : undefined,
            baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
            apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
            channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
          });
          return json({ ok: true, ...result });
        }
        case 'config': {
          const result = await configStore.saveConfig(ctx, mote, body.patch);
          return json(result.data, result.status);
        }
        default:
          return json({ ok: false, error: { message: `unknown action: ${action}` } }, 400);
      }
    } catch (error) {
      return json(ACTION_FAILURE(error));
    }
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

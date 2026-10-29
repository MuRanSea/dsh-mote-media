import { readMediaResult, individualMediaResults } from './media-call.js';

const EMPTY = [];
const EMPTY_SOURCE = { getSnapshot: () => EMPTY, subscribe: () => () => {} };
const OWN_TOOLS = new Set(['mote_image', 'mote_media_task']);

/** Resolve canonical results in this Turn, including calls inside a tool batch. */
function mediaBlocks(data) {
  const blocks = [];
  const visit = block => {
    if (!block) return;
    if (block.kind === 'tool-result' && OWN_TOOLS.has(block.name || block.call?.name)) blocks.push(block);
    for (const child of block.subCalls || []) visit(child);
  };
  for (const row of data) visit(row.root);
  const latest = new Map();
  for (const block of blocks.sort((left, right) => left.seq - right.seq)) {
    const result = readMediaResult(block);
    if (!result) continue;
    for (const row of individualMediaResults(result)) {
      const key = row.submissionId ? `submission:${row.submissionId}`
        : row.task?.id ? `task:${row.channelId || ''}:${row.task.id}` : `call:${block.callId}`;
      latest.set(key, result.results ? { ...block, content: [{ type: 'text', text: JSON.stringify(row) }] } : block);
    }
  }
  return [...latest].map(([key, block]) => ({ key, block }));
}

/** Keep image results in the completed reply, outside the foldable process group. */
export function createMediaTurnTail(React, MediaToolRow) {
  return function MediaTurnTail({ turn, useChat, openFile }) {
    const nodes = useChat?.(snapshot => snapshot.nodes);
    const source = React.useMemo(() => {
      const current = nodes?.turnDataSource?.(Number(turn.turn), 'tool-call');
      return current ? {
        getSnapshot: () => current.getSnapshot(),
        subscribe: listener => current.subscribe(listener),
      } : EMPTY_SOURCE;
    }, [nodes, turn.turn]);
    const data = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
    const entries = React.useMemo(() => mediaBlocks(data), [data]);
    if (!entries.length) return null;
    return React.createElement('div', { 'data-mote-image-results': true }, entries.map(({ key, block }) =>
      React.createElement(MediaToolRow, { key, block, phase: 'result', toolName: block.name || block.call?.name,
        callId: block.callId, openFile })));
  };
}

import { modelChoices, modelById, modelValue, defaultParams } from '../../domain/model-capabilities.js';
import { emptyDraft, referencePlacement } from '../../domain/drafts.js';

/** Session drafts stay separate from durable submission receipts and their IDs. */
export function createUseDrafts(React) {
  const { useState, useRef, useEffect } = React;
  return function useDrafts(models, config) {
    const [editor, setEditor] = useState(() => ({ type: 'image', drafts: { image: emptyDraft(), video: emptyDraft() } }));
    const current = useRef(editor);
    const version = useRef(0);
    const catalog = useRef(models);
    current.current = editor;
    catalog.current = models;
    const commit = (next) => { current.current = next; setEditor(next); };
    useEffect(() => {
      let next = current.current;
      for (const type of ['image', 'video']) {
        if (next.drafts[type].modelId !== null) continue;
        const choices = modelChoices(models, type);
        const preferred = config?.[type === 'video' ? 'videoModel' : 'imageModel'];
        const channel = config?.[type === 'video' ? 'videoChannelId' : 'imageChannelId'];
        const model = choices.find((entry) => entry.id === preferred && (!channel || entry.channelId === channel)) || choices[0];
        if (model) next = { ...next, drafts: { ...next.drafts, [type]: { ...next.drafts[type], modelId: modelValue(model), params: defaultParams(model) } } };
      }
      if (next !== current.current) commit(next);
    }, [models, config]);
    const update = (type, change) => {
      const previous = current.current;
      const draft = previous.drafts[type];
      const patch = typeof change === 'function' ? change(draft) : change;
      version.current += 1;
      commit({ ...previous, drafts: { ...previous.drafts, [type]: { ...draft, ...patch } } });
    };
    return {
      type: editor.type, draft: editor.drafts[editor.type], version,
      patch: (change) => update(editor.type, change),
      switchTo(type) {
        if (type === current.current.type || !['image', 'video'].includes(type)) return;
        version.current += 1; commit({ ...current.current, type });
      },
      restore({ type, draft }) {
        version.current += 1;
        commit({ type, drafts: { ...current.current.drafts, [type]: { ...draft, epoch: current.current.drafts[type].epoch + 1 } } });
      },
      addReference(reference, slot = 'auto') {
        const type = editor.type;
        const draft = current.current.drafts[type];
        if (draft.epoch !== editor.drafts[type].epoch) return 'uploadDraftChanged';
        const model = modelById(catalog.current, type, draft.modelId);
        const result = referencePlacement(draft, model, type, reference, slot);
        if (result.error) return result.error;
        update(type, result.draft);
        return '';
      },
    };
  };
}

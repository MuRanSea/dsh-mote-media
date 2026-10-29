import { createIcon } from '../../ui/Icon.js';
import { modelDisplayName } from '../../ui/presentation.js';
import { modelChoices, modelById, modelValue, SIZE_BY_RATIO, ratioToSize, sizeToRatio, referenceRoles } from '../../domain/model-capabilities.js';
import { createMenu } from '../../ui/Menu.js';

export function createComposer(React, t) {
  const h = React.createElement;
  const Icon = createIcon(React);
  const { useState, useRef } = React;
  const Menu = createMenu(React);
  const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;

    function readFileAsDataUrl(file, onLoad, onError) {
      if (file.size > MAX_REFERENCE_BYTES) {
        onError(t('uploading'));
        return;
      }
      if (!file.type?.startsWith('image/')) { onError(t('referenceImageOnly')); return; }
      const reader = new FileReader();
      reader.onload = () => onLoad(String(reader.result || ''));
      reader.onerror = () => onError('cannot read the file');
      reader.readAsDataURL(file);
    }

    function Composer(props) {
      const { type, models, modelId, params, imageCount = 1, prompt, refs, frames, busy, error, blocked, notice, draftIssue, unhandledReferences = [], onRemoveUnhandled, onType, onModel, onParams, onCount, onPrompt, onRefs, onFrames, onAddReference, onRun, textareaRef } = props;
      const model = modelById(models, type, modelId);
      const roles = referenceRoles(model);
      const fileInput = useRef(null);
      const slotRef = useRef('reference');
      const currentType = useRef(type);
      currentType.current = type;
      const [note, setNote] = useState('');

      const pick = (slot) => {
        if ((slot === 'reference' && !roles.reference) || (slot === 'first' && !roles.firstFrame) || (slot === 'last' && !roles.lastFrame)) { setNote(t('referenceUnsupported')); return; }
        slotRef.current = slot;
        if (fileInput.current) fileInput.current.click();
      };

      const slotKeyboard = (slot) => (event) => {
        if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); pick(slot); }
      };
      const onFile = (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        const slot = slotRef.current;
        const add = onAddReference;
        const showNote = (message) => { if (fileInput.current && currentType.current === type) setNote(message); };
        readFileAsDataUrl(
          file,
          (dataUrl) => {
            const issue = add({ type: 'image', url: dataUrl, name: file.name }, slot);
            showNote(issue ? t(issue) : '');
          },
          showNote,
        );
      };

      const ratioSpec = model && model.parameters ? model.parameters.aspect_ratio : null;
      const sizeSpec = model && model.parameters ? model.parameters.size : null;
      // A model either takes `aspect_ratio` (Seedream, Gemini) or a pixel `size`
      // (GPT Image). For the latter the ratio buttons are translated to `size`.
      const supportsRatio = Boolean(ratioSpec && Array.isArray(ratioSpec.enum));
      const supportsSize = Boolean(sizeSpec);
      const ratioValues = supportsRatio
        ? ratioSpec.enum
        : supportsSize
          ? Object.keys(SIZE_BY_RATIO)
          : [];
      const ratioItems = ratioValues.map((value) => ({ value, label: value }));
      const ratioCurrent = supportsRatio
        ? params.aspect_ratio || (ratioSpec && ratioSpec.default) || ratioItems[0].value
        : sizeToRatio(params.size) ||
          sizeToRatio(sizeSpec && sizeSpec.default) ||
          (ratioItems[0] && ratioItems[0].value) ||
          '';
      const pickRatio = (value) => {
        if (supportsRatio) onParams({ ...params, aspect_ratio: value });
        else onParams({ ...params, size: ratioToSize(value) || value });
      };

      const qualitySpec = model && model.parameters ? model.parameters.resolution : null;
      const qualityItems = qualitySpec && Array.isArray(qualitySpec.enum) ? qualitySpec.enum.map((value) => ({ value, label: value })) : [];
      const qualityCurrent = params.resolution || (qualitySpec && qualitySpec.default) || (qualityItems[0] && qualityItems[0].value);

      // This is the plugin's independent request count, not a provider parameter.
      const countLabel = value => `${value}${t('countSuffix')}`;
      const countItems = Array.from({ length: 15 }, (_, index) => ({ value: index + 1, label: countLabel(index + 1) }));

      const durationSpec = model && model.parameters ? model.parameters.duration : null;
      const durationItems = (() => {
        if (!durationSpec) return [];
        const min = Math.max(1, Number.isFinite(durationSpec.minimum) ? durationSpec.minimum : 3);
        const max = Number.isFinite(durationSpec.maximum) ? durationSpec.maximum : 10;
        const out = [];
        for (let value = min; value <= Math.min(max, 15); value += 1) out.push({ value, label: `${value}${t('secondsSuffix')}` });
        return out;
      })();
      const durationCurrent = params.duration ?? (durationSpec && durationSpec.default) ?? (durationItems[0] && durationItems[0].value);

      const catalog = modelChoices(models, type);
      const channelNames = [];
      for (const row of catalog) {
        const name = row.channelName || 'mote';
        if (!channelNames.includes(name)) channelNames.push(name);
      }
      const modelItems = [];
      if (channelNames.length > 1) {
        for (const name of channelNames) {
          modelItems.push({ header: true, value: `__head:${name}`, label: name });
          for (const row of catalog.filter((entry) => (entry.channelName || 'mote') === name)) {
            modelItems.push({ value: modelValue(row), label: modelDisplayName(row.id), description: modelDisplayName(row.id) === row.id ? '' : row.id });
          }
        }
      } else {
        for (const row of catalog) modelItems.push({ value: modelValue(row), label: modelDisplayName(row.id), description: modelDisplayName(row.id) === row.id ? '' : row.id });
      }
      const showFrames = type === 'video' && (roles.firstFrame || roles.lastFrame || frames.first || frames.last);
      const showRefs = refs.length > 0 || roles.reference && (type === 'image' || !roles.firstFrame);
      const audioOn =
        params.generate_audio === undefined
          ? Boolean(model && model.parameters && model.parameters.generate_audio && model.parameters.generate_audio.default === true)
          : params.generate_audio === true;

      return h(
        'section',
        { className: 'jz-composer' },
        notice ? h('div', { className: 'jz-composer-notice', role: 'status' }, t(notice)) : null,
        unhandledReferences.length ? h('div', { className: 'jz-unhandled-refs' },
          unhandledReferences.map((reference, index) => h('div', { key: index },
            h('span', null, `${reference.name || reference.role || t('references')} · ${reference.type || '—'}`),
            h('button', { type: 'button', className: 'jz-text-btn', onClick: () => onRemoveUnhandled(index) }, t('removeRef'))))) : null,
        h(
          'div',
          { className: 'jz-composer-main' },
          h(
            'div',
            { className: 'jz-slots' },
            showFrames
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'div',
                    { className: `jz-slot${frames.first ? ' filled' : ''}`, title: t('firstFrame'), role: 'button', tabIndex: 0, onKeyDown: slotKeyboard('first'), onClick: () => pick('first') },
                    frames.first ? h('img', { src: frames.first.url, alt: '' }) : h(Icon, { name: 'plus', size: 22 }),
                    h('span', { className: 'cap' }, t('firstFrame')),
                    frames.first
                      ? h('button', { type: 'button', 'aria-label': t('removeRef'),
                          className: 'del',
                          onClick: (event) => {
                            event.stopPropagation();
                            onFrames({ ...frames, first: null });
                          },
                        }, h(Icon, { name: 'close', size: 12 }))
                      : null,
                  ),
                  roles.lastFrame || frames.last
                    ? h(
                        'div',
                        { className: `jz-slot${frames.last ? ' filled' : ''}`, title: t('lastFrame'), role: 'button', tabIndex: 0, onKeyDown: slotKeyboard('last'), onClick: () => pick('last') },
                        frames.last ? h('img', { src: frames.last.url, alt: '' }) : h(Icon, { name: 'plus', size: 22 }),
                        h('span', { className: 'cap' }, t('lastFrame')),
                        frames.last
                          ? h('button', { type: 'button', 'aria-label': t('removeRef'),
                              className: 'del',
                              onClick: (event) => {
                                event.stopPropagation();
                                onFrames({ ...frames, last: null });
                              },
                            }, h(Icon, { name: 'close', size: 12 }))
                          : null,
                      )
                    : null,
                )
              : null,
            showRefs
              ? h(
                  React.Fragment,
                  null,
                  refs.map((ref, index) =>
                    h(
                      'div',
                      { key: `${index}-${ref.url.length}`, className: 'jz-slot filled', title: ref.name || t('references') },
                      h('img', { src: ref.url, alt: '' }),
                      h('button', { type: 'button', 'aria-label': t('removeRef'),
                        className: 'del',
                        onClick: () => onRefs(refs.filter((_, i) => i !== index)),
                      }, h(Icon, { name: 'close', size: 12 })),
                    ),
                  ),
                  roles.reference && refs.length < Math.max(1, roles.referenceLimit)
                    ? h(
                        'div',
                        { className: 'jz-slot', title: t('references'), role: 'button', tabIndex: 0, onKeyDown: slotKeyboard('reference'), onClick: () => pick('reference') },
                        h(Icon, { name: 'plus', size: 22 }),
                        h('span', { className: 'cap' }, t('references')),
                      )
                    : null,
                )
              : null,
          ),
          h('textarea', {
            ref: textareaRef,
            className: 'jz-prompt',
            value: prompt,
            placeholder: t('promptPlaceholder'),
            onChange: (event) => onPrompt(event.target.value),
            onKeyDown: (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                onRun();
              }
            },
          }),
          h('input', { ref: fileInput, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: onFile }),
        ),
        h(
          'div',
          { className: 'jz-bar' },
          h(Menu, {
            label: t('typeLabel'), hideLabel: true, icon: type === 'video' ? 'video' : 'image', variant: 'jz-chip-mode',
            value: type === 'image' ? t('modeImage') : t('modeVideo'),
            current: type,
            items: [
              { value: 'image', label: t('modeImage') },
              { value: 'video', label: t('modeVideo') },
            ],
            onPick: onType,
            width: 160,
          }),
          h(Menu, {
            label: t('modelLabel'), hideLabel: true,
            value: model ? `${channelNames.length > 1 ? `${model.channelName || model.channelId} · ` : ''}${modelDisplayName(model.id)}` : t('chooseModel'),
            current: model ? modelValue(model) : modelId,
            items: modelItems,
            onPick: onModel,
            width: 280,
            searchLabel: t('searchModels'), emptyLabel: t('noMatchingModels'),
          }),
          ratioItems.length > 1 && (type === 'image' || !roles.firstFrame)
            ? h(Menu, {
                label: t('ratioLabel'), hideLabel: true,
                value: ratioCurrent,
                current: ratioCurrent,
                items: ratioItems,
                onPick: pickRatio,
                width: 150,
              })
            : null,
          qualityItems.length > 1
            ? h(Menu, {
                label: t('qualityLabel'), hideLabel: true,
                value: qualityCurrent,
                current: qualityCurrent,
                items: qualityItems,
                onPick: (value) => onParams({ ...params, resolution: value }),
                width: 140,
              })
            : null,
          type === 'image' && model
            ? h(Menu, {
                label: t('countLabel'), hideLabel: true,
                value: countLabel(imageCount),
                current: imageCount,
                items: countItems,
                onPick: onCount,
                width: 120,
              })
            : null,
          type === 'video' && durationItems.length > 1
            ? h(Menu, {
                label: t('durationLabel'), hideLabel: true,
                value: `${durationCurrent}${t('secondsSuffix')}`,
                current: durationCurrent,
                items: durationItems,
                onPick: (value) => onParams({ ...params, duration: value }),
                width: 120,
              })
            : null,
          type === 'video' && model && model.parameters && model.parameters.generate_audio
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'jz-chip', 'aria-label': t('audioLabel'), 'aria-pressed': audioOn,
                  onClick: () => onParams({ ...params, generate_audio: !audioOn }),
                },
                h('span', { className: 'jz-chip-label' }, t('audioLabel')),
                h('span', { className: 'jz-chip-value' }, audioOn ? t('on') : t('off')),
              )
            : null,
          h('span', { className: 'jz-spacer' }),
          note ? h('span', { className: 'jz-note' }, note) : null,
          h(
            'button',
            {
              type: 'button',
              className: 'jz-send',
              disabled: busy || prompt.trim() === '' || !model || blocked || Boolean(draftIssue),
              title: blocked ? t('needKey') : t('send'), 'aria-label': t('send'),
              onClick: onRun,
            },
            busy ? h('span', { className: 'jz-send-spin' }) : h(Icon, { name: 'arrow', size: 21 }),
          ),
        ),
        error || draftIssue ? h('div', { className: 'jz-error', role: 'alert' }, h(Icon, { name: 'alert', size: 16 }), h('span', null, error || t(draftIssue))) : null,
        h('div', { className: 'jz-composer-help' }, h('span', null, t(type === 'image' && imageCount > 1 ? 'independentImagesHint' : 'composerHint')), h('span', { className: 'jz-key-hint' }, h('kbd', null, '⌘ / Ctrl'), ' + ', h('kbd', null, 'Enter'))),
      );
    }

  return Composer;
}

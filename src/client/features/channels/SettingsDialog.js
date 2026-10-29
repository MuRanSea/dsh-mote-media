import { createIcon } from '../../ui/Icon.js';
import { createUseDialog } from '../../ui/useDialog.js';
import { modelValue } from '../../domain/model-capabilities.js';

export function createSettingsDialog(React, { t, call }) {
  const h = React.createElement;
  const Icon = createIcon(React);
  const useDialog = createUseDialog(React);
  const { useState } = React;

    function SettingsDialog({ state, onClose, onSave, onTest, models }) {
      const dialog = useDialog(onClose);
      const selection = (kind) => {
        const id = state[kind + 'Model'] || '';
        if (!id) return '';
        const channelId = state[kind + 'ChannelId'] || '';
        const chosen = (models?.[kind] || []).find(row => row.id === id && (!channelId || row.channelId === channelId));
        return chosen ? modelValue(chosen) : JSON.stringify([channelId, id]);
      };
      const decoded = (value) => {
        if (!value) return ['', ''];
        try { const row = JSON.parse(value); if (Array.isArray(row) && row.length === 2) return row; } catch {}
        return ['', value];
      };
      const [channels, setChannels] = useState(() =>
        (Array.isArray(state.channels) ? state.channels : []).map((channel) => ({
          id: channel.id || '',
          name: channel.name || '',
          driver: channel.driver === 'openai-images' ? 'openai-images' : 'mote',
          baseUrl: channel.baseUrl || '',
          apiKey: '',
          models: Array.isArray(channel.models) ? channel.models.join(', ') : '',
          configured: channel.configured === true,
        })),
      );
      const [form, setForm] = useState({
        imageModel: selection('image'),
        videoModel: selection('video'),
        outputDir: state.outputDir || '',
      });
      const [busy, setBusy] = useState(false);
      const [message, setMessage] = useState('');
      const [error, setError] = useState('');
      const [probing, setProbing] = useState(-1);
      const [probeNote, setProbeNote] = useState({});

      const catalogOf = (kind) => (models && Array.isArray(models[kind]) ? models[kind] : []);
      const modelOptions = (kind, current) => {
        const rows = catalogOf(kind).map((row) => ({
          id: modelValue(row),
          label: row.channelName && row.channelName !== 'mote' ? `${row.channelName} · ${row.id}` : row.id,
        }));
        if (current && !rows.some((row) => row.id === current)) rows.unshift({ id: current, label: decoded(current).filter(Boolean).join(' · ') });
        return rows;
      };
      const probeChannel = async (index) => {
        const channel = channels[index];
        setProbing(index);
        setProbeNote((current) => ({ ...current, [index]: '' }));
        try {
          const result = await call('probe', {
            driver: channel.driver,
            baseUrl: channel.baseUrl,
            apiKey: channel.apiKey,
            channelId: channel.id || undefined,
          });
          const ids =
            channel.driver === 'mote'
              ? result.image.concat(result.video)
              : result.image.length > 0
                ? result.image
                : result.models.map((row) => row.id);
          update(index, { models: ids.join(', ') });
          setProbeNote((current) => ({ ...current, [index]: `${t('probeOk')} ${result.models.length} ${t('modelsCount')}` }));
        } catch (cause) {
          setProbeNote((current) => ({ ...current, [index]: cause instanceof Error ? cause.message : String(cause) }));
        } finally {
          setProbing(-1);
        }
      };

      const update = (index, patch) =>
        setChannels((current) => current.map((channel, i) => (i === index ? { ...channel, ...patch } : channel)));
      const addChannelRow = () =>
        setChannels((current) => [
          ...current,
          { id: '', name: '', driver: 'mote', baseUrl: 'https://platform.sgt.site', apiKey: '', models: '', configured: false },
        ]);

      const buildPatch = () => ({
        channels: channels.map((channel, index) => ({
          id: channel.id || `ch${index + 1}`,
          name: channel.name || `ch${index + 1}`,
          driver: channel.driver,
          baseUrl: channel.baseUrl.trim(),
          apiKey: channel.apiKey,
          models: String(channel.models || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          enabled: true,
        })),
        imageModel: decoded(form.imageModel)[1],
        videoModel: decoded(form.videoModel)[1],
        imageChannelId: decoded(form.imageModel)[0],
        videoChannelId: decoded(form.videoModel)[0],
        outputDir: form.outputDir.trim(),
      });

      return h(
        'div',
        {
          className: 'jz-overlay',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          { className: 'jz-modal', ref: dialog, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mote-channel-title', tabIndex: -1 },
          h(
            'header',
            { className: 'jz-modal-head' },
            h('span', { className: 'jz-modal-title', id: 'mote-channel-title' }, t('settingsTitle')),
            h('span', { className: 'jz-spacer' }),
            h('button', { type: 'button', className: 'jz-icon-btn', 'aria-label': t('close'), 'data-autofocus': true, onClick: onClose }, h(Icon, { name: 'close', size: 18 })),
          ),
          state.route && state.route.registered === false ? h('div', { className: 'jz-error' }, `${t('routeDown')} ${state.route.error || ''}`) : null,
          h(
            'div',
            { className: 'jz-field' },
            h(
              'div',
              { className: 'jz-field-head' },
              h('span', null, `${t('channels')} (${channels.length})`),
              h('span', { className: 'jz-spacer' }),
              h('button', { className: 'jz-btn small', onClick: addChannelRow }, t('addChannel')),
            ),
            channels.length === 0 ? h('div', { className: 'jz-dim' }, t('noChannel')) : null,
            channels.map((channel, index) =>
              h(
                'div',
                { key: `${channel.id || 'new'}-${index}`, className: 'jz-channel' },
                h(
                  'div',
                  { className: 'jz-grid2' },
                  h('input', {
                    className: 'jz-input',
                    value: channel.name,
                    placeholder: t('channelName'),
                    onChange: (event) => update(index, { name: event.target.value }),
                  }),
                  h(
                    'select',
                    { className: 'jz-input', value: channel.driver, onChange: (event) => update(index, { driver: event.target.value }) },
                    h('option', { value: 'mote' }, 'mote 统一渠道'),
                    h('option', { value: 'openai-images' }, 'OpenAI 兼容图片'),
                  ),
                ),
                h('input', {
                  className: 'jz-input',
                  value: channel.baseUrl,
                  placeholder: t('channelBase'),
                  onChange: (event) => update(index, { baseUrl: event.target.value }),
                }),
                h('input', {
                  className: 'jz-input',
                  type: 'password',
                  value: channel.apiKey,
                  placeholder: channel.configured ? '••••••••' : t('channelKey'),
                  autoComplete: 'off',
                  onChange: (event) => update(index, { apiKey: event.target.value }),
                }),
                channel.driver === 'openai-images' || channel.driver === 'mote'
                  ? h(
                      'div',
                      { className: 'jz-row' },
                      h('input', {
                        className: 'jz-input',
                        value: channel.models,
                        placeholder: channel.driver === 'mote' ? t('channelModelsMote') : t('channelModels'),
                        onChange: (event) => update(index, { models: event.target.value }),
                      }),
                      h(
                        'button',
                        { className: 'jz-btn small', disabled: probing === index, onClick: () => probeChannel(index) },
                        probing === index ? t('probing') : t('autoFetch'),
                      ),
                    )
                  : null,
                probeNote[index] ? h('div', { className: 'jz-dim' }, probeNote[index]) : null,
                h(
                  'div',
                  { className: 'jz-channel-foot' },
                  h('span', { className: 'jz-dim' }, channel.configured ? t('channelReady') : t('channelNoKey')),
                  h('span', { className: 'jz-spacer' }),
                  h('button', { className: 'jz-btn small ghost', onClick: () => setChannels((current) => current.filter((_, i) => i !== index)) }, t('deleteChannel')),
                ),
              ),
            ),
            h('div', { className: 'jz-dim' }, t('channelsHint')),
          ),
          h(
            'div',
            { className: 'jz-grid2' },
            h(
              'label',
              { className: 'jz-field' },
              h('span', { className: 'jz-dim' }, t('imageModel')),
              h(
                'select',
                {
                  className: 'jz-input',
                  value: form.imageModel,
                  onChange: (event) => setForm((current) => ({ ...current, imageModel: event.target.value })),
                },
                h('option', { value: '' }, t('modelAuto')),
                modelOptions('image', form.imageModel).map((row) => h('option', { key: row.id, value: row.id }, row.label)),
              ),
            ),
            h(
              'label',
              { className: 'jz-field' },
              h('span', { className: 'jz-dim' }, t('videoModel')),
              h(
                'select',
                {
                  className: 'jz-input',
                  value: form.videoModel,
                  onChange: (event) => setForm((current) => ({ ...current, videoModel: event.target.value })),
                },
                h('option', { value: '' }, t('modelAuto')),
                modelOptions('video', form.videoModel).map((row) => h('option', { key: row.id, value: row.id }, row.label)),
              ),
            ),
          ),
          h(
            'label',
            { className: 'jz-field' },
            h('span', { className: 'jz-dim' }, t('outputDir')),
            h('input', {
              className: 'jz-input',
              value: form.outputDir,
              onChange: (event) => setForm((current) => ({ ...current, outputDir: event.target.value })),
            }),
          ),
          error ? h('div', { className: 'jz-error' }, error) : null,
          message ? h('div', { className: 'jz-dim' }, message) : null,
          h(
            'footer',
            { className: 'jz-modal-foot' },
            h('span', { className: 'jz-spacer' }),
            h(
              'button',
              {
                className: 'jz-btn',
                disabled: busy,
                onClick: async () => {
                  setBusy(true);
                  setError('');
                  setMessage('');
                  try {
                    const count = await onTest(buildPatch());
                    setMessage(`${t('testOk')} · ${count} ${t('modelsCount')}`);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                  } finally {
                    setBusy(false);
                  }
                },
              },
              busy ? t('testing') : t('testSave'),
            ),
            h(
              'button',
              {
                className: 'jz-btn primary',
                disabled: busy,
                onClick: async () => {
                  setBusy(true);
                  setError('');
                  setMessage('');
                  try {
                    await onSave(buildPatch());
                    onClose();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                  } finally {
                    setBusy(false);
                  }
                },
              },
              busy ? t('saving') : t('save'),
            ),
            h('button', { className: 'jz-btn', onClick: onClose }, t('close')),
          ),
        ),
      );
    }

  return SettingsDialog;
}

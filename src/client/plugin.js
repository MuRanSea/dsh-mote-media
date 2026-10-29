import { createHostClient } from './api/host-client.js';
import { createWorksStorage } from './storage/works-storage.js';
import { createStudio } from './app/Studio.js';
import { createStudioLocale } from './i18n.js';
import { createPanelIcon } from './ui/PanelIcon.js';
import { createMediaToolRow } from './features/chat/MediaToolRow.js';
import { createMediaTurnTail } from './features/chat/MediaTurnTail.js';

export function createClientPlugin(React) {
  const locale = createStudioLocale();
  const { call } = createHostClient();
  const Studio = createStudio(React, {
    locale,
    call,
    storage: createWorksStorage(),
  });
  const PanelIcon = createPanelIcon(React);
  const MediaToolRow = createMediaToolRow(React, { t: locale.t, call });
  const MediaTurnTail = createMediaTurnTail(React, MediaToolRow);

  return {
    inject: ['slots', 'locale'],
    apply(ctx) {
      locale.register(ctx);
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'mote-media', order: 0 }, Studio));
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: 'mote-media', order: 30, label: () => locale.t('panelLabel') },
          PanelIcon,
        ),
      );
      for (const key of ['mote_image', 'mote_media_task']) {
        ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key }, MediaToolRow));
      }
      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
        { name: 'conversation.chat.turnTail', id: 'mote-media.images', order: 10 }, MediaTurnTail,
      ));
    },
  };
}

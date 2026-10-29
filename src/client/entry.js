import { createClientPlugin } from './plugin.js';

// DSH supplies React through this factory. Keep the loader protocol stable even
// as the implementation is split into source modules.
window.__ModuleLoader__.load({
  id: '@local/dsh-mote-media',
  factory(require) {
    return createClientPlugin(require('react'));
  },
});

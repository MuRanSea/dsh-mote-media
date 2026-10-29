const STORE_KEY = 'mote-media.studio.v1';
const MAX_STORED_ITEMS = 120;
const HIDDEN_CHAT_KEY = 'mote-media.chat-hidden.v1';

/** Keep browser access and storage failures behind the existing work format. */
export function createWorksStorage({ getStorage = () => window.localStorage } = {}) {
  function loadItems() {
    try {
      const raw = getStorage().getItem(STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => item && typeof item.id === 'string' && (item.type === 'image' || item.type === 'video'));
    } catch {
      return [];
    }
  }

  function saveItems(items) {
    try {
      getStorage().setItem(STORE_KEY, JSON.stringify(items.slice(0, MAX_STORED_ITEMS).map(({ snapshot, ...item }) => item)));
      return true;
    } catch {
      return false;
    }
  }

  function loadHiddenChat() {
    try {
      const parsed = JSON.parse(getStorage().getItem(HIDDEN_CHAT_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
    } catch { return []; }
  }
  function saveHiddenChat(ids) {
    try { getStorage().setItem(HIDDEN_CHAT_KEY, JSON.stringify([...new Set(ids)].slice(-1000))); return true; }
    catch { return false; }
  }
  return { loadItems, saveItems, loadHiddenChat, saveHiddenChat };
}

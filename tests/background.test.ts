import { formatBadgeText } from '../src/background/badge';
import { STORAGE_KEY } from '../src/shared/storage';

type StorageValue = Record<string, unknown>;

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('badge formatting', () => {
  it('formats badge text based on count', () => {
    expect(formatBadgeText(0)).toBe('');
    expect(formatBadgeText(1)).toBe('1');
    expect(formatBadgeText(99)).toBe('99');
    expect(formatBadgeText(100)).toBe('99+');
  });
});

describe('background badge worker', () => {
  let syncStore: StorageValue;
  let localStore: StorageValue;
  let onInstalled: (() => void) | null;
  let onStartup: (() => void) | null;
  let onStorageChanged:
    | ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void)
    | null;

  let setBadgeText: ReturnType<typeof vi.fn>;
  let setBadgeBackgroundColor: ReturnType<typeof vi.fn>;
  let setBadgeTextColor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();

    syncStore = {};
    localStore = {};
    onInstalled = null;
    onStartup = null;
    onStorageChanged = null;

    setBadgeText = vi.fn().mockResolvedValue(undefined);
    setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    setBadgeTextColor = vi.fn().mockResolvedValue(undefined);

    (globalThis as unknown as { chrome: chrome }).chrome = {
      action: {
        setBadgeText,
        setBadgeBackgroundColor,
        setBadgeTextColor
      } as unknown as typeof chrome.action,
      runtime: {
        lastError: null,
        onInstalled: {
          addListener: (cb: () => void) => {
            onInstalled = cb;
          }
        },
        onStartup: {
          addListener: (cb: () => void) => {
            onStartup = cb;
          }
        }
      } as unknown as typeof chrome.runtime,
      storage: {
        sync: {
          get: (_keys: string[], cb: (result: StorageValue) => void) => cb(syncStore)
        },
        local: {
          get: (_keys: string[], cb: (result: StorageValue) => void) => cb(localStore)
        },
        onChanged: {
          addListener: (
            cb: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
          ) => {
            onStorageChanged = cb;
          }
        }
      } as unknown as typeof chrome.storage
    } as unknown as chrome;
  });

  it('updates badge on initial load from sync storage', async () => {
    syncStore[STORAGE_KEY] = { repos: ['a/repo', 'b/repo'], updatedAt: Date.now() };

    await import('../src/background/index');
    await flush();

    expect(setBadgeText).toHaveBeenCalledWith({ text: '2' });
  });

  it('falls back to local storage when sync is empty', async () => {
    localStore[STORAGE_KEY] = { repos: ['c/repo'], updatedAt: Date.now() };

    await import('../src/background/index');
    await flush();

    expect(setBadgeText).toHaveBeenCalledWith({ text: '1' });
  });

  it('responds to install/startup and relevant storage changes only', async () => {
    syncStore[STORAGE_KEY] = { repos: [], updatedAt: Date.now() };

    await import('../src/background/index');
    await flush();

    const baselineCalls = setBadgeText.mock.calls.length;

    onStorageChanged?.({}, 'sync');
    await flush();
    expect(setBadgeText.mock.calls.length).toBe(baselineCalls);

    syncStore[STORAGE_KEY] = { repos: ['x/repo', 'y/repo', 'z/repo'], updatedAt: Date.now() };
    onStorageChanged?.(
      { [STORAGE_KEY]: { oldValue: undefined, newValue: syncStore[STORAGE_KEY] } },
      'sync'
    );
    await flush();
    expect(setBadgeText).toHaveBeenLastCalledWith({ text: '3' });

    onInstalled?.();
    await flush();
    expect(setBadgeText).toHaveBeenLastCalledWith({ text: '3' });

    onStartup?.();
    await flush();
    expect(setBadgeText).toHaveBeenLastCalledWith({ text: '3' });
  });
});

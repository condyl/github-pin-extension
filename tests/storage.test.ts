import {
  getPinnedRepos,
  normalizePinnedRepos,
  parsePinnedReposFromRecord,
  setPinnedRepos,
  STORAGE_KEY,
  togglePinnedRepo
} from '../src/shared/storage';

type StorageValue = Record<string, unknown>;

describe('storage helpers', () => {
  let store: StorageValue;
  let localStore: StorageValue;

  beforeEach(() => {
    store = {};
    localStore = {};

    const sync = {
      get: (_keys: string[], cb: (result: StorageValue) => void) => cb(store),
      set: (value: StorageValue, cb: () => void) => {
        store = { ...store, ...value };
        cb();
      }
    };
    const local = {
      get: (_keys: string[], cb: (result: StorageValue) => void) => cb(localStore),
      set: (value: StorageValue, cb: () => void) => {
        localStore = { ...localStore, ...value };
        cb();
      }
    };

    const runtime = { lastError: null as { message: string } | null };

    (globalThis as unknown as { chrome: chrome }).chrome = {
      storage: {
        sync,
        local,
        onChanged: {
          addListener: () => {
            return;
          }
        }
      },
      runtime
    } as unknown as chrome;
  });

  it('normalizes and sorts pinned repos', () => {
    expect(normalizePinnedRepos(['Foo/Bar', 'foo/bar', 'zed/app'])).toEqual([
      'Foo/Bar',
      'zed/app'
    ]);
  });

  it('parses pinned repos from raw storage shape', () => {
    expect(parsePinnedReposFromRecord({})).toEqual([]);
    expect(parsePinnedReposFromRecord({ [STORAGE_KEY]: { repos: ['Foo/Bar', 'foo/bar'] } })).toEqual([
      'Foo/Bar'
    ]);
    expect(parsePinnedReposFromRecord({ [STORAGE_KEY]: { repos: 'bad' } })).toEqual([]);
  });

  it('writes and reads pinned repos', async () => {
    await setPinnedRepos(['zed/app', 'foo/bar']);
    await expect(getPinnedRepos()).resolves.toEqual(['foo/bar', 'zed/app']);

    const state = store[STORAGE_KEY] as { repos: string[] };
    expect(state.repos).toEqual(['foo/bar', 'zed/app']);
  });

  it('toggles repos in storage', async () => {
    await setPinnedRepos(['foo/bar']);
    await togglePinnedRepo('ant/project');
    await expect(getPinnedRepos()).resolves.toEqual(['ant/project', 'foo/bar']);

    await togglePinnedRepo('foo/bar');
    await expect(getPinnedRepos()).resolves.toEqual(['ant/project']);
  });

  it('falls back to local storage when sync state is missing', async () => {
    localStore[STORAGE_KEY] = { repos: ['local/only', 'zed/app'], updatedAt: Date.now() };

    await expect(getPinnedRepos()).resolves.toEqual(['local/only', 'zed/app']);
  });
});

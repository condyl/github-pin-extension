import type { PinnedState, RepoSlug } from './types';

export const STORAGE_KEY = 'githubPinnedRepos:v1';
const FALLBACK_STORAGE_KEY = 'githubPinnedReposFallback:v1';

function getStorageSync(): chrome.storage.SyncStorageArea | null {
  if (!globalThis.chrome?.storage?.sync) {
    return null;
  }

  return globalThis.chrome.storage.sync;
}

export function normalizePinnedRepos(repos: RepoSlug[]): RepoSlug[] {
  const seen = new Map<string, RepoSlug>();

  for (const repo of repos) {
    const normalized = repo.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, normalized);
    }
  }

  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

export function parsePinnedReposFromRecord(result: Record<string, unknown>): RepoSlug[] {
  const value = result[STORAGE_KEY];

  if (!value || typeof value !== 'object') {
    return [];
  }

  const state = value as Partial<PinnedState>;
  if (!Array.isArray(state.repos)) {
    return [];
  }

  return normalizePinnedRepos(state.repos);
}

async function getPinnedReposFromLocalArea(): Promise<RepoSlug[]> {
  if (!globalThis.chrome?.storage?.local) {
    return [];
  }

  return new Promise((resolve) => {
    globalThis.chrome.storage.local.get([STORAGE_KEY], (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve([]);
        return;
      }

      resolve(parsePinnedReposFromRecord(result));
    });
  });
}

function readFallbackRepos(): RepoSlug[] {
  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<PinnedState>;
    if (!Array.isArray(parsed.repos)) {
      return [];
    }

    return normalizePinnedRepos(parsed.repos);
  } catch {
    return [];
  }
}

function writeFallbackRepos(repos: RepoSlug[]): void {
  const state: PinnedState = {
    repos: normalizePinnedRepos(repos),
    updatedAt: Date.now()
  };

  try {
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export async function getPinnedRepos(): Promise<RepoSlug[]> {
  const storage = getStorageSync();
  if (!storage) {
    const localRepos = await getPinnedReposFromLocalArea();
    if (localRepos.length > 0) {
      return localRepos;
    }

    return readFallbackRepos();
  }

  return new Promise((resolve) => {
    storage.get([STORAGE_KEY], (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        getPinnedReposFromLocalArea()
          .then((localRepos) => {
            if (localRepos.length > 0) {
              resolve(localRepos);
              return;
            }

            resolve(readFallbackRepos());
          })
          .catch(() => resolve(readFallbackRepos()));
        return;
      }

      resolve(parsePinnedReposFromRecord(result));
    });
  });
}

export async function setPinnedRepos(repos: RepoSlug[]): Promise<void> {
  const storage = getStorageSync();
  const normalized = normalizePinnedRepos(repos);
  const state: PinnedState = {
    repos: normalized,
    updatedAt: Date.now()
  };

  if (!storage) {
    if (globalThis.chrome?.storage?.local) {
      await new Promise<void>((resolve) => {
        globalThis.chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
      });
    }
    writeFallbackRepos(normalized);
    return;
  }

  return new Promise((resolve) => {
    storage.set({ [STORAGE_KEY]: state }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        if (globalThis.chrome?.storage?.local) {
          globalThis.chrome.storage.local.set({ [STORAGE_KEY]: state }, () => {
            writeFallbackRepos(normalized);
            resolve();
          });
          return;
        }

        writeFallbackRepos(normalized);
        resolve();
        return;
      }

      if (globalThis.chrome?.storage?.local) {
        globalThis.chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
        return;
      }

      resolve();
    });
  });
}

export async function togglePinnedRepo(slug: RepoSlug): Promise<void> {
  const current = await getPinnedRepos();
  const key = slug.toLowerCase();
  const exists = current.some((repo) => repo.toLowerCase() === key);

  if (exists) {
    await setPinnedRepos(current.filter((repo) => repo.toLowerCase() !== key));
    return;
  }

  await setPinnedRepos([...current, slug]);
}

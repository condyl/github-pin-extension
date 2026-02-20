import { applyBadgeCount } from './badge';
import { parsePinnedReposFromRecord, STORAGE_KEY } from '../shared/storage';

async function getReposFromArea(
  area: chrome.storage.StorageArea
): Promise<string[]> {
  return new Promise((resolve) => {
    area.get([STORAGE_KEY], (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve([]);
        return;
      }

      resolve(parsePinnedReposFromRecord(result));
    });
  });
}

async function readPinnedReposForBadge(): Promise<string[]> {
  const syncRepos = await getReposFromArea(chrome.storage.sync);
  if (syncRepos.length > 0) {
    return syncRepos;
  }

  return getReposFromArea(chrome.storage.local);
}

export async function updateBadgeFromStorage(): Promise<void> {
  try {
    const repos = await readPinnedReposForBadge();
    await applyBadgeCount(repos.length);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[github-pin] failed to update badge', error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void updateBadgeFromStorage();
});

chrome.runtime.onStartup.addListener(() => {
  void updateBadgeFromStorage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' && areaName !== 'local') {
    return;
  }

  if (!changes[STORAGE_KEY]) {
    return;
  }

  void updateBadgeFromStorage();
});

void updateBadgeFromStorage();

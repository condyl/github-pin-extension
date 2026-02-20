import '../styles/github-pin.css';
import { scanTopRepositoriesSection, renderPinControl } from './dom';
import { applyPinnedSections } from './reorder';
import { getPinnedRepos, STORAGE_KEY, togglePinnedRepo } from '../shared/storage';

const DEBUG = false;
const STORAGE_AREA = 'sync';

let renderQueued = false;
let recoveryTriggered = false;

function logDebug(...args: unknown[]): void {
  if (!DEBUG) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug('[github-pin]', ...args);
}

function queueRender(): void {
  if (renderQueued) {
    return;
  }

  renderQueued = true;
  window.setTimeout(async () => {
    renderQueued = false;
    await renderSidebar();
  }, 50);
}

function isContextInvalidatedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = (error as Error).message ?? '';
  return message.toLowerCase().includes('extension context invalidated');
}

function triggerRecoveryReload(): void {
  if (recoveryTriggered) {
    return;
  }

  recoveryTriggered = true;
  window.setTimeout(() => {
    window.location.reload();
  }, 80);
}

async function renderSidebar(): Promise<void> {
  const sections = scanTopRepositoriesSection(document);
  if (sections.length === 0) {
    return;
  }

  let pinnedRepos: string[] = [];
  try {
    pinnedRepos = await getPinnedRepos();
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      triggerRecoveryReload();
      return;
    }

    // eslint-disable-next-line no-console
    console.warn('[github-pin] storage read failed; continuing with empty pins', error);
  }

  const pinnedSet = new Set(pinnedRepos.map((repo) => repo.toLowerCase()));
  const pinnedDisplaySet = new Set(pinnedRepos);

  for (const section of sections) {
    applyPinnedSections(section, pinnedDisplaySet);

    for (const row of section.rows) {
      renderPinControl(
        row,
        pinnedSet.has(row.slug.toLowerCase()),
        async (slug) => {
          if (!slug) {
            return;
          }

          try {
            await togglePinnedRepo(slug);
            await renderSidebar();
          } catch (error) {
            if (isContextInvalidatedError(error)) {
              triggerRecoveryReload();
              return;
            }

            // eslint-disable-next-line no-console
            console.warn('[github-pin] failed to toggle pin', error);
          }
        },
        false
      );
    }
  }

  logDebug('rendered sections', sections.length);
}

function mountObservers(): void {
  const observer = new MutationObserver(() => {
    queueRender();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      queueRender();
    }
  });

  document.addEventListener('turbo:render', queueRender);
  window.addEventListener('popstate', queueRender);

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== STORAGE_AREA) {
        return;
      }

      if (!changes[STORAGE_KEY]) {
        return;
      }

      queueRender();
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      triggerRecoveryReload();
      return;
    }
  }
}

mountObservers();
queueRender();

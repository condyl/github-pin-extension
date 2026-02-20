import type { RepoRow, RepoSection, RepoSlug } from '../shared/types';

const TOP_REPO_HEADING = /^top repositories$/i;

const BLOCKED_ROOT_SEGMENTS = new Set([
  'about',
  'account',
  'apps',
  'blog',
  'collections',
  'codespaces',
  'contact',
  'customer-stories',
  'events',
  'explore',
  'features',
  'issues',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'search',
  'security',
  'settings',
  'signup',
  'site',
  'sponsors',
  'team',
  'teams',
  'topics',
  'trending',
  'users'
]);

function isHeadingMatch(el: Element): boolean {
  const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return TOP_REPO_HEADING.test(text) || text.toLowerCase().includes('top repositories');
}

export function normalizeRepoSlug(rawHref: string): RepoSlug | null {
  let url: URL;
  try {
    url = new URL(rawHref, 'https://github.com');
  } catch {
    return null;
  }

  if (url.hostname !== 'github.com') {
    return null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) {
    return null;
  }

  const [owner, name] = parts;
  if (!owner || !name) {
    return null;
  }

  if (BLOCKED_ROOT_SEGMENTS.has(owner.toLowerCase())) {
    return null;
  }

  return `${owner}/${name}`;
}

function gatherRepoAnchors(container: HTMLElement): Array<{ slug: RepoSlug; anchor: HTMLAnchorElement }> {
  const anchors = container.querySelectorAll<HTMLAnchorElement>('a[href]');
  const results: Array<{ slug: RepoSlug; anchor: HTMLAnchorElement }> = [];

  anchors.forEach((anchor) => {
    const slug = normalizeRepoSlug(anchor.getAttribute('href') ?? '');
    if (!slug) {
      return;
    }

    results.push({ slug, anchor });
  });

  return results;
}

function listCandidates(
  container: HTMLElement,
  repoAnchors: Array<{ slug: RepoSlug; anchor: HTMLAnchorElement }>
): HTMLElement[] {
  const counts = new Map<HTMLElement, number>();

  for (const { anchor } of repoAnchors) {
    let current = anchor.parentElement;
    const seenForAnchor = new Set<HTMLElement>();

    while (current && current !== container.parentElement) {
      if (!seenForAnchor.has(current)) {
        counts.set(current, (counts.get(current) ?? 0) + 1);
        seenForAnchor.add(current);
      }

      if (current === container) {
        break;
      }

      current = current.parentElement;
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([el]) => el);
}

function rowsFromList(
  listEl: HTMLElement
): Array<{ slug: RepoSlug; anchor: HTMLAnchorElement; row: HTMLElement }> {
  const rows: Array<{ slug: RepoSlug; anchor: HTMLAnchorElement; row: HTMLElement }> = [];

  const children = Array.from(listEl.children) as HTMLElement[];
  for (const child of children) {
    const anchor = child.matches('a[href]')
      ? (child as HTMLAnchorElement)
      : child.querySelector<HTMLAnchorElement>('a[href]');
    if (!anchor) {
      continue;
    }

    const slug = normalizeRepoSlug(anchor.getAttribute('href') ?? '');
    if (!slug) {
      continue;
    }

    rows.push({ slug, anchor, row: child });
  }

  return rows;
}

function depthFrom(container: HTMLElement, node: HTMLElement): number {
  let depth = 0;
  let current: HTMLElement | null = node;

  while (current && current !== container) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
}

function toSection(container: HTMLElement): RepoSection | null {
  const repoAnchors = gatherRepoAnchors(container);
  if (repoAnchors.length < 2) {
    return null;
  }

  const candidates = listCandidates(container, repoAnchors);
  let bestList: HTMLElement | null = null;
  let bestEntries: Array<{ slug: RepoSlug; anchor: HTMLAnchorElement; row: HTMLElement }> = [];
  let bestDepth = -1;

  for (const candidate of candidates) {
    const entries = rowsFromList(candidate);
    if (entries.length < 2) {
      continue;
    }

    const depth = depthFrom(container, candidate);
    const betterLength = entries.length > bestEntries.length;
    const sameLengthDeeper = entries.length === bestEntries.length && depth > bestDepth;

    if (betterLength || sameLengthDeeper) {
      bestList = candidate;
      bestEntries = entries;
      bestDepth = depth;
    }
  }

  if (!bestList || bestEntries.length < 2) {
    return null;
  }

  const seen = new Set<string>();
  const rows: RepoRow[] = [];

  for (const entry of bestEntries) {
    const key = entry.slug.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    rows.push({
      slug: entry.slug,
      rowEl: entry.row,
      linkEl: entry.anchor
    });
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    sectionEl: container,
    listEl: bestList,
    rows
  };
}

export function scanTopRepositoriesSection(root: Document | HTMLElement): RepoSection[] {
  const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, span, strong');
  const sections: RepoSection[] = [];
  const seen = new Set<HTMLElement>();

  for (const heading of headings) {
    if (!isHeadingMatch(heading)) {
      continue;
    }

    let ancestor: HTMLElement | null = heading;
    while (ancestor && ancestor !== document.body) {
      ancestor = ancestor.parentElement;
      if (!ancestor || seen.has(ancestor)) {
        continue;
      }

      const section = toSection(ancestor);
      if (section) {
        seen.add(ancestor);
        sections.push(section);
        break;
      }
    }
  }

  return sections;
}

function pinIconPath(pinned: boolean): string {
  if (pinned) {
    return 'M12 17v5 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z';
  }

  return 'M12 17v5 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z';
}

export function renderPinControl(
  row: RepoRow,
  pinned: boolean,
  onToggle: (slug: RepoSlug) => void,
  disabled = false
): void {
  const titleLink =
    row.rowEl.querySelector<HTMLAnchorElement>('.wb-break-word a[href]') ?? row.linkEl;
  row.rowEl.classList.add('github-pin-enabled-row');

  let button = row.rowEl.querySelector<HTMLButtonElement>('button[data-github-pin-control="true"]');

  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'github-pin-btn';
    button.dataset.githubPinControl = 'true';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.classList.add('github-pin-btn__icon');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('github-pin-btn__path');
    icon.appendChild(path);

    button.appendChild(icon);

    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button?.disabled) {
        return;
      }

      onToggle(button?.dataset.repoSlug ?? '');
    });

    titleLink.insertAdjacentElement('afterend', button);
  }

  if (button.previousElementSibling !== titleLink) {
    titleLink.insertAdjacentElement('afterend', button);
  }

  button.dataset.repoSlug = row.slug;
  button.disabled = disabled;
  button.setAttribute('aria-pressed', String(pinned));
  button.setAttribute('aria-label', pinned ? 'Unpin repo' : 'Pin repo');
  button.title = pinned ? 'Unpin repo' : 'Pin repo';
  button.classList.toggle('is-pinned', pinned);

  const path = button.querySelector<SVGPathElement>('path.github-pin-btn__path');
  path?.setAttribute('d', pinIconPath(pinned));
}

function createPinSvg(size: string): SVGSVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('width', size);
  icon.setAttribute('height', size);
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.classList.add('github-pin-btn__icon');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('github-pin-btn__path');
  path.setAttribute('d', pinIconPath(false));
  icon.appendChild(path);

  return icon;
}

export function getCurrentRepoSlug(pathname = window.location.pathname): RepoSlug | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return normalizeRepoSlug(`/${parts[0]}/${parts[1]}`);
}

function findRepoHeaderActionsList(): HTMLUListElement | null {
  return document.querySelector<HTMLUListElement>(
    '#repository-details-container ul.pagehead-actions'
  );
}

function findWatchListItem(listEl: HTMLUListElement): HTMLLIElement | null {
  const byTestId = listEl
    .querySelector<HTMLElement>('[data-testid="notifications-subscriptions-menu-button"]')
    ?.closest<HTMLLIElement>('li');
  if (byTestId) {
    return byTestId;
  }

  const bySubscription = listEl
    .querySelector<HTMLElement>('form[action*="/subscription"]')
    ?.closest<HTMLLIElement>('li');
  if (bySubscription) {
    return bySubscription;
  }

  const candidates = Array.from(listEl.querySelectorAll<HTMLLIElement>('li'));
  for (const candidate of candidates) {
    const text = candidate.textContent?.toLowerCase() ?? '';
    if (text.includes('watch') || text.includes('unwatch')) {
      return candidate;
    }
  }

  return null;
}

function cleanCloneIds(root: Element): void {
  root.removeAttribute('id');
  root.removeAttribute('aria-labelledby');
  root.removeAttribute('aria-controls');
  root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
}

function buildRepoHeaderButtonFromTemplate(template: HTMLButtonElement): HTMLButtonElement {
  const button = template.cloneNode(true) as HTMLButtonElement;
  button.type = 'button';
  button.dataset.githubPinRepoHeader = 'true';
  button.classList.add('github-pin-repo-btn');
  button.removeAttribute('data-testid');
  button.setAttribute('data-loading', 'false');
  cleanCloneIds(button);

  const content = button.querySelector<HTMLElement>('[data-component="buttonContent"]');
  const label = button.querySelector<HTMLElement>('[data-component="text"]');
  const leadingVisual = button.querySelector<HTMLElement>('[data-component="leadingVisual"]');
  const trailingAction = button.querySelector<HTMLElement>('[data-component="trailingAction"]');

  trailingAction?.remove();
  button.querySelectorAll('.Counter').forEach((el) => el.remove());

  if (leadingVisual) {
    leadingVisual.textContent = '';
    leadingVisual.appendChild(createPinSvg('16'));
  } else if (content) {
    content.prepend(createPinSvg('16'));
  }

  if (!label) {
    const fallbackLabel = document.createElement('span');
    fallbackLabel.dataset.component = 'text';
    fallbackLabel.className = 'github-pin-repo-btn__label';
    fallbackLabel.textContent = 'Pin';
    if (content) {
      content.appendChild(fallbackLabel);
    } else {
      button.appendChild(fallbackLabel);
    }
  }

  return button;
}

export function renderRepoHeaderPinButton(
  slug: RepoSlug,
  pinned: boolean,
  onToggle: (slug: RepoSlug) => void,
  disabled = false
): void {
  const listEl = findRepoHeaderActionsList();
  const watchLi = listEl ? findWatchListItem(listEl) : null;
  if (!listEl || !watchLi) {
    document
      .querySelectorAll<HTMLElement>('button[data-github-pin-repo-header="true"]')
      .forEach((el) => el.remove());
    document
      .querySelectorAll<HTMLElement>('li[data-github-pin-repo-header-item="true"]')
      .forEach((el) => el.remove());
    return;
  }

  let button = document.querySelector<HTMLButtonElement>('button[data-github-pin-repo-header="true"]');
  let wrapper = document.querySelector<HTMLLIElement>('li[data-github-pin-repo-header-item="true"]');
  if (!button) {
    const templateButton =
      watchLi.querySelector<HTMLButtonElement>('button') ??
      watchLi.querySelector<HTMLAnchorElement>('a')?.querySelector<HTMLButtonElement>('button') ??
      null;

    if (!templateButton) {
      return;
    }

    button = buildRepoHeaderButtonFromTemplate(templateButton);
    wrapper = document.createElement('li');
    wrapper.dataset.githubPinRepoHeaderItem = 'true';
    wrapper.className = watchLi.className;
    wrapper.appendChild(button);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button?.disabled) {
        return;
      }
      onToggle(button?.dataset.repoSlug ?? '');
    });
  }

  if (!wrapper) {
    wrapper = button.closest<HTMLLIElement>('li');
  }

  if (!wrapper) {
    return;
  }

  if (wrapper.parentElement !== listEl || wrapper.nextElementSibling !== watchLi) {
    listEl.insertBefore(wrapper, watchLi);
  }

  const label = button.querySelector<HTMLElement>('[data-component="text"], .github-pin-repo-btn__label');
  if (label) {
    label.textContent = pinned ? 'Pinned' : 'Pin';
  }

  button.disabled = disabled;
  button.dataset.repoSlug = slug;
  button.setAttribute('aria-pressed', String(pinned));
  button.setAttribute('aria-label', pinned ? 'Unpin repository' : 'Pin repository');
  button.title = pinned ? 'Unpin repository' : 'Pin repository';
  button.classList.toggle('is-pinned', pinned);
}

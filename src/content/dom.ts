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

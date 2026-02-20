import { normalizeRepoSlug } from './dom';
import type { RepoRow, RepoSection, RepoSlug } from '../shared/types';

const PINNED_SECTION_ATTR = 'data-github-pin-section';
const PINNED_LIST_ATTR = 'data-github-pin-list';
const PINNED_ROW_ATTR = 'data-github-pin-row';
const ROW_SLUG_ATTR = 'data-github-pin-slug';

function sortedPinnedSlugs(pinnedRepos: Set<RepoSlug>): RepoSlug[] {
  return [...pinnedRepos].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function findHeadingTemplate(section: RepoSection): HTMLElement | null {
  const candidates = section.sectionEl.querySelectorAll<HTMLElement>('h1, h2, h3, h4, span, strong');

  for (const el of candidates) {
    const text = el.textContent?.trim().toLowerCase() ?? '';
    if (text.includes('top repositories')) {
      return el;
    }
  }

  return section.sectionEl.querySelector<HTMLElement>('h1, h2, h3, h4, span, strong');
}

function buildPinnedHeading(section: RepoSection): HTMLElement {
  const template = findHeadingTemplate(section);

  if (!template) {
    const fallback = document.createElement('h2');
    fallback.textContent = 'Pinned repositories';
    fallback.className = 'github-pin-section__title';
    return fallback;
  }

  const heading = document.createElement(template.tagName.toLowerCase());
  heading.className = template.className;
  heading.textContent = 'Pinned repositories';
  heading.setAttribute('data-github-pin-title', 'true');
  return heading;
}

function ensurePinnedSection(section: RepoSection): { container: HTMLElement; listEl: HTMLElement } {
  let container = section.sectionEl.parentElement?.querySelector<HTMLElement>(`[${PINNED_SECTION_ATTR}="true"]`);
  let listEl = container?.querySelector<HTMLElement>(`[${PINNED_LIST_ATTR}="true"]`) ?? null;

  if (container && listEl) {
    return { container, listEl };
  }

  container = document.createElement('section');
  container.setAttribute(PINNED_SECTION_ATTR, 'true');
  container.className = 'github-pin-section';

  const heading = buildPinnedHeading(section);

  listEl = document.createElement(section.listEl.tagName.toLowerCase());
  listEl.setAttribute(PINNED_LIST_ATTR, 'true');
  listEl.className = section.listEl.className;

  container.appendChild(heading);
  container.appendChild(listEl);
  section.sectionEl.parentElement?.insertBefore(container, section.sectionEl);

  return { container, listEl };
}

function removePinnedSection(section: RepoSection): void {
  const existing = section.sectionEl.parentElement?.querySelector<HTMLElement>(`[${PINNED_SECTION_ATTR}="true"]`);
  existing?.remove();
}

function findRepoLink(rowEl: HTMLElement): HTMLAnchorElement | null {
  const links = rowEl.querySelectorAll<HTMLAnchorElement>('a[href]');

  for (const link of links) {
    const slug = normalizeRepoSlug(link.getAttribute('href') ?? '');
    if (slug) {
      return link;
    }
  }

  return null;
}

function findSampleAvatar(section: RepoSection): HTMLImageElement | null {
  for (const row of section.rows) {
    const avatar = row.rowEl.querySelector<HTMLImageElement>('img');
    if (avatar) {
      return avatar;
    }
  }

  return null;
}

function ownerFromSlug(slug: RepoSlug): string {
  const [owner] = slug.split('/');
  return owner || 'github';
}

function partsFromSlug(slug: RepoSlug): { owner: string; repo: string } {
  const [owner = 'github', repo = slug] = slug.split('/');
  return { owner, repo };
}

function findAvatarLink(rowEl: HTMLElement): HTMLAnchorElement | null {
  const links = rowEl.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const link of links) {
    if (link.querySelector('img')) {
      return link;
    }
  }

  return null;
}

function findTitleLink(rowEl: HTMLElement): HTMLAnchorElement | null {
  const inBreakWord = rowEl.querySelector<HTMLAnchorElement>('.wb-break-word a[href]');
  if (inBreakWord) {
    return inBreakWord;
  }

  const links = rowEl.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const link of links) {
    if (link.querySelector('img')) {
      continue;
    }

    if (normalizeRepoSlug(link.getAttribute('href') ?? '')) {
      return link;
    }
  }

  return null;
}

function ensureAvatar(rowEl: HTMLElement, section: RepoSection): HTMLImageElement {
  const existing = rowEl.querySelector<HTMLImageElement>('img');
  if (existing) {
    return existing;
  }

  const sampleAvatar = findSampleAvatar(section);
  const avatar = sampleAvatar
    ? (sampleAvatar.cloneNode(true) as HTMLImageElement)
    : document.createElement('img');

  if (!sampleAvatar) {
    avatar.width = 20;
    avatar.height = 20;
    avatar.style.borderRadius = '50%';
    avatar.style.marginRight = '8px';
  }

  avatar.removeAttribute('srcset');
  const avatarLink = findAvatarLink(rowEl);
  if (avatarLink) {
    avatarLink.textContent = '';
    avatarLink.appendChild(avatar);
  } else if (rowEl.firstChild) {
    rowEl.insertBefore(avatar, rowEl.firstChild);
  } else {
    rowEl.appendChild(avatar);
  }

  return avatar;
}

function applyAvatar(rowEl: HTMLElement, section: RepoSection, slug: RepoSlug): void {
  const avatar = ensureAvatar(rowEl, section);

  const owner = ownerFromSlug(slug);
  avatar.src = `https://github.com/${owner}.png?size=40`;
  avatar.alt = `@${owner}`;
}

function ensureBreakWordContainer(rowEl: HTMLElement): HTMLElement {
  const existing = rowEl.querySelector<HTMLElement>('.wb-break-word');
  if (existing) {
    return existing;
  }

  const fallback = document.createElement('div');
  fallback.className = 'wb-break-word';
  rowEl.appendChild(fallback);
  return fallback;
}

function findActionListLink(rowEl: HTMLElement): HTMLAnchorElement | null {
  return rowEl.querySelector<HTMLAnchorElement>('a.prc-ActionList-ActionListContent-KBb8-');
}

function normalizeActionListRow(rowEl: HTMLElement, slug: RepoSlug): HTMLAnchorElement {
  const actionLink = findActionListLink(rowEl);
  if (!actionLink) {
    throw new Error('ActionList row is missing its main link');
  }

  actionLink.href = `/${slug}`;
  const labelEl = actionLink.querySelector<HTMLElement>('.prc-ActionList-ItemLabel-81ohH');
  if (labelEl) {
    labelEl.textContent = slug;
  }

  rowEl.querySelectorAll('.wb-break-word').forEach((el) => el.remove());
  rowEl.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    if (link !== actionLink && normalizeRepoSlug(link.getAttribute('href') ?? '')) {
      link.remove();
    }
  });

  return actionLink;
}

function normalizeRowLinks(rowEl: HTMLElement, slug: RepoSlug): HTMLAnchorElement {
  const actionListLink = findActionListLink(rowEl);
  if (actionListLink) {
    return normalizeActionListRow(rowEl, slug);
  }

  const avatarLink = findAvatarLink(rowEl);
  if (avatarLink) {
    avatarLink.href = `/${slug}`;
  }

  const container = ensureBreakWordContainer(rowEl);
  let titleLink = findTitleLink(rowEl);
  if (!titleLink) {
    titleLink = document.createElement('a');
    titleLink.className = 'color-fg-default lh-0 mb-2 markdown-title';
    container.appendChild(titleLink);
  }

  const { owner, repo } = partsFromSlug(slug);
  titleLink.href = `/${slug}`;
  titleLink.innerHTML = `${owner}<span class=\"color-fg-muted\">/</span>${repo}`;

  const links = rowEl.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const link of links) {
    if (link === avatarLink || link === titleLink) {
      continue;
    }

    if (normalizeRepoSlug(link.getAttribute('href') ?? '')) {
      link.remove();
    }
  }

  return titleLink;
}

function cloneRowTemplate(section: RepoSection, slug: RepoSlug): RepoRow {
  const loaded = section.rows.find((row) => row.slug.toLowerCase() === slug.toLowerCase());
  const templateRow = loaded?.rowEl ?? section.rows[0]?.rowEl;

  const rowEl = templateRow
    ? (templateRow.cloneNode(true) as HTMLElement)
    : document.createElement(section.listEl.tagName.toLowerCase() === 'ul' ? 'li' : 'div');

  rowEl.setAttribute(PINNED_ROW_ATTR, 'true');
  rowEl.setAttribute(ROW_SLUG_ATTR, slug);

  rowEl.querySelectorAll('[data-github-pin-control="true"]').forEach((el) => el.remove());

  const linkEl = normalizeRowLinks(rowEl, slug);
  applyAvatar(rowEl, section, slug);

  return {
    slug,
    rowEl,
    linkEl
  };
}

function syncPinnedRows(listEl: HTMLElement, rows: RepoRow[]): void {
  listEl.querySelectorAll(`[${PINNED_ROW_ATTR}="true"]`).forEach((row) => row.remove());
  for (const row of rows) {
    listEl.appendChild(row.rowEl);
  }
}

export function applyPinnedSections(section: RepoSection, pinnedRepos: Set<RepoSlug>): RepoRow[] {
  const slugs = sortedPinnedSlugs(pinnedRepos);

  if (slugs.length === 0) {
    removePinnedSection(section);
    return [];
  }

  const { listEl } = ensurePinnedSection(section);
  const pinnedRows = slugs.map((slug) => cloneRowTemplate(section, slug));

  syncPinnedRows(listEl, pinnedRows);
  return pinnedRows;
}

import { applyPinnedSections } from '../src/content/reorder';
import type { RepoSection } from '../src/shared/types';

function makeSection(slugs: string[]): RepoSection {
  const host = document.createElement('div');
  const sectionEl = document.createElement('aside');
  const listEl = document.createElement('ul');
  host.appendChild(sectionEl);
  sectionEl.appendChild(listEl);
  document.body.appendChild(host);

  const rows = slugs.map((slug) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `/${slug}`;
    a.textContent = slug;
    li.appendChild(a);
    listEl.appendChild(li);

    return {
      slug,
      rowEl: li,
      linkEl: a
    };
  });

  return { sectionEl, listEl, rows };
}

describe('applyPinnedSections', () => {
  it('creates pinned section above top repositories without mutating top list', () => {
    const section = makeSection(['zed/app', 'foo/bar', 'cat/repo', 'ant/project']);

    applyPinnedSections(section, new Set(['cat/repo', 'ant/project']));

    const pinnedSection = section.sectionEl.parentElement?.querySelector<HTMLElement>(
      '[data-github-pin-section="true"]'
    );
    expect(pinnedSection).not.toBeNull();
    expect(pinnedSection?.nextElementSibling).toBe(section.sectionEl);

    const pinnedOrder = Array.from(
      pinnedSection?.querySelectorAll('[data-github-pin-list="true"] a') ?? []
    ).map((a) => a.textContent);
    expect(pinnedOrder).toEqual(['ant/project', 'cat/repo']);

    const topOrder = Array.from(section.listEl.querySelectorAll('a')).map((a) => a.textContent);
    expect(topOrder).toEqual(['zed/app', 'foo/bar', 'cat/repo', 'ant/project']);
  });

  it('removes pinned section when there are no pinned repos', () => {
    const section = makeSection(['foo/bar', 'cat/repo']);

    applyPinnedSections(section, new Set(['cat/repo']));
    applyPinnedSections(section, new Set());

    const pinnedSection = section.sectionEl.parentElement?.querySelector<HTMLElement>(
      '[data-github-pin-section="true"]'
    );
    expect(pinnedSection).toBeNull();
    expect(Array.from(section.listEl.querySelectorAll('a')).map((a) => a.textContent)).toEqual([
      'foo/bar',
      'cat/repo'
    ]);
  });

  it('keeps pinned section on subsequent renders when scanner only returns top list rows', () => {
    const section = makeSection(['foo/bar', 'cat/repo', 'zed/app']);

    applyPinnedSections(section, new Set(['cat/repo']));

    const rescannedRows = Array.from(section.listEl.children).map((rowEl) => {
      const row = rowEl as HTMLElement;
      const linkEl = row.querySelector('a') as HTMLAnchorElement;
      return {
        slug: linkEl.getAttribute('href')!.slice(1),
        rowEl: row,
        linkEl
      };
    });

    const rescannedSection: RepoSection = {
      sectionEl: section.sectionEl,
      listEl: section.listEl,
      rows: rescannedRows
    };

    applyPinnedSections(rescannedSection, new Set(['cat/repo']));

    const pinnedSection = section.sectionEl.parentElement?.querySelector<HTMLElement>(
      '[data-github-pin-section="true"]'
    );
    const pinnedOrder = Array.from(
      pinnedSection?.querySelectorAll('[data-github-pin-list="true"] a') ?? []
    ).map((a) => a.textContent);
    expect(pinnedOrder).toEqual(['cat/repo']);
  });

  it('shows pinned repos immediately even when they are not loaded in top list yet', () => {
    const section = makeSection(['foo/bar', 'cat/repo']);

    applyPinnedSections(section, new Set(['missing/repo']));

    const pinnedSection = section.sectionEl.parentElement?.querySelector<HTMLElement>(
      '[data-github-pin-section="true"]'
    );
    const pinnedOrder = Array.from(
      pinnedSection?.querySelectorAll('[data-github-pin-list="true"] a') ?? []
    ).map((a) => a.textContent);
    expect(pinnedOrder).toEqual(['missing/repo']);

    const topOrder = Array.from(section.listEl.querySelectorAll('a')).map((a) => a.textContent);
    expect(topOrder).toEqual(['foo/bar', 'cat/repo']);
  });
});

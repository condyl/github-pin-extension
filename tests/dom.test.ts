import { normalizeRepoSlug, renderPinControl, scanTopRepositoriesSection } from '../src/content/dom';

describe('normalizeRepoSlug', () => {
  it('parses relative repo links', () => {
    expect(normalizeRepoSlug('/octocat/hello-world')).toBe('octocat/hello-world');
  });

  it('parses absolute repo links', () => {
    expect(normalizeRepoSlug('https://github.com/octocat/hello-world')).toBe(
      'octocat/hello-world'
    );
  });

  it('rejects non-repo GitHub paths', () => {
    expect(normalizeRepoSlug('/orgs/github')).toBeNull();
    expect(normalizeRepoSlug('/octocat/hello-world/issues')).toBeNull();
  });

  it('rejects non-github hosts', () => {
    expect(normalizeRepoSlug('https://example.com/octocat/hello-world')).toBeNull();
  });
});

describe('scanTopRepositoriesSection', () => {
  it('finds top repositories rows and keeps first duplicate only', () => {
    document.body.innerHTML = `
      <aside>
        <h2>Top repositories</h2>
        <ul>
          <li><a href="/foo/one">foo/one</a></li>
          <li><a href="/bar/two">bar/two</a></li>
          <li><a href="/foo/one">foo/one duplicate</a></li>
        </ul>
      </aside>
    `;

    const sections = scanTopRepositoriesSection(document);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.rows.map((row) => row.slug)).toEqual(['foo/one', 'bar/two']);
  });

  it('finds rows when heading is inside a nested header wrapper', () => {
    document.body.innerHTML = `
      <aside>
        <div class="header-row">
          <h2>Top repositories</h2>
          <button type="button">Search</button>
        </div>
        <div class="repo-list-wrap">
          <ul>
            <li><a href="/alpha/one">alpha/one</a></li>
            <li><a href="/beta/two">beta/two</a></li>
          </ul>
        </div>
      </aside>
    `;

    const sections = scanTopRepositoriesSection(document);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.rows.map((row) => row.slug)).toEqual(['alpha/one', 'beta/two']);
  });

  it('finds rows in div-based list containers', () => {
    document.body.innerHTML = `
      <aside>
        <div><span>Top repositories</span></div>
        <div class="repos">
          <div class="repo-row"><a href="/octo/one">octo/one</a></div>
          <div class="repo-row"><a href="/octo/two">octo/two</a></div>
          <div class="repo-row"><a href="/marketplace">marketplace</a></div>
        </div>
      </aside>
    `;

    const sections = scanTopRepositoriesSection(document);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.rows.map((row) => row.slug)).toEqual(['octo/one', 'octo/two']);
  });
});

describe('renderPinControl', () => {
  it('updates the icon path when pin state changes', () => {
    document.body.innerHTML = `
      <li>
        <div class="wb-break-word">
          <a href="/octocat/hello-world">octocat/hello-world</a>
        </div>
      </li>
    `;

    const rowEl = document.querySelector('li') as HTMLElement;
    const linkEl = rowEl.querySelector('a') as HTMLAnchorElement;
    const onToggle = () => {
      return;
    };

    renderPinControl({ slug: 'octocat/hello-world', rowEl, linkEl }, false, onToggle);
    const unpinnedPath = rowEl.querySelector('path.github-pin-btn__path')?.getAttribute('d');

    renderPinControl({ slug: 'octocat/hello-world', rowEl, linkEl }, true, onToggle);
    const pinnedPath = rowEl.querySelector('path.github-pin-btn__path')?.getAttribute('d');

    expect(unpinnedPath).toBeTruthy();
    expect(pinnedPath).toBeTruthy();
    expect(unpinnedPath).not.toEqual(pinnedPath);
  });
});

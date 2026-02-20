export type RepoSlug = string;

export interface PinnedState {
  repos: RepoSlug[];
  updatedAt: number;
}

export interface RepoRow {
  slug: RepoSlug;
  rowEl: HTMLElement;
  linkEl: HTMLAnchorElement;
}

export interface RepoSection {
  sectionEl: HTMLElement;
  listEl: HTMLElement;
  rows: RepoRow[];
}

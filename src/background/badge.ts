export const BADGE_BACKGROUND_COLOR = '#24292f';
export const BADGE_TEXT_COLOR = '#ffffff';

export function formatBadgeText(count: number): string {
  if (count <= 0) {
    return '';
  }

  if (count >= 100) {
    return '99+';
  }

  return String(count);
}

export async function applyBadgeCount(count: number): Promise<void> {
  const text = formatBadgeText(count);

  await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
  await chrome.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR });
  await chrome.action.setBadgeText({ text });
}

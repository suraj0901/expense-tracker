/**
 * SMS detector — platform detection and notification hooks for SMS transactions.
 *
 * Since no standard browser SMS API exists, the primary flow is Web Share Target
 * (already implemented in share-target.ts + drafts). This module handles:
 * - Android platform detection for feature gating
 * - Push notification when a new SMS draft is received while app is in background
 * - Registration as a share target (handled via manifest.json, not code)
 */

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Check if the platform supports background SMS share */
export function supportsSmsShare(): boolean {
  return isAndroid();
}

/** Send a notification when a new SMS draft is received in the background */
export async function notifySmsDraftReceived(
  amount: number | null,
  merchant: string | null
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const body = amount
    ? `Detected ₹${amount}${merchant ? ` at ${merchant}` : ''}. Open to log it.`
    : 'New transaction detected. Open to review.';

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Expense Tracker', {
      body,
      icon: '/favicon.svg',
      tag: 'sms-draft',
    } as NotificationOptions);
  } catch {
    // Silently fail — notification is optional
  }
}

import { EmployeeReview, ReviewKraSnapshot, ReviewReturnRequest, ReturnTarget } from '../../../types';

/** The open KRA-level return on a review, optionally limited to one recipient. */
export function getOpenReturn(review: EmployeeReview | null | undefined, target?: ReturnTarget): ReviewReturnRequest | undefined {
  if (!review) return undefined;
  return [...(review.returnRequests || [])]
    .reverse()
    .find((r) => r.status === 'OPEN' && (!target || r.target === target));
}

/**
 * How many times this review has been sent back (includes returns made before KRA-level returns).
 * A "return to both" creates two linked requests but counts once.
 */
export function getReturnCount(review: EmployeeReview): number {
  const fromActions = (review.actionHistory || []).filter(
    (a) => a.action === 'RETURNED' || a.action === 'HOD_RETURNED'
  ).length;
  const groups = new Set((review.returnRequests || []).map((r) => r.groupId || r.id));
  return Math.max(fromActions, groups.size);
}

/** The HOD leg of a "return to both" that is waiting for the Manager to finish first. */
export function getQueuedHodLeg(review: EmployeeReview, open: ReviewReturnRequest | undefined): ReviewReturnRequest | undefined {
  if (!open?.groupId) return undefined;
  return (review.returnRequests || []).find((r) => r.groupId === open.groupId && r.status === 'QUEUED' && r.target === 'HOD');
}

export function getReturnDueInfo(request: ReviewReturnRequest): { label: string; overdue: boolean; soon: boolean } {
  const diffMs = new Date(request.dueAt).getTime() - Date.now();
  const days = Math.ceil(Math.abs(diffMs) / (24 * 60 * 60 * 1000));
  if (diffMs < 0) return { label: `Overdue by ${days} day${days === 1 ? '' : 's'}`, overdue: true, soon: false };
  if (days <= 1) return { label: 'Due within a day', overdue: false, soon: true };
  return { label: `Due in ${days} days`, overdue: false, soon: false };
}

/**
 * Whether the recipient has dealt with a returned KRA: rating, justification or achievement
 * changed since the return, or the rating is explicitly kept with a reason (min 10 chars).
 * Mirrors the server-side check so the progress counter matches what submit will accept.
 */
export function isReturnedKraAddressed(k: ReviewKraSnapshot, target: ReturnTarget): boolean {
  const flag = k.returnFlag;
  if (!flag) return true;
  const rating = target === 'MANAGER' ? k.rating : k.hodRating;
  const justification = (target === 'MANAGER' ? k.ratingJustification : k.hodJustification) || '';
  const achievement = (target === 'MANAGER' ? k.achievement : k.hodAchievement) || '';
  const changed =
    (Number(rating) || 0) !== (Number(flag.previousRating) || 0) ||
    justification.trim() !== (flag.previousJustification || '').trim() ||
    achievement.trim() !== (flag.previousAchievement || '').trim();
  if (changed) return true;
  return Boolean(flag.keepRating) && (flag.keepReason || '').trim().length >= 10;
}

/** Per-KRA responses (reply / keep rating) to send with a save or resubmission. */
export function buildReturnResponses(snapshots: ReviewKraSnapshot[]) {
  const out: Record<string, { reply?: string; keepRating?: boolean; keepReason?: string }> = {};
  snapshots.forEach((k) => {
    if (!k.returnFlag) return;
    out[k.id] = {
      reply: k.returnFlag.reply || '',
      keepRating: Boolean(k.returnFlag.keepRating),
      keepReason: k.returnFlag.keepReason || '',
    };
  });
  return out;
}

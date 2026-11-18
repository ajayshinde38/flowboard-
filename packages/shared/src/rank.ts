export const POSITION_STEP = 65536;
export const MIN_POSITION_GAP = 0.001;

/**
 * Computes a stable floating-point position between `before` and `after` task positions.
 * Never relies on array indices for database persistence.
 */
export function computeNewPosition(
  before: number | null | undefined,
  after: number | null | undefined
): { position: number; needsRebalance: boolean } {
  const hasBefore = typeof before === 'number' && Number.isFinite(before);
  const hasAfter = typeof after === 'number' && Number.isFinite(after);

  if (!hasBefore && !hasAfter) {
    return { position: POSITION_STEP, needsRebalance: false };
  }
  if (!hasBefore && hasAfter) {
    const pos = (after as number) / 2;
    return {
      position: pos,
      needsRebalance: pos < MIN_POSITION_GAP || (after as number) - pos < MIN_POSITION_GAP,
    };
  }
  if (hasBefore && !hasAfter) {
    return { position: (before as number) + POSITION_STEP, needsRebalance: false };
  }

  const b = before as number;
  const a = after as number;
  const gap = a - b;
  const pos = b + gap / 2;
  return {
    position: pos,
    needsRebalance: gap <= MIN_POSITION_GAP * 2 || pos === b || pos === a,
  };
}

/**
 * Generates evenly spaced positions for column rebalancing inside a DB transaction.
 */
export function generateRebalancedPositions(count: number): number[] {
  return Array.from({ length: count }, (_, idx) => (idx + 1) * POSITION_STEP);
}

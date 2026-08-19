/**
 * Convert recipe weights into a small integer drop ratio (3:1:1).
 * Prefers drip-friendly totals over exact millilitre precision.
 */

export const DROP_RATIO_MAX_TOTAL = 16;
const COMPLEXITY_WEIGHT = 0.01;

const gcd = (left: number, right: number): number => {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
};

const gcdAll = (values: number[]): number =>
  values.reduce((acc, value) => gcd(acc, value), values[0] ?? 1);

const allocateLargestRemainder = (weights: number[], total: number): number[] => {
  const count = weights.length;
  const raw = weights.map(weight => weight * total);
  const floors = raw.map(value => Math.floor(value + 1e-12));
  let leftover = total - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((left, right) => (
      right.fraction - left.fraction !== 0
        ? right.fraction - left.fraction
        : left.index - right.index
    ));

  const drops = floors.slice();
  for (let step = 0; leftover > 0 && step < order.length; step += 1) {
    drops[order[step].index] += 1;
    leftover -= 1;
  }

  for (let guard = 0; guard < count; guard += 1) {
    const zeroIndex = drops.findIndex(value => value <= 0);
    if (zeroIndex < 0) break;
    let donor = 0;
    for (let index = 1; index < count; index += 1) {
      if (drops[index] > drops[donor]) donor = index;
    }
    if (drops[donor] <= 1) break;
    drops[donor] -= 1;
    drops[zeroIndex] = 1;
  }

  return drops;
};

const l1Error = (drops: number[], weights: number[], total: number): number =>
  drops.reduce((error, value, index) => error + Math.abs(value / total - weights[index]), 0);

/**
 * Map positive relative amounts onto gcd-reduced integer drops.
 * Zero / non-finite inputs are treated as 0 and stay 0 in the result.
 */
export const toDropRatio = (
  amounts: number[],
  maxTotal: number = DROP_RATIO_MAX_TOTAL
): number[] => {
  const sanitized = amounts.map(amount => (
    Number.isFinite(amount) && amount > 0 ? amount : 0
  ));
  const active = sanitized
    .map((amount, index) => ({ amount, index }))
    .filter(item => item.amount > 0);

  if (active.length === 0) {
    return sanitized.map(() => 0);
  }
  if (active.length === 1) {
    return sanitized.map((_, index) => (index === active[0].index ? 1 : 0));
  }

  const sum = active.reduce((total, item) => total + item.amount, 0);
  const weights = active.map(item => item.amount / sum);
  const pigmentCount = active.length;
  const cap = Math.max(pigmentCount, maxTotal);

  let bestDrops = allocateLargestRemainder(weights, pigmentCount);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let total = pigmentCount; total <= cap; total += 1) {
    const drops = allocateLargestRemainder(weights, total);
    const score = l1Error(drops, weights, total) + COMPLEXITY_WEIGHT * (total - pigmentCount);
    if (score < bestScore - 1e-12) {
      bestScore = score;
      bestDrops = drops;
    }
  }

  const divisor = gcdAll(bestDrops);
  const reduced = bestDrops.map(value => value / divisor);
  return sanitized.map((_, index) => {
    const activeIndex = active.findIndex(item => item.index === index);
    return activeIndex >= 0 ? reduced[activeIndex] : 0;
  });
};

export const formatDropRatioLine = (
  parts: { name: string; drops: number }[],
  separator = ' : '
): string =>
  parts
    .filter(part => part.drops > 0)
    .map(part => `${part.name} ${part.drops}`)
    .join(separator);

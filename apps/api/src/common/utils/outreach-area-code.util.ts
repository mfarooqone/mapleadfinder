import { phoneToWaMeDigits } from './wa-me.util';

export function areaCodeMatchScore(
  leadPhone: string,
  accountPhone: string,
): number {
  const leadDigits = phoneToWaMeDigits(leadPhone);
  const accountDigits = phoneToWaMeDigits(accountPhone);
  let score = 0;

  for (let i = 0; i < Math.min(leadDigits.length, accountDigits.length); i++) {
    if (leadDigits[i] !== accountDigits[i]) {
      break;
    }
    score++;
  }

  return score;
}

export function sortLeadsByAreaCodeProximity<T extends { phone: string }>(
  leads: T[],
  accountPhone: string,
): T[] {
  return [...leads].sort(
    (left, right) =>
      areaCodeMatchScore(right.phone, accountPhone) -
      areaCodeMatchScore(left.phone, accountPhone),
  );
}

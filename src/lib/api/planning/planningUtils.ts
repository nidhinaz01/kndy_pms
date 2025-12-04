export function calculatePattern(rate: number): { cycle: number; pattern: number[] } {
  if (rate <= 0) {
    return { cycle: 1, pattern: [0] };
  }

  if (rate === Math.floor(rate)) {
    return { cycle: 1, pattern: [rate] };
  }

  const precision = 100;
  const numerator = Math.round(rate * precision);
  const denominator = precision;
  
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(numerator, denominator);
  const simplifiedNum = numerator / divisor;
  const simplifiedDen = denominator / divisor;

  const pattern: number[] = [];
  for (let i = 0; i < simplifiedDen; i++) {
    pattern.push(Math.floor(simplifiedNum / simplifiedDen) + (i < simplifiedNum % simplifiedDen ? 1 : 0));
  }

  return { cycle: simplifiedDen, pattern };
}

export function validatePattern(pattern: number[], cycle: number): boolean {
  if (pattern.length !== cycle) return false;
  if (pattern.some(p => p < 0)) return false;
  return true;
}


/**
 * Money utilities — store and operate in cents (integer) to avoid float rounding.
 */

export const toCents = (soles: number): number => Math.round(soles * 100);
export const toSoles = (cents: number): number => cents / 100;

export const formatPEN = (cents: number): string =>
  "S/ " +
  toSoles(cents).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

/**
 * Calculate IGV (Peruvian VAT) breakdown given a price that INCLUDES tax.
 * Per Peruvian law, displayed prices already include IGV.
 */
export const calcTaxBreakdown = (totalCents: number, taxRate = 0.18) => {
  const baseCents = Math.round(totalCents / (1 + taxRate));
  const taxCents = totalCents - baseCents;
  return { baseCents, taxCents, totalCents };
};

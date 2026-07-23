export enum WeightUnit {
  KG = 'kg',
  LB = 'lb',
}

export const WEIGHT_UNIT_TO_KG: Record<WeightUnit, number> = {
  [WeightUnit.KG]: 1,
  [WeightUnit.LB]: 0.45359237,
};

export const WEIGHT_UNITS = Object.values(WeightUnit);

export function convertWeight(
  value: number,
  from: WeightUnit,
  to: WeightUnit,
  decimalPlaces = 3,
): number {
  const result = (value * WEIGHT_UNIT_TO_KG[from]) / WEIGHT_UNIT_TO_KG[to];
  return Number(result.toFixed(decimalPlaces));
}

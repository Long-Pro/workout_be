export const WEIGHT_UNIT_TO_KG = {
  kg: 1,
  lb: 0.45359237,
} as const;

export type WeightUnit = keyof typeof WEIGHT_UNIT_TO_KG;

export const WEIGHT_UNITS = Object.keys(WEIGHT_UNIT_TO_KG) as WeightUnit[];

export function convertWeightToKg(weight: number, unit: WeightUnit): number {
  return weight * WEIGHT_UNIT_TO_KG[unit];
}

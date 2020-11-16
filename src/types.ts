export interface RegistrationInfo {
  VIN: string
  "Model Year": string
  [key: string]: any
}

export interface MPGData {
  id: string
  make: string
  model: string
  year: string
  fuelType1: string
  fuelType2: string
  displ: string
  trany: string
  cylinders: string
  [key: string]: any
}

/**
 * RegistrationInfo with matched MPGData appended.
 * If multiple matches, returns MPGData of first match.
 * If no matches, returns no MPGData.
 * Also includes the total number of matches, and the IDs of each matching MPGData.
 * TOOO: If multiple matches, returns averages of the numeric MPGData of the matches
 */
export type CombinedData = RegistrationInfo &
  Partial<MPGData> & { numMatches: number; matches: string }

export interface RawVinDataPoint {
  Value: string | null
  ValueId: string
  Variable: string
  VariableId: number
}

export interface IdentifyingInfo {
  vin: string
  make: string | null
  model: string | null
  year: string | null
  fuelTypePrimary: string | null
  fuelTypeSecondary: string | null
  displacement: string | null
  transmissionStyle: string | null
  transmissionSpeed: string | null
  cylinders: string | null
}

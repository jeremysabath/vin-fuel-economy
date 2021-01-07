export interface RegistrationInfo {
  VIN: string
  "Model Year": string
  Make: string
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
  drive: string
  [key: string]: any
}

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
  drive: string | null
}
/**
 * RegistrationInfo with VIN lookup data and matched MPGData.
 * If multiple matches, returns MPGData of first match.
 * If no matches, returns no MPGData.
 * Also includes the total number of matches, and the IDs of each matching MPGData.
 * TOOO: If multiple matches, returns averages of the numeric MPGData of the matches
 */
export type CombinedData = RegistrationInfo & {
  vinMake: string | null
  vinModel: string | null
  vinYear: string | null
  vinFuelTypePrimary: string | null
  vinFuelTypeSecondary: string | null
  vinDisplacement: string | null
  vinTransmissionStyle: string | null
  vinTransmissionSpeed: string | null
  vinCylinders: string | null
  vinDrive: string | null
} & Partial<MPGData> & {
    numMatches: number
    matches: string
    selectedMatch: string
    decidingFactor?: string

    // Only set if multiple matches
    comb08min?: number
    comb08max?: number
    comb08mean?: number
    comb08range?: number
  }

/* 
  Unique MPG Data drive types:
  - 2-Wheel Drive
  - Front-Wheel Drive
  - Rear-Wheel Drive
  - Part-time 4-Wheel Drive
  - 4-Wheel Drive
  - All-Wheel Drive
  - 4-Wheel or All-Wheel Drive
  - 4x2
*/
export enum VINDriveType {
  FWD = "FWD/Front Wheel Drive",
  FourWD = "4WD/4-Wheel Drive/4x4",
  AWD = "AWD/All Wheel Drive",
  RWD = "RWD/ Rear Wheel Drive",
  PartTimeFourWD = "2WD/4WD",
  FourByTwo = "4x2",
}

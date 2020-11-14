export interface RegistrationInfo {
  VIN: string
  "Model Year": string
  [key: string]: string
}

export interface MPGData {
  make: string
  model: string
  year: string
  fuelType1: string
  fuelType2: string
  displ: string
  trany: string
  cylinders: string
  [key: string]: string
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
}

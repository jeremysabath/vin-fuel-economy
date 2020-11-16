import fs from "fs"
import path from "path"
import csv from "csv-parser"
import {
  IdentifyingInfo,
  MPGData,
  RawVinDataPoint,
  RegistrationInfo,
} from "./types"
import axios from "axios"

export const parseVinData = (
  vin: string,
  rawVinData: RawVinDataPoint[]
): IdentifyingInfo => {
  const parsed: { [key: string]: string | null } = {}
  for (let i = 0; i < rawVinData.length; i += 1) {
    const rawDataPoint = rawVinData[i]
    parsed[rawDataPoint.Variable] = rawDataPoint.Value
  }

  return {
    vin,
    make: parsed["Make"],
    model: parsed["Model"],
    year: parsed["Model Year"],
    fuelTypePrimary: parsed["Fuel Type - Primary"],
    fuelTypeSecondary: parsed["Fuel Type - Secondary"],
    displacement: parsed["Displacement (L)"],
    transmissionStyle: parsed["Transmission Style"],
    transmissionSpeed: parsed["Transmission Speeds"],
    cylinders: parsed["Engine Number of Cylinders"],
  }
}

export const readData = async (): Promise<{
  mpgData: MPGData[]
  registrations: RegistrationInfo[]
} | null> => {
  try {
    // Read the MPG Data into an array
    const mpgData: MPGData[] = []
    await new Promise((resolve, reject): void => {
      fs.createReadStream(path.join(__dirname, "data/mpg-data.csv"))
        .pipe(csv())
        .on("data", (data: MPGData): void => {
          mpgData.push(data)
        })
        .on("error", err => reject(err))
        .on("end", () => {
          console.log(`Read ${mpgData.length} records of MPG Data`)
          resolve()
        })
    })
    console.log("read MPG data")

    // Read the VIN Data into an array
    const registrations: RegistrationInfo[] = []
    await new Promise((resolve, reject): void => {
      fs.createReadStream(
        path.join(__dirname, "data/bedford-vehicle-registrations.csv")
      )
        .pipe(csv())
        .on("data", (data: RegistrationInfo): void => {
          registrations.push(data)
        })
        .on("error", err => reject(err))
        .on("end", () => {
          console.log(`Read ${registrations.length} registrations`)
          resolve()
        })
    })
    console.log("read registration data, e.g. ", registrations[0])

    return { mpgData, registrations }
  } catch (err) {
    console.error("Error reading data: ", err)
    return null
  }
}

// Takes a vehicle's identifying info and attempts to look up the corresponding
// MPG data record. Returns the complete MPGData record if found, otherwise null.
export const findMpgData = (
  vinInfo: IdentifyingInfo,
  mpgData: MPGData[]
): MPGData[] => {
  console.log("findMpgData for VIN Info: ", vinInfo)

  const matches = mpgData.filter((mpgRecord): boolean => {
    if (
      !vinInfo.make ||
      vinInfo.make.toLowerCase() !== mpgRecord.make.toLowerCase()
    )
      return false

    if (
      !vinInfo.model ||
      mpgRecord.model.toLowerCase().indexOf(vinInfo.model.toLowerCase()) === -1
    )
      return false

    // The model year is a valid number and matches the mpgRecord year.
    if (
      Number.isNaN(Number(vinInfo.year)) ||
      Number(vinInfo.year) !== Number(mpgRecord.year)
    )
      return false

    // If we have fuel type info for the VIN, attempt to match it, otherwise ignore.
    if (vinInfo.fuelTypePrimary && vinInfo.fuelTypePrimary !== "") {
      if (
        mpgRecord.fuelType1
          .toLowerCase()
          .indexOf(vinInfo.fuelTypePrimary.toLowerCase()) === -1
      )
        return false
    }

    if (vinInfo.fuelTypeSecondary && vinInfo.fuelTypeSecondary !== "") {
      if (
        mpgRecord.fuelType2
          .toLowerCase()
          .indexOf(vinInfo.fuelTypeSecondary.toLowerCase()) === -1
      )
        return false
    }

    if (vinInfo.displacement) {
      if (
        Number(vinInfo.displacement).toFixed(1) !==
        Number(mpgRecord.displ).toFixed(1)
      )
        return false
    }

    // Match on Transmission. Look for the transmission style and speed string anywhere in the mpgRecord's one `trany` string
    if (vinInfo.transmissionStyle) {
      if (
        mpgRecord.trany
          .toLowerCase()
          .indexOf(vinInfo.transmissionStyle.toLowerCase()) === -1
      )
        return false
    }

    if (vinInfo.transmissionSpeed) {
      if (
        mpgRecord.trany
          .toLowerCase()
          .indexOf(vinInfo.transmissionSpeed.toLowerCase()) === -1
      )
        return false
    }

    if (vinInfo.cylinders) {
      if (Number(vinInfo.cylinders) !== Number(mpgRecord.cylinders))
        return false
    }

    return true
  })

  return matches
}

/** Fetch VIN data via API and extract the model's identifying info, or null if error */
export const getVinInfo = async (
  vin: string,
  year: string
): Promise<IdentifyingInfo | null> => {
  try {
    const { data } = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinExtended/${vin}?format=json&modelyear=${year}`
    )

    return parseVinData(vin, data.Results)
  } catch (err) {
    console.error(`Error loading data for VIN: ${vin}`, err)
    return null
  }
}

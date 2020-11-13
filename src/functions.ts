import fs from "fs"
import path from "path"
import csv from "csv-parser"
import {
  IdentifyingInfo,
  MPGData,
  RawVinDataPoint,
  RegistrationInfo,
} from "./types"

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
): MPGData | null => {
  console.log("findMpgData for VIN Info: ", vinInfo)

  const matches = mpgData.filter((mpgRecord): boolean => {
    // prettier-ignore
    return !!(
        vinInfo.make &&
        vinInfo.make.toLowerCase() === mpgRecord.make.toLowerCase() &&

        vinInfo.model &&
        vinInfo.model.toLowerCase() === mpgRecord.model.toLowerCase() &&

        // The model year is a valid number and matches the mpgRecord year.
        !Number.isNaN(Number(vinInfo.year)) &&
        Number(vinInfo.year) &&
        Number(vinInfo.year) === Number(mpgRecord.year) &&

        // Fuel Types are defined and the same, or are both undefined/null/""
        ((vinInfo.fuelTypePrimary && mpgRecord.fuelType1 !== "" && vinInfo.fuelTypePrimary.toLowerCase() === mpgRecord.fuelType1.toLowerCase()) || 
        (!vinInfo.fuelTypePrimary && mpgRecord.fuelType1 === "")) &&

        ((vinInfo.fuelTypeSecondary && mpgRecord.fuelType2 !== "" && vinInfo.fuelTypeSecondary.toLowerCase() === mpgRecord.fuelType2.toLowerCase()) || 
        (!vinInfo.fuelTypeSecondary && mpgRecord.fuelType2 === "")) &&
        
        !Number.isNaN(Number(vinInfo.displacement)) && Number(vinInfo.displacement).toFixed(1) === Number(mpgRecord.displ).toFixed(1) &&

        // Match on Transmission. Look for the transmission style and speed string anywhere in the mpgRecord's one `trany` string
        (vinInfo.transmissionStyle 
          ? mpgRecord.trany.toLowerCase().indexOf(vinInfo.transmissionStyle.toLowerCase()) >= 0 
          : true)
          &&
        (vinInfo.transmissionSpeed 
          ? mpgRecord.trany.toLowerCase().indexOf(vinInfo.transmissionSpeed.toLowerCase()) >= 0 
          : true) &&

        !Number.isNaN(Number(vinInfo.cylinders)) && Number(vinInfo.cylinders) === Number(mpgRecord.cylinders)
      )
  })

  if (matches.length === 0) {
    console.log("No match")
    return null
  }

  if (matches.length === 1) {
    console.log("Success, found 1 match: ", matches[0])
    return matches[0]
  }

  // More than 1 match.
  console.log(`${matches.length} matches`)
  return null
}

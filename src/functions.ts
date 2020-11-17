import fs from "fs"
import path from "path"
import csv from "csv-parser"
import {
  IdentifyingInfo,
  MPGData,
  RawVinDataPoint,
  RegistrationInfo,
  VINDriveType,
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
    drive: parsed["Drive Type"],
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

/**
 * Counts the number of occurrences of each value in an array.
 * Returns an array of objects, each object with the value and count.
 */
export const countUnique = (
  data: string[]
): { value: string; count: number }[] => {
  const results: { [key: string]: number } = {}

  data.forEach((value): void => {
    const count = results[value]
    results[value] = typeof count === "number" ? count + 1 : 1
  })

  return Object.keys(results).map((value): {
    value: string
    count: number
  } => ({ value, count: results[value] }))
}

interface Matcher<T> {
  label: string
  matchFn: (item: T) => boolean
}

const getMatches = <T>(
  data: T[],
  matchers: Matcher<T>[]
): { matches: T[]; decidingFactor?: string } => {
  let matches: T[] | undefined
  let decidingFactor: string | undefined

  for (let i = 0; i < matchers.length; i += 1) {
    const matcher = matchers[i]

    // The first time, use the complete data set. Once we've matched, use the matches.
    const remainingData = !matches ? data : matches
    const nextMatches = remainingData.filter(matcher.matchFn)

    // If the first (broadest) matcher returns no matches, return early.
    if (i === 0 && nextMatches.length === 0) {
      console.log(`(${matcher.label}): no initial matches, skipping.`)
      return { matches: [], decidingFactor: matcher.label }
    }

    // If this matcher found a unique match in the remaining set, exit the loop, we have our match.
    if (nextMatches.length === 1) {
      console.log(`(${matcher.label}): 1 match `)
      matches = [...nextMatches]
      decidingFactor = matcher.label
      break
    }

    // If there are still multiple matches, update the match list for the next matcher to have a go.
    if (nextMatches.length > 1) {
      console.log(`(${matcher.label}): ${nextMatches.length} matches `)
      matches = [...nextMatches]
    }

    // If there were no matches with this matcher, do nothing, run the next matcher on the same data.
    if (nextMatches.length === 0) {
      console.log(`(${matcher.label}): 0 matches `)
    }
  }

  return {
    matches: matches || [],
    decidingFactor,
  }
}

// Takes a vehicle's identifying info and attempts to look up the corresponding
// MPG data record. Returns an array of matching MPG Data records, along with a `decidingFactor`,
// the characteristic that reduced the match count to 1, when applicable.
export const findMpgData = (
  vinInfo: IdentifyingInfo,
  mpgData: MPGData[]
): { matches: MPGData[]; decidingFactor?: string } => {
  console.log("findMpgData for VIN Info: ", vinInfo)

  const matchers: Matcher<MPGData>[] = [
    {
      label: "makeModelYear",
      matchFn: (mpgRecord): boolean => {
        if (
          !vinInfo.make ||
          vinInfo.make.toLowerCase() !== mpgRecord.make.toLowerCase()
        )
          return false

        if (
          !vinInfo.model ||
          mpgRecord.model.toLowerCase().indexOf(vinInfo.model.toLowerCase()) ===
            -1
        )
          return false

        // The model year is a valid number and matches the mpgRecord year.
        if (
          Number.isNaN(Number(vinInfo.year)) ||
          Number(vinInfo.year) !== Number(mpgRecord.year)
        )
          return false

        return true
      },
    },
    {
      label: "fuelTypePrimary",
      matchFn: (mpgRecord): boolean =>
        // If we have fuel type info for the VIN and it's in the MPG record's fuel type text.
        !!(
          vinInfo.fuelTypePrimary &&
          vinInfo.fuelTypePrimary !== "" &&
          mpgRecord.fuelType1
            .toLowerCase()
            .indexOf(vinInfo.fuelTypePrimary.toLowerCase()) !== -1
        ),
    },
    {
      label: "fuelTypeSecondary",
      matchFn: (mpgRecord): boolean =>
        !!(
          vinInfo.fuelTypeSecondary &&
          vinInfo.fuelTypeSecondary !== "" &&
          mpgRecord.fuelType2
            .toLowerCase()
            .indexOf(vinInfo.fuelTypeSecondary.toLowerCase()) !== -1
        ),
    },
    {
      label: "driveType",
      matchFn: (mpgRecord): boolean => {
        const { drive: vinDriveType } = vinInfo
        const { drive: mpgRecordDriveType } = mpgRecord

        // console.log(
        //   `vidDriveType: ${vinDriveType}, mpgRecordDriveType: ${mpgRecordDriveType}`
        // )
        if (!vinDriveType) return false

        switch (vinDriveType) {
          // If vehicle is "FWD", match on any MPG Records
          // labeled Front-Wheel Drive or 2-Wheel Drive.
          case VINDriveType.FWD:
            return (
              mpgRecordDriveType === "Front-Wheel Drive" ||
              mpgRecordDriveType === "2-Wheel Drive" ||
              mpgRecordDriveType === "4x2"
            )

          case VINDriveType.RWD:
            return (
              mpgRecordDriveType === "Read-Wheel Drive" ||
              mpgRecordDriveType === "2-Wheel Drive" ||
              mpgRecordDriveType === "4x2"
            )

          case VINDriveType.FourWD:
          case VINDriveType.AWD:
            return (
              mpgRecordDriveType === "4-Wheel Drive" ||
              mpgRecordDriveType === "All-Wheel Drive" ||
              mpgRecordDriveType === "4-Wheel or All-Wheel Drive"
            )

          case VINDriveType.PartTimeFourWD:
            return mpgRecordDriveType === "Part-time 4-Wheel Drive"

          default:
            console.log(`Other drive type: ${vinDriveType}`)
            return false
        }
      },
    },
    {
      label: "displacement",
      matchFn: (mpgRecord): boolean =>
        !!(
          vinInfo.displacement &&
          Number(vinInfo.displacement).toFixed(1) ===
            Number(mpgRecord.displ).toFixed(1)
        ),
    },
    {
      label: "transmissionStyle",
      matchFn: (mpgRecord): boolean =>
        // Match on Transmission. Look for the transmission style and speed string anywhere in the mpgRecord's one `trany` string
        !!(
          vinInfo.transmissionStyle &&
          mpgRecord.trany
            .toLowerCase()
            .indexOf(vinInfo.transmissionStyle.toLowerCase()) !== -1
        ),
    },
    {
      label: "transmissionSpeed",
      matchFn: (mpgRecord): boolean =>
        !!(
          vinInfo.transmissionSpeed &&
          mpgRecord.trany
            .toLowerCase()
            .indexOf(vinInfo.transmissionSpeed.toLowerCase()) !== -1
        ),
    },
    {
      label: "cylinders",
      matchFn: (mpgRecord): boolean =>
        !!(
          vinInfo.cylinders &&
          Number(vinInfo.cylinders) === Number(mpgRecord.cylinders)
        ),
    },
  ]

  return getMatches(mpgData, matchers)
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

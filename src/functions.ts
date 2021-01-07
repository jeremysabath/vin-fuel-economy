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
import { Make } from "./const"

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

const getModelMatch = (
  vinInfo: IdentifyingInfo,
  mpgRecord: MPGData
): boolean => {
  const defaultMatch = !!(
    vinInfo.model &&
    mpgRecord.model.toLowerCase().indexOf(vinInfo.model.toLowerCase()) !== -1
  )

  if (!vinInfo.make) return defaultMatch
  if (!vinInfo.model) return defaultMatch

  // Ford Custom Matchers
  if (vinInfo.make.toLowerCase() === Make.Ford.toLowerCase()) {
    // Remove the "-" in an "E-350"-style model, resulting in "E350",
    // matching the MPG Data "spelling".
    // Match on the "-" character when preceded by "E" or "F", and post-ceded by
    // a 3-digit number.
    const regex = RegExp(/(?<=[ef])-(?=\d\d\d)/, "gi")
    const dehyphenatedModel = vinInfo.model.replace(regex, "")

    // console.log("---")
    // console.log(
    //   `mpgRecord.model.toLowerCase(): ${mpgRecord.model.toLowerCase()}`
    // )
    // console.log(
    //   `dehyphenatedModel.toLowerCase(): ${dehyphenatedModel.toLowerCase()}`
    // )
    // console.log(
    //   "Match?",
    //   mpgRecord.model.toLowerCase().indexOf(dehyphenatedModel.toLowerCase()) !==
    //     -1
    // )
    // console.log("")

    // Return 'true' if the dehyphenated VIN Model is contained in the MPG Record model.
    return (
      mpgRecord.model.toLowerCase().indexOf(dehyphenatedModel.toLowerCase()) !==
      -1
    )
  }

  // Mazda Custom Matchers
  if (vinInfo.make.toLowerCase() === Make.Mazda.toLowerCase()) {
    // Remove the "Mazda" prefix from "Mazda#"-style models
    // Match on "Mazda" when post-ceded by a number and remove it.
    const regex = RegExp(/Mazda(?=\d)/, "gi")
    const cleanedModel = vinInfo.model.replace(regex, "")
    console.log(`rawModel: ${vinInfo.model}, cleanedModel: ${cleanedModel}`)

    // For number-only models, match on the exact number, no surrounding characters.
    if (!Number.isNaN(Number(cleanedModel))) {
      const exactNumberRegex = RegExp(
        `(?<![\\w\\d-])${cleanedModel}(?![\\w\\d-])`,
        "gi"
      )
      const match = mpgRecord.model.match(exactNumberRegex)
      return !!match
    }

    // For everything else, default match.
    return defaultMatch
  }

  // Mercedes-Benz Custom Matchers
  if (vinInfo.make.toLowerCase() === Make.Mercedes.toLowerCase()) {
    // Numeric-only models
    if (vinInfo.model && !Number.isNaN(Number(vinInfo.model))) {
      const numericModel = Number(vinInfo.model)

      // If a VIN Model is numeric only, match for a MPG Record Model
      // with the exact numeric model group preceded by no alphanumeric characters
      // and suffixed by no numeric characters.
      const matches = mpgRecord.model.match(
        `(?<![\\w\\d])${numericModel}(?!\\d)`
      )
      return !!matches
    }

    // [X]-Class models
    if (vinInfo.model && vinInfo.model.toLowerCase().indexOf("class") !== -1) {
      const classMatch = vinInfo.model.match(/\w+(?=(-Class))/)
      // console.log("-Class Matches:", classMatch)

      // If we can't get the class prefix, return the default match.
      if (!classMatch) return defaultMatch

      const classPrefix = classMatch[0]
      // console.log("classPrefix: ", classPrefix)

      // Match the VIN Model class prefix in the MPG Record Model
      // Match if the exact class is present, with no alphabetical characters on
      // either side.
      // Ex: "G" doesn't match "GLK"
      // Ex: "C" *does* match "C320"
      // console.log("mpgRecord.model: ", mpgRecord.model)
      const modelMatcher = RegExp(`(?<!(\\w+))${classPrefix}(?!([a-z]+))`, "gi")
      const modelMatch = mpgRecord.model.match(modelMatcher)
      // console.log("modelMatch: ", modelMatch)
      return !!modelMatch
    }
  }

  return defaultMatch
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

        if (!getModelMatch(vinInfo, mpgRecord)) return false

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
        //   `vinDriveType: ${vinDriveType}, mpgRecordDriveType: ${mpgRecordDriveType}`
        // )
        if (!vinDriveType) return false

        switch (vinDriveType) {
          // If vehicle is "FWD", match on any MPG Records
          // labeled Front-Wheel Drive or 2-Wheel Drive.
          case VINDriveType.FWD:
            return (
              mpgRecordDriveType === "Front-Wheel Drive" ||
              mpgRecordDriveType === "2-Wheel Drive"
            )

          case VINDriveType.RWD:
            return (
              mpgRecordDriveType === "Rear-Wheel Drive" ||
              mpgRecordDriveType === "2-Wheel Drive"
            )

          case VINDriveType.FourByTwo:
            return (
              mpgRecordDriveType === "Front-Wheel Drive" ||
              mpgRecordDriveType === "Rear-Wheel Drive" ||
              mpgRecordDriveType === "2-Wheel Drive"
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
            // console.log(`Other drive type: ${vinDriveType}`)
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
      matchFn: (mpgRecord): boolean => {
        // console.log(
        //   `vinInfo.transmissionStyle: ${vinInfo.transmissionStyle}, mpgRecord.trany: ${mpgRecord.trany}`
        // )
        // Match on Transmission. Look for the transmission style and speed string anywhere in the mpgRecord's one `trany` string
        return !!(
          vinInfo.transmissionStyle &&
          // VIN Transmission type included in MPG data transmission type...
          (mpgRecord.trany
            .toLowerCase()
            .indexOf(vinInfo.transmissionStyle.toLowerCase()) !== -1 ||
            // Or, if VIN transmission is "CVT", look for "variable gear ratio" in the MPG data
            (vinInfo.transmissionStyle.indexOf("CVT") !== -1 &&
              mpgRecord.trany.toLowerCase().indexOf("variable gear ratio") !==
                -1))
        )
      },
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

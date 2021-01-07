import sampleSize from "lodash.samplesize"
import moment from "moment"
import { countUnique, findMpgData, getVinInfo, readData } from "./functions"
import { CombinedData } from "./types"
import { createObjectCsvWriter } from "csv-writer"
import mkdirp from "mkdirp"
import { CsvWriter } from "csv-writer/src/lib/csv-writer"

console.log("Hello VIN Fuel Economy!")

const main = async (): Promise<void> => {
  const startTime = moment()
  console.log(`Start time: ${startTime.format("h:mm:ss")}`)

  const data = await readData()
  if (!data) throw Error("Failed to read data. Abort.")

  const runDate = moment().format("YYYY-MM-DD - hh-mm-ssa")
  const logDirectory = `output`
  await mkdirp(logDirectory)
  const logFile = `${logDirectory}/${runDate}-vin-fuel-economy.csv`

  const { mpgData, registrations } = data
  const results: CombinedData[] = []

  // Get a sample of the registration data for testing.
  const sample = registrations.filter(
    (registration): boolean => registration.Make.indexOf("BMW") !== -1
  )

  const n = registrations.length
  // const startIndex = 0

  // const sample = registrations.slice(startIndex, startIndex + n) //sampleSize(registrations, n)
  console.log(
    `registrations in sample: ${sample.length}. Total registrations: ${registrations.length}`
  )

  for (let i = 0; i < sample.length; i += 1) {
    const registration = sample[i]
    const vinInfo = await getVinInfo(
      registration.VIN,
      registration["Model Year"]
    )

    if (vinInfo) {
      const { matches, decidingFactor } = findMpgData(vinInfo, mpgData)
      if (matches.length === 0) console.log("No match")
      if (matches.length === 1) console.log("Success, 1 match")
      if (matches.length > 1)
        console.log(
          `${matches.length} matches: `,
          matches.map((match): string => match.id)
        )

      const result: CombinedData = {
        ...registration,
        vinMake: vinInfo.make,
        vinModel: vinInfo.model,
        vinYear: vinInfo.year,
        vinFuelTypePrimary: vinInfo.fuelTypePrimary,
        vinFuelTypeSecondary: vinInfo.fuelTypeSecondary,
        vinDisplacement: vinInfo.displacement,
        vinTransmissionStyle: vinInfo.transmissionStyle,
        vinTransmissionSpeed: vinInfo.transmissionSpeed,
        vinCylinders: vinInfo.cylinders,
        vinDrive: vinInfo.drive,
        numMatches: matches.length,
        matches: matches
          .map((match): string => `${match.id} - ${match.model}`)
          .toString(),
        decidingFactor,
      }
      const match = matches.length > 0 ? matches[0] : null
      if (match) Object.assign(result, match)

      results.push(result)
    } else {
      console.log(
        `Couldn't get vehicle info from VIN ${registration.VIN}, skipping`
      )
    }
  }

  try {
    const csvWriter: CsvWriter<CombinedData> = createObjectCsvWriter({
      path: logFile,
      header: [
        // Registration Info
        { id: "Record Type", title: "Record Type" },
        { id: "VIN", title: "VIN" },
        { id: "Registration Class", title: "Registration Class" },
        { id: "City", title: "City" },
        { id: "State", title: "State" },
        { id: "Zip", title: "Zip" },
        { id: "County", title: "County" },
        { id: "Model Year", title: "Model Year" },
        { id: "Make", title: "Make" },
        { id: "Body Type", title: "Body Type" },
        { id: "Fuel Type", title: "Fuel Type" },
        { id: "Unladen Weight", title: "Unladen Weight" },
        { id: "Maximum Gross Weight", title: "Maximum Gross Weight" },
        { id: "Passengers	", title: "Passengers	" },
        { id: "Reg Valid Date", title: "Reg Valid Date" },
        { id: "Reg Expiration Date", title: "Reg Expiration Date" },
        { id: "Color", title: "Color" },
        { id: "Scofflaw Indicator", title: "Scofflaw Indicator" },
        { id: "Suspension Indicator", title: "Suspension Indicator	" },
        { id: "Revocation Indicator", title: "Revocation Indicator" },
        { id: "numMatches", title: "Num Matches" },
        { id: "matches", title: "Match IDs" },
        { id: "decidingFactor", title: "Deciding Factor" },

        // VIN Search Data + corresponding MPG Data fields
        { id: "vinMake", title: "VIN - Make" },
        { id: "vinModel", title: "VIN - Model" },
        { id: "vinYear", title: "VIN - Year" },
        { id: "vinFuelTypePrimary", title: "VIN - Fuel Type Primary" },
        { id: "vinFuelTypeSecondary", title: "VIN - Fuel Type Secondary" },
        { id: "vinDisplacement", title: "VIN - Displacement" },
        { id: "vinTransmissionStyle", title: "VIN - Transmission Style" },
        { id: "vinTransmissionSpeed", title: "VIN - Transmission Speed" },
        { id: "vinCylinders", title: "VIN - Cylinders" },
        { id: "vinDrive", title: "VIN - Drive Type" },

        // MPG Data
        { id: "id", title: "MPG Data ID" },
        { id: "barrels08", title: "barrels08" },
        { id: "barrelsA08", title: "barrelsA08" },
        { id: "charge240", title: "charge240" },
        { id: "city08", title: "city08" },
        { id: "city08U", title: "city08U" },
        { id: "cityA08", title: "cityA08" },
        { id: "cityA08U", title: "cityA08U" },
        { id: "cityE", title: "cityE" },
        { id: "cityUF", title: "cityUF" },
        { id: "co2", title: "co2" },
        { id: "co2A", title: "co2A" },
        { id: "co2TailpipeAGpm", title: "co2TailpipeAGpm" },
        { id: "co2TailpipeGpm", title: "co2TailpipeGpm" },
        { id: "comb08", title: "comb08" },
        { id: "comb08U", title: "comb08U" },
        { id: "combA08", title: "combA08" },
        { id: "combA08U", title: "combA08U" },
        { id: "combE", title: "combE" },
        { id: "combinedCD", title: "combinedCD" },
        { id: "combinedUF", title: "combinedUF" },
        { id: "cylinders", title: "cylinders" },
        { id: "displ", title: "displ" },
        { id: "drive", title: "drive" },
        { id: "engId", title: "engId" },
        { id: "eng_dscr", title: "eng_dscr" },
        { id: "feScore", title: "feScore" },
        { id: "fuelCost08", title: "fuelCost08" },
        { id: "fuelCostA08", title: "fuelCostA08" },
        { id: "fuelType", title: "fuelType" },
        { id: "fuelType1", title: "fuelType1" },
        { id: "fuelType2", title: "fuelType2" },
        { id: "ghgScore", title: "ghgScore" },
        { id: "ghgScoreA", title: "ghgScoreA" },
        { id: "highway08", title: "highway08" },
        { id: "highway08U", title: "highway08U" },
        { id: "highwayA08", title: "highwayA08" },
        { id: "highwayA08U", title: "highwayA08U" },
        { id: "highwayCD", title: "highwayCD" },
        { id: "highwayE", title: "highwayE" },
        { id: "highwayUF", title: "highwayUF" },
        { id: "make", title: "make" },
        { id: "model", title: "model" },
        { id: "range", title: "range" },
        { id: "rangeCity", title: "rangeCity" },
        { id: "rangeCityA", title: "rangeCityA" },
        { id: "rangeHwy", title: "rangeHwy" },
        { id: "rangeHwyA", title: "rangeHwyA" },
        { id: "trany", title: "trany" },
        { id: "UCity", title: "UCity" },
        { id: "UCityA", title: "UCityA" },
        { id: "UHighway", title: "UHighway" },
        { id: "UHighwayA", title: "UHighwayA" },
        { id: "VClass", title: "VClass" },
        { id: "year", title: "year" },
        { id: "youSaveSpend", title: "youSaveSpend" },
        { id: "trans_dscr", title: "trans_dscr" },
        { id: "atvType", title: "atvType" },
        { id: "fuelType2", title: "fuelType2" },
        { id: "rangeA", title: "rangeA" },
        { id: "evMotor", title: "evMotor" },
        { id: "mfrCode", title: "mfrCode" },
        { id: "c240Dscr", title: "c240Dscr" },
        { id: "charge240b", title: "charge240b" },
        { id: "c240bDscr", title: "c240bDscr" },
      ],
    })

    console.log("writing results...")
    await csvWriter.writeRecords(results)
    console.log("Success")
    console.log(`Finished at ${moment().format("h:mm:ss")}`)
    console.log(`Duration: ${moment().diff(startTime, "second")} seconds`)

    const resultsWithAMatch = results.filter(
      (result): boolean => result.numMatches > 0
    )
    console.log(
      `Match rate: ${((resultsWithAMatch.length / n) * 100).toFixed(2)}%`
    )

    const rawMatchCounts = results.map((result): string =>
      String(result.numMatches)
    )
    const matchFrequency = countUnique(rawMatchCounts)
    console.table(matchFrequency)
  } catch (error) {
    console.error("Error writing records: ", error)
  }
}

main()

import fs from "fs"
import path from "path"
import { findMpgData, parseVinData, readData } from "./functions"

console.log("Hello VIN Fuel Economy!")

const main = async (): Promise<void> => {
  const data = await readData()
  if (!data) throw Error("Failed to read data. Abort.")

  const { mpgData, registrations } = data

  const sampleVinDataFile = fs.readFileSync(
    path.join(__dirname, "data/sample-vin-data-2.json"),
    "utf-8"
  )
  const sampleVinData = JSON.parse(sampleVinDataFile)
  const vinInfo = parseVinData("5YJXCDE25HF037940", sampleVinData.Results)
  console.log("key vin data: ", vinInfo)

  const mpgRecord = findMpgData(vinInfo, mpgData)
}

main()

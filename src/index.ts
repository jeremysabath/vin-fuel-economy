import { findMpgData, getVinInfo, readData } from "./functions"

console.log("Hello VIN Fuel Economy!")

const main = async (): Promise<void> => {
  const data = await readData()
  if (!data) throw Error("Failed to read data. Abort.")

  const { mpgData, registrations } = data

  // const sampleVinDataFile = fs.readFileSync(
  //   path.join(__dirname, "data/sample-vin-data-2.json"),
  //   "utf-8"
  // )
  const registration = registrations[8000]
  const vinInfo = await getVinInfo(registration.VIN, registration["Model Year"])
  console.log("got vinInfo: ", vinInfo)

  if (vinInfo) {
    const mpgRecord = findMpgData(vinInfo, mpgData)
  } else {
    console.log(
      `Couldn't get vehicle info from VIN ${registration.VIN}, skipping`
    )
  }
}

main()

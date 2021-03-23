# vin-fuel-economy

Overview
========

Finding fuel efficiency data for a VIN seems like it should be as simple as... well, searching for a VIN and getting its EPA fuel efficiency! However, vehicles, even the same models, can have different levels of fuel efficiency depending on within-model differences like engine size, transmission type, etc. 

In order to get a vehicle's fuel efficiency from its VIN<sup id="a1">[1](#f1)</sup>, we first have to "decode" the VIN, and get the vehicle's Identifying Info and then use that information to filter fuel efficiency records from the EPA, which include all of the unique vehicle combinations that the EPA has test data for (~40,000), hoping to identify a single, exact match for the VIN in question.

Vehicle Identifying Info:
-   Make
-   Model
-   Year
-   Primary fuel type
-   Displacement
-   Transmission style (automatic, manual, CVT)
-   Transmission speeds (5-speed, 6-speed, etc)
-   Number of engine cylinders
-   Drive type (FWD, RWD, 4x4, etc.)

In some cases, we can't find an exact match in the EPA data because there are multiple records for a particular make, model, and year that can't be uniquely identified by the Identifying Info that we get from the decoded VIN. In those cases, we record the maximum MPG of all of the matches, the minimum, the range, and the mean, so that the user of the data can choose how to represent that vehicle in individual and summary statistics. In all cases, we record the total number of matches, and list the IDs<sup id="a2">[2](#f2)</sup>  of the matching EPA fuel efficiency records so that they can be identified and analyzed after the fact.

## Running the Script

- `npm install`
- `npm run build` 
- `node build/index.ts` 🪄

Step 1: Data prep
=================

-   Prepare a spreadsheet of VINs in CSV format so that it can be read into a program (the script currently expects the filename to be in the directory `data` with the name `/bedford-vehicle-registrations.csv`)
-   As long as these are complete VINs, no additional info is required.
-   Any columns in the input spreadsheet other than "VIN" are unused in identifying EPA matches, but are carried over to the final spreadsheet for reference.
-   In our analysis, we used the "Registration Class" and "Body Type" columns to identify passenger vehicles and distinguish cars from trucks/SUVs in the final analysis.
-   Download the latest vehicle data from the EPA (this is the list of ~40,000 specific vehicles, their key characteristics, and their fuel efficiency data). The script currently expects the filename to be in the directory `data` with the name `mpg-data.csv`)   
-   Available @[  https://www.fueleconomy.gov/feg/ws/index.shtml](https://www.fueleconomy.gov/feg/ws/index.shtml)
-   Direct link to latest CSV:[  https://www.fueleconomy.gov/feg/epadata/vehicles.csv](https://www.fueleconomy.gov/feg/epadata/vehicles.csv)

Step 2: VIN Decoding<sup id="a3">[3](#f3)</sup> 
====================

Use the NHTSA's API to decode the VIN and get the vehicle's identifying information (the NHTSA's web services are listed[  here](https://vpic.nhtsa.dot.gov/api/)). We use the "Decode VIN Extended" service, which takes a complete VIN as an input and returns the list of vehicle characteristics.

In most cases (>97%), the NHTSA VIN lookup is successful. Without the decoded VIN data, we don't have enough identifying info to match against the EPA fuel efficiency records, so we have to skip that VIN and move on to the next one.

The decoded VIN includes a lot of data, but only a handful of the 100+ fields are useful in finding the matching EPA fuel efficiency record. As far as I've been able to tell, the following is an exhaustive list of the identifying info that we can use to match a decoded VIN with and EPA fuel efficiency record:

-   "Make" (VariableId 26)
-   "Model" (VariableId 28)
-   "Model Year" (VariableId 29)
-   "Fuel Type - Primary" (VariableId 24)
-   "Fuel Type - Secondary" (VariableId 66)
-   "Displacement (L)" (VariableId 13)
-   "Transmission Style" (VariableId 37)
-   "Transmission Speeds" (VariableId 63)
-   "Engine Number of Cylinders" (VariableId 9)
-   "Drive Type" (VariableId 15)

When iterating over each VIN, extract the identifying info from the decoded VIN data and store it for use in the next step.

Step 3: Matching with EPA Fuel Efficiency Records
=================================================

Overview
--------

The general approach to matching a VIN to its EPA fuel efficiency data record is that we start with the list of all vehicles in the EPA data and then progressively filter out irrelevant results until we have the smallest non-zero number of matches.

When filtering, we are iterating over every record in the EPA fuel efficiency data, and including only those that match the specific characteristic that we're looking for. Then, if we move onto a subsequent matcher, we use the results of the previous filter as the basis for the next one, so that we filter more and more each time, resulting in the finest-grained filter when we've applied all of the matchers (if necessary).

We start by looking only for vehicle records with the matching make, model, and year, and then, if we find more than one, continue on with matchers for the remaining identifying characteristics.

In some cases, we use "custom matchers" to handle inconsistencies in how certain makes and models are identified in the NHTSA data vs the EPA data (see "Custom Matchers" section below).

Matching Step 1: Make/Model/Year
--------------------------------

The first step is to filter the master list of vehicles to include only those with the make, model, and year of the VIN we're looking for.

For each record in the EPA data, we check the make, model, and year, in order. If the make doesn't match, it's not a match, so skip the rest of the checks. If the make matches but the model doesn't match, it's not a match. If the make and model match but the year doesn't, it's not a match. Only when the make, model, and year all match do we include the EPA record in the list of matches and continue to the next step.

### Matching on make<sup id="a4">[4](#f4)</sup> 

Compare the "Make" variable from the decoded VIN data with the "make" field in the EPA data, looking for an exact match (the two values are exactly equal).

### Matching on model

Compare the "Model" variable from the decoded VIN data with the "model" field in the EPA data, looking to see if the model from the VIN data is contained in the model from the EPA data.

The NHTSA and the EPA use slightly different model names for the same vehicles. In most cases, the EPA model name is more specific. For example, a Mini Cooper S Countryman All4 has the model "Cooper" in the NHTSA data, but the model "Cooper S Countryman All4" in the EPA data. This is a common pattern for all makes and models.

To address this, we don't look for exact matches between the two fields, we check to see if the NHTSA model is contained in the EPA model. This works for most vehicle makes, with some exceptions (see Custom Matchers).

### Matching on year

Check that the year in the NHTSA data and the EPA data are exactly the same.

### Make/model/year results<sup id="a5">[5](#f5)</sup> 

If there is only one record in the EPA data that matches on make, model, and year, then we're done! We found an exact match.

If there are no fuel efficiency records with the make, model, and year of the VIN we're looking for, then we can go no further. There just isn't fuel efficiency data for that vehicle in the EPA catalog, so move onto checking the next VIN (this is about 3% of Bedford's passenger vehicles).

If there are multiple vehicles records in the EPA data that match on make, model, and year, then we need to use more of the identifying info to refine the results.

Matching Step 2: Trying other Matchers
--------------------------------------

If, after filtering on make, model, and year, we find multiple matching vehicles in the EPA data, we need to use other identifying info to further refine the list and get down to as few matches as possible. We apply each matcher to the most-filtered version of the list, one at a time, until we get down to a single match, or until we have used all of the matchers.

After applying matcher to the list, there will either be 0, 1, or multiple remaining matches:

-   If there is a single match, exit the loop, we have our match.

-   If there are zero matches, don't update the match set, just run the next matcher on the same data (see note 5 above).

-   If there are still multiple matches, update the set of matches to filter on and advance to the next matcher.

The typical case is that the make/model/year filter finds 4-8 matching vehicles, and then, one or two of the additional matchers reduces that list to 1 or 2 vehicles, by finding the version of those models with a specific combination of identifying info (e.g. transmission style and displacement).

If any matcher results in the list of matches going to zero, we skip it, and proceed to the next matcher using the last non-zero set of matches. The most common reason for a matcher to reduce the number of matches to zero is because of inconsistencies in the NHTSA and EPA data. Sometimes, a piece of identifying info is missing in one or both data sources. In those cases, we can't determine whether or not the records match, so we skip that matcher and move onto another one.

The result of the matching algorithm for a single VIN is the smallest non-zero set of make/model/year matches, or, if there were no make/model/year matches, then no matches at all.

### Identifying Info Matchers

**Primary Fuel Type**\
Match if the decoded VIN's "Fuel Type - Primary" field is contained in the EPA record's "fuelType1" field

**Secondary Fuel Type**\
Match if the decoded VIN's "Fuel Type - Secondary" field is contained in the EPA record's "fuelType2" field

**Drive Type**\
The EPA uses a different list of drive types than the NHTSA's, and there is not a one-to-one match. We attempt to line them up. 

| **NHTSA Drive Type**                      | **Matching EPA Drive Types**                               |
|-------------------------------------------|------------------------------------------------------------|
| FWD/Front Wheel Drive                     | Front-Wheel Drive, 2-Wheel Drive                           |
| RWD/ Rear Wheel Drive<sup id="a6">[6](#f6)</sup>                  | Rear-Wheel Drive, 2-Wheel Drive                            |
| 4x2                                       | Front-Wheel Drive, Rear-Wheel Drive, 2-Wheel Drive         |
| 4WD/4-Wheel Drive/4x4 AWD/All Wheel Drive | 4-Wheel Drive, All-Wheel Drive, 4-Wheel or All-Wheel Drive |
| 2WD/4WD                                   | Part-time 4-Wheel Drive                                    |

**Displacement**\
Round the decoded VIN's "Displacement (L)" value and the EPA record's "displ" value to 1 decimal place and match if they are equal.

**Transmission Style**\
Match if the decoded VIN's "Transmission Style" field is contained in the EPA record's "trany" field. Or, if the decoded VIN's transmission style is "CVT", match if the EPA record's "trany" field contains "variable gear ratio".<sup id="a7">[7](#f7)</sup> 

**Transmission Speeds**\
Match if the decoded VIN's "Transmission Speeds" value is contained in the EPA record's "trany" field.

**Number of Cylinders**\
Match if the decoded VIN's "Engine Number of Cylinders" field equals the EPA record's "cylinders" field.

Custom Matchers
---------------

Due to inconsistencies in how the NHTSA and EPA record certain components of vehicle data, we can't always use the default matchers. These cases were identified by looking for the makes with a high percentage of VINs with zero matches in early versions of the algorithm. Then, by looking into how those vehicles are defined in the VIN decode data (from NHTSA) and in the EPA data, I was able to figure out if the inconsistencies were systematic. When they were, we were able to write a "custom matcher" to account for the inconsistency and match anyway.

The following are the custom matchers that we used, broken down my make:

### Ford

The bulk of Ford models are in the form of "E-350", "F-150", etc. In the NHTSA data, models are written with the hyphen (e.g. "F-150"). In the EPA data, models are written without the hyphen (e.g. "F150"). To account for this, when we've determined that we're looking at a Ford, rather than just checking to see if the NHTSA model name is contained in the EPA model name, we first remove the hyphen using a[  Regular Expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).<sup id="a8">[8](#f8)</sup> 

The RegEx we use looks for a hyphen that is preceded by E or F and post-cded by a 3-digit number: `/(?<=[ef])-(?=\d\d\d)/gi`

### Mazda

Many Mazda model names are in the form of "Mazda3", "Mazda5". In the NHTSA data, the models are written with "Mazda" included. In the EPA data, these models are listed only by their number (e.g. "3"). So, when we're looking at a Mazda, we use a Regular Expression to strip the "Mazda" prefix from "Mazda#"-style models in the NHTSA data, and then look for an exact numeric match in the EPA data.

RegEx: `/Mazda(?=\d)/gi`

For all other Mazda models, we use the default model matcher, which just looks to see if the NHTSA model is contained in the EPA model.

### Mercedes-Benz

**Number-only models**\
Some Mercedes models are number-only. In those cases, we check for an exact numeric match in the EPA data, ensuring that we are matching on the whole number (e.g. "3" doesn't match "350")

RegEx: `(?<![\\w\\d])$\{model-number}(?!\\d)`

**X-Class models**\
Many Mercedes models are in the form of X-Class (e.g. "C-Class", "E-Class"). In the NHTSA data, these models are written out in the "class" form (e.g. "C-Class"). In the EPA data, the models are written with the class letter as a prefix, followed by a number (e.g. "C320"). To account for this, we use a Regular Expression to match on NHTSA models in the form of "X-Class" and extract the class prefix

RegEx: `/\w+(?=(-Class))/`

Then we use another regular expression to match on EPA models that include the class prefix with no alphabetical characters on either side. For example, "G" doesn't match on "GLK", which is a different class, but "C" does match on "C320".

RegEx: `/(?<!(\\w+)){classPrefix}(?!([a-z]+))/gi`

### Toyota

**Scion**\
The EPA includes Scions as their own make, whereas the NHTSA includes Scions as a model under the Toyota make. To account for this, when looking at a Toyota in the NHTSA data, we check to see if the model includes the word "Scion" (e.g. model = "Scion xB").

In the make matcher, we check Toyotas to see if the model name includes "Scion" and consider it a make match if the EPA record's make is "Scion".

In the model matcher, we remove the "Scion " text and then run the default "contained-in" matcher on the remaining model name (e.g "xB").

**4-Runner**\
As with the Fords, the NHTSA lists "4-Runner" with the hyphen, and the EPA lists theirs without. So, when looking at a Toyota "4-Runner", look for "4Runner" (no hyphen) when checking the EPA record.

**Matrix**\
The NHTSA data records the Toyota Matrix model as "Corolla Matrix", while the EPA only lists it as "Matrix". So, when we encounter a "Corolla Matrix", match only on "Matrix".

Step 4: Recording Results
=========================

After getting match results for each VIN, we record those results alongside the VIN and whatever other columns were included in the input spreadsheet. When recording the results, we insert a handful of columns that make the data more useful and easier to interpret. These are easiest understood as belonging to three categories:

Matching Results
----------------

-   numMatches: The number of matching fuel efficiency records for each VIN
-   matches: The IDs and model names of each match from the EPA data (useful in identifying specific matching records and in the EPA data when further investigation is required)
-   selectedMatch: In cases where there are multiple matching EPA records, the record that we chose to represent a particular VIN. The latest version of the algorithm chose the record with the worst MPG 
-   decidingFactor: Which of the matchers, when applied, resulted in a single remaining match in the EPA data (or if make/model/year resulted in zero matches).
-   comb08min: The minimum MPG (comb08) of all of the matches for a particular VIN
-   comb08max: The maximum MPG (comb08) of all of the matches for a particular VIN
-   comb08mean: The arithmetic mean of the comb08 MPG values for all of a VIN's matches
-   comb08range: comb08max - comb08min. What is the range in MPG values across the matched vehicle records? Useful in determining how to incorporate a VIN with multiple matches into the summary statistics.

VIN Decode Data
---------------

A column for each piece of "Identifying Info" in the decoded VIN data:

-   vinMake
-   vinModel
-   vinYear
-   vinFuelTypePrimary
-   vinFuelTypeSecondary
-   vinDisplacement
-   vinTransmissionStyle
-   vinTransmissionSpeed
-   vinCylinders
-   vinDrive

EPA Fuel Efficiency Data
------------------------

The EPA fuel efficiency record of the "selectedMatch". In cases where there were no matches, these fields are empty. In cases of a single match, these fields are the values for that single EPA fuel efficiency record. In cases of multiple matches, these fields are the values for the match with the worst (lowest) "comb08" MPG value. For more information on what each field represents, see[  https://www.fueleconomy.gov/feg/ws/](https://www.fueleconomy.gov/feg/ws/)

Each of these columns is inserted alongside the original record from the VIN input spreadsheet, so that the result spreadsheet includes one long row for each input VIN that includes the original NYS VIN record, the matching results, the VIN decode data, and the EPA fuel efficiency data, if we found at least one match.

Step 5: Analysis + Interpretation
=================================

The matching algorithm provides us with the raw data about match results for each VIN, but we need to go a step further to interpret that data. In the results spreadsheet, I added some more columns to enable calculation of some key summary statistics. These are all in the form of "If" statements that result in a "1" if true and "0" if false.<sup id="a9">[9](#f9)</sup>  These columns and their formulas were added by hand, so they would need to be copy/pasted into subsequent results spreadsheets.

**Has VIN Data**\
True if the "VIN - Make" column has a value. Means that the VIN decoding was successful.

**Has MPG Data**\
True if there is a "comb08" value, the combined MPG provided by the EPA, meaning there was at least one match.

**Has Valid MPG Data**\
True if the VIN has a single match or, in the case of multiple matches, if the field is less than or equal to the maximum "acceptable" range, which is defined in the "Definitions" sheet in the same spreadsheet file.

**Passenger Vehicle**\
True if the vehicle's "Registration Class" field (provided in the input spreadsheet from the NYS registration database) matches one of the known passenger vehicle registration classes, defined in the Definitions table. In addition to "PAS", I also included specialty license plates that also represent passenger vehicles. See[  https://dmv.ny.gov/registration/registration-class-codes](https://dmv.ny.gov/registration/registration-class-codes) for more.

**Sedan/Car/SUV/Truck/Hybrid/EV/Diesel**\
All vehicles eligible to be counted in the standard fleet. Excludes gas vehicles with non-standard body types (defined in the Definitions table). Used in the "sanity check" calculation confirming that the number of vehicles we count when broken down by the types we want to include in the final analysis add up to the "right" number.

**Gas**\
Is the vehicle's primary fuel type one of:

-   Regular
-   Gasoline or E85
-   Premium
-   Gasoline or natural gas
-   Midgrade
-   Premium of E85

**Diesel**\
Is the vehicle's primary fuel type "Diesel"?

**Sedan/Car**\
Is the vehicle's "Body Type" (as provided in the NYS VIN data) one of:

-   2DSD
-   4DSD
-   CONV
-   SEDN

**SUV/Truck**\
Is the vehicle's "Body Type" (as provided in the NYS VIN data) one of:

-   PICK, SUBN

**Sedan/Car (Gas)**\
True if the vehicle is defined as Sedan/Car and has Gas as its primary fuel type. Distinguishes them from Cars that are hybrids or EVs.

**SUV/Truck (Gas)**\
True if the vehicle is defined as SUV/Truck and has Gas as its primary fuel type. Distinguishes them from SUVs that are hybrids or EVs.

**Hybrid**\
True if the vehicle's primary fuel type is one of:<sup id="a10">[10](#f10)</sup> 

-   Premium and Electricity
-   Regular Gas and Electricity
-   Premium Gas or Electricity
-   Regular Gas or Electricity

**EV**\
True if the vehicle's primary fuel type is "Electricity"

The Analysis sheet uses the boolean values calculated for each VIN to count the vehicles in each relevant category and get the average combined MPG values for vehicles in that category.

Click into the cells for each category to see how those values are generated. They are mostly just "SUMIF" formulas that use the relevant boolean category column (e.g. "Sedan/Car (Gas)") as the criterion.

Opportunity for Improvement
===========================

Right now, we're able to decode VINs with over 97% success. The only VINs we don't find tend to be those that are pre-1980.

We're able to find at least one matching EPA fuel efficiency record for 97% of the vehicles we have decoded VIN data for. [Here is a table](https://docs.google.com/spreadsheets/d/1IaZTcA91iSB6RcB0gpevJohhwtRcNA4OXKhswL8OrJ8/edit#gid=0) documenting the makes for which at least one vehicle has missing match data. With such a small number of vehicles missing match data, filling in the gaps likely won't have any effect on fleet-level statistics. However, some of the makes we miss matches for may be of interest to individual viewers of the data (e.g. Hummer, Ferrari, some Cadillacs, etc.).

With an acceptable MPG range of 2 MPG, we have valid MPG data for 84% of the Bedford fleet. With a range of 5 MPG, that goes to 91.5%. With a range of 10 MPG, it goes to just under 97%. I'm not sure just how much better the matching can get without incorporating some additional data. Again, as far as I can tell, we're using all of the identifying info we can get from the VIN decode data that corresponds to any fields in the EPA data. To figure out if there is room to further refine the matching, I would start by looking at vehicles with multiple matches and a wide MPG range, looking closely at the both their decoded VIN data and the matching EPA fuel efficiency records (find them by looking up the IDs in the [master EPA data sheet](https://docs.google.com/spreadsheets/d/15UkETNOtYL0TJRmABzPdeKJTOF1gJy4HysODUjbqnbU/edit#gid=0)) to see if there is any way that they are systematically related that we've missed to this point.

Another possible area of improvement would be refining the logic around rejecting matches in the case of missing NHTSA or EPA data. As mentioned above, it might be better to distinguish cases where both pieces of data exist and are different vs those where one or both pieces of data are missing, so the comparison is inconclusive. That being said, this improvement would only lower the match rate, as we currently use the more permissive approach; allowing matches to stick around if any matcher eliminates all of them.

## Notes

<ol>
  <li id="f1">There are other providers of this data that offer paid APIs for getting fuel efficiency data for a VIN. You may also want to look into these. My initial research found one that looks particularly promising: <a href="https://www.dataonesoftware.com/web-services-vin-decoder-api\")>DataOne Software</a> <a href="#a1"> ↩</a> </li> 
  <li id="f2">In my original algorithm, I generated IDs for each EPA record. However, this is actually not necessary as there is an existing column in the EPA data called “id” that I just missed the first time around. Those IDs are useful as they can be used in the rest of the EPA's web services.<a href="#a2"> ↩</a> </li> 
  <li id="f3">Repeat steps 2-4 for each VIN in the input spreadsheet<a href="#a3"> ↩</a> </li> 
  <li id="f4">In all cases where we're looking for text matches, we first convert all text to lowercase to avoid inconsistencies due to capitalization in the data.<a href="#a4"> ↩</a> </li> 
  <li id="f5">It's possible, though unlikely, that additional pieces of identifying info won't match the exact match that we found. However, in some cases, one or both of the NHTSA and EPA records is missing a particular piece of identifying info. This would result in a record being filtered out because the two "don't match", resulting in many cases of an accurate individual match being thrown out. Because of this, the current algorithm ignores the issue and takes the single match as-is. The algorithm does this because it assumes that having some closely-related fuel efficiency data points is better than having no fuel efficiency data all. A future version of the algorithm could more specifically tease apart this issue and "unmatch" a single match only if both data sources have an additional piece of identifying info and they do not match. In the current algorithm, we take the more permissive approach.<a href="#a5"> ↩</a> </li> 
  <li id="f6">The NHTSA drive type actually includes the extra space after the “/”<a href="#a6"> ↩</a> </li> 
  <li id="f7">The NHTSA data has one field for Transmission Style and another for Transmission Speeds, but the EPA data only has a single field containing both values.<a href="#a7"> ↩</a> </li> 
  <li id="f8">You can use a site like https://regexr.com/ to learn about Regular Expressions and try them out.<a href="#a8"> ↩</a> </li> 
  <li id="f9">Not a column, but another important definition is "Valid MPG Data”. When used in the analysis, it refers to a VIN with an exact match, a “comb08range” within the acceptable range, or an EV. We include EVs with any MPG data since a significant number of them have large comb08 ranges, but they don't actually use any gas so including them doesn't invalidate the data.<a href="#a9"> ↩</a> </li> 
  <li id="f10">The EPA is not consistent in how it defines the fuel type of hybrid vehicles. As far as I can tell, however, using fuel type is the only way to determine if a vehicle is likely a hybrid or not.<a href="#a10"> ↩</a> </li> 
</ol>

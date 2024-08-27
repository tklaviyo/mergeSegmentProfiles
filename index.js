const express = require("express")
const app = express()
const port = 5000
const axios = require("axios")

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.get("/run", async (req, res) => {
  // Update these variables with your Klaviyo API key and Segment ID
  const KLAVIYO_API_KEY = "PRIVATE_API_KEY"
  const SEGMENT_ID = "SEGMENT_ID"

  if (!KLAVIYO_API_KEY) {
    return res
      .status(500)
      .json({ success: false, error: "API key not configured" })
  }

  async function getSegmentProfiles(segmentId) {
    let url = `https://a.klaviyo.com/api/segments/${segmentId}/profiles/`
    const headers = {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      revision: "2024-07-15",
    }

    const profiles = []

    try {
      while (url) {
        const response = await axios.get(url, { headers })
        profiles.push(...response.data.data)
        url = response.data.links?.next || null
      }
    } catch (error) {
      console.error(
        "Error fetching segment profiles:",
        error.response?.data || error.message
      )
      throw error
    }

    return profiles
  }

  async function findMatchingProfile(phoneNumber) {
    const url = `https://a.klaviyo.com/api/profiles/?filter=equals(phone_number,"${phoneNumber}")`
    const headers = {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
      Accept: "application/json",
      revision: "2024-07-15",
    }

    try {
      const response = await axios.get(url, { headers })
      return response.data.data[0] || null
    } catch (error) {
      console.error(
        "Error finding matching profile:",
        error.response?.data || error.message
      )
      throw error
    }
  }

  async function mergeProfiles(destinationProfileId, sourceProfileId) {
    const url = "https://a.klaviyo.com/api/profile-merge/"
    const headers = {
      Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      revision: "2024-07-15",
    }
    const data = {
      data: {
        type: "profile-merge",
        id: destinationProfileId,
        relationships: {
          profiles: {
            data: [
              {
                type: "profile",
                id: sourceProfileId,
              },
            ],
          },
        },
      },
    }

    try {
      const response = await axios.post(url, data, { headers })
      console.log(
        `Merged profiles: ${destinationProfileId} (destination) and ${sourceProfileId} (source)`
      )
      return response.data
    } catch (error) {
      console.error(
        "Error merging profiles:",
        error.response?.data || error.message
      )
      throw error
    }
  }

  try {
    const segmentProfiles = await getSegmentProfiles(SEGMENT_ID)

    for (const segmentProfile of segmentProfiles) {
      const segmentProfileId = segmentProfile.id
      const segmentProfilePhone = segmentProfile.attributes.phone_number

      if (segmentProfilePhone) {
        const matchingProfile = await findMatchingProfile(segmentProfilePhone)

        if (matchingProfile && matchingProfile.id !== segmentProfileId) {
          console.log(`Found matching profiles:`)
          console.log(`Segment Profile ID: ${segmentProfileId}`)
          console.log(`Matching Profile ID: ${matchingProfile.id}`)

          try {
            await mergeProfiles(matchingProfile.id, segmentProfileId)
            console.log("Profiles merged successfully")
          } catch (mergeError) {
            console.error("Failed to merge profiles:", mergeError.message)
          }

          console.log("---")
        }
      }
    }

    res.json({
      success: true,
      message:
        "Profile matching and merging completed. Check console for results.",
    })
  } catch (error) {
    console.error("Error:", error.message)
    res.status(500).json({ success: false, error: "Error processing profiles" })
  }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

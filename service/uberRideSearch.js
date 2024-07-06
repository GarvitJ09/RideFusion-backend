const { chromium } = require("playwright");
const fs = require("fs/promises");

const constructUberUrl = (
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude
) => {
  return `https://m.uber.com/go/product-selection?drop[0]={"latitude":${dropLatitude},"longitude":${dropLongitude}}&pickup={"latitude":${pickupLatitude},"longitude":${pickupLongitude}}`;
};

const startRideSearch = async (req, res) => {
  const {
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude,
    rideId,
  } = req.body;

  if (
    !pickupLatitude ||
    !pickupLongitude ||
    !dropLatitude ||
    !dropLongitude ||
    !rideId
  ) {
    return res
      .status(400)
      .json({ error: "Missing required query parameters." });
  }

  try {
    const fareEstimates = await selectAndRequestRide(
      pickupLatitude,
      pickupLongitude,
      dropLatitude,
      dropLongitude,
      rideId
    );
    res.json(fareEstimates);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request." });
  }
};

const selectAndRequestRide = async (
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude,
  rideId
) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    let authData = null;
    try {
      const data = await fs.readFile("auth_data.json", "utf-8");
      authData = JSON.parse(data);
      console.log("Authentication data loaded from auth_data.json");
    } catch (err) {
      console.log("No previous authentication data found.");
    }

    if (authData && authData.cookies) {
      await context.addCookies(authData.cookies);
      console.log("Cookies restored from auth_data.json");
    }

    const page = await context.newPage();

    page.on("framenavigated", async (frame) => {
      const url = frame.url();
      if (url.includes("m.uber.com/go/")) {
        const cookies = await context.cookies();
        const authData = {
          url: url,
          cookies: cookies,
          timestamp: new Date().toISOString(),
        };
        await fs.writeFile("auth_data.json", JSON.stringify(authData, null, 2));
        console.log(`Authentication data saved to auth_data.json`);
      }
    });

    const url = constructUberUrl(
      pickupLatitude,
      pickupLongitude,
      dropLatitude,
      dropLongitude
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
    console.log("Navigation to product selection page successful.");
    await page.waitForTimeout(10000);

    // Wait for the ul element to appear on the page
    await page.waitForSelector("ul._css-jlxUSy", { timeout: 6000 });

    // Click the ride based on the rideId (only if rideId is provided and valid)
    if (rideId == 2007) {
      await page.click(`li[data-itemid="${rideId}"]`);
      console.log(`Clicked on the ride with rideId: ${rideId}`);
    }

    // Wait for the "Request Uber Auto" button to appear and click it
    await page.waitForSelector('button[data-testid="request_trip_button"]', {
      timeout: 5000,
    });
    await page.click('button[data-testid="request_trip_button"]');
    console.log(`Clicked on the "Request Uber Auto" button`);

    // Additional steps to complete the ride request can be added here
    await page.waitForTimeout(5000); // Example wait for 2 seconds to see the effect

    return { message: "Ride search initiated successfully." };
  } catch (error) {
    console.error("Error:", error);
    throw new Error("An error occurred while processing the request.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  startRideSearch,
};

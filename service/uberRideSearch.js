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
    const context = await browser.newContext({
      storageState: "uber_auth_data.json",
    });

    const page = await context.newPage();

    const url = constructUberUrl(
      pickupLatitude,
      pickupLongitude,
      dropLatitude,
      dropLongitude
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 6000 });
    console.log("Navigation to product selection page successful.");

    // Wait for the ul element to appear on the page
    await page.waitForSelector("ul._css-jlxUSy", { timeout: 6000 });

    // Click the ride based on the rideId (only if rideId is provided and valid)
    if (rideId != 2007) {
      await highlightAndClick(page, `li[data-itemid="${rideId}"]`);
      console.log(`Clicked on the ride with rideId: ${rideId}`);
    }

    // Wait for the "Request Uber Auto" button to appear and click it
    await page.waitForSelector('button[data-testid="request_trip_button"]', {
      timeout: 6000,
    });
    await highlightAndClick(page, 'button[data-testid="request_trip_button"]');
    console.log(`Clicked on the "Request Uber Auto" button`);

    // Wait until either user details or error message appears
    const userDetailsSelector = 'div[data-baseweb="block"] > h4._css-jfZXzu';
    const noDriverTextSelector = "div._css-xyzabc"; // Replace with actual selector for "No driver available" text

    await Promise.race([
      page.waitForSelector(userDetailsSelector, { timeout: 6000 }),
      page.waitForSelector(noDriverTextSelector, { timeout: 6000 }),
    ]);

    let rideDetails = null;

    // Check if user details are found
    const userDetailsElement = await page.$(userDetailsSelector);
    if (userDetailsElement) {
      await highlight(page, userDetailsSelector);

      const rideNumber = await page.textContent("h4._css-jfZXzu");
      const riderName = await page.textContent("div._css-gpCJFN");
      const vehicleType = await page.textContent("p._css-iCSGwJ");
      const waitingMinutes = await page.textContent("div._css-jpCcoT");

      rideDetails = {
        rideNumber,
        riderName,
        vehicleType,
        waitingMinutes,
      };

      console.log("Extracted ride data:", rideDetails);
    } else {
      // Handle case where no driver is available
      throw new Error("No driver available or unable to find user details.");
    }

    return rideDetails;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("An error occurred while processing the request.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

async function highlightAndClick(page, selector) {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.style.border = "2px solid red";
    }
  }, selector);
  await page.waitForTimeout(2000);
  await page.click(selector);
}

async function highlight(page, selector) {
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.style.border = "2px solid red";
    }
  }, selector);
  await page.waitForTimeout(2000);
}

module.exports = {
  startRideSearch,
};

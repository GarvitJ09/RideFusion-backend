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

const getUberFareEstimates = async (req, res) => {
  const { pickupLatitude, pickupLongitude, dropLatitude, dropLongitude } =
    req.query;

  if (!pickupLatitude || !pickupLongitude || !dropLatitude || !dropLongitude) {
    return res.status(400).send("Missing required query parameters.");
  }

  try {
    const fareEstimates = await scrapeUberFareEstimates(
      pickupLatitude,
      pickupLongitude,
      dropLatitude,
      dropLongitude
    );
    res.json(fareEstimates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const scrapeUberFareEstimates = async (
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude
) => {
  const url = constructUberUrl(
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude
  );
  let browser;

  try {
    browser = await chromium.launch({
      headless: false,
    });
    const context = await browser.newContext();

    let authData = null;
    try {
      const data = await fs.readFile("uber_auth_data.json", "utf-8");
      authData = JSON.parse(data);
      console.log("Authentication data loaded from uber_auth_data.json");
    } catch (err) {
      console.log("No previous authentication data found.");
    }

    if (authData && authData.cookies) {
      await context.addCookies(authData.cookies);
      console.log("Cookies restored from uber_auth_data.json");
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
        await fs.writeFile(
          "uber_auth_data.json",
          JSON.stringify(authData, null, 2)
        );
        console.log(`Authentication data saved to uber_auth_data.json`);
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Retry logic with reduced timeout
    let retries = 5;
    let data = null;
    while (retries > 0) {
      try {
        await page.waitForSelector("ul._css-jlxUSy", { timeout: 6000 });
        data = await page.evaluate(() => {
          const rides = [];
          const uberData = [];
          document
            .querySelectorAll(
              'ul._css-jlxUSy > li[data-testid="product_selector.list_item"] > div._css-zSrrc'
            )
            .forEach((element) => {
              const rideId = element
                .closest('li[data-testid="product_selector.list_item"]')
                .getAttribute("data-itemid");
              const uberGoText = element ? element.innerText : "No data found";
              uberData.push({ rideId, uberGoText });
            });

          const parseRideData = (ride) => {
            const parts = ride.uberGoText.split("\n\n");
            const rideType = parts[0].replace(/\d+$/, ""); // Remove trailing numbers
            const description = parts[2];
            const price = parts[3].startsWith("₹") ? parts[3] : "Unavailable";

            return { rideId: ride.rideId, rideType, price, description };
          };

          const parsedRides = uberData.map(parseRideData);

          return parsedRides;
        });

        if (data) {
          break; // Exit retry loop if data is successfully retrieved
        }
      } catch (error) {
        console.error(`Retry ${4 - retries} failed:`, error.message);
        retries--;
        await page.waitForTimeout(2000); // Wait before retrying
      }
    }

    if (!data) {
      throw new Error("Failed to fetch Uber fare estimates after retries.");
    }

    console.log("Scraped Data:", data);
    return data;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("An error occurred while scraping data");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  getUberFareEstimates,
};

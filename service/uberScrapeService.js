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

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
    await page.waitForTimeout(12000);
    console.log("Navigation to product selection page successful.");

    await page.waitForSelector("div._css-zSrrc");

    const data = await page.evaluate(() => {
      const rides = [];
      const uberData = [];
      const uberGoElement = document.querySelectorAll("div._css-zSrrc", {
        timeout: 6000,
      });
      for (var i = 0; i < uberGoElement.length; i++) {
        const uberGoText = uberGoElement[i]
          ? uberGoElement[i].innerText
          : "No data found";
        uberData.push(uberGoText);
      }

      const parseRideData = (rideString) => {
        const parts = rideString.split("\n\n");
        const rideType = parts[0].replace(/\d+$/, ""); // Remove trailing numbers
        const description = parts[2];
        const price = parts[3].startsWith("₹") ? parts[3] : "Unavailable";

        return { rideType, price, description };
      };

      const parsedRides = uberData.map(parseRideData);

      return parsedRides;
    });

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

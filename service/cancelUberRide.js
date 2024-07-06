const { chromium } = require("playwright");
const fs = require("fs/promises");

const cancelUberRide = async (req, res) => {
  try {
    const cancellationStatus = await cancelRide();
    res.json({ message: cancellationStatus });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while cancelling the ride." });
  }
};

const cancelRide = async () => {
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
      if (url.includes("m.uber.com/go/on-trip")) {
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

    // Construct cancellation URL
    const url = `https://m.uber.com/go/on-trip`;

    // Navigate to the cancellation page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
    console.log("Navigation to cancellation page successful.");
    await page.waitForTimeout(10000);

    // Wait for the "Cancel" button to appear and click it
    await page.waitForSelector('button[data-baseweb="button"]._css-jnfpen', {
      timeout: 5000,
    });
    await page.click('button[data-baseweb="button"]._css-jnfpen');
    console.log(`Clicked on the "Cancel" button`);

    // Wait for the "YES, CANCEL" button to appear and click it
    await page.waitForSelector(
      'button[data-baseweb="button"][data-tracking-name="cancel_ride"]',
      {
        timeout: 5000,
      }
    );
    await page.click(
      'button[data-baseweb="button"][data-tracking-name="cancel_ride"]'
    );
    console.log(`Clicked on the "YES, CANCEL" button`);

    // Additional steps to confirm cancellation can be added here
    await page.waitForTimeout(5000); // Example wait for 5 seconds to see the effect

    return "Ride cancellation initiated successfully.";
  } catch (error) {
    console.error("Error:", error);
    throw new Error(
      "An error occurred while processing the cancellation request."
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  cancelUberRide,
};

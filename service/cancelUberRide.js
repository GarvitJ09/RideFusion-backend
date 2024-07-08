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
      if (url.includes("m.uber.com/go/on-trip")) {
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

    // Construct cancellation URL
    const url = `https://m.uber.com/go/on-trip`;

    // Navigate to the cancellation page
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
    console.log("Navigation to cancellation page successful.");

    // Wait for the "Cancel" button to appear and click it (with retry)
    const cancelBtnSelector = 'button[data-baseweb="button"]._css-jnfpen';
    await page.waitForSelector(cancelBtnSelector, { timeout: 6000 });
    await retryClick(page, cancelBtnSelector);

    console.log(`Clicked on the "Cancel" button`);

    // Wait for the "YES, CANCEL" button to appear and click it (with retry)
    const confirmBtnSelector =
      'button[data-baseweb="button"][data-tracking-name="cancel_ride"]';
    await page.waitForSelector(confirmBtnSelector, { timeout: 6000 });
    await retryClick(page, confirmBtnSelector);

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

// Helper function to retry clicking an element until success or max retries
const retryClick = async (page, selector, maxRetries = 3) => {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await page.click(selector);
      return;
    } catch (error) {
      retries++;
      console.log(
        `Attempt ${retries} failed to click ${selector}. Retrying...`
      );
      await page.waitForTimeout(2000); // Wait before retrying
    }
  }
  throw new Error(`Failed to click ${selector} after ${maxRetries} retries.`);
};

module.exports = {
  cancelUberRide,
};

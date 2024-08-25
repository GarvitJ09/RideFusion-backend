const { chromium } = require("playwright");
const fs = require("fs/promises");

const cancelOlaRide = async (req, res) => {
  const { rideUrl } = req.body;

  if (!rideUrl) {
    return res.status(400).json({ error: "Missing required URL parameter." });
  }

  try {
    const cancellationStatus = await cancelRide(rideUrl);
    res.json({ message: cancellationStatus });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while cancelling the ride." });
  }
};

const cancelRide = async (rideUrl) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    let authData = null;
    try {
      const data = await fs.readFile("ola_auth_data.json", "utf-8");
      authData = JSON.parse(data);
      console.log("Authentication data loaded from ola_auth_data.json");
    } catch (err) {
      console.log("No previous authentication data found.");
    }

    if (authData && authData.cookies) {
      await context.addCookies(authData.cookies);
      console.log("Cookies restored from ola_auth_data.json");
    }

    const page = await context.newPage();

    // Navigate to the ride URL
    await page.goto(rideUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
    console.log("Navigation to ride page successful.");
    await page.waitForTimeout(10000);

    // Check if the page contains the "Cancel Ride" button for in-progress scenario
    const inProgressCancelBtnSelector = "#icon .ola-svg.ola-icon";
    let cancelRideElement = await page.$(inProgressCancelBtnSelector);

    if (cancelRideElement) {
      // Click the in-progress cancel button
      await cancelRideElement.click();
      console.log(`Clicked on the in-progress "Cancel Ride" button`);

      // Wait for and click the confirmation button
      const confirmCancelBtnSelector = "#ok.dialog-button.info";
      await page.waitForSelector(confirmCancelBtnSelector, { timeout: 6000 });
      await page.click(confirmCancelBtnSelector);
      console.log(`Clicked on the "Yes" button to confirm cancellation`);
    } else {
      // Check if the page contains the "Cancel Ride" button for booking confirmed scenario
      const confirmedCancelBtnSelector = "div.right.text.value.text-danger";
      cancelRideElement = await page.$(confirmedCancelBtnSelector);

      if (!cancelRideElement) {
        throw new Error("Cancel button not found in either scenario.");
      }

      // Click the booking confirmed cancel button
      await cancelRideElement.click();
      console.log(`Clicked on the booking confirmed "Cancel Ride" button`);
    }

    // Additional steps to confirm cancellation can be added here
    await page.waitForTimeout(10000); // Example wait for 10 seconds to see the effect

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
  cancelOlaRide,
};

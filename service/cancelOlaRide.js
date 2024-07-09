const { chromium } = require('playwright');
const fs = require('fs/promises');

const cancelOlaRide = async (req, res) => {
  try {
    const cancellationStatus = await cancelRide();
    res.json({ message: cancellationStatus });
  } catch (error) {
    console.error('Error:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while cancelling the ride.' });
  }
};

const cancelRide = async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    let authData = null;
    try {
      const data = await fs.readFile('ola_auth_data.json', 'utf-8');
      authData = JSON.parse(data);
      console.log('Authentication data loaded from ola_auth_data.json');
    } catch (err) {
      console.log('No previous authentication data found.');
    }

    if (authData && authData.cookies) {
      await context.addCookies(authData.cookies);
      console.log('Cookies restored from ola_auth_data.json');
    }

    const page = await context.newPage();

    // Construct ride details URL
    const url = `https://www.olacabs.com`;

    // Navigate to the ride details page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('Navigation to ride details page successful.');

    // Wait for and click the "Don't allow" button
    const dontAllowBtnSelector = 'a.ptr.link:has-text("Don\'t allow")';
    await page.waitForSelector(dontAllowBtnSelector, { timeout: 6000 });
    await page.click(dontAllowBtnSelector);
    console.log(`Clicked on the "Don't allow" button`);

    // Wait for and click the "Cancel Ride" button
    const cancelRideBtnSelector =
      'div.card.bg-white div.row.ptr:has-text("Cancel Ride")';
    await page.waitForSelector(cancelRideBtnSelector, { timeout: 6000 });
    await page.click(cancelRideBtnSelector);
    console.log(`Clicked on the "Cancel Ride" button`);

    // Additional steps to confirm cancellation can be added here
    await page.waitForTimeout(5000); // Example wait for 5 seconds to see the effect

    return 'Ride cancellation initiated successfully.';
  } catch (error) {
    console.error('Error:', error);
    throw new Error(
      'An error occurred while processing the cancellation request.'
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

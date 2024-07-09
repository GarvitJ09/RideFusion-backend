const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const fs = require('fs/promises');

const constructOlaUrl = (
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude
) => {
  return `https://book.olacabs.com/?lat=${pickupLatitude}&lng=${pickupLongitude}&pickup=&drop_lat=${dropLatitude}&drop_lng=${dropLongitude}`;
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
      .json({ error: 'Missing required query parameters.' });
  }

  try {
    const rideDetails = await selectAndRequestRide(
      pickupLatitude,
      pickupLongitude,
      dropLatitude,
      dropLongitude,
      rideId
    );
    res.json(rideDetails);
  } catch (error) {
    console.error('Error:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while processing the request.' });
  }
};

const selectAndRequestRide = async (
  pickupLatitude,
  pickupLongitude,
  dropLatitude,
  dropLongitude,
  rideId
) => {
  const url = constructOlaUrl(
    pickupLatitude,
    pickupLongitude,
    dropLatitude,
    dropLongitude
  );
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

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 16000 });
    console.log('Navigation to Ola booking page successful.');

    const reloadSelector = '#ok.dialog-button.danger';
    const reloadElement = await page.$(reloadSelector);

    if (reloadElement) {
      await page.click(reloadSelector);
      console.log("Clicked 'Reload' button.");
    }

    // Check login status
    const loginElement = await page.$('span#login');

    if (loginElement) {
      console.log('User needs to log in. Clicking on the login button.');

      // Click the login button
      await page.click('span#login');
      await page.pause();

      // Wait for the user to log in manually
      await page.waitForNavigation({
        timeout: 60000,
        waitUntil: 'networkidle',
      });

      await page.waitForSelector('#loggedIn', { timeout: 6000 });

      // After manual login, save cookies
      const cookies = await context.cookies();
      const authData = {
        url: page.url(),
        cookies: cookies,
        timestamp: new Date().toISOString(),
      };
      await fs.writeFile(
        'ola_auth_data.json',
        JSON.stringify(authData, null, 2)
      );
      console.log(`Authentication data saved to ola_auth_data.json`);

      // Navigate to the main URL again
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    const cookies = await context.cookies();
    const auth = {
      url: url,
      cookies: cookies,
      timestamp: new Date().toISOString(),
    };
    await fs.writeFile('ola_auth_data.json', JSON.stringify(auth, null, 2));
    console.log(`Authentication data updated to ola_auth_data.json`);
    await page.waitForTimeout(10000);

    // Wait for the main container to appear
    await page.waitForSelector('div.card.car-cont.bg-white.when-NOW', {
      timeout: 10000,
    });

    await page.click(
      `div.card.car-cont.bg-white.when-NOW > div:nth-child(${rideId})`
    );

    // Wait for the Confirm & Book button to appear and click it
    await page.waitForSelector(
      'button.nxt-btn-active.ola-ripple.next-btn-pos',
      { timeout: 5000 }
    );
    await page.click('button.nxt-btn-active.ola-ripple.next-btn-pos');
    console.log('Clicked Confirm & Book button.');

    // Wait for a while to see if the "Don't allow" link appears and click it if present

    // Retry mechanism for waiting driver details
    const maxDriverRetries = 20;
    let driverRetries = 0;
    let driverDetails = null;

    while (driverRetries < maxDriverRetries) {
      try {
        const dontAllowSelector = 'a.ptr.link';
        const dontAllowElement = await page.$(dontAllowSelector);

        if (dontAllowElement) {
          await page.click('a.ptr.link');
          console.log("Clicked 'Don't allow' link.");
        }
        // Wait for the driver details to appear
        await page.waitForSelector('a.row[href^="tel"]', { timeout: 6000 });
        await page.waitForSelector('div.cards-container.ptr.show-false', {
          timeout: 6000,
        });

        // Extract the driver details
        const driverDetailsResult = await page.$eval(
          'a.row[href^="tel"]',
          (el) => {
            return {
              riderName: el
                .querySelector('div.middle.value.two-lines.name-lab div.bold')
                .textContent.trim(),
              riderRating: el
                .querySelector(
                  'div.middle.value.two-lines.name-lab div.driver-rating-value'
                )
                .textContent.trim(),
              driverImage: el.querySelector('div.left.label img.bg-cover').src,
              rideNumber: el.getAttribute('href').replace('tel:', ''),
            };
          }
        );

        const vehicleDetails = await page.$eval(
          'div.cards-container.ptr.show-false div.row div.middle.value.text.two-lines',
          (el) => {
            return {
              vehicleModel: el.children[0].textContent.trim(),
              vehicleType: el.children[1].textContent.trim(),
            };
          }
        );

        const vehicleNumber = await page.$eval(
          'div.cards-container.ptr.show-false div.row div.far-right.cab-number',
          (el) => {
            return {
              vehicleNumber:
                el.children[0].textContent.trim() +
                el.children[1].textContent.trim(),
            };
          }
        );

        driverDetails = {
          ...vehicleDetails,
          ...vehicleNumber,
          ...driverDetailsResult,
        };

        console.log('Extracted ride data:', driverDetails);
        break; // Exit the retry loop if successful
      } catch (error) {
        driverRetries++;
        console.log(`Attempt ${driverRetries} failed to find driver details.`);
        if (driverRetries === maxDriverRetries) {
          throw new Error('Failed to retrieve driver details after retries.');
        }
        await page.waitForTimeout(3000); // Wait before retrying
      }
    }
    const cancelRideSelector = 'div.right.text.value.text-danger';
    const cancelRideElement = await page.$(cancelRideSelector);

    if (cancelRideElement) {
      await page.click('div.right.text.value.text-danger');
      console.log('Clicked on cancel ride');
    }
    // Wait for the driver details to appear
    await page.waitForSelector('a.row[href^="tel"]', { timeout: 6000 });
    await page.waitForSelector('div.cards-container.ptr.show-false', {
      timeout: 6000,
    });
    await page.waitForTimeout(30000);
    return driverDetails; // Return the extracted driver details
  } catch (error) {
    console.error('Error:', error);
    throw new Error('An error occurred while scraping Ola ride options');
  } finally {
    if (browser) {
      // await browser.close();
    }
  }
};

module.exports = {
  startRideSearch,
};

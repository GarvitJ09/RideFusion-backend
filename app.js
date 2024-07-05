const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs/promises');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

app.get('/scrape', async (req, res) => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    // Check if auth_data.json exists
    let authData = null;
    try {
      const data = await fs.readFile('auth_data.json', 'utf-8');
      authData = JSON.parse(data);
      console.log('Authentication data loaded from auth_data.json');
    } catch (err) {
      console.log('No previous authentication data found.');
    }

    if (authData && authData.cookies) {
      await context.addCookies(authData.cookies);
      console.log('Cookies restored from auth_data.json');
    }

    const page = await context.newPage();

    // Monitor URL changes
    page.on('framenavigated', async (frame) => {
      const url = frame.url();
      if (url.includes('m.uber.com/go/')) {
        // Example: Get cookies
        const cookies = await context.cookies();

        // Save authentication data as JSON
        const authData = {
          url: url,
          cookies: cookies,
          timestamp: new Date().toISOString(),
        };

        // Save JSON to a file
        const fileName = 'auth_data.json';
        await fs.writeFile(fileName, JSON.stringify(authData, null, 2));
        console.log(`Authentication data saved to ${fileName}`);
      }
    });

    // Navigate to Uber mobile website
    await page.goto(
      'https://m.uber.com/go/product-selection?drop[0]={"latitude":12.9788206,"longitude":77.7148979}&pickup={"latitude":12.9237022,"longitude":77.6641198}'
    );
    console.log('Navigation to product selection page successful.');

    // Wait for the desired element to appear on the page
    await page.waitForSelector('div._css-zSrrc');

    // Extract the desired data from all div._css-zSrrc elements
    const data = await page.evaluate(() => {
      const rides = [];
      const uberData = [];
      const uberGoElement = document.querySelectorAll('div._css-zSrrc');
      for (var i = 0; i < uberGoElement.length; i++) {
        const uberGoText = uberGoElement[i]
          ? uberGoElement[i].innerText
          : 'No data found';
        uberData.push(uberGoText);
      }

      const parseRideData = (rideString) => {
        const parts = rideString.split('\n\n');
        const rideType = parts[0].replace(/\d+$/, ''); // Remove trailing numbers
        const description = parts[2];
        const price = parts[3].startsWith('₹') ? parts[3] : 'Unavailable';

        return { rideType, price, description };
      };

      const parsedRides = uberData.map(parseRideData);

      return parsedRides;
    });

    console.log('Scraped Data:', data);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while scraping data' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

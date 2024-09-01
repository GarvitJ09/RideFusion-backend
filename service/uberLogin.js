const { chromium } = require('playwright');
const fs = require('fs/promises');

const performLogin = async (req, resOrWs) => {
  let browser;
  let context;
  let page;

  const isWebSocket =
    typeof resOrWs.send === 'function' && typeof resOrWs.json !== 'function';

  try {
    browser = await chromium.launch({
      headless: false,
    });
    context = await browser.newContext();

    let authData = null;
    try {
      const data = await fs.readFile('uber_auth_data.json', 'utf-8');
      authData = JSON.parse(data);
      console.log('Authentication data loaded from uber_auth_data.json');
    } catch (err) {
      console.log('No previous authentication data found.');
    }

    if (authData && authData.cookies) {
      await context.addCookies(authData.cookies);
      console.log('Cookies restored from uber_auth_data.json');
    }

    page = await context.newPage();

    let loginResult = { success: false, message: 'Login process started' };

    page.on('framenavigated', async (frame) => {
      const url = frame.url();
      if (url.includes('m.uber.com/go/')) {
        const cookies = await context.cookies();
        const authData = {
          url: url,
          cookies: cookies,
          timestamp: new Date().toISOString(),
        };
        await fs.writeFile(
          'uber_auth_data.json',
          JSON.stringify(authData, null, 2)
        );
        console.log(`Authentication data saved to uber_auth_data.json`);
        loginResult = {
          success: true,
          message: 'Login successful and data saved',
        };
        if (isWebSocket) {
          resOrWs.send(JSON.stringify(loginResult));
        } else {
          resOrWs.json(loginResult);
        }
      }
    });

    await page.goto('https://m.uber.com/go/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    if (isWebSocket) {
      resOrWs.send(JSON.stringify(loginResult));
    } else {
      resOrWs.json(loginResult);
    }
  } catch (error) {
    console.error('Error:', error);
    const errorResponse = {
      success: false,
      message: 'An error occurred during login',
    };
    if (isWebSocket) {
      resOrWs.send(JSON.stringify(errorResponse));
    } else {
      resOrWs.status(500).json(errorResponse);
    }
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
};

module.exports = {
  performLogin,
};

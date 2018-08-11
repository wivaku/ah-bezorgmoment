#!/usr/local/bin/node

/**
 * @file Goes to Albert Heijn website, gets the upcoming delivery details and returns parsed results
 * @author Winfred van Kuijk <wivaku@gmail.com>
 * @version 1.0.0
 * 
 */

/** @constant {object} CREDS the Albert Heijn user credentials*/
const CREDS = require('./creds');

/** @constant {object} CONFIG user settings (screenshot, JSON file, PDF) */
const CONFIG = require('./config');

/** the various URL's */
const URLBASE = 'https://www.ah.nl'
const URLLOGIN = '/mijn/inloggen'
const URLORDERS = '/producten/eerder-gekocht/bestellingen'
const URLORDERDETAILS = '/producten/eerder-gekocht/bestelling/print?orderno='

/** load the modules */
const puppeteer = require('puppeteer'); // https://github.com/GoogleChrome/puppeteer
const moment = require('moment'); // https://momentjs.com
const fs = require('fs');

/**
 * Parse the strings from the website and create object with relevant delivery and change details
 * @param {object} scraped The scraped details: {deliveryDetails, changeDetails, orderUrl, orderNumber}
 * 
 * @returns {object} details The order details
 * 
 */
function parseOrderResults(scraped) {
	let details = { 
		label:null,
		date:null, from:null, to:null, range:null, 
		changeUntil:null, 
		timestamp:null,
		address:null, 
		url:null,
		screenshot:null,
		pdf:null,
		// strings: {} 
	}
	let strings = {
		date:null, from: null, to:null, changeUntil:null
	}
	
	// deliveryDetails
	regex = /(.*20\d\d).(\d{2}:\d{2}) - (\d{2}:\d{2}), (.*)/gm;
	// 'Zaterdag 18 aug. 2018 16:00 - 18:00, My street 1234, City'
	m = regex.exec(scraped.deliveryDetails)
	
	if (m && m[1]) {
		strings.date = m[1]
		strings.from = m[2]
		strings.to = m[3]
		details.address = m[4]
	}
	
	// changeDetails
	regex = /Nog te wijzigen tot (.*?), (.*)/gm;
	// 'Nog te wijzigen tot vrijdag, 17 augustus 2018, 23:59'
	m = regex.exec(scraped.changeDetails)
	
	if(m && m[2]) {
		strings.changeUntil = m[2]
		changeUntil = moment(strings.changeUntil, "DD MMMM YYYY, HH:mm")
		details.changeUntil = changeUntil.toISOString(true)
	}
	
	// parse the various strings
	moment.locale('nl')
	from = moment(strings.date +" "+ strings.from, "dddd DD MMM. YYYY HH:mm")
	to = moment(strings.date +" "+ strings.to, "dddd DD MMM. YYYY HH:mm")
	
	details.label = from.format('dddd D MMMM (HH:mm - ') + to.format('HH:mm)')
	details.date = from.format('YYYY-MM-DD')
	details.from = from.toISOString(true)
	details.to = to.toISOString(true)
	details.range = from.isValid() && to.isValid() ? to.diff(from,'minutes') : null

	// store the details
	details.source = {deliveryDetails:scraped.deliveryDetails, changeDetails:scraped.changeDetails}
	// details.url = `${URLBASE}${URLORDERS}`
	details.url = scraped.orderUrl
	details.strings = strings
	details.timestamp = moment().toISOString(true)

	// optional elements
	details.pdf = CONFIG.orderpdf ? CONFIG.orderpdf.split("/").pop() : null
	details.screenshot = CONFIG.screenshot ? CONFIG.screenshot.split("/").pop() : null
	
	return details
}


/**
 * Use Puppeteer (headless Chrome) to mimic regular browser logging in + checking order details
 * 
 * @returns {string} the parsed order details
 */
(async () => {
	if (!CREDS.username) {
		console.error('check/create creds.js: should contain "username" and "password"')
		return
	}

	let launchSettings = {
		// executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome', // your mileage may vary
		// args: [ '--disable-extensions' ],
		// devtools: true, // shows browser + devtools
		// headless: false, // shows browser
	}
	if (CONFIG.debug) launchSettings.devtools = true

	const browser = await puppeteer.launch(launchSettings);

	// login
	// const page = await browser.newPage();
	const pages = await browser.pages()
	const page = pages.length ? pages[0] : await browser.newPage()
	await page.goto(`${URLBASE}${URLLOGIN}?ref=${URLORDERS}`).catch(e => console.error(e));

	await page.waitFor(".login-form");
	await page.type("#username", CREDS.username);
	await page.type("#password", CREDS.password);
	await page.click('.login-form button');

	// wait until we get the articles (future and previous orders), or login error
	await page.waitFor('.login-form__error, article')

	// store as screenshot
	if (CONFIG.screenshot) {
		await page.screenshot({path: CONFIG.screenshot, fullPage: false});
	}

	// check if the login failed: get the error message on the screen
	const errorMsg = await page.$eval('.login-form__error', el => el.innerText).catch(e => { return });
	if (errorMsg) {
		console.error(errorMsg)
		console.log('creds.js username: '+CREDS.username)
		await browser.close();
		return
	}

	// check if there are open orders
	const openOrders = await page.$x("//h3[contains(text(),'Nog te leveren bestellingen')]");

	if (openOrders.length) {
		// read available details
		const scraped = {
			deliveryDetails: await page.$eval('article a h2', el => el.innerText),
			changeDetails: await page.$eval('article a p', el => el.innerText),
			orderUrl: await page.$eval(`article div a[href*="${URLORDERS}"]`, el => el.href),
		}
		scraped.orderNumber = scraped.orderUrl.split("/").pop();

		// parse these details
		const details = parseOrderResults(scraped)
		if (CONFIG.outputjson) {
			fs.writeFileSync(CONFIG.outputjson, JSON.stringify(details, null, 2) , 'utf-8'); 
		}
		// console.log(details)
		console.log(JSON.stringify(details))

		// create PDF of the order - will fail if not headless (e.g. devtools)
		if (CONFIG.orderpdf) {
			const pagePdf = await browser.newPage();
			await pagePdf.goto(`${URLBASE}${URLORDERDETAILS}${scraped.orderNumber}`, {waitUntil: 'networkidle0'});

			// remove the background color
			pagePdf.addStyleTag({content:'body { background-color: transparent !important }'})

			if (!CONFIG.debug) await pagePdf.pdf({path: CONFIG.orderpdf, format: 'A4'});
		}	  
	}

	// we're done
	if (CONFIG.debug) {
		console.log('')
		console.log('Done. Press Ctrl-c to quit')
	} else {
		await browser.close();
	}

  })();
  
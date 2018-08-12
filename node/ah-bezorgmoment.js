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
const fs = require('fs'); // so we can save the JSON details
const path = require('path'); // path + filename utilities

// get the parameters
CONFIG.argv = require('minimist')(process.argv.slice(2));

// we can either set debug flag as parameter or in config.js
if (!CONFIG.debug && CONFIG.argv.debug) CONFIG.debug = true

// set the name of this file
CONFIG.filenameApp = path.posix.basename( process.argv[1] );
// set the path to the app, output folder and if applicable output URL
CONFIG.pathToApp = path.posix.dirname( process.argv[1] );
CONFIG.outputPath = path.join( 
	CONFIG.pathToApp,
	CONFIG.outputPathRelative,
	CONFIG.outputFolder
)
CONFIG.outputUrl = CONFIG.argv.serverUrl ? path.join(CONFIG.argv.serverUrl,CONFIG.outputFolder) : null
CONFIG.executionStart = moment()

const syntax = `syntax:
node ${CONFIG.filenameApp} [--withPdf] [--serverUrl=<url>] [--debug] [--help]
  --withPdf         : also create PDF (takes a bit longer)
  --serverUrl=<url> : store serverUrl in output urls
  --debug           : enable debugging (e.g. display browser)
  --help            : this message 
`

if(CONFIG.argv.help) {
	console.log(syntax)
	if (CONFIG.debug) console.log(CONFIG)
	return
}



/**
 * Parse the strings from the website and create object with relevant delivery and change details
 * @param {object} scraped The scraped details: {deliveryDetails, changeDetails, orderUrl, orderNumber}
 * 
 * @returns {object} details The order details
 * 
 */
function parseOrderResults(scraped) {
	let details = { 
		label:null, labelHuman:null, labelHumanUntil:null, labelHumanChange:null,
		date:null, from:null, to:null, range:null,
		weekday:null, dayAndMonth:null,
		dateFrom:null, dateTo:null,
		changeUntil:null, 
		timestamp:null,
		address:null, 
		url:null,
		json:null,
		screenshot:null,
		pdf:null,
		calendarTitle:null,
		labelPrevious:null, rangePrevious:null, 
		minutesFromPrevious:null, minutesToPrevious:null,
		timestampPrevious:null, previous:null,
		// strings: {} 
	}
	let strings = {
		date:null, from: null, to:null, changeUntil:null
	}

	// parse deliveryDetails string
	regex = /(.*20\d\d).(\d{2}:\d{2}) - (\d{2}:\d{2}), (.*)/gm;
	// 'Zaterdag 18 aug. 2018 16:00 - 18:00, My street 1234, City'
	m = regex.exec(scraped.deliveryDetails)
	
	if (m && m[1]) {
		strings.date = m[1]
		strings.from = m[2]
		strings.to = m[3]
		details.address = m[4]
	}

	// during debug, replace actual data with dummy data
	if (CONFIG.debug) {
		const dummyAddress = 'My address 1234, My city'
		scraped.deliveryDetails = scraped.deliveryDetails.replace(details.address,dummyAddress)		
		details.address = dummyAddress
		scraped.orderUrl = scraped.orderUrl.replace(/\d+/gm, '123456789')
	}

	// parse changeDetails string
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
	now = moment()
	
	// http://momentjs.com/docs/#/displaying/format/
	details.label = from.format('dddd D MMMM (H:mm - ') + to.format('H:mm)')
	details.labelHuman = from.format('dddd [tussen] H:mm [en] ') + to.format('H:mm')
	details.labelHumanUntil = now.to(to)
	details.labelHumanChange = now.to(changeUntil)
	details.date = from.format('YYYY-MM-DD')
	details.dateFrom = from.toISOString(true)
	details.dateTo = to.toISOString(true)
	details.from = from.format('H:mm')
	details.to = to.format('H:mm')
	details.range = from.isValid() && to.isValid() ? to.diff(from,'minutes') : null
	details.weekday = from.format('dddd')
	details.dayAndMonth = from.format('D MMMM')
	
	// store the details
	details.source = {deliveryDetails:scraped.deliveryDetails, changeDetails:scraped.changeDetails}
	// details.url = `${URLBASE}${URLORDERS}`
	details.url = scraped.orderUrl
	details.strings = strings
	details.timestamp = moment().toISOString(true)

	details.calendarTitle = CONFIG.calendarTitle || null
	details.json = CONFIG.detailsJson || null
	details.screenshot = CONFIG.screenshot || null
	details.pdf = CONFIG.argv.withPdf ? CONFIG.orderPdf || null : null
	// if server URL was provided, then prefix the output URL
	if (CONFIG.outputUrl) {
		if (details.json) details.json = CONFIG.outputUrl +'/'+ details.json
		if (details.screenshot) details.screenshot = CONFIG.outputUrl +'/'+ details.screenshot
		if (details.pdf) details.pdf = CONFIG.outputUrl +'/'+ details.pdf
	}
	
	// compare with previous details
	if (scraped.previousDetails) {
		const prevDetails = scraped.previousDetails
		if (CONFIG.debug) {
			prevDetails.dateFrom = moment(prevDetails.dateFrom).subtract(2,'hours').toISOString(true);
			prevDetails.dateTo = moment(prevDetails.dateTo).add(1,'hours').toISOString(true);
		}
		prevFrom = moment(prevDetails.dateFrom)
		prevTo = moment(prevDetails.dateTo)

		details.timestampPrevious = prevDetails.timestamp
		details.previous = moment(prevDetails.timestamp).from(moment())
		details.labelPrevious = prevDetails.label
		details.rangePrevious = prevDetails.range
		details.minutesFromPrevious = from.diff(prevFrom, 'minutes')
		details.minutesToPrevious = to.diff(prevTo, 'minutes')
	}

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

	// read the previous details
	const previousJson = CONFIG.detailsJson ? fs.readFileSync(
		path.join(CONFIG.outputPath, CONFIG.detailsJson), { encoding: 'utf-8' }
	) : null;
	const previousDetails = previousJson ? JSON.parse(previousJson) : null

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
		await page.screenshot({path: path.join(CONFIG.outputPath, CONFIG.screenshot), fullPage: false});
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
		if (previousDetails) scraped.previousDetails = previousDetails

		// parse these details
		const details = parseOrderResults(scraped)

		if (CONFIG.detailsJson) {
			// store how long it took to execute
			details.executionSeconds = moment().diff(CONFIG.executionStart, 'seconds', true)

			fs.writeFileSync(
				path.join(CONFIG.outputPath, CONFIG.detailsJson), 
				JSON.stringify(details, null, 2),
				{ encoding: 'utf-8' }
			); 
		}
		// console.log(details) // pretty print, but difficult for index.php
		console.log(JSON.stringify(details)) // as a single line

		// create PDF of the order (only if asked for in command line argument)
		// will fail if not headless (e.g. devtools)
		if (CONFIG.argv.withPdf && CONFIG.orderPdf) {
			const pagePdf = await browser.newPage();
			await pagePdf.goto(`${URLBASE}${URLORDERDETAILS}${scraped.orderNumber}`, {waitUntil: 'networkidle2'});

			// remove the background color
			pagePdf.addStyleTag({content:'body { background-color: transparent !important }'})

			// create the PDF file (unless we are in debug mode, only possible headless)
			if (!CONFIG.debug) await pagePdf.pdf({
				path: path.join(CONFIG.outputPath, CONFIG.orderPdf), 
				format: 'A4'
			});
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
  
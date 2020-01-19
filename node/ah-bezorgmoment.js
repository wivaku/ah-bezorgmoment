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
const DAEMONFILE = './daemon.txt'

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
CONFIG.filenameApp = path.posix.basename(process.argv[1]);
// set the path to the app, output folder and if applicable output URL
CONFIG.pathToApp = path.posix.dirname(process.argv[1]);
CONFIG.outputPath = path.join(
	CONFIG.pathToApp,
	CONFIG.outputPathRelative,
	CONFIG.outputFolder
)
CONFIG.outputUrl = CONFIG.argv.serverUrl ? path.join(CONFIG.argv.serverUrl, CONFIG.outputFolder) : null
CONFIG.executionStart = moment()

const syntax = `syntax:
node ${CONFIG.filenameApp} [--daemon] [--withPdf] [--serverUrl=<url>] [--withPrevious] [--cached] [--debug] [--help]
	--daemon          : keep the browser running in the background
	--faster          : don't load CSS, images, fonts (experimental)
	--withPdf         : also create PDF (takes a bit longer)
	--serverUrl=<url> : store serverUrl in output urls
	--withPrevious    : include details from previous fetch
	--cached          : return the cached JSON data
	--debug           : enable debugging (e.g. display browser)
	--help            : this message 
`

if (CONFIG.argv.help) {
	console.log(syntax)
	if (CONFIG.debug) console.log(CONFIG)
	return
}


/**
 * Parse the strings from the website and create object with relevant delivery and change details
 * @param {object} scraped The scraped details: {deliverySummary, deliveryDetails, orderUrl, orderNumber}
 * 
 * @returns {object} details The order details
 * 
 */
function parseOrderResults(scraped) {
	// e.g. iOS Shortcuts Dictionary can not handle nested object, so make as flat as possible
	let details = {
		label: null, label_human: null, label_humanUntilDelivery: null, label_humanChangeUntil: null,
		date_ymd: null, time_from: null, time_to: null, minutesBetweenFromTo: null,
		label_weekday: null, label_dayAndMonth: null,
		date_dateFrom: null, date_dateTo: null, date_dateChangeUntil: null,
		timestamp: null,
		address: null,
		orderUrl: null,
		json: null,
		screenshot: null,
		pdf: null,
		calendarTitle: null,
		// strings: {} 
	}

	if (CONFIG.argv.withPrevious) {
		// merge additional details
		details = Object.assign(details, {
			previous_label: null, previous_minutesBetweenFromTo: null,
			previous_deltaMinutesFrom: null, previous_deltaMinutesTo: null,
			previous_deltaHuman: null,
			previous_timestamp: null, previous_humanHowLongAgo: null,
		})
	}

	let strings = {
		date: null, from: null, to: null, changeUntil: null
	}

	moment.locale(CONFIG.locale || 'nl')

	// parse deliverySummary string
	regex = /(.*20\d\d).(\d{2}:\d{2}) - (\d{2}:\d{2}), (.*)/gm;
	// 'Zaterdag 18 aug. 2018 16:00 - 18:00, My street 1234, City'
	m = regex.exec(scraped.deliverySummary)

	if (m && m[1]) {
		strings.date = m[1]
		strings.from = m[2]
		strings.to = m[3]
		details.address = m[4]
	}

	// during debug, replace actual data with dummy data
	if (CONFIG.debug) {
		const dummyAddress = 'My address 1234, My city'
		scraped.deliverySummary = scraped.deliverySummary.replace(details.address, dummyAddress)
		details.address = dummyAddress
		scraped.orderUrl = scraped.orderUrl.replace(/\d+/gm, '123456789')
	}

	// replace newlines with space
	scraped.deliveryDetails = scraped.deliveryDetails.replace(/[\r\n]+/g, " ");

	// parse details string, can be 
	// 1) change details
	// 2) updated delivery details
	// 3) completed orders

	// 'Nog te wijzigen tot vrijdag, 17 augustus 2018, 23:59'
	regex = /Nog te wijzigen tot (.*?), (.*)/gm;
	m = regex.exec(scraped.deliveryDetails)

	if (m && m[2]) {
		strings.changeUntil = m[2]
		changeUntil = moment(strings.changeUntil, "DD MMMM YYYY, HH:mm")

		details.date_dateChangeUntil = changeUntil.toISOString(true)
		details.label_humanChangeUntil = changeUntil.fromNow()
	}

	// 'Je bezorging staat gepland tussen 16:15 en 16:45. Deze tijd kan nog wijzigen'
	regex = /Je bezorging staat gepland tussen (\d+:\d+) en (\d+:\d+).*/gm;
	m = regex.exec(scraped.deliveryDetails)

	// we now have more precise times
	if (m && m[2]) {
		strings.from = m[1]
		strings.to = m[2]
	}

	// 'Ontvangen'
	regex = /Ontvangen/gm;
	m = regex.exec(scraped.deliveryDetails)

	// in case we want to do something once delivered
	if (m) {
		details.delivered = true
	}


	// parse the various strings
	from = moment(strings.date + " " + strings.from, "dddd DD MMM. YYYY HH:mm")
	to = moment(strings.date + " " + strings.to, "dddd DD MMM. YYYY HH:mm")

	// http://momentjs.com/docs/#/displaying/format/
	details.label = from.format('dddd D MMMM (H:mm - ') + to.format('H:mm)')
	details.label_human = from.format('dddd [tussen] H:mm [en] ') + to.format('H:mm')
	details.label_humanUntilDelivery = to.fromNow()
	details.date_dateFrom = from.toISOString(true)
	details.date_dateTo = to.toISOString(true)
	details.date_ymd = from.format('YYYY-MM-DD')
	details.time_from = from.format('H:mm')
	details.time_to = to.format('H:mm')
	details.minutesBetweenFromTo = from.isValid() && to.isValid() ? to.diff(from, 'minutes') : null
	details.label_weekday = from.format('dddd')
	details.label_dayAndMonth = from.format('D MMMM')

	// store the remaining details
	details.timestamp = moment().toISOString(true)
	details.source = { deliverySummary: scraped.deliverySummary, deliveryDetails: scraped.deliveryDetails }
	details.strings = strings

	details.orderUrl = scraped.orderUrl
	details.calendarTitle = CONFIG.calendarTitle || null
	details.json = CONFIG.detailsJson || null
	details.screenshot = CONFIG.screenshot || null
	details.pdf = CONFIG.argv.withPdf ? CONFIG.orderPdf || null : null

	// if server URL was provided, then prefix the output URL
	if (CONFIG.outputUrl) {
		if (details.json) details.json = CONFIG.outputUrl + '/' + details.json
		if (details.screenshot) details.screenshot = CONFIG.outputUrl + '/' + details.screenshot
		if (details.pdf) details.pdf = CONFIG.outputUrl + '/' + details.pdf
	}

	// compare with previous details
	if (CONFIG.argv.withPrevious && scraped.previousDetails && scraped.previousDetails.orderUrl == details.orderUrl) {
		const prevDetails = scraped.previousDetails
		if (CONFIG.debug) {
			prevDetails.date_dateFrom = moment(prevDetails.date_dateFrom).subtract(2, 'hours').toISOString(true);
			prevDetails.date_dateTo = moment(prevDetails.date_dateTo).add(1, 'hours').toISOString(true);
		}
		prevFrom = moment(prevDetails.date_dateFrom)
		prevTo = moment(prevDetails.date_dateTo)

		details.previous_timestamp = prevDetails.timestamp
		details.previous_label = prevDetails.label
		details.previous_humanHowLongAgo = moment(prevDetails.timestamp).from(moment())
		details.previous_minutesBetweenFromTo = prevDetails.minutesBetweenFromTo
		details.previous_deltaMinutesFrom = from.diff(prevFrom, 'minutes')
		details.previous_deltaMinutesTo = to.diff(prevTo, 'minutes')

		if (details.previous_deltaMinutesFrom) {
			minutesChangedFrom = from.from(prevFrom, true)
			details.previous_deltaHuman = minutesChangedFrom
			details.previous_deltaHuman += minutesChangedFrom > 0 ? " eerder" : " later"
		} else {
			details.previous_deltaHuman = 'ongewijzigd'
		}
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
	const previousJson = CONFIG.argv.withPrevious && CONFIG.detailsJson ? fs.readFileSync(
		path.join(CONFIG.outputPath, CONFIG.detailsJson), { encoding: 'utf-8' }
	) : null;
	const previousDetails = previousJson ? JSON.parse(previousJson) : null

	// if cached data was requested: display it and exit
	if (CONFIG.argv.cached && previousDetails) {
		console.log(JSON.stringify(previousDetails, null, 2))
		return
	}

	// optional settings for Puppeteer
	let launchSettings = {
		userDataDir: `/var/tmp/${CONFIG.filenameApp}`, // https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md
		// executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome', // your mileage may vary, preferred to use Chromium included with Puppeteer
		// args: [ '--disable-extensions' ],
		// devtools: true, // shows browser + devtools
		// headless: false, // shows browser
	}
	if (CONFIG.debug) launchSettings.devtools = true

	// either connect to existing browser (daemon mode), or launch new one
	let browser
	let usingExistingEndpoint
	try {
		wsEndpoint = fs.readFileSync(DAEMONFILE, 'utf-8')
		console.log("found daemon file: ", DAEMONFILE)
		browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint })
		console.log("connected to existing browser: ", wsEndpoint)
		usingExistingEndpoint = wsEndpoint
	} catch (err) {
		console.log("launching new browser")
		browser = await puppeteer.launch(launchSettings)
		if (CONFIG.argv.daemon && browser.wsEndpoint()) {
			fs.writeFileSync(DAEMONFILE, browser.wsEndpoint())
			console.log(`written details existing browser to: ${DAEMONFILE}`)
		} else {
			// connecting to existing endpoint failed, and daemon option was not used: we can remove existing daemon file
			try {
				fs.unlinkSync(DAEMONFILE)
			} catch (err) {
			}
		}
	}

	// use existing page, or create new one if none exists
	const pages = await browser.pages()
	const page = pages.length ? pages[0] : await browser.newPage()

	// change timeout - default timeout is 30 seconds (30x1000)
	page.setDefaultTimeout(3000);

	// disable loading images and stylesheets
	if (CONFIG.argv.faster) {
		await page.setRequestInterception(true);
		page.on('request', (request) => {
			if (['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
				request.abort();
			} else {
				request.continue();
			}
		});
	}

	// load the order page (could be we get a login page)
	try {
		await page.goto(`${URLBASE}${URLORDERS}`).catch(e => console.error(e));
	} catch (e) {
		if (e instanceof TimeoutError) {
			// Do something if this is a timeout.
			console.log('page timeout')
		}
	}

	// wait for the various elements that we can encounter
	await page.waitFor(".status500, #decline-cookies, #password, .login-form__submit, .login-form__error, article");

	// - .status500: site is in maintenance mode
	// - #decline-cookies: cookiewall
	// - #password, .login-form: login form elements
	// - .login-form__error: element that appears after unsuccesful login
	// - article: the order page

	// check for + deal with site maintenance
	const siteMaintenanceMode = await page.$eval('.status500', e => e.innerText).catch(e => { return });
	if (siteMaintenanceMode) {
		throw "AH site is in maintenance mode"
	}

	// await page.waitForNavigation({ waitUntil: 'networkidle0' }); // wait for page to be loaded completely

	const cookieWall = await page.$eval('#decline-cookies', e => e.innerText).catch(e => { return });
	if (cookieWall) {
		await page.click('#decline-cookies');
		console.log('declined the cookies');
	}

	// check for + deal with login page
	const loginForm = await page.$eval('#password', e => e.outerHTML).catch(e => { return });
	if (loginForm) {
		// await page.waitFor(300)

		await page.type("#username", CREDS.username);
		await page.type("#password", CREDS.password);		
		await page.click('.login-form__submit');

		// wait until we get either of these two: the articles (future and previous orders), or login error

		try {
			await page.waitFor(".login-form__error, #rc-imageselect, #recaptcha-verify-button, article");
		} catch(e) {
			// note: sometimes recaptcha is shown, but the orde page will still be loaded
			const foundRecaptcha = await page.$eval('#recaptcha-verify-button', el => el.innerText).catch(e => { return });
			var resultError = foundRecaptcha ? "encountered recaptcha" : "error after pressing submit"
			console.log(resultError)
			console.log(e)
		}
	}

	// store as screenshot
	if (CONFIG.screenshot && !CONFIG.argv.faster) {
		await page.screenshot({ path: path.join(CONFIG.outputPath, CONFIG.screenshot), fullPage: false });
		console.log(`created screenshot: ${CONFIG.screenshot}`)
	}

	// check if the login failed: show the error message that was on the screen
	const errorMsg = await page.$eval('.login-form__error', el => el.innerText).catch(e => { return });
	if (errorMsg) {
		var resultError = "error logging in"
		console.log('creds.js username: ' + CREDS.username)
		// throw errorMsg
	}

	if (resultError) {
		var details = { error: resultError }
	}

	// check if there are open orders
	const openOrders = await page.$x("//h3[contains(text(),'Nog te leveren bestellingen')]");

	if (openOrders.length) {
		// read available details
		const scraped = {
			deliverySummary: await page.$eval('article a h2', el => el.innerText),
			deliveryDetails: await page.$eval('article a p', el => el.innerText),
			orderUrl: await page.$eval(`article div a[href*="${URLORDERS}"]`, el => el.href),
		}
		scraped.orderNumber = scraped.orderUrl.split("/").pop();
		if (CONFIG.argv.withPrevious && previousDetails) scraped.previousDetails = previousDetails

		// parse these details
		var details = parseOrderResults(scraped)
	} else if (!resultError) {
		console.log('no open orders')
	}

	// write the results (can contain order details or error)
	if (details && CONFIG.detailsJson) {
		// store how long it took to execute
		details.executionSeconds = moment().diff(CONFIG.executionStart, 'seconds', true)

		fs.writeFileSync(
			path.join(CONFIG.outputPath, CONFIG.detailsJson),
			JSON.stringify(details, null, 2),
			{ encoding: 'utf-8' }
		);
		// display the details object
		console.log(JSON.stringify(details, null, 2))
	}

	// create PDF of the order (only if asked for in command line argument)
	// will fail if not headless (e.g. devtools)
	if (openOrders.length && CONFIG.argv.withPdf && CONFIG.orderPdf) {
		const pagePdf = await browser.newPage();
		await pagePdf.goto(`${URLBASE}${URLORDERDETAILS}${scraped.orderNumber}`, { waitUntil: 'networkidle2' });

		// remove the background color
		pagePdf.addStyleTag({ content: 'body { background-color: transparent !important }' })

		// create the PDF file (unless we are in debug mode, only possible headless)
		if (!CONFIG.debug) await pagePdf.pdf({
			path: path.join(CONFIG.outputPath, CONFIG.orderPdf),
			format: 'A4'
		});
	}

	// we're done
	if (CONFIG.debug) {
		console.log('')
		console.log('Done. Press Ctrl-c to quit')
		await browser.disconnect()
	} else {
		if (usingExistingEndpoint || CONFIG.argv.daemon) {
			console.log(`disconnecting from browser, to reconnect use endpoint in ${DAEMONFILE}`)
			await browser.disconnect()
		} else {
			console.log('closing browser')
			await browser.close()
		}
	}

})()
	.catch(e => {
		console.log("error:", e)
		process.exit()
	});

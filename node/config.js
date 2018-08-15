module.exports = {
	/**
	 * configuration details
	 * feel free to change / comment out the below
	 */

	 // where to store the output files?
	outputPathRelative: '..', // relative path from location of Node application
	outputFolder: '/output', // name of folder (as it would be accessed from webserver)

	// --- comment out the following to disable that functionality ---

	// save the details as JSON file
	detailsJson: 'orderDetails.json',

	// save the details as a screenshot
	screenshot: 'screenshot.png',

	// load + save the order as a PDF (takes a bit longer)
	orderPdf: 'bestelling.pdf',

	// the default calendar title (helps to find existing calendar events)
	calendarTitle: 'Albert Heijn bezorgmoment',	
}
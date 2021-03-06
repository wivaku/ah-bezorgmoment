# Albert Heijn delivery information (bezorgmoment)

Loads delivery information of your next delivery from Dutch grocery store [Albert Heijn](https://www.ah.nl/over-ah/online-bestellen/bezorgservice) and makes available machine-readable details. It stores the details so they can be compared with previous retrievals.

Example usage: create Siri Shortcut (iOS 12) that reads the delivery data.
And then e.g.:
- [let Siri say what the delivery time will be](https://github.com/wivaku/ah-bezorgmoment/issues/1)
- add / update the calendar entry
- view the ordered items as PDF

Consists of:
- `node/ah-bezorgmoment.js`: the main Node application
- `index.php`: the optional PHP wrapper that calls the main Node application

## Example
```
$ ./ah-bezorgmoment.js --withPdf --serverUrl=https://example.com/ah-bezorgmoment
```
Returns:
```
{
  "label": "zaterdag 18 augustus (16:00 - 18:00)",
  "label_human": "zaterdag tussen 16:00 en 18:00",
  "label_humanUntilDelivery": "over 3 dagen",
  "label_humanChangeUntil": "over 2 dagen",
  "date_ymd": "2018-08-18",
  "time_from": "16:00",
  "time_to": "18:00",
  "minutesBetweenFromTo": 120,
  "label_weekday": "zaterdag",
  "label_dayAndMonth": "18 augustus",
  "date_dateFrom": "2018-08-18T16:00:00.000+02:00",
  "date_dateTo": "2018-08-18T18:00:00.000+02:00",
  "date_dateChangeUntil": "2018-08-17T23:59:00.000+02:00",
  "timestamp": "2018-08-15T14:04:20.625+02:00",
  "address": "My address 1234, My city",
  "orderUrl": "https://www.ah.nl/producten/eerder-gekocht/bestellingen/123456789",
  "json": "https:/example.com/ah-bezorgmoment/output/orderDetails.json",
  "screenshot": "https:/example.com/ah-bezorgmoment/output/screenshot.png",
  "pdf": "https:/example.com/ah-bezorgmoment/output/bestelling.pdf",
  "calendarTitle": "Albert Heijn bezorgmoment",
  "previous_label": "zaterdag 18 augustus (16:00 - 18:00)",
  "previous_minutesBetweenFromTo": 120,
  "previous_deltaMinutesFrom": 120,
  "previous_deltaMinutesTo": -60,
  "previous_deltaHuman": "2 uur later",
  "previous_timestamp": "2018-08-15T14:03:27.637+02:00",
  "previous_humanHowLongAgo": "één minuut geleden",
  "source": {
    "deliveryDetails": "Zaterdag 18 aug. 2018 16:00 - 18:00, My address 1234, My city",
    "changeDetails": "Nog te wijzigen tot vrijdag, 17 augustus 2018, 23:59"
  },
  "strings": {
    "date": "Zaterdag 18 aug. 2018",
    "from": "16:00",
    "to": "18:00",
    "changeUntil": "17 augustus 2018, 23:59"
  },
  "executionSeconds": 0.901
}
  ```

### output

The following optional output files can be created (see config section).
- **JSON**: the delivery details as JSON (see example above)
- **screenshot**: the delivery details as PNG image
- **order details**: the order items as PDF

### parameters

```
$ ./ah-bezorgmoment.js --help

syntax:
node ah-bezorgmoment.js [--daemon] [--faster] [--withPdf] [--serverUrl=<url>] [--cached] [--debug] [--help]
	--daemon          : keep the browser running in the background
	--faster          : don't load CSS, images, fonts (experimental)
	--withPdf         : also create PDF (takes a bit longer)
	--serverUrl=<url> : store serverUrl in output urls
	--cached          : return the cached JSON data
	--debug           : enable debugging (e.g. display browser)
	--help            : this message
```

### daemon mode
Normally a new browser is launched and stopped every time. It is possible to run the application in the background, so that the browser can be reused. Resulting in much faster responses (less than 1 second instead of ±4 seconds).

```
$ ./ah-bezorgmoment.js --daemon &
```

### PHP wrapper

A PHP wrapper is provided (`index.php`), which internally calls the Node application and returns the JSON details.

```
php -S localhost:8000
open http://localhost:8000
open http://localhost:8000?withPdf
open http://localhost:8000?cached
```


## Installing

### Prerequisites

Requires Node v7.6.0 or greater and (optional) PHP.

### Clone repository

Get the source code
```
git clone git@github.com:wivaku/ah-bezorgmoment.git
```

### Node modules

Install Node modules, mainly ([puppeteer](https://github.com/GoogleChrome/puppeteer) and [moment](https://momentjs.com/)). 

```
cd node
npm install
```

**note**: Puppeteer also installs Chromium. It is possible to use Puppeteer with custom Chrome/Chromium (`node i puppeteer-core` and specify the path in `launchSettings`). It worked with Chrome 71 on my Mac, but using the default Chromium is easier.

### Credentials

**required**: Copy `node/creds_example.js` to `node/creds.js` (is done by `npm install`) and enter your Albert Heijn login details.

### Config

See Copy `node/config_example.js` to `node/config.js` (is done by `npm install`) to enable / disable or customize location and filename. 

## Author

Winfred van Kuijk

## License

This project is licensed under the [MIT License](LICENSE).

This project is not associated with or endorsed by Albert Heijn. 
It does not use any API's or scraping, it simply mimics the user using a webbrowser checking the order delivery information.
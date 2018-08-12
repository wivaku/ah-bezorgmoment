# Albert Heijn delivery information (bezorgmoment)

Loads delivery information for Dutch grocery store [Albert Heijn](https://www.ah.nl/over-ah/online-bestellen/bezorgservice) and makes available machine-readable details. It stores the details so they can be compared with previous retrievals.

Example usage: create Siri Shortcut (iOS 12) that reads the delivery data.
And then e.g.:
- [let Siri say what the delivery time will be](https://github.com/wivaku/ah-bezorgmoment/issues/1)
- add / update the calendar entry
- view the ordered items as PDF

Consists of:
- `node/ah-bezorgmoment.js`: the main Node application
- `index.php`: the optional PHP wrapper that calls the main application

## Example
```
$ ./ah-bezorgmoment.js --withPdf --serverUrl=https://example.com/ah-bezorgmoment
```
Returns:
```
{ label: 'zaterdag 18 augustus (16:00 - 18:00)',
  labelHuman: 'zaterdag tussen 16:00 en 18:00',
  labelHumanUntil: 'over 6 dagen',
  labelHumanChange: 'over 5 dagen',
  date: '2018-08-18',
  from: '16:00',
  to: '18:00',
  range: 120,
  weekday: 'zaterdag',
  dayAndMonth: '18 augustus',
  dateFrom: '2018-08-18T16:00:00.000+02:00',
  dateTo: '2018-08-18T18:00:00.000+02:00',
  changeUntil: '2018-08-17T23:59:00.000+02:00',
  timestamp: '2018-08-12T13:44:01.342+02:00',
  address: 'My address 1234, My city',
  url:
   'https://www.ah.nl/producten/eerder-gekocht/bestellingen/123456789',
  json:
   'https:/example.com/ah-bezorgmoment/output/orderDetails.json',
  screenshot: 'https:/example.com/ah-bezorgmoment/output/screenshot.png',
  pdf: 'https:/example.com/ah-bezorgmoment/output/bestelling.pdf',
  calendarTitle: 'Albert Heijn bezorgmoment',
  labelPrevious: 'zaterdag 18 augustus (14:00 - 19:00)',
  rangePrevious: 300,
  minutesFromPrevious: 120,
  minutesToPrevious: -60,
  timestampPrevious: '2018-08-12T13:32:57.041+02:00',
  previous: '11 minuten geleden',
  source:
   { deliveryDetails:
      'Zaterdag 18 aug. 2018 16:00 - 18:00, My address 1234, My city',
     changeDetails: 'Nog te wijzigen tot vrijdag, 17 augustus 2018, 23:59' },
  strings:
   { date: 'Zaterdag 18 aug. 2018',
     from: '16:00',
     to: '18:00',
     changeUntil: '17 augustus 2018, 23:59' },
  executionSeconds: 3.84 }
  ```

### output

The following optional output files can be created (see config section).
- **JSON**: the delivery details as JSON (see example above)
- **screenshot**: the delivery details as PNG image
- **order items**: the order items as PDF

### parameters

```
$ node ah-bezorgmoment.js --help

syntax:
node ah-bezorgmoment.js [--withPdf] [--serverUrl=<url>] [--debug] [--help]
  --withPdf         : also create PDF (takes a bit longer)
  --serverUrl=<url> : store serverUrl in output urls
  --debug           : enable debugging (e.g. display browser)
  --help            : this message
```

### PHP wrapper

A PHP wrapper is provided (`index.php`), which internally calls the Node application and returns the JSON details.

```
php -S localhost:8000
open http://localhost:8000
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

**note**: Puppeteer also installs Chromium. It is possible to use Puppeteer with custom Chrome/Chromium (`node i puppeteer-core` and specify the path in `.launch()`), but it needs to be a specific Chrome version so I did not bother.

### Credentials

**required**: Copy `node/creds_example.js` to `node/creds.js` and enter your Albert Heijn login details.

### Config

See `node/config.js` to enable / disable or customize location and filename. 

## Author

Winfred van Kuijk

## License

This project is licensed under the [MIT License](LICENSE).

This project is not associated with or endorsed by Albert Heijn. 
It does not use any API's or scraping, it simply mimics the user using a webbrowser checking the order delivery information.
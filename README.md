# Albert Heijn delivery information (bezorgmoment)

Loads delivery information for Dutch grocery store Albert Heijn and makes available machine-readable details.

Consists of:
- `node/ahbezorgmoment.js`: the main Node application
- `index.php`: the optional PHP wrapper that calls the main application

## Example
```
$ node node/ahbezorgmoment.js

{ from: '2018-08-18T16:00:00.000+02:00',
  to: '2018-08-18T18:00:00.000+02:00',
  range: 120,
  changeUntil: '2018-08-17T23:59:00.000+02:00',
  timestamp: '2018-08-11T19:48:23.672+02:00',
  address: 'My address 123, My city',
  url:
   'https://www.ah.nl/producten/eerder-gekocht/bestellingen/123456789',
  source:
   { deliveryDetails:
      'Zaterdag 18 aug. 2018 16:00 - 18:00, My address 123, My city',
     changeDetails: 'Nog te wijzigen tot vrijdag, 17 augustus 2018, 23:59' },
  strings:
   { date: 'Zaterdag 18 aug. 2018',
     from: '16:00',
     to: '18:00',
     changeUntil: '17 augustus 2018, 23:59' },
  pdf: 'bestelling.pdf',
  screenshot: 'screenshot.png' }
  ```

### output

The following optional output files can be created (see config section).
- **JSON**: the delivery details as JSON (see example above)
- **screenshot**: the delivery details as PNG image
- **items**: the order items as PDF

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

Install Node modules ([puppeteer](https://github.com/GoogleChrome/puppeteer) and [moment](https://momentjs.com/)). 

```
cd node
npm install
```

**note**: Puppeteer also installs Chromium. It is possible to use Puppeteer with custom Chrome/Chromium (`node i puppeteer-core` and specify the path in `.launch()`), but it needs to be a specific Chrome version so I did not bother.

### Credentials

Copy `node/creds_example.js` to `node/creds.js` and enter your Albert Heijn login details.

### Config

See `node/config.js` to enable / disable or customize location and filename. 

### Debugging

Set `debug: true` in `node/config.js` to show the browser (default: headless)

## Author

Winfred van Kuijk

## License

This project is licensed under the [MIT License](LICENSE).
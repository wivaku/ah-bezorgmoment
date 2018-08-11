<?php

// run the Node application to retrieve the details (stored in orderDetails.json)
exec("cd node && node ahbezorgmoment.js 2>&1", $out, $err);

if ($err) {
	if (php_sapi_name() !== "cli") {
		echo '<pre>'. $err;
	} else {
		print_r($err);
	}
	return;
}

/* option 1: read from the Node output */

$json = $out[0];

/* option 2: read from the JSON file */

// $file = './output/orderDetails.json';
// if (!file_exists($file)) die("could not open $file");
// $json = file_get_contents($file);

if (php_sapi_name() !== "cli") {
	header('Content-Type: application/json');
}
echo json_encode(json_decode($json), JSON_PRETTY_PRINT);
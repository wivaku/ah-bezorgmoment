<?php

// check / set the parameters
$withPdf = false;
$serverUrl = (php_sapi_name() !== "cli") ? getUrl() : null;

// run the Node application to retrieve the details (stored in ./output/orderDetails.json)
// exec("cd node && /usr/local/bin/node ./ah-bezorgmoment.js 2>&1", $out, $err);
$cmd = "/usr/local/bin/node ./node/ah-bezorgmoment.js";
if (isset($withPdf) && $withPdf) $cmd .= " --withPdf";
if (isset($serverUrl) && $serverUrl) $cmd .= " --serverUrl=${serverUrl}";

exec("$cmd 2>&1", $out, $err);

if ($err) {
	if (php_sapi_name() !== "cli") {
		echo '<pre>'. $err;
	} else {
		print_r($err);
	}
	return;
}

/* option 1: read from the Node output */

$json = $out[0]; // TODO: deal with newlines

/* option 2: read from the JSON file */

// $file = './output/orderDetails.json';
// if (!file_exists($file)) die("could not open $file");
// $json = file_get_contents($file);

// return / display the results

if (php_sapi_name() !== "cli") {
	header('Content-Type: application/json');
}
echo json_encode(json_decode($json), JSON_PRETTY_PRINT);


function getUrl() {
	$url  = @( $_SERVER["HTTPS"] != 'on' ) ? 'http://'.$_SERVER["SERVER_NAME"] :  'https://'.$_SERVER["SERVER_NAME"];
	$url .= ( $_SERVER["SERVER_PORT"] !== 80 ) ? ":".$_SERVER["SERVER_PORT"] : "";
	$url .= $_SERVER["REQUEST_URI"];
	return $url;
  }
  
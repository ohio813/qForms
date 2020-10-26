<?php
  if ($_SERVER['REQUEST_METHOD'] != 'POST') die("0");
  $survey_results = json_decode(file_get_contents('php://input'), true);
  if (is_null($survey_results)) die("1");
  if (!is_array($survey_results)) die("2");
  if (sizeof($survey_results) >= 0x10000) die("3"); 

  $m = new MongoDB\Driver\Manager("mongodb://localhost:27017");
  $bulk = new MongoDB\Driver\BulkWrite;
  $bulk->insert($survey_results);
  $result = $m->executeBulkWrite('survey.results', $bulk);

  echo "OK";
  //print_r($survey_results);
?>

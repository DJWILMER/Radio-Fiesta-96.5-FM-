<?php
/* Radio Fiesta 96.5 FM - Tacna, Perú
   Puente de metadatos (opcional).
   Despliega este archivo en el mismo servidor del PWA (sp.oyotunstream.com)
   para leer la canción en vivo superando las restricciones CORS. */
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/plain; charset=utf-8');

$port = isset($_GET['p']) ? preg_replace('/[^0-9]/', '', $_GET['p']) : '8116';
$targets = array(
  "https://sp.oyotunstream.com/8116/7.html",
  "https://sp.oyotunstream.com/cp/get_info.php?p=$port"
);

foreach ($targets as $t) {
  $ch = curl_init($t);
  curl_setopt_array($ch, array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (RadioFiesta PWA)',
    CURLOPT_HTTPHEADER => array('Icy-MetaData: 1')
  ));
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code === 200 && $body !== false && trim($body) !== '' && trim($body) !== '0') {
    echo $body;
    exit;
  }
}
echo '0';
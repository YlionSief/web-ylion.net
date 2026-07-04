<?php
/**
 * contacto.php — Receptor del formulario de contacto de YLION SIEF.
 *
 * Recibe JSON {name,email,phone,message,website} del formulario de index.html,
 * valida en servidor, comprueba mismo-origen (anti-CSRF), descarta bots
 * (honeypot), aplica límite por IP y envía el mensaje por correo a RECIPIENT.
 * Responde JSON {success:bool[,error]}.
 *
 * Endurecido: sin fuga de errores, POST-only, límite de tamaño de cuerpo,
 * comprobación de Origin/Referer, anti-inyección de cabeceras, cabeceras de
 * respuesta seguras. Requiere PHP con mail() (tu web anterior ya lo usa).
 */

// --- No filtrar errores internos en la respuesta ---
@ini_set('display_errors', '0');
error_reporting(0);

// --- Cabeceras de respuesta seguras ---
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const RECIPIENT    = 'soporte@ylion.net';   // destino de los mensajes
const FROM_EMAIL   = 'noreply@ylion.net';   // remitente (del dominio, para SPF)
const FROM_NAME    = 'Web YLION SIEF';
const MAX_PER_HOUR = 5;                      // envíos máximos por IP y hora
const MIN_INTERVAL = 15;                     // segundos mínimos entre envíos por IP
const MAX_BODY     = 16384;                  // tamaño máximo del cuerpo (bytes)

/**
 * Emite una respuesta JSON y finaliza la ejecución.
 * @param bool        $ok    true si el envío fue correcto.
 * @param string|null $error código de error cuando $ok es false.
 * @param int         $code  código HTTP.
 * @return void
 */
function respond($ok, $error = null, $code = 200) {
  http_response_code($ok ? 200 : $code);
  echo json_encode($error ? array('success' => false, 'error' => $error) : array('success' => true));
  exit;
}

/** Host (en minúsculas) de una URL, o '' si no es válida. */
function host_of($url) { $h = parse_url((string) $url, PHP_URL_HOST); return $h ? strtolower($h) : ''; }

// ---------------------------------------------------------------------------
// Método y tamaño
// ---------------------------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST')                 respond(false, 'method', 405);
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_BODY)            respond(false, 'toobig', 413);

// ---------------------------------------------------------------------------
// Mismo-origen (anti-CSRF): Origin/Referer deben coincidir con el host servido
// ---------------------------------------------------------------------------
$selfHost = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
$srcHost  = host_of($_SERVER['HTTP_ORIGIN'] ?? '') ?: host_of($_SERVER['HTTP_REFERER'] ?? '');
if ($selfHost === '' || $srcHost === '' || $srcHost !== $selfHost) respond(false, 'origin', 403);

// ---------------------------------------------------------------------------
// Cuerpo (JSON o, como respaldo, form-encoded)
// ---------------------------------------------------------------------------
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if (strlen((string) $raw) > MAX_BODY)                              respond(false, 'toobig', 413);
$data = json_decode((string) $raw, true, 4);
if (!is_array($data)) $data = $_POST;

$get = function ($k) use ($data) { return isset($data[$k]) && is_scalar($data[$k]) ? trim((string) $data[$k]) : ''; };
$name    = $get('name');
$email   = $get('email');
$phone   = $get('phone');
$message = $get('message');
$hp      = $get('website'); // honeypot: campo oculto que solo rellenan los bots

// Honeypot relleno → bot: fingimos éxito sin enviar nada.
if ($hp !== '') respond(true);

// ---------------------------------------------------------------------------
// Validación en servidor (el frontend nunca es frontera de seguridad)
// ---------------------------------------------------------------------------
if (mb_strlen($name) < 2)                                                   respond(false, 'name', 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120)  respond(false, 'email', 422);
if ($phone !== '' && !preg_match('/^[+\d][\d\s().\-]{6,18}$/', $phone))      respond(false, 'phone', 422);
if (mb_strlen($message) < 10)                                               respond(false, 'message', 422);

// Anti-inyección de cabeceras (salto de línea en campos que van a cabeceras).
if (preg_match('/[\r\n]/', $name . $email))                                 respond(false, 'invalid', 422);

// Normaliza longitudes.
$name    = mb_substr($name, 0, 80);
$email   = mb_substr($email, 0, 120);
$phone   = ($phone === '') ? '-' : mb_substr($phone, 0, 20);
$message = mb_substr($message, 0, 1000);

// ---------------------------------------------------------------------------
// Límite por IP: MAX_PER_HOUR/hora y MIN_INTERVAL entre envíos (fail-open)
// ---------------------------------------------------------------------------
$ip    = (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
$store = rtrim(sys_get_temp_dir(), '/\\') . '/ylion_contact_' . hash('sha256', $ip) . '.json';
$now   = time();
$hits  = array();
if (is_readable($store)) {
  $prev = json_decode((string) @file_get_contents($store), true);
  if (is_array($prev)) {
    foreach ($prev as $t) { if (is_int($t) && ($now - $t) < 3600) $hits[] = $t; }
  }
}
if (count($hits) >= MAX_PER_HOUR)                                  respond(false, 'limit', 429);
if (!empty($hits) && ($now - max($hits)) < MIN_INTERVAL)          respond(false, 'limit', 429);

// ---------------------------------------------------------------------------
// Construcción y envío del correo (mail() nativo, como la web anterior)
// ---------------------------------------------------------------------------
$subject = '=?UTF-8?B?' . base64_encode('Nuevo mensaje web · YLION SIEF') . '?=';
$from    = '=?UTF-8?B?' . base64_encode(FROM_NAME) . '?= <' . FROM_EMAIL . '>';

$body  = "Nuevo mensaje desde el formulario de ylion.net\n";
$body .= "------------------------------------------------\n\n";
$body .= "Nombre:   $name\n";
$body .= "Email:    $email\n";
$body .= "Teléfono: $phone\n";
$body .= "Fecha:    " . date('d/m/Y H:i') . "\n";
$body .= "IP:       $ip\n\n";
$body .= "Mensaje:\n$message\n";

$headers  = "From: $from\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";

$sent = @mail(RECIPIENT, $subject, $body, $headers);
if (!$sent) respond(false, 'send', 500);

// Registra el envío para el límite por IP.
$hits[] = $now;
@file_put_contents($store, json_encode(array_values($hits)), LOCK_EX);

respond(true);

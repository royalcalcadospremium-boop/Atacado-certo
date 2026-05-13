// Faz OAuth flow completo em um único processo:
// 1) Sobe servidor em localhost:3000
// 2) Espera callback do Olist
// 3) Imediatamente troca code por access_token + refresh_token
// 4) Salva no .env

import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '.env');

function loadEnv() {
  const raw = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function saveEnv(updates) {
  let raw = readFileSync(ENV_PATH, 'utf8');
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    raw = re.test(raw) ? raw.replace(re, `${k}=${v}`) : raw + `\n${k}=${v}`;
  }
  writeFileSync(ENV_PATH, raw);
}

const env = loadEnv();
const { TINY_CLIENT_ID, TINY_CLIENT_SECRET, TINY_REDIRECT_URI } = env;

const TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:3000');
  if (u.pathname !== '/oauth/callback') {
    res.writeHead(404).end('Not found');
    return;
  }

  const code = u.searchParams.get('code');
  const error = u.searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error, u.searchParams.get('error_description'));
    res.writeHead(400).end('Erro: ' + error);
    setTimeout(() => server.close(() => process.exit(1)), 500);
    return;
  }

  if (!code) {
    res.writeHead(400).end('Sem code');
    return;
  }

  console.log('Code recebido, trocando por tokens IMEDIATAMENTE...');

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: TINY_CLIENT_ID,
        client_secret: TINY_CLIENT_SECRET,
        code,
        redirect_uri: TINY_REDIRECT_URI
      })
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Erro Olist:', JSON.stringify(data, null, 2));
      res.writeHead(500).end('Erro ao trocar code: ' + JSON.stringify(data));
      setTimeout(() => server.close(() => process.exit(1)), 500);
      return;
    }
    const expiresAt = Date.now() + (data.expires_in * 1000) - 60_000;
    saveEnv({
      TINY_ACCESS_TOKEN: data.access_token,
      TINY_REFRESH_TOKEN: data.refresh_token || '',
      TINY_TOKEN_EXPIRES_AT: String(expiresAt)
    });
    console.log('OK — access_token e refresh_token salvos em .env');
    console.log('Expira em:', data.expires_in, 'segundos');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<h1>OK</h1><p>Tokens capturados. Pode fechar.</p>');
    setTimeout(() => server.close(() => process.exit(0)), 500);
  } catch (err) {
    console.error('Falha:', err);
    res.writeHead(500).end('Erro interno');
    setTimeout(() => server.close(() => process.exit(1)), 500);
  }
});

server.listen(3000, () => {
  console.log('Servidor OAuth em http://localhost:3000/oauth/callback');
  console.log('Aguardando callback... (timeout 5min)');
});

setTimeout(() => {
  console.log('Timeout - encerrando');
  process.exit(2);
}, 300_000);

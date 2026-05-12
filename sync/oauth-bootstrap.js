// OAuth bootstrap — executa uma única vez para obter o refresh_token do Olist v3.
// Uso: cd sync && cp .env.example .env && (preencha CLIENT_ID/SECRET) && npm run auth
//
// Fluxo:
//  1) Abre URL de autorização do Olist no navegador
//  2) Você autoriza, Olist redireciona para http://localhost:3000/oauth/callback?code=...
//  3) Script captura o code, troca por access_token + refresh_token
//  4) Salva tokens no .env
//
// Depois disso, sync-precos.js usa o refresh_token (válido por 30 dias rolling).

import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
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

function saveEnvKeys(updates) {
  let raw = readFileSync(ENV_PATH, 'utf8');
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(raw)) raw = raw.replace(re, `${k}=${v}`);
    else raw += `\n${k}=${v}`;
  }
  writeFileSync(ENV_PATH, raw);
}

function openBrowser(url) {
  // Argumentos passados via execFile/spawn — sem shell, sem injection.
  if (process.platform === 'win32') {
    spawn('rundll32', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore', detached: true }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  } else {
    spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  }
}

const env = loadEnv();
const { TINY_CLIENT_ID, TINY_CLIENT_SECRET, TINY_REDIRECT_URI } = env;

if (!TINY_CLIENT_ID || !TINY_CLIENT_SECRET) {
  console.error('Falta TINY_CLIENT_ID e/ou TINY_CLIENT_SECRET no .env. Copie .env.example e preencha.');
  process.exit(1);
}

const REDIRECT_URI = TINY_REDIRECT_URI || 'http://localhost:3000/oauth/callback';
const STATE = Math.random().toString(36).slice(2);
const AUTH_URL =
  'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth' +
  `?client_id=${encodeURIComponent(TINY_CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  '&response_type=code' +
  '&scope=openid' +
  `&state=${STATE}`;

console.log('\n=== Olist OAuth Bootstrap ===');
console.log('Abrindo URL de autorização no navegador:\n', AUTH_URL, '\n');
console.log('Se o navegador não abrir, copie a URL acima e cole manualmente.\n');
openBrowser(AUTH_URL);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:3000');
  if (u.pathname !== '/oauth/callback') {
    res.writeHead(404).end('Not found');
    return;
  }
  const code = u.searchParams.get('code');
  const state = u.searchParams.get('state');
  if (!code || state !== STATE) {
    res.writeHead(400).end('Code ausente ou state inválido.');
    return;
  }

  try {
    const tokenRes = await fetch('https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: TINY_CLIENT_ID,
        client_secret: TINY_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    });
    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Erro Olist:', data);
      res.writeHead(500).end('Erro ao trocar code por tokens. Veja terminal.');
      return;
    }
    const expiresAt = Date.now() + (data.expires_in * 1000) - 60_000;
    saveEnvKeys({
      TINY_ACCESS_TOKEN: data.access_token,
      TINY_REFRESH_TOKEN: data.refresh_token,
      TINY_TOKEN_EXPIRES_AT: String(expiresAt)
    });
    console.log('\nTokens salvos em sync/.env');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<h1>OK</h1><p>Você pode fechar essa aba e voltar ao terminal.</p>');
    setTimeout(() => server.close(() => process.exit(0)), 500);
  } catch (err) {
    console.error(err);
    res.writeHead(500).end('Erro no servidor. Veja terminal.');
  }
});

server.listen(3000, () => {
  console.log('Aguardando callback em http://localhost:3000/oauth/callback ...');
});

// Receptor temporário do OAuth callback. Escreve o code em /tmp/oauth-code.txt e sai.
import http from 'node:http';
import { writeFileSync } from 'node:fs';

const PORT = 3000;
const OUT = process.argv[2] || './oauth-code.txt';

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (u.pathname === '/oauth/callback') {
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state');
    const error = u.searchParams.get('error');
    if (error) {
      writeFileSync(OUT, JSON.stringify({ error, error_description: u.searchParams.get('error_description') }));
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<h1>Erro</h1><p>${error}</p>`);
    } else if (code) {
      writeFileSync(OUT, JSON.stringify({ code, state }));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>OK</h1><p>Code capturado, pode fechar.</p>');
    } else {
      res.writeHead(400).end('Sem code nem error');
    }
    setTimeout(() => server.close(() => process.exit(0)), 500);
  } else {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}/oauth/callback`));
setTimeout(() => { console.log('Timeout'); process.exit(2); }, 600_000);

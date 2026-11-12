// node preview.js timeline_v.json prev/v 2.5 10 20  -> stills at given seconds (for layout review)
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [tl, out, ...ts] = process.argv.slice(2); const T = require(path.resolve(tl));
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: T.W, height: T.H } });
  await p.goto('file://' + path.join(__dirname, 'engine.html')); await p.evaluate(u => window.init(u), T);
  for (const t of ts) { await p.evaluate(x => window.seek(x), +t); await p.screenshot({ path: `${out}_${t}.jpg`, type: 'jpeg', quality: 80 }); }
  await b.close();
})();

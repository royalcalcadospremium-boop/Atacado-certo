// Usage: node render.js <timeline.json> <outdir> <startFrame> <endFrame(excl)>
// Renders engine.html deterministically frame by frame (JPEG) with headless Chromium.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [tlPath, out, s, e] = process.argv.slice(2);
  const root = __dirname;
  const b = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const tl = require(path.resolve(tlPath));
  const p = await b.newPage({ viewport: { width: tl.W, height: tl.H }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(root, 'engine.html'));
  await p.evaluate(u => window.init(u), tl);
  const start = +s, end = Math.min(+e, Math.round(tl.duration * tl.fps));
  for (let f = start; f < end; f++) {
    await p.evaluate(t => window.seek(t), f / tl.fps);
    await p.screenshot({ path: `${out}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (f % 100 === 0) console.log('frame', f);
  }
  await b.close();
  console.log('done', start, end);
})();

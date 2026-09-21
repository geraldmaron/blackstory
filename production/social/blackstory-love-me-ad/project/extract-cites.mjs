// Pull the real reference list from The Count so the evidence card sets the
// chapter's own citations verbatim rather than paraphrasing them.
import fs from 'node:fs';
import { launch, newPage, settle } from './browser.mjs';
const b = await launch();
const { ctx, page } = await newPage(b);
await page.goto('http://localhost:3048/stories/the-count', {
  waitUntil: 'commit',
  timeout: 180000,
});
await settle(page, { extra: 3000 });
const r = await page.evaluate(() => {
  const ol = document.querySelector('ol.ds-article-references');
  const head = [...document.querySelectorAll('h2,h3,p')].find((e) =>
    /numbered mark/i.test(e.textContent),
  );
  return {
    heading: head?.textContent.trim(),
    items: [...ol.children].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
  };
});
fs.writeFileSync('../assets/cites-the-count.json', JSON.stringify(r, null, 1));
console.log(r.heading, r.items.length);
r.items.slice(0, 16).forEach((x) => console.log(' ', x.slice(0, 130)));
await ctx.close();
await b.close();

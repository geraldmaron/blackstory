// A camera for ordinary pages.
//
// Scrolling is not used for movement. Instead the document is parked and moved
// with a compositor transform: `scale(z) translate(-dx, -Y)`. Transforms do not
// reflow, so there is no scroll jank, no scroll anchoring, and no lazy-load pop
// mid-shot; and because Chrome re-rasterises text and images at the transformed
// scale, a push-in stays crisp instead of turning into an upscale. Images here
// are served far larger than their layout box (7258px wide originals), so a
// 2x push is still reading real detail.
export const PREP = `(() => {
  const d = document.documentElement, b = document.body;
  const st = document.createElement('style');
  st.textContent = 'header.ds-bar,.ds-roomsmenu,.ds-roomsmenu__panel,nextjs-portal,' +
    '[data-next-badge-root]{display:none!important}';
  document.head.appendChild(st);
  // Reveal anything gated on scroll/intersection before we park the page.
  d.style.scrollBehavior = 'auto';
  b.style.transformOrigin = '50% 0';
  b.style.willChange = 'transform';
  b.style.backfaceVisibility = 'hidden';
  d.style.overflow = 'hidden';
  d.style.background = getComputedStyle(b).backgroundColor;
  window.__camApply = (y, z, dx) => {
    b.style.transform = 'scale(' + z + ') translate(' + (-dx) + 'px,' + (-y) + 'px)';
  };
})()`;

/** Sweep the whole document once so lazy images and reveal animations all fire. */
export const SWEEP = `(async () => {
  const settleImgs = async (ms) => {
    const imgs = [...document.images].filter(i => !i.complete);
    await Promise.all(imgs.map(i => new Promise(r => {
      i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true });
      setTimeout(r, ms);
    })));
  };
  const H0 = document.documentElement.scrollHeight;
  // Two passes: the first trips lazy loaders and reveal observers, the second
  // catches anything whose loading changed the document height underneath us.
  for (let pass = 0; pass < 2; pass++) {
    const H = document.documentElement.scrollHeight;
    for (let y = 0; y < H; y += 420) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 70));
      await settleImgs(600);
    }
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 400));
  await document.fonts.ready.catch(() => {});
  await settleImgs(5000);
  // Decoding matters too: a loaded-but-undecoded image paints blank on first frame.
  await Promise.all([...document.images].map(i => i.decode?.().catch(() => {})));
})()`;

export async function prep(page) {
  await page.evaluate(SWEEP);
  await page.evaluate(PREP);
}

export async function cam(page, y, z = 1, dx = 0) {
  await page.evaluate(([y, z, dx]) => window.__camApply(y, z, dx), [y, z, dx]);
}

/**
 * Measure an element in *untransformed* document space, so shots can be framed
 * on a real thing ("the Dred Scott portrait") instead of a guessed pixel offset.
 * Returns {top, height, width, left} or null.
 */
export async function measure(page, sel, nth = 0) {
  return page.evaluate(
    ([sel, nth]) => {
      const b = document.body,
        keep = b.style.transform;
      b.style.transform = 'none';
      let els;
      if (sel.startsWith('alt:')) {
        const needle = sel.slice(4).toLowerCase();
        els = [...document.images].filter((i) => (i.alt || '').toLowerCase().includes(needle));
      } else if (sel.startsWith('text:')) {
        const needle = sel.slice(5).toLowerCase();
        els = [...document.querySelectorAll('h1,h2,h3,figure,blockquote')].filter(
          (e) => e.offsetParent !== null && e.textContent.toLowerCase().includes(needle),
        );
      } else {
        els = [...document.querySelectorAll(sel)].filter(
          (e) => e.offsetParent !== null || e.tagName === 'IMG',
        );
      }
      const e = els[nth];
      let r = null;
      if (e) {
        const bb = e.getBoundingClientRect();
        r = {
          top: Math.round(bb.top + scrollY),
          left: Math.round(bb.left + scrollX),
          height: Math.round(bb.height),
          width: Math.round(bb.width),
          text: (e.textContent || e.alt || '').trim().replace(/\s+/g, ' ').slice(0, 70),
        };
      }
      b.style.transform = keep;
      return r;
    },
    [sel, nth],
  );
}

/** y offset that centres `box` in the viewport at zoom z (plus optional bias). */
export function centreOn(box, z, vh = 1920, bias = 0) {
  return Math.round(box.top - (vh / z - box.height) / 2 + bias);
}

#!/usr/bin/env python3
"""Read-only public-site motion capture. Never touches product data or secrets."""
from __future__ import annotations
import asyncio
import concurrent.futures
import json
import os
import pathlib
import re
import shutil
import signal
import subprocess
import time
import urllib.parse

import requests
from playwright.async_api import async_playwright

ROOT = pathlib.Path('output')
REFERENCE = 'https://www.tiktok.com/@ambnt.prod/video/7670347350115634462'
VIDEO_ID = '7670347350115634462'
for directory in ['reference', 'captures', 'inspection', 'assets', 'project']:
    (ROOT / directory).mkdir(parents=True, exist_ok=True)
REPORT: dict = {'reference_url': REFERENCE, 'reference_verified': False, 'captures': [], 'errors': [], 'source_capture_fps': 60}


def acquire_reference() -> dict:
    """Try public delivery only; require matching post ID before using any mirror."""
    report: dict = {'attempts': [], 'verified': False}
    out = ROOT / 'reference'
    try:
        proc = subprocess.run([
            'yt-dlp', '--no-playlist', '--socket-timeout', '15', '--retries', '1',
            '--write-info-json', '--impersonate', 'chrome',
            '-o', str(out / 'reference.%(ext)s'), REFERENCE,
        ], capture_output=True, text=True, timeout=100)
        (out / 'yt-dlp.log').write_text(proc.stdout + '\n' + proc.stderr)
        report['attempts'].append({'method': 'yt-dlp-public-post', 'returncode': proc.returncode})
        info_path = out / 'reference.info.json'
        if info_path.exists():
            info = json.loads(info_path.read_text())
            report['metadata'] = {k: info.get(k) for k in ['id', 'uploader', 'uploader_id', 'duration', 'title', 'webpage_url']}
            media = [p for p in out.glob('reference.*') if p.suffix in {'.mp4', '.webm', '.m4a'}]
            if str(info.get('id')) == VIDEO_ID and media:
                report.update(verified=True, media=media[0].name, method='original-public-post')
    except Exception as exc:
        report['attempts'].append({'method': 'yt-dlp-public-post', 'error': str(exc)})
    if not report['verified']:
        try:
            response = requests.get('https://www.tikwm.com/api/', params={'url': REFERENCE, 'hd': '1'}, timeout=35)
            response.raise_for_status()
            payload = response.json()
            (out / 'public-mirror-metadata.json').write_text(json.dumps(payload, indent=2))
            data = payload.get('data') or {}
            author = data.get('author') or {}
            identifier = str(data.get('id') or data.get('aweme_id') or '')
            creator = author.get('unique_id') or author.get('uniqueId')
            report['attempts'].append({'method': 'public-mirror', 'code': payload.get('code'), 'id': identifier, 'author': creator, 'message': payload.get('msg')})
            if identifier == VIDEO_ID and creator == 'ambnt.prod':
                url = data.get('hdplay') or data.get('play') or data.get('wmplay')
                if url:
                    url = urllib.parse.urljoin('https://www.tikwm.com', url)
                    content = requests.get(url, timeout=60)
                    content.raise_for_status()
                    path = out / 'reference.mp4'
                    path.write_bytes(content.content)
                    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
                    probe_data = json.loads(probe.stdout)
                    if any(s.get('codec_type') == 'audio' for s in probe_data.get('streams', [])):
                        report.update(verified=True, media=path.name, method='public-mirror-matching-post-and-author', metadata={'id': identifier, 'author': creator, 'title': data.get('title'), 'duration': data.get('duration')}, probe=probe_data)
        except Exception as exc:
            report['attempts'].append({'method': 'public-mirror', 'error': str(exc)})
    (out / 'acquisition.json').write_text(json.dumps(report, indent=2))
    return report


def record_start(name: str) -> tuple[subprocess.Popen, object, pathlib.Path]:
    target = ROOT / 'captures' / (name + '.mp4')
    target.parent.mkdir(parents=True, exist_ok=True)
    log = open(target.with_suffix('.log'), 'w')
    proc = subprocess.Popen([
        'ffmpeg', '-hide_banner', '-y', '-f', 'x11grab', '-framerate', '60',
        '-video_size', '1080x1920', '-draw_mouse', '0', '-i', ':99.0+0,0',
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target),
    ], stdout=log, stderr=log)
    return proc, log, target


async def record(page, name: str, action=None, hold: float = 1.5):
    proc, log, target = record_start(name)
    started = time.monotonic()
    error = None
    try:
        await page.wait_for_timeout(1000)
        if action:
            await action()
        await page.wait_for_timeout(hold * 1000)
    except Exception as exc:
        error = str(exc)
        REPORT['errors'].append({'capture': name, 'error': error})
    finally:
        proc.send_signal(signal.SIGINT)
        try:
            proc.wait(timeout=40)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()
    metadata = {'name': name, 'file': str(target.relative_to(ROOT)), 'url': page.url, 'elapsed_seconds': time.monotonic() - started, 'error': error}
    REPORT['captures'].append(metadata)
    await page.screenshot(path=str(ROOT / 'inspection' / (name.replace('/', '-') + '.png')))
    (ROOT / 'capture-report.json').write_text(json.dumps(REPORT, indent=2))
    print('CAPTURE', json.dumps(metadata), flush=True)


async def smooth_scroll(page, delta: float, duration: float = 5000):
    await page.evaluate("""({delta,duration}) => new Promise(resolve => {
      const start = performance.now(), y = scrollY;
      const tick = now => { const p = Math.min(1,(now-start)/duration); const e = p*p*(3-2*p);
        scrollTo(0,y+delta*e); if(p<1) requestAnimationFrame(tick); else resolve(); };
      requestAnimationFrame(tick);
    })""", {'delta': delta, 'duration': duration})


async def inspect(page, name: str):
    result = await page.evaluate("""() => ({url:location.href,title:document.title,
      size:{innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio},
      body:document.body.innerText,
      headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({text:e.innerText,id:e.id,y:e.getBoundingClientRect().top+scrollY})),
      images:[...document.images].map(e=>({src:e.currentSrc,alt:e.alt,w:e.naturalWidth,h:e.naturalHeight,y:e.getBoundingClientRect().top+scrollY})),
      links:[...document.querySelectorAll('a[href]')].map(e=>({href:e.getAttribute('href'),text:e.innerText})),
      buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,label:e.getAttribute('aria-label'),cls:e.className}))
    })""")
    (ROOT / 'inspection' / (name + '.json')).write_text(json.dumps(result, indent=2))
    (ROOT / 'inspection' / (name + '.html')).write_text(await page.content())
    return result


async def settle(page, url: str):
    response = await page.goto(url, wait_until='domcontentloaded', timeout=60000)
    if response and response.status >= 400:
        raise RuntimeError(f'{url}: HTTP {response.status}')
    await page.wait_for_timeout(6500)
    await page.evaluate('document.fonts.ready')
    await page.add_style_tag(content='*{cursor:none!important}html{scrollbar-width:none}::-webkit-scrollbar{display:none!important}')
    await page.mouse.move(1, 1)


async def capture_site():
    xvfb = subprocess.Popen(['Xvfb', ':99', '-screen', '0', '1080x1920x24', '-nolisten', 'tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    os.environ['DISPLAY'] = ':99'
    async with async_playwright() as p:
        chrome = subprocess.Popen([
            p.chromium.executable_path, '--no-sandbox', '--disable-dev-shm-usage',
            '--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble',
            '--kiosk', '--start-fullscreen', '--force-device-scale-factor=2',
            '--window-position=0,0', '--window-size=540,960',
            '--remote-debugging-port=9222', '--user-data-dir=/tmp/blackstory-ad-profile',
            '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader', '--hide-scrollbars',
            '--autoplay-policy=no-user-gesture-required', '--app=https://blackstory.app',
        ], stdout=subprocess.DEVNULL, stderr=open(ROOT / 'inspection' / 'chrome.log', 'w'))
        await asyncio.sleep(4)
        browser = await p.chromium.connect_over_cdp('http://127.0.0.1:9222')
        context = browser.contexts[0]
        page = context.pages[0]
        await page.emulate_media(color_scheme='dark', reduced_motion='no-preference')
        try:
            await settle(page, 'https://blackstory.app')
            dimensions = await page.evaluate('({innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio})')
            REPORT['geometry'] = dimensions
            print('GEOMETRY', json.dumps(dimensions), flush=True)
            if dimensions['innerWidth'] != 540 or dimensions['innerHeight'] != 960:
                REPORT['errors'].append({'geometry': dimensions, 'expected': 'CSS 540x960 at DPR 2; inspect physical recording before editorial use'})
            await inspect(page, 'home')
            await record(page, 'map/door-opening', hold=5)
            async def begin():
                await page.get_by_role('button', name='Begin', exact=True).click()
                await page.wait_for_timeout(4500)
            await record(page, 'map/door-begin', begin, 2)
            for i in range(1, 7):
                chapter = page.locator(f'#door-chapter-{i}')
                if await chapter.count():
                    async def advance(chapter=chapter):
                        delta = await chapter.evaluate('(e)=>e.getBoundingClientRect().top-140')
                        await smooth_scroll(page, delta, 3000)
                        await page.wait_for_timeout(3500)
                    await record(page, f'map/journey-{i}', advance, 1.5)
            await settle(page, 'https://blackstory.app/explore')
            hide = page.get_by_role('button', name='Hide filters', exact=True)
            if await hide.count():
                await hide.click()
                await page.wait_for_timeout(1800)
            await inspect(page, 'explore-clear')
            async def drift():
                await page.mouse.move(250, 430)
                await page.mouse.down()
                for i in range(90):
                    await page.mouse.move(250 + i*0.55, 430 + i*0.15)
                    await page.wait_for_timeout(33)
                await page.mouse.up()
                await page.mouse.move(1, 1)
            await record(page, 'map/national-drift', drift, 2)
            async def zoom():
                await page.mouse.move(410, 410)
                for _ in range(5):
                    await page.mouse.wheel(0, -110)
                    await page.wait_for_timeout(650)
                await page.mouse.move(1, 1)
            await record(page, 'map/east-zoom', zoom, 2)
            for state in ['NY', 'DC']:
                await settle(page, 'https://blackstory.app/explore?state=' + state)
                hide = page.get_by_role('button', name='Hide filters', exact=True)
                if await hide.count():
                    await hide.click()
                    await page.wait_for_timeout(1200)
                await inspect(page, 'map-' + state)
                await record(page, 'map/' + state.lower() + '-drift', drift, 2)
                await record(page, 'map/' + state.lower() + '-zoom', zoom, 2)
            routes = [
                ('records/index', '/records', 800),
                ('entities/du-bois', '/entity/ent_web_du_bois_001', 1000),
                ('entities/phillis-wheatley', '/entity/ent_phillis_wheatley_001', 950),
                ('entities/first-african-baptist', '/place/first-african-baptist-church', 950),
                ('entities/mother-bethel', '/place/mother-bethel-ame-church', 950),
                ('stories/index', '/stories', 900),
                ('stories/buying-a-home', '/stories/buying-a-home', 1200),
                ('lives/overview', '/lives', 1300),
                ('data/overview', '/data', 1250),
            ]
            for name, route, distance in routes:
                try:
                    await settle(page, 'https://blackstory.app' + route)
                    info = await inspect(page, name.replace('/', '-'))
                    await record(page, name, lambda distance=distance: smooth_scroll(page, distance, 6500), 2)
                    if name.startswith('entities/'):
                        evidence = page.get_by_text(re.compile(r'^(Sources|Evidence|The evidence|Sources and evidence|What supports this)$', re.I)).first
                        if await evidence.count():
                            await evidence.scroll_into_view_if_needed()
                            await page.wait_for_timeout(1000)
                        await record(page, 'evidence/' + name.split('/')[1], lambda: smooth_scroll(page, 700, 5000), 2)
                    if name == 'lives/overview':
                        anchor = page.locator('#era-1900-1930')
                        if await anchor.count():
                            await anchor.scroll_into_view_if_needed()
                            await page.wait_for_timeout(1200)
                        await record(page, 'lives/decades', lambda: smooth_scroll(page, 1600, 7500), 2)
                    if name == 'data/overview':
                        charts = page.locator('svg').filter(has_not=page.locator('symbol'))
                        await record(page, 'data/series', lambda: smooth_scroll(page, 1900, 8000), 2)
                except Exception as exc:
                    REPORT['errors'].append({'route': route, 'error': str(exc)})
            await settle(page, 'https://blackstory.app/memorial')
            await inspect(page, 'memorial')
            await record(page, 'memorial/wall', hold=16)
            read = page.get_by_role('link', name=re.compile('READ EVERY NAME', re.I))
            if await read.count():
                await read.click()
                await page.wait_for_timeout(2500)
            await record(page, 'memorial/names', lambda: smooth_scroll(page, 240, 8000), 3)
            # Inspect original delivery metadata, including public embedded players.
            for label, url in [
                ('post', REFERENCE),
                ('embed', 'https://www.tiktok.com/embed/v2/' + VIDEO_ID),
                ('player', 'https://www.tiktok.com/player/v1/' + VIDEO_ID),
            ]:
                try:
                    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                    await page.wait_for_timeout(5000)
                    (ROOT / 'reference' / (label + '.html')).write_text(await page.content())
                    state = await page.evaluate("""() => ({url:location.href,title:document.title,body:document.body.innerText,videos:[...document.querySelectorAll('video')].map(e=>({src:e.currentSrc,duration:e.duration})),scripts:[...document.querySelectorAll('script[type="application/json"]')].map(e=>({id:e.id,text:e.textContent}))})""")
                    (ROOT / 'reference' / (label + '.json')).write_text(json.dumps(state, indent=2))
                except Exception as exc:
                    REPORT['errors'].append({'reference_browser': label, 'error': str(exc)})
        finally:
            await browser.close()
            chrome.terminate()
    xvfb.terminate()


if __name__ == '__main__':
    for path in pathlib.Path('apps/web/public/brand').glob('*.png'):
        if path.name.startswith(('lockup-', 'symbol-')):
            shutil.copy2(path, ROOT / 'assets' / path.name)
    shutil.copy2(__file__, ROOT / 'project' / pathlib.Path(__file__).name)
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        reference_future = executor.submit(acquire_reference)
        try:
            asyncio.run(capture_site())
        except Exception as exc:
            REPORT['errors'].append({'fatal_capture_error': str(exc)})
            print('CAPTURE ERROR', repr(exc), flush=True)
        REPORT['reference'] = reference_future.result()
        REPORT['reference_verified'] = REPORT['reference']['verified']
    (ROOT / 'capture-report.json').write_text(json.dumps(REPORT, indent=2))
    print(json.dumps(REPORT, indent=2), flush=True)

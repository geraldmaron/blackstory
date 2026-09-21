"""Read-only public-site acquisition for the isolated BlackStory ad production.
Run with --mode reference or --mode capture. Writes only _ad_artifacts locally.
No accounts, credentials, database, or publication endpoints are used.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import requests
from playwright.async_api import async_playwright

OUT = Path('_ad_artifacts')
BASE = 'https://blackstory.app'
REFERENCE = 'https://www.tiktok.com/@ambnt.prod/video/7670347350115634462'
VIDEO_ID = '7670347350115634462'
for name in ['reference', 'captures', 'inspection', 'assets', 'provenance', 'scripts']:
    (OUT / name).mkdir(parents=True, exist_ok=True)

def utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def dump(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False))

def probe(path: Path) -> dict:
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

async def acquire_reference() -> None:
    result = {'started_utc': utc(), 'original_url': REFERENCE, 'id': VIDEO_ID, 'verified': False, 'downloaded': False, 'attempts': []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--disable-dev-shm-usage'])
        ctx = await browser.new_context(viewport={'width': 960, 'height': 1080})
        page = await ctx.new_page()
        try:
            await page.goto(REFERENCE, wait_until='domcontentloaded', timeout=65000)
            await page.wait_for_timeout(6000)
            await page.screenshot(path=str(OUT/'reference'/'verified-post.png'))
            state = await page.locator('script#__UNIVERSAL_DATA_FOR_REHYDRATION__').text_content()
            if not state:
                raise RuntimeError('TikTok hydration metadata unavailable; no substitute audio will be used.')
            obj = json.loads(state)
            item = obj['__DEFAULT_SCOPE__']['webapp.video-detail']['itemInfo']['itemStruct']
            dump(OUT/'reference'/'reference-item.json', item)
            if str(item.get('id')) != VIDEO_ID or item.get('author', {}).get('uniqueId') != 'ambnt.prod':
                raise RuntimeError('Reference identity did not match both ID and creator.')
            result['verified'] = True
            result['creator'] = item['author']['uniqueId']
            result['metadata_duration'] = item['video']['duration']
            result['music_precise_duration'] = item.get('music', {}).get('preciseDuration')
            urls = [item['video'].get('playAddr')]
            urls += item['video'].get('PlayAddrStruct', {}).get('UrlList', [])
            urls += [item['video'].get('downloadAddr')]
            urls = list(dict.fromkeys(u for u in urls if isinstance(u, str) and u.startswith('https://')))
            ua = await page.evaluate('navigator.userAgent')
            for ix, url in enumerate(urls[:5]):
                try:
                    resp = await ctx.request.get(url, headers={'Referer': REFERENCE, 'User-Agent': ua}, timeout=60000)
                    body = await resp.body()
                    record = {'method': 'browser-session request', 'status': resp.status, 'bytes': len(body), 'content_type': resp.headers.get('content-type')}
                    result['attempts'].append(record)
                    if resp.ok and len(body) > 100000:
                        candidate = OUT/'reference'/'ambnt-7670347350115634462.mp4'
                        candidate.write_bytes(body)
                        info = probe(candidate)
                        if any(s['codec_type'] == 'audio' for s in info['streams']):
                            result.update({'downloaded': True, 'filename': candidate.name, 'sha256': sha(candidate), 'source_url': url, 'ffprobe': info})
                            break
                except Exception as exc:
                    result['attempts'].append({'method': 'browser-session request', 'error': str(exc)})
            if not result['downloaded']:
                session = requests.Session()
                session.headers.update({'User-Agent': ua, 'Referer': REFERENCE})
                for cookie in await ctx.cookies():
                    session.cookies.set(cookie['name'], cookie['value'], domain=cookie['domain'])
                for url in urls[:3]:
                    try:
                        response = session.get(url, timeout=60)
                        result['attempts'].append({'method': 'requests-session', 'status': response.status_code, 'bytes': len(response.content)})
                        if response.ok and len(response.content) > 100000:
                            candidate = OUT/'reference'/'ambnt-7670347350115634462.mp4'
                            candidate.write_bytes(response.content)
                            info = probe(candidate)
                            if any(s['codec_type'] == 'audio' for s in info['streams']):
                                result.update({'downloaded': True, 'filename': candidate.name, 'sha256': sha(candidate), 'source_url': url, 'ffprobe': info})
                                break
                    except Exception as exc:
                        result['attempts'].append({'method': 'requests-session', 'error': str(exc)})
            if result['downloaded']:
                source = OUT/'reference'/result['filename']
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-vn', '-c:a', 'pcm_s24le', '-ar', '48000', str(OUT/'reference'/'reference-audio.wav')], check=True)
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(source), '-vn', '-c:a', 'copy', str(OUT/'reference'/'reference-audio.m4a')], check=True)
        except Exception as exc:
            result['error'] = traceback.format_exc()
        finally:
            await browser.close()
            result['finished_utc'] = utc()
            dump(OUT/'reference'/'acquisition.json', result)
            print('REFERENCE_RESULT', json.dumps({k:v for k,v in result.items() if k not in ['ffprobe','source_url']}), flush=True)

SCROLL_JS = """({delta,ms})=>new Promise(resolve=>{const start=window.scrollY;const begin=performance.now();function step(now){const t=Math.min(1,(now-begin)/ms);const e=t*t*(3-2*t);window.scrollTo(0,start+delta*e);if(t<1)requestAnimationFrame(step);else resolve(window.scrollY);}requestAnimationFrame(step);})"""

async def capture_product() -> None:
    report = {'started_utc': utc(), 'capture_kind': 'real X11 browser motion', 'target_fps': 60, 'physical_resolution': [1080,1920], 'captures': [], 'errors': []}
    report['commit'] = subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip()
    xvfb = subprocess.Popen(['Xvfb', ':91', '-screen', '0', '1080x2200x24', '-ac', '-nolisten', 'tcp'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, env={**os.environ, 'DISPLAY': ':91'}, args=['--no-sandbox', '--window-position=0,0', '--window-size=540,1047', '--force-device-scale-factor=2', '--disable-dev-shm-usage', '--no-first-run', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'])
        ctx = await browser.new_context(no_viewport=True, reduced_motion='no-preference')
        page = await ctx.new_page()
        await page.goto('about:blank')
        metrics = await page.evaluate('({iw:innerWidth,ih:innerHeight,ow:outerWidth,oh:outerHeight,dpr:devicePixelRatio})')
        if metrics['iw'] != 540 or metrics['ih'] != 960:
            session = await ctx.new_cdp_session(page)
            window = await session.send('Browser.getWindowForTarget')
            chrome = metrics['oh']-metrics['ih']
            await session.send('Browser.setWindowBounds', {'windowId': window['windowId'], 'bounds': {'left':0,'top':0,'width':540,'height':960+chrome,'windowState':'normal'}})
            await asyncio.sleep(1)
            metrics = await page.evaluate('({iw:innerWidth,ih:innerHeight,ow:outerWidth,oh:outerHeight,dpr:devicePixelRatio})')
        report['viewport_metrics'] = metrics
        assert metrics['iw']*metrics['dpr'] == 1080 and metrics['ih']*metrics['dpr'] == 1920, metrics
        yoffset = round((metrics['oh']-metrics['ih'])*metrics['dpr'])
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        async def save_report():
            dump(OUT/'capture-report.json', report)
        async def settle(seconds=4):
            await page.evaluate('document.fonts.ready')
            await page.wait_for_timeout(seconds*1000)
        async def goto(route):
            resp = await page.goto(BASE+route, wait_until='domcontentloaded', timeout=60000)
            if not resp or resp.status >= 400:
                raise RuntimeError('Product returned '+str(resp.status if resp else None))
            await settle(5)
            await page.add_style_tag(content='html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}*{cursor:none!important}')
            await page.mouse.move(2,959)
        async def scroll(delta, seconds):
            return await page.evaluate(SCROLL_JS, {'delta':delta, 'ms':seconds*1000})
        async def position(selector, offset=170):
            loc = page.locator(selector).first
            if not await loc.count():
                raise RuntimeError('Position target missing: '+selector)
            await loc.evaluate('(e,offset)=>window.scrollTo(0,e.getBoundingClientRect().top+window.scrollY-offset)', offset)
            await settle(2)
        async def record(name, surface, action, duration=8):
            start = utc()
            path = OUT/'captures'/surface/f'{name}.mp4'
            path.parent.mkdir(exist_ok=True)
            item = {'name':name,'file':str(path.relative_to(OUT)), 'url':page.url, 'surface':surface, 'started_utc':start, 'viewport':metrics, 'frame_rate':60, 'action':action.__name__, 'planned_duration':duration}
            print('CAPTURE_START',name,flush=True)
            await page.screenshot(path=str(OUT/'inspection'/f'{name}-in.png'))
            item['text_start'] = (await page.locator('body').inner_text())[:16000]
            item['images'] = await page.locator('img').evaluate_all('(a)=>a.filter(x=>x.naturalWidth>100).map(x=>({alt:x.alt,src:x.currentSrc,width:x.naturalWidth,height:x.naturalHeight}))')
            item['headings'] = await page.locator('h1,h2,h3').evaluate_all('(a)=>a.map(x=>({text:x.innerText,id:x.id}))')
            (OUT/'inspection'/f'{name}.html').write_text(await page.content())
            log = (OUT/'provenance'/f'{name}-ffmpeg.log').open('w')
            cmd = ['ffmpeg','-y','-hide_banner','-loglevel','warning','-thread_queue_size','1024','-f','x11grab','-framerate','60','-video_size','1080x1920','-draw_mouse','0','-i',f':91.0+0,{yoffset}','-an','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(path)]
            item['ffmpeg_command'] = cmd
            proc = subprocess.Popen(cmd, stdout=log, stderr=log, stdin=subprocess.PIPE)
            begun = time.monotonic()
            try:
                await asyncio.sleep(0.65)
                item['action_start_offset'] = time.monotonic()-begun
                await action()
                remaining = duration-(time.monotonic()-begun)
                await asyncio.sleep(max(remaining,0.5))
            except Exception as exc:
                item['action_error'] = str(exc)
            finally:
                proc.communicate(input=b'q\n', timeout=30)
                log.close()
                item['elapsed'] = time.monotonic()-begun
                item['probe'] = probe(path)
                item['sha256'] = sha(path)
                item['errors'] = errors[-10:]
                await page.screenshot(path=str(OUT/'inspection'/f'{name}-out.png'))
                item['final_url'] = page.url
                report['captures'].append(item)
                await save_report()
                print('CAPTURE_END',name,item.get('action_error'),flush=True)
        async def hold():
            await asyncio.sleep(5)
        async def gentle_scroll():
            await scroll(360,5.5)
        async def story_scroll():
            await scroll(650,6)
        async def evidence_scroll():
            await scroll(280,5.5)
        async def journey():
            await scroll(1200,4)
            await asyncio.sleep(2)
            await scroll(1000,3)
        async def map_zoom():
            canvas = page.locator('canvas.maplibregl-canvas').first
            b = await canvas.bounding_box()
            if not b:
                raise RuntimeError('No rendered map canvas')
            await page.mouse.move(305,405)
            await page.mouse.wheel(0,-430)
            await asyncio.sleep(2.8)
            await page.mouse.wheel(0,-320)
            await asyncio.sleep(2.5)
            await page.mouse.move(2,959)
        async def map_drift():
            await page.mouse.move(340,435)
            await page.mouse.down()
            for i in range(100):
                t=(i+1)/100
                await page.mouse.move(340-110*(t*t*(3-2*t)),435+55*t)
                await asyncio.sleep(.035)
            await page.mouse.up()
            await page.mouse.move(2,959)
            await asyncio.sleep(2)
        async def map_out():
            await page.mouse.move(275,450)
            await page.mouse.wheel(0,500)
            await asyncio.sleep(3)
            await page.mouse.wheel(0,350)
            await asyncio.sleep(2)
            await page.mouse.move(2,959)
        async def close_filters():
            button = page.get_by_role('button',name='Hide filters',exact=True)
            if await button.count():
                await button.click()
                await settle(2)
        async def section(route, name, surface, selector=None, action=gentle_scroll, duration=8, offset=170):
            try:
                await goto(route)
                if selector:
                    await position(selector, offset)
                await record(name,surface,action,duration)
            except Exception as exc:
                report['errors'].append({'name':name,'error':traceback.format_exc()})
                print('CAPTURE_FAILURE',name,str(exc),flush=True)
                await save_report()
        try:
            await goto('/explore')
            await close_filters()
            await record('map-national-drift','map',map_drift,9)
            await record('map-national-zoom','map',map_zoom,9)
            await record('map-outward','map',map_out,9)
        except Exception as exc:
            report['errors'].append({'name':'map-national','error':traceback.format_exc()})
        for state in ['DC','LA','NY']:
            try:
                await goto('/explore?state='+state)
                await close_filters()
                await record('map-'+state.lower()+'-zoom','map',map_zoom,9)
                await record('map-'+state.lower()+'-drift','map',map_drift,8)
            except Exception as exc:
                report['errors'].append({'name':'map-'+state,'error':traceback.format_exc()})
        await section('/', 'door-native-journey','map',action=journey,duration=12)
        await section('/records','records-flow','records','main',story_scroll,8,80)
        people = [('/entity/ent_phillis_wheatley_001','phillis-wheatley'),('/entity/ent_benjamin_banneker_001','benjamin-banneker'),('/entity/ent_harriet_jacobs_001','harriet-jacobs'),('/place/treme','treme'),('/place/mother-bethel-ame-church','mother-bethel')]
        for route,name in people:
            try:
                await goto(route)
                await record(name+'-record','entities',gentle_scroll,8)
                hero = page.locator('main img').filter(visible=True)
                imgs = await page.locator('main img').evaluate_all('(a)=>a.map((x,i)=>({i,w:x.naturalWidth,h:x.naturalHeight,top:x.getBoundingClientRect().top+scrollY,alt:x.alt})).filter(x=>x.w>=200&&x.h>=150)')
                if imgs:
                    await page.evaluate('(y)=>window.scrollTo(0,Math.max(0,y-180))',imgs[0]['top'])
                    await settle(2)
                    await record(name+'-image','entities',evidence_scroll,8)
                headings = page.get_by_role('heading').filter(has_text=re.compile('evidence|sources|citations',re.I))
                if await headings.count():
                    await headings.first.evaluate('(e)=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-220)')
                    await settle(2)
                    await record(name+'-evidence','evidence',evidence_scroll,8)
            except Exception as exc:
                report['errors'].append({'name':name,'error':traceback.format_exc()})
                print('ENTITY_FAILURE',name,str(exc),flush=True)
                await save_report()
        await section('/stories/buying-a-home','story-holc-map','stories','figure.ds-article-mast',evidence_scroll,9,240)
        await section('/stories/the-count','story-source-document','stories','figure.ds-article-mast',evidence_scroll,8,240)
        await section('/lives','lives-archive-image','lives','.ds-archive-figure',evidence_scroll,9,200)
        await section('/lives','lives-decades','lives','#lives-era-1900-1930',story_scroll,10,230)
        await section('/data','data-counted','data','#counted-heading',story_scroll,10,180)
        await section('/data','data-measured-gaps','data','#gaps-heading',story_scroll,10,180)
        await section('/memorial','memorial-living-wall','memorial',action=hold,duration=13)
        await section('/memorial','memorial-readable-names','memorial','#memorial-names-A-heading',evidence_scroll,11,250)
        await browser.close()
    xvfb.terminate()
    report['finished_utc'] = utc()
    dump(OUT/'capture-report.json',report)
    print('CAPTURE_RESULT',json.dumps({'captures':len(report['captures']),'errors':report['errors']}),flush=True)

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--mode',choices=['reference','capture'],required=True)
    args=parser.parse_args()
    shutil.copy2(__file__, OUT/'scripts'/'acquire-capture.py')
    for path in Path('apps/web/public/brand').glob('*.png'):
        if 'lockup' in path.name or 'symbol' in path.name:
            shutil.copy2(path,OUT/'assets'/path.name)
    dump(OUT/'provenance'/'repo.json',{'repository':'geraldmaron/blackstory','commit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'retrieved_utc':utc()})
    asyncio.run(acquire_reference() if args.mode=='reference' else capture_product())

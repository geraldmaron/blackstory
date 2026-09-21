"""Capture public BlackStory browser motion into reusable 1080x1920/60 fps clips.

The browser content rectangle is calibrated against an X11 screen grab. Chrome UI is
outside every recording. This does not modify the application or its records.
Requires Linux, Xvfb, FFmpeg, Playwright Chromium, Pillow and opencv-python-headless.
Run: python tools/media/blackstory_capture.py --group map --output output
"""
from __future__ import annotations
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import traceback
from typing import Awaitable, Callable
import cv2
import numpy as np
from playwright.async_api import async_playwright, Page

WIDTH, HEIGHT, FPS = 1080, 1920, 60
DISPLAY = ':99'
BASE = 'https://blackstory.app'

class Capture:
    def __init__(self, root: Path, group: str):
        self.root = root
        self.group = group
        self.page: Page | None = None
        self.offset = (0, 174)
        self.records: list[dict] = []
        for name in ('captures', 'review', 'metadata', 'assets', 'project'):
            (root / name).mkdir(parents=True, exist_ok=True)
        shutil.copy2(__file__, root / 'project' / Path(__file__).name)

    def save(self):
        (self.root / 'metadata' / (self.group + '.json')).write_text(json.dumps({
            'site': BASE, 'group': self.group, 'capture': 'Continuous X11 recording of real browser interaction',
            'width': WIDTH, 'height': HEIGHT, 'fps': FPS, 'content_offset': self.offset,
            'clips': self.records,
        }, indent=2))

    async def calibrate(self):
        assert self.page is not None
        await self.page.set_content('<html><body style="margin:0;background:#0a0a0a;color:#f4efe5;font:64px sans-serif"><div style="height:80px;background:#b86b2a">CALIBRATION</div><div style="padding:24px">0123456789</div><div style="height:500px;background:#383027"></div></body></html>')
        await self.page.wait_for_timeout(600)
        await self.page.screenshot(path=str(self.root / 'review' / 'calibration-page.png'))
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'x11grab',
                        '-draw_mouse', '0', '-video_size', '1200x2160', '-i', DISPLAY + '.0',
                        '-frames:v', '1', str(self.root / 'review' / 'calibration-screen.png')], check=True)
        screen = cv2.imread(str(self.root / 'review' / 'calibration-screen.png'))
        page = cv2.imread(str(self.root / 'review' / 'calibration-page.png'))
        match = cv2.matchTemplate(screen, page[:400], cv2.TM_CCOEFF_NORMED)
        _, confidence, _, offset = cv2.minMaxLoc(match)
        if confidence < 0.985 or offset[0] + WIDTH > 1200 or offset[1] + HEIGHT > 2160:
            raise RuntimeError(f'Browser rectangle calibration failed: {confidence}, {offset}')
        self.offset = offset
        (self.root / 'review' / 'calibration-page.png').unlink()
        (self.root / 'review' / 'calibration-screen.png').unlink()
        self.save()

    async def goto(self, path: str, label: str):
        assert self.page is not None
        response = await self.page.goto(BASE + path, wait_until='domcontentloaded', timeout=45000)
        if response is None or response.status >= 400:
            raise RuntimeError(f'Unavailable public page: {path}')
        await self.page.wait_for_timeout(6500 if path.startswith('/explore') or path == '/' else 3500)
        await self.page.evaluate('document.fonts.ready')
        await self.page.add_style_tag(content='html{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}*{cursor:none!important}')
        await self.page.evaluate('''async () => {
          const images = [...document.images];
          images.forEach(i => {i.loading='eager';});
          await Promise.race([Promise.all(images.map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,5000))]);
        }''')
        await self.page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
        await self.page.wait_for_timeout(1000)
        meta = await self.page.evaluate('''() => ({
          title:document.title,url:location.href,height:document.documentElement.scrollHeight,
          headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({tag:e.tagName,text:e.innerText,y:e.getBoundingClientRect().top+scrollY})),
          images:[...document.querySelectorAll('main img')].map(e=>({src:e.currentSrc,alt:e.alt,loaded:e.complete&&e.naturalWidth>0,width:e.naturalWidth,height:e.naturalHeight,y:e.getBoundingClientRect().top+scrollY})),
          links:[...document.querySelectorAll('main a[href]')].map(e=>({text:e.innerText,href:e.getAttribute('href')}))
        })''')
        (self.root / 'metadata' / (label + '.json')).write_text(json.dumps(meta, indent=2))
        (self.root / 'metadata' / (label + '.html')).write_text(await self.page.content())
        await self.page.screenshot(path=str(self.root / 'review' / (label + '-page.png')))
        return meta

    async def position(self, y: float):
        assert self.page is not None
        await self.page.evaluate('(y)=>window.scrollTo({top:y,behavior:"instant"})', max(0, y))
        await self.page.wait_for_timeout(900)

    async def scroll(self, pixels: float, seconds: float):
        assert self.page is not None
        await self.page.evaluate('''({pixels,seconds}) => new Promise(resolve => {
          const origin=window.scrollY, start=performance.now();
          const destination=Math.max(0, Math.min(origin+pixels,document.documentElement.scrollHeight-innerHeight));
          function tick(now){
            const t=Math.min(1,(now-start)/(seconds*1000));
            const eased=t*t*(3-2*t);
            window.scrollTo({top:origin+(destination-origin)*eased,behavior:'instant'});
            if(t<1) requestAnimationFrame(tick); else resolve();
          }
          requestAnimationFrame(tick);
        })''', {'pixels': pixels, 'seconds': seconds})

    async def drag(self, start: tuple[float, float], end: tuple[float, float], seconds: float):
        assert self.page is not None
        await self.page.mouse.move(*start)
        await self.page.mouse.down()
        begin = time.monotonic()
        for i in range(1, round(seconds * 40) + 1):
            t = min(1, i / round(seconds * 40))
            u = t*t*(3-2*t)
            await self.page.mouse.move(start[0]+(end[0]-start[0])*u, start[1]+(end[1]-start[1])*u)
            await asyncio.sleep(max(0, begin + i/40 - time.monotonic()))
        await self.page.mouse.up()

    async def shot(self, name: str, surface: str, action: str, perform: Callable[[], Awaitable[None]], handles: float = 0.85):
        assert self.page is not None
        folder = self.root / 'captures' / surface
        folder.mkdir(parents=True, exist_ok=True)
        file = folder / (name + '.mp4')
        log = (self.root / 'metadata' / (name + '-ffmpeg.log')).open('w')
        command = ['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','x11grab','-draw_mouse','0',
                   '-framerate',str(FPS),'-video_size',f'{WIDTH}x{HEIGHT}',
                   '-i',f'{DISPLAY}.0+{self.offset[0]},{self.offset[1]}',
                   '-an','-c:v','libx264','-preset','ultrafast','-crf','17','-threads','2',
                   '-pix_fmt','yuv420p','-movflags','+faststart',str(file)]
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=log, stderr=log)
        begin = time.monotonic()
        record = {'name': name, 'surface': surface, 'action': action, 'file': str(file.relative_to(self.root)), 'url': self.page.url}
        try:
            await asyncio.sleep(handles)
            if process.poll() is not None:
                raise RuntimeError('Screen recorder exited before the shot')
            record['action_start_wall_seconds'] = round(time.monotonic()-begin, 3)
            await perform()
            record['action_end_wall_seconds'] = round(time.monotonic()-begin, 3)
            await asyncio.sleep(handles)
            record['status'] = 'captured'
        except Exception as exc:
            record['status'] = 'capture_failed'
            record['error'] = str(exc)
        finally:
            if process.poll() is None:
                process.communicate(input=b'q\n', timeout=25)
            log.close()
            record['recorder_exit_code'] = process.returncode
            if file.exists():
                probe = subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(file)],capture_output=True,text=True)
                if probe.returncode == 0:
                    record['media'] = json.loads(probe.stdout)
                    for second in (1, 4):
                        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(second),'-i',str(file),'-frames:v','1','-vf','scale=360:640',str(self.root/'review'/f'{name}-{second}s.jpg')],capture_output=True)
            record['final_body_excerpt'] = (await self.page.locator('body').inner_text())[:3500]
            self.records.append(record)
            self.save()
            print(json.dumps({k:record[k] for k in ['name','status','file','recorder_exit_code']}, indent=2), flush=True)

    async def close_filters(self):
        assert self.page is not None
        button = self.page.get_by_role('button', name='Hide filters', exact=True)
        if await button.count() and await button.first.is_visible():
            await button.first.click()
            await self.page.wait_for_timeout(1000)

    async def map_group(self):
        assert self.page is not None
        await self.goto('/', 'door')
        height = await self.page.evaluate('document.documentElement.scrollHeight-innerHeight')
        await self.shot('door-journey','map','Native scroll-driven national map, chapter camera flights and changing records', lambda: self.scroll(height * .91, 25))
        await self.shot('door-return','map','Native journey returns outward through the pin field', lambda: self.scroll(-height, 13))
        await self.goto('/explore', 'national')
        await self.close_filters()
        canvas = self.page.locator('canvas.maplibregl-canvas').first
        await canvas.focus()
        await self.page.keyboard.press('-')
        await self.page.wait_for_timeout(2200)
        await self.shot('national-drift','map','Real national map pan, preserving geographic labels', lambda: self.drag((255,455),(293,471),7))
        async def zoom():
            await self.page.mouse.move(383,385)
            await self.page.mouse.dblclick(383,385,delay=110)
            await self.page.wait_for_timeout(1900)
            await self.page.mouse.dblclick(332,407,delay=110)
            await self.page.wait_for_timeout(2300)
            await self.drag((285,455),(261,448),2)
        await self.shot('national-to-region','map','Native map zooms on double-click and settles into the region', zoom)
        for state in ('NY','GA','DC'):
            await self.goto('/explore?state='+state, 'state-'+state)
            await self.close_filters()
            await self.shot('state-'+state+'-drift','map','Public state-filtered pin field, slow native camera pan',lambda: self.drag((270,452),(302,439),6))
            if state == 'NY':
                async def select():
                    await self.page.mouse.click(278,444)
                    await self.page.wait_for_timeout(2300)
                    await self.page.mouse.dblclick(279,458,delay=110)
                    await self.page.wait_for_timeout(2500)
                await self.shot('ny-pin-interaction','map','Native pin and cluster interaction; review selection before editorial use',select)

    async def editorial_group(self):
        assert self.page is not None
        await self.goto('/records', 'records')
        await self.position(160)
        await self.shot('records-index','records','Smooth scroll through the actual chronological record index',lambda:self.scroll(1140,8))
        for name, path in [('du-bois','/entity/ent_web_du_bois_001'),('wheatley','/entity/ent_phillis_wheatley_001'),('banneker','/entity/ent_benjamin_banneker_001')]:
            try:
                meta = await self.goto(path, name)
                await self.position(50)
                await self.shot(name+'-record','entities','Actual person record with context; smooth scroll from heading toward imagery',lambda:self.scroll(600,7))
                images = [x for x in meta['images'] if x['loaded'] and x['width']>180 and x['height']>150 and x['y']>100]
                if images:
                    await self.position(max(0,images[0]['y']-200))
                    await self.shot(name+'-photograph','entities','Real record image with surrounding context, slow browser movement',lambda:self.scroll(155,6))
                evidence = [x for x in meta['headings'] if any(word in x['text'].lower() for word in ('source','evidence','reference','citation'))]
                if evidence and name == 'du-bois':
                    await self.position(max(0,evidence[0]['y']-230))
                    await self.shot('du-bois-evidence','evidence','Source and citation section of the same public person record',lambda:self.scroll(260,6))
            except Exception as exc:
                self.records.append({'name':name,'status':'page_failed','error':str(exc)}); self.save()
        await self.goto('/stories/buying-a-home','story-home')
        await self.position(80)
        await self.shot('story-opening','stories','Native editorial chapter opening and historical evidence',lambda:self.scroll(900,9))
        images = await self.page.locator('main img').evaluate_all('(xs)=>xs.filter(e=>e.naturalWidth>300).map(e=>({y:e.getBoundingClientRect().top+scrollY,h:e.getBoundingClientRect().height,alt:e.alt}))')
        if images:
            await self.position(max(0,images[0]['y']-210))
            await self.shot('story-archive-image','stories','Original archival map in its published story, with natural browser drift',lambda:self.scroll(180,6))

    async def context_group(self):
        assert self.page is not None
        meta = await self.goto('/lives','lives')
        image = next((x for x in meta['images'] if x['loaded'] and x['width']>200),None)
        if image:
            await self.position(max(0,image['y']-260))
            await self.shot('lives-archive','lives','Du Bois archival chart inside the published Lives encounter',lambda:self.scroll(220,8))
        era = self.page.locator('#era-1900-1930')
        if await era.count():
            y=await era.evaluate('(e)=>e.getBoundingClientRect().top+scrollY')
            await self.position(max(0,y-160))
            await self.shot('lives-decades','lives','Native scroll through period-labeled lives and evidence',lambda:self.scroll(1500,10))
        await self.goto('/data','data')
        chart = self.page.locator('svg.ds-data-chart__svg').first
        if await chart.count():
            y=await chart.evaluate('(e)=>e.getBoundingClientRect().top+scrollY')
            await self.position(max(0,y-250))
            await self.shot('data-history','data','Actual historical data visualization with period and source context',lambda:self.scroll(470,7))
        later = self.page.locator('svg.ds-data-chart__svg--wide').first
        if await later.count():
            y=await later.evaluate('(e)=>e.getBoundingClientRect().top+scrollY')
            await self.position(max(0,y-260))
            await self.shot('data-comparison','data','Published comparison chart, not redrawn or rescaled data',lambda:self.scroll(180,6))
        await self.goto('/memorial','memorial')
        await self.shot('memorial-wall','memorial','Unaltered, slowly moving native Memorial name wall',lambda:self.page.wait_for_timeout(13000),handles=1)
        names = self.page.locator('#memorial-names')
        if await names.count():
            y=await names.evaluate('(e)=>e.getBoundingClientRect().top+scrollY')
            await self.position(max(0,y+100))
            await self.shot('memorial-names','memorial','Long, restrained movement across the published Memorial names',lambda:self.scroll(165,10),handles=1)
        await self.goto('/rooms','brand-source')
        # Preserve the application's loaded typography; render only a clearly editorial end card.
        # No fonts are extracted or included in the deliverables.
        await self.page.evaluate('''() => {
          window.scrollTo(0,0);
          const overlay=document.createElement('div');
          overlay.id='blackstory-ad-endcard';
          overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0a0a0a;display:flex;align-items:center;justify-content:center;overflow:hidden';
          overlay.innerHTML='<div id="blackstory-ad-signature" style="width:420px;display:flex;flex-direction:column;align-items:center;transform:translate(-15px,-45px);text-align:center"><img src="/brand/lockup-dark.png" alt="BlackStory" style="width:380px;height:auto;display:block"><p style="font-family:var(--font-geist),sans-serif;font-size:23px;letter-spacing:-.4px;color:#f4efe5;margin:32px 0 0;white-space:nowrap">History, pinned to place.</p><p style="font-family:var(--font-geist-mono),monospace;font-size:16px;letter-spacing:1px;color:#d07a32;margin:28px 0 0">blackstory.app</p></div>';
          document.body.appendChild(overlay);
        }''')
        await self.page.wait_for_timeout(1200)
        async def endcard():
            await self.page.evaluate('''() => new Promise(resolve=>{
              const e=document.getElementById('blackstory-ad-signature');
              const a=e.animate([{transform:'translate(-15px,-45px) scale(1)'},{transform:'translate(-15px,-45px) scale(1.018)'}],{duration:5000,fill:'forwards',easing:'linear'});
              a.onfinish=resolve;
            })''')
        await self.shot('brand-resolve','brand','Editorial ending, official artwork, mandatory line, native type, restrained push',endcard)
        for name in ('lockup-dark.png','lockup-light.png','symbol-dark.png','symbol-light.png'):
            response=await self.page.request.get(BASE+'/brand/'+name)
            if response.ok:
                (self.root/'assets'/name).write_bytes(await response.body())

    async def run(self):
        x = subprocess.Popen(['Xvfb', DISPLAY, '-screen','0','1200x2160x24','-ac','-nolisten','tcp'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        os.environ['DISPLAY'] = DISPLAY
        try:
            await asyncio.sleep(.5)
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=False,args=[
                    '--no-sandbox','--window-position=0,0','--window-size=540,960',
                    '--force-device-scale-factor=2','--hide-scrollbars','--disable-dev-shm-usage',
                    '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
                    '--disable-background-timer-throttling','--disable-renderer-backgrounding'])
                context = await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark',reduced_motion='no-preference')
                self.page = await context.new_page()
                await self.calibrate()
                await getattr(self,self.group+'_group')()
                await browser.close()
        finally:
            self.save()
            x.terminate()
            x.wait(timeout=5)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--group',choices=['map','editorial','context'],required=True)
    parser.add_argument('--output',type=Path,default=Path('output'))
    args=parser.parse_args()
    asyncio.run(Capture(args.output,args.group).run())

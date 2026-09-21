"""Read-only, live-product screen recording. No fixture data and no app deployment.
Linux capture: Playwright headed Chromium at 2x DPR, Xvfb, FFmpeg x11grab.
Every source take includes handles; the final edit is assembled separately.
"""
from __future__ import annotations
import asyncio
import base64
import io
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
from typing import Awaitable, Callable
from PIL import Image
from playwright.async_api import async_playwright

OUT = Path(os.environ.get('CAPTURE_OUTPUT', 'output'))
BASE = 'https://blackstory.app'
MANIFEST: dict = {'base_url': BASE, 'capture': {'width':1080,'height':1920,'fps':60,'css_viewport':[540,960],'device_scale_factor':2,'method':'Chromium real-time X11 screen recording'}, 'takes':[], 'failures':[]}
for directory in ['captures','review','project','assets','inspection']:
    (OUT / directory).mkdir(parents=True, exist_ok=True)
shutil.copy2(__file__, OUT / 'project/capture.py')

def save_manifest() -> None:
    (OUT / 'capture-manifest.json').write_text(json.dumps(MANIFEST, indent=2))

FIND_MAP = r'''() => {
  if (window.__blackstoryCaptureMap) return true;
  const seen = new Set();
  function probe(x, depth=0) {
    if (!x || typeof x !== 'object' || seen.has(x) || depth>3) return null;
    seen.add(x);
    if (typeof x.flyTo==='function' && typeof x.getCanvas==='function' && typeof x.getCenter==='function') return x;
    for (const key of ['current','map','mapRef','mapInstance','_map','value']) {
      try { const m=probe(x[key],depth+1); if(m) return m; } catch(e) {}
    }
    return null;
  }
  for (const el of document.querySelectorAll('.ds-map-stage, .ds-map-stage__canvas, .maplibregl-map, main')) {
    const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
    let f=el[key];
    for(let depth=0;f&&depth<35;depth++,f=f.return) {
      let h=f.memoizedState;
      for(let i=0;h&&i<80;i++,h=h.next) {
        const m=probe(h.memoizedState);
        if(m){window.__blackstoryCaptureMap=m;return true;}
      }
      const m=probe(f.stateNode);if(m){window.__blackstoryCaptureMap=m;return true;}
    }
  }
  return false;
}'''

SCROLL = r'''({dy, duration}) => new Promise(resolve => {
  const candidates=[document.scrollingElement,...document.querySelectorAll('main,main *,[class*=journey]')].filter(Boolean);
  const visible=candidates.filter(e=>{const b=e.getBoundingClientRect();const s=getComputedStyle(e);return e.scrollHeight>e.clientHeight+40 && b.width>250 && b.height>250 && (e===document.scrollingElement||/(auto|scroll)/.test(s.overflowY));});
  visible.sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight);
  const el=visible[0]||document.scrollingElement;
  const from=el.scrollTop, to=Math.max(0,Math.min(el.scrollHeight-el.clientHeight,from+dy)), start=performance.now();
  function tick(now){const p=Math.min(1,(now-start)/duration);const t=p*p*(3-2*p);el.scrollTop=from+(to-from)*t;if(p<1)requestAnimationFrame(tick);else resolve({from,to,element:el.className||el.tagName});}
  requestAnimationFrame(tick);
})'''

async def settle(page, delay: int = 1800) -> None:
    await page.evaluate('Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,10000))])')
    await page.add_style_tag(content='*{cursor:none!important}html,body,*{scrollbar-width:none!important}::-webkit-scrollbar{display:none!important}')
    await page.wait_for_timeout(delay)

async def visit(page, route: str) -> None:
    response=await page.goto(BASE+route, wait_until='domcontentloaded',timeout=45000)
    if response and response.status>=400:
        raise RuntimeError(f'{route}: HTTP {response.status}')
    await settle(page, 3500 if route.startswith('/explore') or route=='/' else 1800)

async def position(page, selector: str, offset: int = 160) -> None:
    loc=page.locator(selector).first
    await loc.wait_for(state='attached',timeout=7000)
    await loc.evaluate('(e,offset)=>{e.scrollIntoView({block:"start",behavior:"instant"});window.scrollBy(0,-offset)}',offset)
    await settle(page,1500)

async def scroll(page, dy: float, seconds: float) -> None:
    await page.evaluate(SCROLL, {'dy':dy, 'duration':round(seconds*1000)})

async def inspect(page, name: str) -> None:
    payload=await page.evaluate('''() => ({url:location.href,title:document.title,body:document.body.innerText.slice(0,48000),headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({text:e.innerText,id:e.id,cls:e.className})),images:[...document.images].map(e=>({src:e.currentSrc||e.src,alt:e.alt,w:e.naturalWidth,h:e.naturalHeight,cls:e.className})),buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,label:e.getAttribute('aria-label')})),links:[...document.querySelectorAll('a[href]')].map(e=>({text:e.innerText,href:e.getAttribute('href')}))})''')
    (OUT/'inspection'/f'{name}.json').write_text(json.dumps(payload,indent=2))
    await page.screenshot(path=str(OUT/'review'/f'{name}.png'))

async def take(page, name: str, surface: str, action: Callable[[], Awaitable], description: str) -> None:
    target=OUT/'captures'/surface/f'{name}.mp4'
    target.parent.mkdir(parents=True,exist_ok=True)
    entry={'name':name,'surface':surface,'file':str(target.relative_to(OUT)),'url':page.url,'action':description,'wallclock_started':time.time()}
    log=open(OUT/'inspection'/f'{name}-ffmpeg.log','w')
    proc=await asyncio.create_subprocess_exec('ffmpeg','-y','-hide_banner','-loglevel','warning','-thread_queue_size','1024','-f','x11grab','-framerate','60','-video_size','1080x1920','-draw_mouse','0','-i',os.environ['DISPLAY'],'-an','-c:v','libx264','-preset','ultrafast','-crf','18','-pix_fmt','yuv420p','-threads','2',str(target),stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.DEVNULL,stderr=log)
    try:
        await page.wait_for_timeout(650)
        entry['action_started_seconds']=time.time()-entry['wallclock_started']
        await action()
        await page.wait_for_timeout(800)
    finally:
        try:
            proc.stdin.write(b'q\n');await proc.stdin.drain()
            await asyncio.wait_for(proc.wait(),timeout=30)
        except Exception:
            proc.send_signal(signal.SIGINT);await proc.wait()
        log.close()
    if proc.returncode not in [0,255]:raise RuntimeError(f'FFmpeg capture failed: {proc.returncode}')
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(target)]))
    entry['probe']=info
    MANIFEST['takes'].append(entry);save_manifest()
    await page.screenshot(path=str(OUT/'review'/f'{name}-end.png'))
    print('CAPTURED',name,info['format']['duration'],target.stat().st_size,flush=True)

async def attempt(label: str, fn: Callable[[], Awaitable]) -> None:
    try:await fn()
    except Exception as exc:
        MANIFEST['failures'].append({'task':label,'error':repr(exc)});save_manifest();print('FAILED',label,repr(exc),flush=True)

async def main() -> None:
    display=':88';os.environ['DISPLAY']=display
    xvfb=subprocess.Popen(['Xvfb',display,'-screen','0','1080x1920x24','-ac','-nolisten','tcp'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=False,args=['--kiosk','--window-position=0,0','--window-size=540,960','--force-device-scale-factor=2','--hide-scrollbars','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            ctx=await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark',reduced_motion='no-preference')
            page=await ctx.new_page();page.set_default_timeout(7000)
            cdp=await ctx.new_cdp_session(page)
            window=await cdp.send('Browser.getWindowForTarget')
            await cdp.send('Browser.setWindowBounds',{'windowId':window['windowId'],'bounds':{'windowState':'fullscreen'}})
            async def home():
                await visit(page,'/');await inspect(page,'home-live')
                await take(page,'door-journey','home',lambda:scroll(page,1550,12),'Smooth native scroll through the Door journey and its evidence reveal')
            await attempt('home',home)
            async def maps():
                await visit(page,'/explore');await page.wait_for_timeout(7000)
                button=page.get_by_role('button',name='Hide filters',exact=True)
                if await button.count():await button.click();await settle(page)
                found=await page.evaluate(FIND_MAP);MANIFEST['map_api_available']=found
                await inspect(page,'map-ready')
                if not found:
                    async def physical():
                        await page.mouse.move(285,410)
                        for _ in range(48):
                            await page.mouse.wheel(0,-18);await page.wait_for_timeout(70)
                        await page.wait_for_timeout(1600)
                    await take(page,'map-native-wheel','map',physical,'Native wheel zoom through the national pin field')
                    return
                meta=await page.evaluate('''() => {const m=window.__blackstoryCaptureMap;return {center:m.getCenter(),zoom:m.getZoom(),layers:m.getStyle().layers.map(l=>({id:l.id,type:l.type,source:l.source})),features:m.queryRenderedFeatures().filter(f=>f.geometry.type==='Point').slice(0,30).map(f=>({properties:f.properties,layer:f.layer.id,geometry:f.geometry}))}}''')
                (OUT/'inspection/map-api.json').write_text(json.dumps(meta,indent=2))
                initial=await page.evaluate('() => {const m=window.__blackstoryCaptureMap;return {center:m.getCenter().toArray(),zoom:m.getZoom(),bearing:m.getBearing()}}')
                async def fly(center,zoom,seconds=5):
                    await page.evaluate('o=>window.__blackstoryCaptureMap.flyTo({...o,essential:true})',{'center':center,'zoom':zoom,'duration':round(seconds*1000)})
                    await page.wait_for_timeout(round(seconds*1000)+300)
                async def pan(dx,dy,seconds):
                    await page.evaluate('o=>window.__blackstoryCaptureMap.panBy([o.x,o.y],{duration:o.d,essential:true})',{'x':dx,'y':dy,'d':round(seconds*1000)})
                    await page.wait_for_timeout(round(seconds*1000))
                await take(page,'national-drift','map',lambda:pan(28,-32,7),'Slow drift across the real national field')
                await take(page,'national-to-dc','map',lambda:fly([-77.0369,38.9072],10,5),'Native national-to-Washington camera flight')
                await page.wait_for_timeout(3500)
                await take(page,'dc-pin-field','map',lambda:pan(40,-32,5),'Move across dense Washington historical pins')
                candidates=await page.evaluate('''() => {const m=window.__blackstoryCaptureMap;return m.queryRenderedFeatures().filter(f=>f.geometry.type==='Point'&&!f.properties.cluster&&JSON.stringify(f.properties).match(/ent_|pl_|place_|record|entity/i)).map(f=>({point:m.project(f.geometry.coordinates),properties:f.properties,layer:f.layer.id})).filter(f=>f.point.x>70&&f.point.x<450&&f.point.y>200&&f.point.y<700).slice(0,20)}''')
                (OUT/'inspection/pin-candidates.json').write_text(json.dumps(candidates,indent=2))
                if candidates:
                    pt=candidates[0]['point']
                    async def clickpin():
                        await page.mouse.click(pt['x'],pt['y']);await page.mouse.move(4,140);await page.wait_for_timeout(4500)
                    await take(page,'pin-to-record-sheet','records',clickpin,'Click a real rendered historical point and hold its native record sheet')
                    await inspect(page,'selected-pin')
                    await page.keyboard.press('Escape')
                    close=page.get_by_role('button',name='Close record',exact=False)
                    if await close.count():await close.first.click()
                await visit(page,'/explore');await page.wait_for_timeout(4000)
                button=page.get_by_role('button',name='Hide filters',exact=True)
                if await button.count():await button.click()
                await page.evaluate(FIND_MAP)
                for name,center,zoom in [('harlem',[-73.9442,40.8116],11),('tulsa',[-95.9903,36.1640],11),('atlanta',[-84.3880,33.7490],10)]:
                    await fly(center,zoom,1);await page.wait_for_timeout(3800)
                    await take(page,f'{name}-drift','map',lambda:pan(45,-24,5),'Native city-level map motion with real records')
                await take(page,'out-to-national','map',lambda:fly(initial['center'],initial['zoom'],5),'Native pullback from city to national scope')
                await page.wait_for_timeout(3000)
                await take(page,'national-return','map',lambda:pan(-20,16,6),'Quiet national map drift for final scope reveal')
            await attempt('maps',maps)
            async def records():
                await visit(page,'/records');await inspect(page,'records-live')
                await take(page,'records-scroll','records',lambda:scroll(page,1050,8),'Smooth movement through published records and evidence grades')
            await attempt('records',records)
            for slug in ['ent_web_du_bois_001','ent_benjamin_banneker_001','ent_phillis_wheatley_001','ent_william_still_001']:
                async def entity(slug=slug):
                    await visit(page,'/entity/'+slug);await inspect(page,slug)
                    await take(page,slug+'-reveal','entities',lambda:scroll(page,730,8),'Real entity page, imagery, biographical context, and record detail')
                    selector='section:has-text("Sources"),section:has-text("Evidence"),[id*=evidence],[id*=source]'
                    exact=page.locator('[id*=evidence],[id*=source]').first
                    if await exact.count():
                        await position(page,'[id*=evidence],[id*=source]',200)
                        await take(page,slug+'-evidence','evidence',lambda:scroll(page,230,5),'A native source/evidence section in motion')
                await attempt(slug,entity)
            async def stories():
                await visit(page,'/stories');await position(page,'h1',160)
                await take(page,'stories-door','stories',lambda:scroll(page,530,6),'Story collection introduction into the featured chapter')
                await visit(page,'/stories/the-count');await inspect(page,'story-the-count')
                await take(page,'the-count-chapter','stories',lambda:scroll(page,1450,12),'Native chapter scroll through original narrative and archival material')
                figure=page.locator('main figure').first
                if await figure.count():
                    await position(page,'main figure',150)
                    await take(page,'the-count-archive','stories',lambda:scroll(page,420,6),'Archival figure with its source context retained')
            await attempt('stories',stories)
            async def lives():
                await visit(page,'/lives');await inspect(page,'lives-live')
                await take(page,'lives-introduction','lives',lambda:scroll(page,570,6),'Moving from the ordinary question into historical evidence')
                await position(page,'.ds-archive-figure',170)
                await take(page,'dubois-original-exhibit','lives',lambda:scroll(page,480,8),'Original historical exhibit in the live Lives experience')
                await position(page,'.lives-era__comparison',200)
                await take(page,'lives-decades','lives',lambda:scroll(page,1430,12),'Move through sourced decade comparisons and their dated context')
            await attempt('lives',lives)
            async def data():
                await visit(page,'/data');await inspect(page,'data-live')
                for selector,name,dy,seconds in [('#population-spine','population-time-spine',420,7),('#population-states','population-state-field',440,7),('#wealth-ratio-long-arc','wealth-long-arc',390,7)]:
                    await position(page,selector,175)
                    await take(page,name,'data',lambda dy=dy,seconds=seconds:scroll(page,dy,seconds),'Native data visualization moving with period and source labels intact')
            await attempt('data',data)
            async def memorial():
                await visit(page,'/memorial');await page.wait_for_timeout(4000);await inspect(page,'memorial-live')
                await take(page,'memorial-wall','memorial',lambda:page.wait_for_timeout(13000),'Uninterrupted native motion of the Memorial wall, with no flashy camera effect')
                await position(page,'.ds-memorial__group',190)
                await take(page,'memorial-names','memorial',lambda:scroll(page,220,12),'Very slow movement over the individual Memorial names')
            await attempt('memorial',memorial)
            async def ending():
                await visit(page,'/stories')
                for asset in ['lockup-dark.png','lockup-light.png','symbol-dark.png','symbol-light.png']:
                    response=await ctx.request.get(BASE+'/brand/'+asset)
                    if response.ok:(OUT/'assets'/asset).write_bytes(await response.body())
                im=Image.open(OUT/'assets/lockup-dark.png').convert('RGBA')
                box=im.getbbox()
                if box:im=im.crop(box)
                buf=io.BytesIO();im.save(buf,format='PNG')
                logo='data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode()
                fonts=await page.evaluate('''() => ({body:getComputedStyle(document.body).fontFamily,editorial:getComputedStyle(document.querySelector('main p')||document.body).fontFamily})''')
                await page.evaluate('''({logo,fonts})=>{const e=document.createElement('div');e.id='ad-endcard';Object.assign(e.style,{position:'fixed',inset:'0',zIndex:'2147483000',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center'});const inner=document.createElement('div');Object.assign(inner.style,{width:'440px',textAlign:'center',transform:'translateY(-50px)'});const image=document.createElement('img');image.src=logo;Object.assign(image.style,{width:'360px',height:'auto',display:'block',margin:'0 auto 42px'});const line=document.createElement('p');line.textContent='History, pinned to place.';Object.assign(line.style,{fontFamily:fonts.editorial,fontSize:'29px',color:'#F4EFE5',margin:'0 0 29px',letterSpacing:'-0.3px'});const url=document.createElement('p');url.textContent='blackstory.app';Object.assign(url.style,{fontFamily:fonts.body,fontSize:'20px',color:'#D07A32',margin:'0',letterSpacing:'1px'});inner.append(image,line,url);e.append(inner);document.body.append(e);window.__endCardInner=inner;}''',{'logo':logo,'fonts':fonts})
                await settle(page,1200)
                async def move():
                    await page.evaluate('''()=>window.__endCardInner.animate([{transform:'translateY(-50px) scale(0.98)'},{transform:'translateY(-50px) scale(1.025)'}],{duration:6500,fill:'forwards',easing:'cubic-bezier(.2,.7,.2,1)'})''')
                    await page.wait_for_timeout(6500)
                await take(page,'brand-resolution','brand',move,'Official BlackStory lockup and mandatory tagline; a restrained 2D brand ending')
                await inspect(page,'brand-endcard')
            await attempt('brand',ending)
            await browser.close()
    finally:
        xvfb.terminate();save_manifest()
    print(json.dumps({'takes':len(MANIFEST['takes']),'failures':MANIFEST['failures']},indent=2),flush=True)

if __name__=='__main__':
    asyncio.run(main())

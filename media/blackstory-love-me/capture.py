#!/usr/bin/env python3
"""Public-site media capture. No production writes, credentials, or fabricated UI data."""
from __future__ import annotations
import argparse, asyncio, json, math, os, pathlib, re, shutil, subprocess, tempfile, time, traceback
import requests

ROOT = pathlib.Path('output')
SITE = 'https://blackstory.app'
VIDEO_ID = '7670347350115634462'
REFERENCE = f'https://www.tiktok.com/@ambnt.prod/video/{VIDEO_ID}'
MIRROR = f'https://www.tikwm.com/video/{VIDEO_ID}.html'

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def reference():
    out = ROOT / 'reference'; out.mkdir(parents=True, exist_ok=True)
    s = requests.Session()
    s.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', 'Referer': MIRROR})
    report = {'video_id': VIDEO_ID, 'creator': '@ambnt.prod', 'original_url': REFERENCE, 'mirror_url': MIRROR, 'attempts': [], 'status': 'not_retrieved'}
    candidates = []
    try:
        p = s.get(MIRROR, timeout=35); p.raise_for_status()
        (out/'mirror.html').write_text(p.text)
        if VIDEO_ID not in p.text or 'ambnt.prod' not in p.text.lower():
            raise ValueError('Mirror identity did not match the supplied post and creator')
        report['mirror_identity_verified'] = True
        for match in re.findall(r'(?:href|src)=[\"\']([^\"\']+)[\"\']', p.text):
            if VIDEO_ID in match and ('hdplay' in match or 'play/' in match):
                candidates.append(requests.compat.urljoin(MIRROR, match))
        candidates += [f'https://www.tikwm.com/video/media/hdplay/{VIDEO_ID}.mp4', f'https://www.tikwm.com/video/media/play/{VIDEO_ID}.mp4']
    except Exception as exc:
        report['mirror_error'] = str(exc)
    try:
        r = s.get('https://www.tikwm.com/api/', params={'url': REFERENCE, 'hd': '1'}, timeout=40)
        data = r.json(); (out/'mirror-api.json').write_text(json.dumps(data, indent=2))
        d = data.get('data') or {}
        if str(d.get('id') or d.get('aweme_id')) == VIDEO_ID and str((d.get('author') or {}).get('unique_id', '')).lower() == 'ambnt.prod':
            report['api_identity_verified'] = True
            for key in ['hdplay', 'play', 'wmplay']:
                if d.get(key): candidates.insert(0, requests.compat.urljoin('https://www.tikwm.com', d[key]))
    except Exception as exc:
        report['api_error'] = str(exc)
    if report.get('mirror_identity_verified') or report.get('api_identity_verified'):
        for url in dict.fromkeys(candidates):
            try:
                response = s.get(url, timeout=65); response.raise_for_status()
                path = out/'reference.mp4'; path.write_bytes(response.content)
                probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)]))
                if not any(x.get('codec_type') == 'audio' for x in probe['streams']): raise ValueError('Reference has no audio stream')
                if not any(x.get('codec_type') == 'video' for x in probe['streams']): raise ValueError('Reference has no video stream')
                report.update({'status': 'retrieved_exact_post', 'download_endpoint': url, 'bytes': len(response.content), 'probe': probe})
                run(['ffmpeg', '-y', '-v', 'error', '-i', str(path), '-vn', '-acodec', 'pcm_s24le', '-ar', '48000', str(out/'reference.wav')])
                break
            except Exception as exc:
                report['attempts'].append({'url': url, 'error': str(exc)})
                (out/'reference.mp4').unlink(missing_ok=True)
    (out/'provenance.json').write_text(json.dumps(report, indent=2))
    print('REFERENCE_RESULT', json.dumps(report), flush=True)

MAP_FIND = r'''() => {
  for (const el of document.querySelectorAll('canvas, .maplibregl-map')) {
    const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));
    let node=key?el[key]:null;
    for(let i=0;node && i<70;i++,node=node.return){
      let h=node.memoizedState;
      for(let j=0;h && j<70;j++,h=h.next){
        const v=h.memoizedState;
        for(const o of [v, v?.current, v?.current?.getMap?.()]){
          if(o && typeof o.flyTo==='function' && typeof o.getCanvas==='function'){
            window.__adCaptureMap=o;return {found:true,center:o.getCenter(),zoom:o.getZoom(),layers:o.getStyle().layers.map(l=>({id:l.id,type:l.type,source:l.source}))};
          }
        }
      }
    }
  }
  return {found:false};
}'''

SCROLL = r'''({y,ms}) => new Promise(resolve=>{
 const el=document.scrollingElement, start=el.scrollTop;
 const end=Math.max(0,Math.min(y,el.scrollHeight-innerHeight));
 const t0=performance.now();
 function tick(t){const p=Math.min(1,(t-t0)/ms),e=p*p*(3-2*p);el.scrollTop=start+(end-start)*e;if(p<1)requestAnimationFrame(tick);else resolve();}
 requestAnimationFrame(tick);
})'''

async def capture():
    import cv2
    import numpy as np
    from playwright.async_api import async_playwright
    out=ROOT/'captures'; out.mkdir(parents=True,exist_ok=True)
    review=ROOT/'review'; review.mkdir(exist_ok=True)
    assets=ROOT/'assets'; assets.mkdir(exist_ok=True)
    manifest={'base_url':SITE,'capture_fps':30,'resolution':[1080,1920],'method':'X11 framebuffer recording of real Chromium interactions at device pixel ratio 2','shots':[],'errors':[]}
    xv=subprocess.Popen(['Xvfb',':99','-screen','0','1280x2400x24','-ac','-nolisten','tcp'])
    os.environ['DISPLAY']=':99';await asyncio.sleep(1)
    try:
      async with async_playwright() as p:
        browser=await p.chromium.launch(headless=False,args=['--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--force-device-scale-factor=2','--window-position=0,0','--window-size=540,1100','--hide-scrollbars'],ignore_default_args=['--enable-automation'])
        ctx=await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark',reduced_motion='no-preference')
        page=await ctx.new_page();page.set_default_timeout(8000)
        async def go(route):
            response=await page.goto(SITE+route,wait_until='domcontentloaded',timeout=60000)
            if response and response.status>=400:raise RuntimeError(f'{route}: HTTP {response.status}')
            await page.wait_for_timeout(3500)
            await page.evaluate('document.fonts.ready')
            await page.add_style_tag(content='* {cursor:none!important} ::-webkit-scrollbar{display:none!important} html{scrollbar-width:none!important;scroll-behavior:auto!important}')
            await page.mouse.move(535,950)
            return response
        await go('/explore')
        for button in [page.get_by_role('button',name='Hide filters',exact=True)]:
            if await button.count() and await button.is_visible():await button.click()
        await page.wait_for_timeout(1000)
        # Calibrate framebuffer crop from a matching static top-of-page strip. No browser chrome enters footage.
        screenshot=await page.screenshot();(review/'calibration-page.png').write_bytes(screenshot)
        run(['ffmpeg','-y','-v','error','-f','x11grab','-video_size','1280x2400','-draw_mouse','0','-i',':99','-frames:v','1',str(review/'calibration-screen.png')])
        template=cv2.imdecode(np.frombuffer(screenshot,np.uint8),cv2.IMREAD_COLOR)[:160,:1000]
        full=cv2.imread(str(review/'calibration-screen.png'))
        matches=cv2.matchTemplate(full[:650,:1200],template,cv2.TM_SQDIFF_NORMED)
        minv,_,offset,_=cv2.minMaxLoc(matches)
        ox,oy=offset;manifest['framebuffer_crop']={'x':ox,'y':oy,'match_error':minv}
        if minv>0.16:raise RuntimeError('Could not confidently calibrate browser content crop')
        if ox+1080>1280 or oy+1920>2400:raise RuntimeError('Calibrated crop exceeds framebuffer')
        print('CAPTURE_CROP',manifest['framebuffer_crop'],flush=True)
        async def snap(name):
            await page.screenshot(path=str(review/(name+'.png')))
        async def record(name,action,handles=0.8):
            target=out/(name+'.mp4');target.parent.mkdir(parents=True,exist_ok=True)
            start=time.monotonic();log=open(review/(name.replace('/','-')+'-ffmpeg.log'),'w')
            proc=subprocess.Popen(['ffmpeg','-y','-v','warning','-f','x11grab','-framerate','30','-video_size','1080x1920','-draw_mouse','0','-i',f':99+{ox},{oy}','-an','-c:v','libx264','-preset','ultrafast','-crf','17','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(target)],stdin=subprocess.PIPE,stdout=log,stderr=log)
            try:
                await page.wait_for_timeout(handles*1000)
                await action()
                await page.wait_for_timeout(handles*1000)
            finally:
                if proc.poll() is None:
                    proc.communicate(input=b'q',timeout=30)
                log.close()
            if proc.returncode:raise RuntimeError(f'Capture encoder exited {proc.returncode}')
            await snap(name.replace('/','-'))
            item={'file':str(target.relative_to(ROOT)),'url':page.url,'elapsed_seconds':round(time.monotonic()-start,3)}
            manifest['shots'].append(item);(ROOT/'capture-manifest.json').write_text(json.dumps(manifest,indent=2));print('CAPTURED',json.dumps(item),flush=True)
        async def hold(ms):await page.wait_for_timeout(ms)
        async def scroll(delta,ms):
            y=await page.evaluate('document.scrollingElement.scrollTop');await page.evaluate(SCROLL,{'y':y+delta,'ms':ms})
        async def at(selector,offset=140):
            el=page.locator(selector).first
            await el.wait_for(state='attached')
            y=await el.evaluate('(e)=>e.getBoundingClientRect().top+window.scrollY')
            await page.evaluate('(y)=>window.scrollTo(0,y)',max(0,y-offset));await page.wait_for_timeout(650)
        async def guarded(label,fn):
            try:await fn()
            except Exception as exc:
                manifest['errors'].append({'surface':label,'error':str(exc)});print('CAPTURE_ERROR',label,str(exc),flush=True)
                try:await snap('error-'+label)
                except Exception:pass
        map_info=await page.evaluate(MAP_FIND);manifest['map_access']=map_info;print('MAP_ACCESS',json.dumps(map_info),flush=True)
        if map_info.get('found'):
            async def map_move(center,zoom,ms):
                await page.evaluate('o=>window.__adCaptureMap.flyTo({...o,essential:true,curve:1.2})',{'center':center,'zoom':zoom,'duration':ms});await hold(ms+250)
            async def map_jump(center,zoom):
                await page.evaluate('o=>window.__adCaptureMap.jumpTo(o)',{'center':center,'zoom':zoom});await hold(2300)
            # Warm target tiles before rolling, then reset to the opening.
            for center,z in [([-90.0715,29.9511],11.8),([-77.0369,38.9072],12.5),([-73.9442,40.8116],12.0),([-97,38],2.5)]:await map_jump(center,z)
            await record('map/01-national-drift',lambda:map_move([-93,37],2.75,6500))
            await record('map/02-national-to-new-orleans',lambda:map_move([-90.0715,29.9511],11.8,6500))
            await record('map/03-new-orleans-detail',lambda:map_move([-90.059,29.961],12.8,6000))
            await map_jump([-77.0369,38.9072],11.8)
            await record('map/04-washington-arrival',lambda:map_move([-77.030,38.903],13.0,5500))
            # Click a genuine rendered point rather than opening a fabricated selection.
            try:
                features=await page.evaluate('''() => window.__adCaptureMap.queryRenderedFeatures().filter(f=>f.geometry.type==='Point'&&!f.properties.cluster).map(f=>({layer:f.layer.id,properties:f.properties,coordinates:f.geometry.coordinates,point:window.__adCaptureMap.project(f.geometry.coordinates)})).filter(f=>f.point.x>45&&f.point.x<480&&f.point.y>220&&f.point.y<680).slice(0,60)''')
                (review/'map-visible-points.json').write_text(json.dumps(features,indent=2))
                candidates=[f for f in features if any(k in f['properties'] for k in ['slug','entityId','id','recordId','entity_id'])]
                if candidates:
                    feature=candidates[0]
                    async def click_pin():
                        await page.mouse.click(feature['point']['x'],feature['point']['y']);await hold(4500)
                    await record('map/05-pin-selection',click_pin)
                    (review/'selected-pin.html').write_text(await page.content())
            except Exception as exc:manifest['errors'].append({'surface':'pin-selection','error':str(exc)})
            await go('/explore')
            button=page.get_by_role('button',name='Hide filters',exact=True)
            if await button.count() and await button.is_visible():await button.click()
            await page.evaluate(MAP_FIND)
            await map_jump([-73.9442,40.8116],12)
            await record('map/06-harlem',lambda:map_move([-73.95,40.805],13.15,5500))
            await record('map/07-return-national',lambda:map_move([-97,38],2.5,6500))
        else:
            async def drag():
                await page.mouse.move(330,390);await page.mouse.down();await page.mouse.move(180,440,steps=90);await page.mouse.up();await hold(4000)
            await record('map/01-native-map-drag',drag)
        async def home():
            await go('/')
            await record('home/01-door',lambda:scroll(750,7000))
        await guarded('home',home)
        async def place():
            await go('/place/fellowship-rosenwald-school-teachers-home')
            await record('records/01-rosenwald',lambda:scroll(430,6000))
            (review/'rosenwald.html').write_text(await page.content())
            headings=page.get_by_role('heading').filter(has_text=re.compile('sources|evidence',re.I))
            if await headings.count():
                el=headings.first;y=await el.evaluate('(e)=>e.getBoundingClientRect().top+scrollY')
                await page.evaluate('(y)=>scrollTo(0,y)',max(0,y-230));await hold(600)
                await record('evidence/01-rosenwald-sources',lambda:scroll(240,5500))
        await guarded('place',place)
        async def person():
            await go('/entity/ent_web_du_bois_001')
            (review/'du-bois.html').write_text(await page.content())
            await record('entities/01-du-bois',lambda:scroll(470,6500))
            imgs=page.locator('main img')
            if await imgs.count():
                await at('main img',180)
                await record('entities/02-du-bois-portrait',lambda:scroll(140,6000))
        await guarded('person',person)
        async def records():
            await go('/records');await scroll(370,1)
            await record('records/02-catalog',lambda:scroll(620,6500))
        await guarded('records',records)
        async def story():
            await go('/stories/the-count');(review/'story.html').write_text(await page.content())
            await record('stories/01-the-count',lambda:scroll(650,7000))
            # Capture the first documentary image, retaining its on-page caption.
            if await page.locator('main img').count():
                await at('main img',140)
                await record('stories/02-document',lambda:scroll(350,6500))
        await guarded('story',story)
        async def lives():
            await go('/lives');await at('#lives-archive-title',160)
            await record('lives/01-original-du-bois-exhibit',lambda:scroll(390,7000))
            await at('#era-1900-1930',130)
            await record('lives/02-1900s-to-1930s',lambda:scroll(400,6500))
            await at('#era-1940-1960',130)
            await record('lives/03-1940s-to-1960s',lambda:scroll(380,6500))
        await guarded('lives',lives)
        async def data():
            await go('/data');await at('#population-spine',140)
            await record('data/01-census-spine',lambda:scroll(220,6000))
            await at('#population-count',140)
            await record('data/02-census-bars',lambda:scroll(290,6500))
            await at('#population-states',140)
            await record('data/03-states',lambda:scroll(400,6500))
        await guarded('data',data)
        async def memorial():
            await go('/memorial')
            await record('memorial/01-native-names-wall',lambda:hold(13000))
            await at('#memorial-names-A',200)
            await record('memorial/02-names',lambda:scroll(230,11000))
        await guarded('memorial',memorial)
        async def endcard():
            await go('/explore')
            for name in ['lockup-dark.png','symbol-dark.png']:
                r=await ctx.request.get(SITE+'/brand/'+name)
                if r.ok:(assets/name).write_bytes(await r.body())
            await page.evaluate('''() => {
             const el=document.createElement('div');el.id='ad-endcard';el.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0A0A0A;display:flex;align-items:center;justify-content:center;';
             el.innerHTML=`<div style="width:420px;transform-origin:center;animation:ad-breathe 8s ease-out both;text-align:center;padding-bottom:70px"><img src="/brand/lockup-dark.png" style="width:360px;max-height:180px;object-fit:contain"/><p style="font-size:24px;color:#F4EFE5;margin:20px 0 25px;letter-spacing:-.35px">History, pinned to place.</p><p style="font-size:16px;color:#D07A32;letter-spacing:2px">blackstory.app</p></div><style>@keyframes ad-breathe{from{transform:scale(.985)}to{transform:scale(1.012)}}</style>`;
             document.body.appendChild(el);
            }''')
            await hold(1200);await record('brand/01-endcard',lambda:hold(5000))
        await guarded('endcard',endcard)
        await browser.close()
    finally:
        xv.terminate();(ROOT/'capture-manifest.json').write_text(json.dumps(manifest,indent=2))
        project=ROOT/'project';project.mkdir(exist_ok=True);shutil.copy(__file__,project/'capture.py')
        print('CAPTURE_SUMMARY',json.dumps(manifest),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['reference','capture']);args=parser.parse_args()
    if args.mode=='reference':reference()
    else:asyncio.run(capture())

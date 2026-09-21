"""Deterministic native-browser map motion, not simulated map artwork.

Each output frame is the live product rendered at a real map camera position.
Fixed-step rendering avoids a software GPU's low wall-clock frame rate.
"""
from __future__ import annotations
import asyncio, importlib.util, json, math, os, pathlib, shutil, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT=pathlib.Path('output');ROOT.mkdir(exist_ok=True)
FPS=30
N=90
SHOTS={
    'descent': {'start':[-95.,37.,2.7], 'end':[-90.0715,29.9511,11.8]},
    'new-orleans': {'start':[-90.080,29.946,11.8], 'end':[-90.059,29.961,12.65]},
    'washington': {'start':[-77.044,38.902,11.6], 'end':[-77.030,38.912,12.7]},
    'return-national': {'start':[-73.95,40.805,12.4], 'end':[-97.,38.,2.5]},
}
MAP_FIND=r'''() => {
 for (const el of document.querySelectorAll('canvas,.maplibregl-map')) {
  const key=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let node=key?el[key]:null;
  for(let i=0;node&&i<70;i++,node=node.return){let h=node.memoizedState;
   for(let j=0;h&&j<70;j++,h=h.next){const v=h.memoizedState;
    for(const o of [v,v?.current,v?.current?.getMap?.()]){
     if(o&&typeof o.jumpTo==='function'&&typeof o.getCanvas==='function'){
      window.__adMap=o;return true;
     }
    }
   }
  }
 }return false;
}'''

async def main(name):
    cfg=SHOTS[name]
    report={'name':name,'url':'https://blackstory.app/explore','capture_method':'Native browser-rendered fixed-step map camera sequence. Every frame is a screenshot of the actual app after its map render. This is not a screenshot slideshow: the map camera advances for all 90 frames. No UI, map geometry, points, labels, or history is fabricated.','fps':FPS,'frames':N,'width':1080,'height':1920,'camera':cfg,'render_seconds':[]}
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark')
        page=await ctx.new_page()
        await page.goto(report['url'],wait_until='domcontentloaded',timeout=60000)
        await page.wait_for_timeout(5000)
        await page.evaluate('document.fonts.ready')
        button=page.get_by_role('button',name='Hide filters',exact=True)
        if await button.count() and await button.is_visible():await button.click()
        await page.add_style_tag(content='*{cursor:none!important}::-webkit-scrollbar{display:none!important}html{scrollbar-width:none!important}')
        if not await page.evaluate(MAP_FIND):raise RuntimeError('The actual map instance was not accessible.')
        # Warm every integer zoom level along the route before recording.
        for k in range(12):
            q=k/11
            pos=[cfg['start'][i]+(cfg['end'][i]-cfg['start'][i])*q for i in range(3)]
            await page.evaluate('p=>window.__adMap.jumpTo({center:p.slice(0,2),zoom:p[2]})',pos)
            await page.wait_for_timeout(200)
        await page.wait_for_timeout(1200)
        dest=ROOT/(name+'.mp4');log=(ROOT/(name+'-encoder.log')).open('w')
        proc=subprocess.Popen(['ffmpeg','-y','-v','warning','-f','image2pipe','-framerate',str(FPS),'-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','15','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(dest)],stdin=subprocess.PIPE,stderr=log)
        try:
            for frame in range(N):
                start=time.monotonic()
                u=frame/(N-1)
                q=u*u*(3.-2.*u)
                pos=[cfg['start'][i]+(cfg['end'][i]-cfg['start'][i])*q for i in range(3)]
                await page.evaluate('p=>new Promise(resolve=>{const m=window.__adMap;m.once("render",()=>requestAnimationFrame(()=>resolve()));m.jumpTo({center:p.slice(0,2),zoom:p[2]});m.triggerRepaint();})',pos)
                await page.wait_for_timeout(35)
                image=await page.screenshot(type='png',animations='allow')
                proc.stdin.write(image)
                report['render_seconds'].append(time.monotonic()-start)
                if frame in [0,44,89]:(ROOT/(name+f'-{frame:03}.png')).write_bytes(image)
                if frame%15==0:print(name,frame,N,flush=True)
            proc.stdin.close();proc.wait(timeout=60)
            if proc.returncode:raise RuntimeError('Video encoding failed')
        finally:
            if proc.poll() is None:proc.terminate();proc.wait()
            log.close()
        report['ffprobe']=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(dest)]))
        (ROOT/(name+'-provenance.json')).write_text(json.dumps(report,indent=2))
        shutil.copy(__file__,ROOT/'map_frames.py')
        await browser.close()

if __name__=='__main__':
    if len(sys.argv)!=2 or sys.argv[1] not in SHOTS:raise SystemExit('Usage: map_frames.py '+ '|'.join(SHOTS))
    asyncio.run(main(sys.argv[1]))

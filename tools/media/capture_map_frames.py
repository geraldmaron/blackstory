#!/usr/bin/env python3
"""Deterministic native browser-frame capture, not a real-time fps measurement.
Every frame is rendered by the live BlackStory map. No record, position, label,
map style, or history data is replaced. Requires Playwright Chromium and FFmpeg.
"""
from __future__ import annotations
import argparse,asyncio,json,math,pathlib,subprocess,shutil
from playwright.async_api import async_playwright
MAP_FIND=r'''() => {
for(const el of document.querySelectorAll('canvas,.maplibregl-map')){
const k=Object.keys(el).find(k=>k.startsWith('__reactFiber$'));let n=k?el[k]:null;
for(let i=0;n&&i<70;i++,n=n.return){let h=n.memoizedState;
for(let j=0;h&&j<70;j++,h=h.next){const v=h.memoizedState;
for(const o of [v,v?.current,v?.current?.getMap?.()]){
if(o&&typeof o.jumpTo==='function'&&typeof o.getCanvas==='function'){
window.__captureMap=o;return true;}}}}}return false;}'''
def smooth(t):return t*t*(3-2*t)
def mercator(ll):
    lon,lat=ll;return ((lon+180)/360,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2)
def inverse(xy):
    x,y=xy;return [x*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y))))]
def camera(shot,t):
    if shot=='lillie-discovery':
        a=[-97,37.8];b=[-92.989728,32.82716];z0=2.9;z1=13.0
        if t<.29:
            u=t/.29;return {'center':[-97+u*.55,37.8],'zoom':2.9+u*.045}
        u=smooth((t-.29)/.71);z=z0+(z1-z0)*u;aa=mercator(a);bb=mercator(b)
        center=inverse([bb[i]-(bb[i]-aa[i])*(2**(z0-z))*(1-u) for i in range(2)])
        return {'center':center,'zoom':z}
    if shot=='harlem-drift':
        u=smooth(t);return {'center':[-73.948+u*.003,40.807-u*.004],'zoom':12.65+u*.35}
    if shot=='return-national':
        a=[-73.946,40.805];b=[-97,37.5];u=smooth(t);z=12.5+(2.9-12.5)*u
        q=u**3;aa=mercator(a);bb=mercator(b)
        return {'center':inverse([aa[i]+(bb[i]-aa[i])*q for i in range(2)]),'zoom':z}
    raise ValueError(shot)
async def main(args):
    root=pathlib.Path('output');(root/'captures/map').mkdir(parents=True,exist_ok=True)
    (root/'project').mkdir(exist_ok=True);(root/'review').mkdir(exist_ok=True)
    shutil.copy2(__file__,root/'project'/pathlib.Path(__file__).name)
    frames={'lillie-discovery':190,'harlem-drift':90,'return-national':120}[args.shot]
    log=(root/'review'/f'{args.shot}-encode.log').open('w');encoder=None
    report={'shot':args.shot,'method':'Fresh native browser render per deterministic camera frame; not real-time frame-rate measurement','frames':frames,'width':1080,'height':1920,'fps':30,'route':'https://blackstory.app/explore','camera_frames':[],'live_data_unchanged':True}
    try:
      async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        ctx=await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark')
        page=await ctx.new_page()
        response=await page.goto(report['route'],wait_until='domcontentloaded',timeout=60000)
        if not response or response.status>=400:raise RuntimeError('Public map unavailable')
        await page.wait_for_timeout(9000);await page.evaluate('document.fonts.ready')
        button=page.get_by_role('button',name='Hide filters',exact=True)
        if await button.count() and await button.first.is_visible():await button.first.click()
        await page.wait_for_timeout(1200)
        if not await page.evaluate(MAP_FIND):raise RuntimeError('Native camera object not found')
        await page.add_style_tag(content='*{cursor:none!important}::-webkit-scrollbar{display:none!important}')
        report['attribution']=await page.locator('.maplibregl-ctrl-attrib').inner_text()
        for j in range(0,frames,20):
            c=camera(args.shot,j/max(1,frames-1))
            await page.evaluate('(c)=>window.__captureMap.jumpTo({...c,padding:{top:0,bottom:0,left:0,right:0},pitch:0,bearing:0})',c)
            await page.wait_for_timeout(900)
        command=['ffmpeg','-hide_banner','-loglevel','warning','-y','-f','image2pipe','-framerate','30','-vcodec','mjpeg','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','15','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(root/'captures/map'/f'{args.shot}.mp4')]
        encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=log,stderr=log)
        for j in range(frames):
            c=camera(args.shot,j/max(1,frames-1));report['camera_frames'].append(c)
            await page.evaluate('''async c=>{
                const m=window.__captureMap;m.stop();m.jumpTo({...c,padding:{top:0,bottom:0,left:0,right:0},pitch:0,bearing:0});
                await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            }''',c)
            await page.wait_for_timeout(60)
            data=await page.screenshot(type='jpeg',quality=98)
            encoder.stdin.write(data)
            if j in [0,frames//2,frames-1]:(root/'review'/f'{args.shot}-{j}.jpg').write_bytes(data)
            if j%30==0:print(args.shot,j,'/',frames,flush=True)
        encoder.stdin.close();code=encoder.wait(timeout=50)
        if code:raise RuntimeError(f'Encoder exited {code}')
        report['status']='complete';await browser.close()
    except Exception as exc:
        report['status']='failed';report['error']=str(exc);raise
    finally:
        (root/f'{args.shot}-provenance.json').write_text(json.dumps(report,indent=2))
        if encoder and encoder.poll() is None:encoder.kill()
        log.close()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--shot',required=True,choices=['lillie-discovery','harlem-drift','return-national'])
    asyncio.run(main(p.parse_args()))

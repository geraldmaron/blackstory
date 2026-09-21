"""Supplementary real-browser recordings of native archive photograph sections."""
import asyncio, importlib.util, os, subprocess, json
from pathlib import Path
spec=importlib.util.spec_from_file_location('capture',Path('creative/blackstory-ad-20260920/capture.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
from playwright.async_api import async_playwright
async def main():
    os.environ['DISPLAY']=':88'
    xvfb=subprocess.Popen(['Xvfb',':88','-screen','0','1080x1920x24','-ac','-nolisten','tcp'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=False,args=['--kiosk','--window-position=0,0','--window-size=540,960','--force-device-scale-factor=2','--hide-scrollbars','--disable-dev-shm-usage'])
            context=await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark')
            page=await context.new_page();page.set_default_timeout(10000)
            cdp=await context.new_cdp_session(page);w=await cdp.send('Browser.getWindowForTarget')
            await cdp.send('Browser.setWindowBounds',{'windowId':w['windowId'],'bounds':{'windowState':'fullscreen'}})
            for slug in ['ent_web_du_bois_001','ent_phillis_wheatley_001','ent_william_still_001']:
                async def record(slug=slug):
                    await c.visit(page,'/entity/'+slug)
                    image=page.locator('.ds-entity-photo__img').first
                    await image.wait_for(state='attached')
                    await image.evaluate('e=>e.decode()')
                    await c.position(page,'.ds-entity-photo__img',160)
                    await c.inspect(page,slug+'-photo-start')
                    await c.take(page,slug+'-photo','photographs',lambda:c.scroll(page,240,7),'Slow native browser scroll over the actual archive photograph and its original citation, with no replacement imagery')
                await c.attempt(slug,record)
            await browser.close()
    finally:
        xvfb.terminate();c.save_manifest()
    import shutil
    shutil.copy2(__file__,c.OUT/'project/closeups.py')
    print(json.dumps(c.MANIFEST,indent=2))
asyncio.run(main())

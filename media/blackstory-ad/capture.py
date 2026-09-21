"""Read-only BlackStory browser motion capture. No simulated application screens."""
from __future__ import annotations
import argparse, asyncio, json, math, os, pathlib, shutil, subprocess, time, traceback
import cv2
from playwright.async_api import async_playwright

OUT = pathlib.Path('output')
CAP = OUT / 'captures'
REVIEW = OUT / 'review'
for folder in [CAP, REVIEW, OUT / 'assets']:
    folder.mkdir(parents=True, exist_ok=True)
DISPLAY = ':99'
WIDTH, HEIGHT, FPS = 1080, 1920, 60
BASE = 'https://blackstory.app'
REPORT = {'base_url': BASE, 'capture': {'width': WIDTH, 'height': HEIGHT, 'fps': FPS, 'method': 'native X11 browser recording', 'css_viewport': [540, 960], 'device_scale_factor': 2}, 'shots': [], 'pages': [], 'errors': []}

SCROLL = '''({target, duration}) => new Promise(resolve => {
  const root = document.scrollingElement;
  const start = root.scrollTop;
  const finish = Math.max(0, Math.min(target, root.scrollHeight - innerHeight));
  const t0 = performance.now();
  function step(now) {
    const x = Math.min(1, (now-t0)/duration);
    const ease = x*x*(3-2*x);
    window.scrollTo(0, start + (finish-start)*ease);
    if(x<1) requestAnimationFrame(step); else resolve();
  }
  requestAnimationFrame(step);
})'''

class Capture:
    def __init__(self, page, offset):
        self.page, self.offset = page, offset

    async def prepare(self, route, y=0):
        response = await self.page.goto(BASE + route, wait_until='domcontentloaded', timeout=45000)
        if response and response.status >= 400:
            raise RuntimeError(f'HTTP {response.status}: {route}')
        await self.page.wait_for_timeout(6000)
        await self.page.evaluate('document.fonts.ready')
        await self.page.add_style_tag(content='*{cursor:none!important}::-webkit-scrollbar{display:none!important}html{scrollbar-width:none!important;scroll-behavior:auto!important}')
        await self.page.evaluate('(y) => window.scrollTo(0,y)', y)
        await self.page.wait_for_timeout(1500)
        await self.page.mouse.move(539, 1)
        REPORT['pages'].append({'url': self.page.url, 'title': await self.page.title(), 'body': (await self.page.locator('body').inner_text())[:45000], 'links': await self.page.locator('a[href]').evaluate_all('(els) => els.map(e=>({text:e.innerText,href:e.getAttribute("href")}))'), 'images': await self.page.locator('img').evaluate_all('(els)=>els.map(e=>({src:e.currentSrc,alt:e.alt,width:e.naturalWidth,height:e.naturalHeight}))')})
        self.save()

    def save(self):
        (OUT / 'capture-manifest.json').write_text(json.dumps(REPORT, indent=2))

    async def scroll(self, target, seconds):
        await self.page.evaluate(SCROLL, {'target': target, 'duration': seconds*1000})

    async def shot(self, category, name, description, action, post=1.2):
        folder = CAP / category
        folder.mkdir(exist_ok=True)
        dest = folder / (name + '.mp4')
        log_path = folder / (name + '.ffmpeg.log')
        await self.page.screenshot(path=str(REVIEW / (name + '-in.png')))
        log = log_path.open('w')
        x, y = self.offset
        command = ['ffmpeg','-y','-hide_banner','-loglevel','warning','-thread_queue_size','1024','-f','x11grab','-draw_mouse','0','-framerate',str(FPS),'-video_size',f'{WIDTH}x{HEIGHT}','-i',f'{DISPLAY}.0+{x},{y}','-an','-c:v','libx264','-preset','ultrafast','-crf','16','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',str(dest)]
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
        start = time.monotonic()
        error = None
        try:
            await asyncio.sleep(.75)
            await action()
            await asyncio.sleep(post)
        except Exception as exc:
            error = str(exc)
        finally:
            if process.poll() is None:
                try:
                    process.stdin.write(b'q\n')
                    process.stdin.flush()
                    await asyncio.wait_for(asyncio.to_thread(process.wait), timeout=20)
                except Exception:
                    process.terminate()
                    await asyncio.to_thread(process.wait)
            log.close()
        if process.returncode != 0:
            error = (error or '') + ' ffmpeg exit ' + str(process.returncode)
        await self.page.screenshot(path=str(REVIEW / (name + '-out.png')))
        metadata = subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(dest)],capture_output=True,text=True)
        info = json.loads(metadata.stdout) if metadata.returncode == 0 else {}
        REPORT['shots'].append({'file':str(dest.relative_to(OUT)),'surface':category,'description':description,'url':self.page.url,'elapsed_wall_seconds':time.monotonic()-start,'error':error,'ffprobe':info})
        self.save()
        print('CAPTURED', str(dest), info.get('format',{}).get('duration'), 'ERROR', error, flush=True)

    async def guard(self, label, operation):
        try:
            await operation()
        except Exception:
            REPORT['errors'].append({'label':label,'traceback':traceback.format_exc()})
            self.save()
            print('SHOT FAILED',label,REPORT['errors'][-1]['traceback'],flush=True)

    async def map_bounds(self):
        canvas = self.page.locator('canvas.maplibregl-canvas,canvas.mapboxgl-canvas').first
        if await canvas.count() == 0:
            canvas = self.page.locator('canvas').first
        await canvas.wait_for(state='visible',timeout=15000)
        return await canvas.bounding_box()

    async def drag_map(self, dx, dy, seconds):
        box = await self.map_bounds()
        x = box['x']+box['width']*.50
        y = box['y']+box['height']*.48
        await self.page.mouse.move(x,y)
        await self.page.mouse.down()
        steps = max(1,int(seconds*30))
        for i in range(1,steps+1):
            t=i/steps
            ease=t*t*(3-2*t)
            await self.page.mouse.move(x+dx*ease,y+dy*ease)
            await asyncio.sleep(seconds/steps)
        await self.page.mouse.up()
        await self.page.mouse.move(539,1)

    async def zoom_map(self, delta, seconds):
        box=await self.map_bounds()
        await self.page.mouse.move(box['x']+box['width']*.55,box['y']+box['height']*.45)
        steps=max(1,int(seconds*20))
        for _ in range(steps):
            await self.page.mouse.wheel(0,delta/steps)
            await asyncio.sleep(seconds/steps)
        await self.page.mouse.move(539,1)

    async def map_prepare(self):
        await self.prepare('/explore')
        hide=self.page.get_by_role('button',name='Hide filters',exact=True)
        if await hide.count():
            await hide.click()
        await self.page.wait_for_timeout(2500)
        await self.page.mouse.move(539,1)

async def calibrate(page):
    # Temporary calibration content is never part of a delivered clip.
    await page.set_content('<html><style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block}</style><body><svg width="540" height="960" viewBox="0 0 540 960"><rect width="540" height="960" fill="#182c49"/><path d="M0 0H540L0 960Z" fill="#ab704c"/><rect x="3" y="3" width="23" height="37" fill="#02f138"/><rect x="503" y="917" width="31" height="37" fill="#f10ade"/><circle cx="265" cy="455" r="123" fill="#e4edfa"/></svg></body></html>')
    await page.wait_for_timeout(600)
    await page.screenshot(path=str(REVIEW/'viewport-template.png'))
    subprocess.run(['ffmpeg','-y','-v','error','-f','x11grab','-draw_mouse','0','-video_size','1200x2300','-i',DISPLAY+'.0','-frames:v','1',str(REVIEW/'viewport-full.png')],check=True)
    template=cv2.imread(str(REVIEW/'viewport-template.png'))
    screen=cv2.imread(str(REVIEW/'viewport-full.png'))
    minimum,_,location,_=cv2.minMaxLoc(cv2.matchTemplate(screen,template,cv2.TM_SQDIFF_NORMED))
    if template.shape[:2]!=(HEIGHT,WIDTH) or minimum>.04:
        raise RuntimeError(f'Native viewport calibration failed: {template.shape}, error {minimum}')
    REPORT['capture']['screen_offset']=location
    REPORT['capture']['calibration_error']=minimum
    print('CALIBRATED', location, minimum,flush=True)
    return location

async def map_shots(c):
    async def home():
        await c.prepare('/')
        async def move():
            await asyncio.sleep(2)
            await c.scroll(180,6)
        await c.shot('home','01-door','Native Door map motion and restrained opening scroll',move)
    await c.guard('door',home)
    async def national():
        await c.map_prepare()
        async def move():
            await asyncio.sleep(1.5)
            await c.drag_map(-65,15,7)
        await c.shot('map','02-national-drift','National map native pan, filters closed',move)
        async def zoom():
            await asyncio.sleep(1)
            await c.zoom_map(-700,6)
            await asyncio.sleep(2)
        await c.shot('map','03-geographic-descent','Continuous national-to-regional native map zoom',zoom)
        async def city():
            await c.drag_map(80,-30,4)
            await c.zoom_map(-450,3)
            await asyncio.sleep(2)
        await c.shot('map','04-regional-detail','Closer native map drift and zoom',city)
    await c.guard('map-national',national)
    async def return_map():
        await c.map_prepare()
        await c.zoom_map(-650,2)
        await asyncio.sleep(3)
        async def move():
            await asyncio.sleep(1)
            await c.zoom_map(680,5)
            await c.drag_map(35,0,3)
        await c.shot('map','05-return-to-scale','Native map zoom outward to national scale',move)
    await c.guard('map-return',return_map)
    async def record():
        await c.prepare('/place/mother-bethel-ame-church')
        async def move():
            await asyncio.sleep(1)
            await c.scroll(730,8)
        await c.shot('records','06-place-reveal','Real Mother Bethel AME Church released place record',move)
        headings=c.page.get_by_text('Sources',exact=False)
        target=await c.page.evaluate('Math.min(document.scrollingElement.scrollHeight-innerHeight,1800)')
        if await headings.count():
            try:
                target=await headings.first.evaluate('(el)=>el.getBoundingClientRect().top+scrollY-200')
            except Exception:
                pass
        await c.page.evaluate('(y)=>scrollTo(0,Math.max(0,y-300))',target)
        await asyncio.sleep(1)
        async def evidence():
            await c.scroll(target+350,8)
        await c.shot('evidence','07-evidence','Published record source section, actual website',evidence)
    await c.guard('place-record',record)
    async def person():
        await c.prepare('/entity/ent_benjamin_banneker_001')
        async def move():
            await asyncio.sleep(1.5)
            await c.scroll(850,8)
        await c.shot('entities','08-person','Real released Benjamin Banneker entity page',move)
    await c.guard('person',person)

async def editorial_shots(c):
    async def story():
        await c.prepare('/stories/the-count')
        async def move():
            await asyncio.sleep(1)
            await c.scroll(900,9)
        await c.shot('stories','09-story-opening','The Count, actual Story page opening and scroll',move)
        async def deeper():
            await c.scroll(2200,10)
        await c.shot('stories','10-story-context','The Count, native editorial page and citations',deeper)
    await c.guard('story',story)
    async def lives():
        await c.prepare('/lives',y=650)
        async def move():
            await c.scroll(2100,11)
        await c.shot('lives','11-lives-decades','Lives across the decades, native timeline scroll',move)
    await c.guard('lives',lives)
    async def data():
        await c.prepare('/data',y=550)
        async def move():
            await c.scroll(1600,10)
        await c.shot('data','12-data-context','Native Data page visualizations entering frame',move)
        async def deeper():
            await c.scroll(2700,10)
        await c.shot('data','13-data-charts','Actual Data charts with native labels and sourcing',deeper)
    await c.guard('data',data)
    async def records():
        await c.prepare('/records',y=450)
        async def move():
            await c.scroll(1400,9)
        await c.shot('records','14-records-catalog','Actual catalog records moving through viewport',move)
    await c.guard('catalog',records)
    async def memorial():
        await c.prepare('/memorial')
        async def hold():
            await asyncio.sleep(13)
        await c.shot('memorial','15-memorial-wall','Uninterrupted native Memorial name-wall animation',hold)
        target=await c.page.locator('#memorial-names').evaluate('(el)=>el.getBoundingClientRect().top+scrollY') if await c.page.locator('#memorial-names').count() else 700
        await c.page.evaluate('(y)=>scrollTo(0,y)',target)
        await asyncio.sleep(2)
        async def names():
            await c.scroll(target+180,12)
        await c.shot('memorial','16-memorial-names','Extremely slow native scroll over real Memorial names',names)
    await c.guard('memorial',memorial)

async def main(group):
    xvfb=subprocess.Popen(['Xvfb',DISPLAY,'-screen','0','1200x2300x24','-ac','-nolisten','tcp'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    await asyncio.sleep(1)
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=False,env={**os.environ,'DISPLAY':DISPLAY},args=['--no-sandbox','--window-position=0,0','--force-device-scale-factor=2','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],ignore_default_args=['--enable-automation'])
            context=await browser.new_context(viewport={'width':540,'height':960},device_scale_factor=2,color_scheme='dark',reduced_motion='no-preference')
            page=await context.new_page()
            offset=await calibrate(page)
            c=Capture(page,offset)
            await (map_shots(c) if group=='map' else editorial_shots(c))
            await browser.close()
    finally:
        xvfb.terminate()
        xvfb.wait()
        (OUT/'capture-manifest.json').write_text(json.dumps(REPORT,indent=2))
    brand=pathlib.Path('apps/web/public/brand')
    if brand.exists():
        for file in brand.glob('*.png'):
            if file.name.startswith(('lockup-','symbol-')):
                shutil.copy2(file,OUT/'assets'/file.name)
    if not REPORT['shots']:
        raise RuntimeError('No actual website clips were captured.')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('group',choices=['map','editorial'])
    asyncio.run(main(parser.parse_args().group))

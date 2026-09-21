"""Retrieve only the requested public TikTok post; never substitute another edit."""
from __future__ import annotations
import asyncio, hashlib, json, pathlib, re, subprocess, sys, traceback
from urllib.parse import urlparse
from curl_cffi import requests
from playwright.async_api import async_playwright

ID = '7670347350115634462'
URL = f'https://www.tiktok.com/@ambnt.prod/video/{ID}'
OUT = pathlib.Path('output/reference')
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {'requested_id': ID, 'requested_creator': 'ambnt.prod', 'status': 'unverified', 'attempts': []}

def save_report():
    (OUT / 'retrieval-report.json').write_text(json.dumps(REPORT, indent=2))

def probe(path):
    p = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)], capture_output=True, text=True)
    return json.loads(p.stdout) if p.returncode == 0 else None

def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)

def inspect_json(data, label):
    (OUT / (label + '.json')).write_text(json.dumps(data, indent=2))
    candidates = []
    for item in walk(data):
        if str(item.get('id', item.get('aweme_id', ''))) != ID:
            continue
        author = item.get('author', {})
        author_name = author.get('uniqueId', author.get('unique_id', '')) if isinstance(author, dict) else str(author)
        if author_name.lower().lstrip('@') != 'ambnt.prod':
            continue
        video = item.get('video', {})
        REPORT['matched_post'] = {'id': ID, 'author': author_name, 'source': label, 'description': item.get('desc'), 'video_duration': video.get('duration'), 'music': item.get('music')}
        for obj in walk(video):
            for key, val in obj.items():
                if key.lower() in ['playaddr', 'downloadaddr', 'play_addr', 'download_addr', 'playaddrh264']:
                    if isinstance(val, str) and val.startswith('https://'):
                        candidates.append(val)
                    elif isinstance(val, dict):
                        candidates.extend(x for x in val.get('url_list', val.get('UrlList', [])) if isinstance(x, str) and x.startswith('https://'))
                if key in ['UrlList', 'url_list'] and isinstance(val, list):
                    candidates.extend(x for x in val if isinstance(x, str) and x.startswith('https://'))
    return list(dict.fromkeys(candidates))

def retrieve_candidate(url, session, label):
    try:
        r = session.get(url, headers={'Referer': URL}, timeout=40)
        item = {'label': label, 'status': r.status_code, 'bytes': len(r.content), 'host': urlparse(url).hostname}
        REPORT['attempts'].append(item)
        if r.status_code != 200 or len(r.content) < 10000:
            return False
        dest = OUT / 'reference.mp4'
        dest.write_bytes(r.content)
        info = probe(dest)
        if not info or not any(s.get('codec_type') == 'audio' for s in info['streams']):
            dest.unlink(missing_ok=True)
            return False
        (OUT / 'reference-ffprobe.json').write_text(json.dumps(info, indent=2))
        REPORT.update(status='verified_post_video_retrieved', sha256=hashlib.sha256(r.content).hexdigest(), bytes=len(r.content), acquisition=label)
        save_report()
        return True
    except Exception as exc:
        REPORT['attempts'].append({'label': label, 'error': str(exc)})
        return False

async def main():
    for extra in [[], ['--impersonate', 'chrome']]:
        command = [sys.executable, '-m', 'yt_dlp', '--no-playlist', '--socket-timeout', '15', '--retries', '1', '--write-info-json', '-f', 'best', '-o', str(OUT / 'reference.%(ext)s'), *extra, URL]
        try:
            p = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
            result, _ = await asyncio.wait_for(p.communicate(), timeout=100)
            label = 'yt-dlp-' + ('impersonation' if extra else 'default')
            (OUT / (label + '.log')).write_bytes(result)
            REPORT['attempts'].append({'label': label, 'returncode': p.returncode})
            info_path = OUT / 'reference.info.json'
            if p.returncode == 0 and info_path.exists():
                info = json.loads(info_path.read_text())
                creator = str(info.get('uploader_id') or info.get('uploader') or '').lower().lstrip('@')
                if str(info.get('id')) == ID and creator == 'ambnt.prod':
                    media = next((x for x in OUT.glob('reference.*') if x.suffix in ['.mp4', '.webm', '.mkv']), None)
                    if media and probe(media):
                        REPORT.update(status='verified_post_video_retrieved', acquisition=label, matched_post={'id': info['id'], 'author': creator}, sha256=hashlib.sha256(media.read_bytes()).hexdigest())
                        (OUT / 'reference-ffprobe.json').write_text(json.dumps(probe(media), indent=2))
                        save_report()
                        return
        except Exception as exc:
            REPORT['attempts'].append({'label': 'yt-dlp', 'error': str(exc)})
            if 'p' in locals() and p.returncode is None:
                p.kill()
                await p.wait()
        save_report()

    session = requests.Session(impersonate='chrome')
    urls = [URL, f'https://www.tiktok.com/embed/v2/{ID}', f'https://www.tiktok.com/player/v1/{ID}', 'https://www.tiktok.com/oembed?url=' + URL]
    for index, url in enumerate(urls):
        label = f'public-endpoint-{index}'
        try:
            response = session.get(url, timeout=25)
            REPORT['attempts'].append({'label': label, 'url': url, 'status': response.status_code})
            (OUT / (label + '.html')).write_text(response.text)
            documents = []
            try:
                documents.append(response.json())
            except Exception:
                pass
            for raw in re.findall(r'<script[^>]*(?:id="(?:__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE|__NEXT_DATA__)"|type="application/json")[^>]*>(.*?)</script>', response.text, flags=re.S):
                try:
                    documents.append(json.loads(raw))
                except Exception:
                    pass
            for n, document in enumerate(documents):
                for candidate in inspect_json(document, label + '-' + str(n)):
                    if retrieve_candidate(candidate, session, label):
                        return
        except Exception as exc:
            REPORT['attempts'].append({'label': label, 'error': str(exc)})
        save_report()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 900})
        page = await context.new_page()
        for index, url in enumerate(urls[:3]):
            label = f'browser-{index}'
            try:
                await page.goto(url, wait_until='domcontentloaded', timeout=35000)
                await page.wait_for_timeout(6000)
                (OUT / (label + '.html')).write_text(await page.content())
                REPORT['attempts'].append({'label': label, 'url': page.url, 'title': await page.title(), 'body': (await page.locator('body').inner_text())[:1500]})
                for n, raw in enumerate(await page.locator('script[type="application/json"],script#__UNIVERSAL_DATA_FOR_REHYDRATION__,script#SIGI_STATE,script#__NEXT_DATA__').all_text_contents()):
                    try:
                        for candidate in inspect_json(json.loads(raw), label + '-' + str(n)):
                            if retrieve_candidate(candidate, session, label):
                                await browser.close()
                                return
                    except json.JSONDecodeError:
                        continue
            except Exception as exc:
                REPORT['attempts'].append({'label': label, 'error': str(exc)})
            save_report()
        await browser.close()
    save_report()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception:
        REPORT['fatal_error'] = traceback.format_exc()
        save_report()
        raise
    finally:
        print(json.dumps(REPORT, indent=2))

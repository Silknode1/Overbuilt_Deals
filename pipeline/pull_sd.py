import os
HERE=os.path.dirname(os.path.abspath(__file__)); os.makedirs(HERE+'/.cache',exist_ok=True)
import subprocess, xml.etree.ElementTree as ET, json, urllib.parse, re, concurrent.futures as cf
kws=["hd 600","hd 650","hd 6xx","audeze","sennheiser","headphone amp","dac","planar headphones","closed back headphones","hifiman","fiio","topping","schiit","soundcore boom","bluetooth speaker","apple watch ultra","airpods pro","macbook pro","ipad pro","nothing phone","nothing headphone","sharge","anker prime","ugreen","peak design","backpack","carry on luggage","osprey","tom bihn","goruck","5.11","benchmade","spyderco","leatherman","flashlight","olight","nitecore","edc","titanium","oura","withings","garmin","whoop","theragun","hyperice","massage gun","mechanical keyboard","keychron","steam deck","dji","insta360","kindle scribe","boox","eero","raspberry pi","bambu","3d printer","framework laptop","sonos","bose quietcomfort","sony wh-1000xm6","damascus","damascus knife","pocket knife","folding knife","multitool","multi-tool","gerber","victorinox","civivi","kizer","cold steel","crkt","ontario knife","morakniv","opinel","bushcraft knife","titanium pen","titanium spork","camping","camp stove","ultralight","sleeping pad","tent","hammock","headlamp","water filter","solar generator","portable power station","jetboil","helinox","nemo","snow peak","black diamond","osprey","hyperlite","lego","lego retro","minifigure","pink floyd","vinyl","turntable","retro console","8bitdo","playdate","funko","kidrobot","super7"]
def get(q):
    url="https://slickdeals.net/newsearch.php?"+urllib.parse.urlencode({"q":q,"searcharea":"deals","searchin":"first","rss":1})
    r=subprocess.run(['curl','-s','-L','-m','30',url],capture_output=True,text=True)
    out=[]
    try: root=ET.fromstring(r.stdout)
    except Exception: return q,[]
    for it in root.iter('item'):
        g=lambda t:(it.findtext(t) or '').strip()
        enc=it.findtext('{http://purl.org/rss/1.0/modules/content/}encoded') or ''; im=re.search(r'<img[^>]+src="([^"]+)"',enc)
        out.append(dict(q=q,img=(im.group(1) if im else None),title=g('title'),link=g('link'),date=g('pubDate'),desc=re.sub('<[^>]+>',' ',g('description'))[:400]))
    return q,out
res=[]
with cf.ThreadPoolExecutor(4) as ex:
    for q,o in ex.map(get,kws): res+=o; print(q,len(o))
for f in ['frontpage','popular']:
    pass
json.dump(res,open(HERE+'/.cache/slickdeals.json','w')); print(len(res))

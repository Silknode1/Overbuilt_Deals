import json,re,statistics,datetime as dt,collections,os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE); HIST=ROOT+'/data/history'
os.makedirs(HIST,exist_ok=True)
P=json.load(open(HERE+'/.cache/shopify_raw.json')); SD=json.load(open(HERE+'/.cache/slickdeals.json'))
NOW=dt.datetime.now(dt.timezone.utc)
def jload(p,d):
    try: return json.load(open(p))
    except Exception: return d
# ---- sale windows (from promo emails + retailer announcements)
ENDS={'us.sennheiser-hearing.com':'2026-12-06T23:59:00-05:00','apos.audio':'2026-12-06T23:59:00-05:00','peakdesign':'2026-11-30T23:59:00-08:00','amazon':'2026-11-30T23:59:00-08:00','apple':'2026-11-30T23:59:00-08:00','bestbuy':'2026-11-30T23:59:00-06:00'}
CAT_BY_STORE={'nobullproject.com':'apparel','thejamesbrand.com':'edc','apos.audio':'audio','www.audeze.com':'audio','us.sennheiser-hearing.com':'audio','fellowproducts.com':'home','headphones.com':'audio','audio46.com':'audio','sharge.com':'charging','www.aersf.com':'bags','www.tombihn.com':'bags','www.goruck.com':'tactical','www.ablecarry.com':'bags','www.nomatic.com':'bags','monos.com':'luggage','www.tactileturn.com':'edc','www.knafs.com':'edc','www.keychron.com':'gadgets','www.hyperice.com':'health','www.therabody.com':'health','www.ugreen.com':'charging','www.evergoods.us':'bags','www.vertx.com':'tactical','www.leatherman.com':'edc','www.orbitkey.com':'edc','www.nitecorestore.com':'edc','www.fenixlighting.com':'edc','www.cotopaxi.com':'bags','www.wandrd.com':'bags','www.campfireaudio.com':'audio','www.64audio.com':'audio','shop.boox.com':'gadgets','www.cutleryandmore.com':'home','prometheusdesignwerx.com':'tactical','www.civivi.com':'edc','www.kizerknives.com':'edc','www.maxpedition.com':'tactical','www.gerbergear.com':'edc','trueutility.com':'edc','www.wubenlight.com':'edc','www.vosteed.com':'edc','ontarioknife.com':'edc','www.chrisreeve.com':'edc','www.realsteelknives.com':'edc','www.zippo.com':'edc','opinel-usa.com':'edc','www.damascus-knife.com':'edc','www.dalstrong.com':'home','www.blackdiamondequipment.com':'camping','nemoequipment.com':'camping','www.helinox.com':'camping','snowpeak.com':'camping','hyperlitemountaingear.com':'camping','www.gossamergear.com':'camping','zpacks.com':'camping','garagegrowngear.com':'camping','seatosummit.com':'camping','www.goalzero.com':'camping','www.bioliteenergy.com':'camping','www.vargooutdoors.com':'camping','toaksoutdoor.com':'camping','orukayak.com':'camping','rumpl.com':'camping','www.bigagnes.com':'camping','www.kelty.com':'camping','www.thermarest.com':'camping','www.kidrobot.com':'quirky','www.super7.com':'quirky','mondoshop.com':'quirky','shop.pinkfloyd.com':'quirky','store.rhino.com':'quirky'}
FULLOK={'shop.pinkfloyd.com'}
NEG=r"\b(sock|socks|tee|t-shirt|shirt|tank|hoodie|jogger|short|shorts|legging|bra|hat|cap|beanie|sticker|patch|gift card|e-gift|warranty|protection plan|replacement|spare|ear ?tips?|eartip|ear ?pads?|earpads?|filter|filters|lanyard|keycap|switches|sample|kids|youth|cleaning|lube|insurance|shipping|deposit|poster|mug|glass|drip|kettle|grinder burr|cable|cables|adapter|interconnect)\b"
FEAT=[('titanium',r'titanium|\bti\b|\bti-'),('carbon',r'carbon fiber|carbon fibre|\bcf\b'),('super-steel',r'magnacut|s90v|m390|20cv|s35vn|cpm|damascus|m4\b|elmax'),('planar',r'planar'),('r2r',r'r2r'),('tube',r'\btube\b|valve'),('balanced',r'balanced|xlr|4\.4mm'),('flagship',r'flagship|reference|pro\b|elite|signature'),('anc',r'\banc\b|noise cancell'),('wireless',r'wireless|bluetooth|tws'),('e-ink',r'e-?ink|eink'),('gan',r'\bgan\b'),('qi2',r'qi2|magsafe|magnetic'),('tech-fabric',r'x-pac|xpac|dyneema|ultra ?200|cordura|ballistic|ecopak|vx21|1050d|500d'),('modular',r'modular|molle|system'),('travel',r'carry-on|carry on|travel|luggage|duffel|check-in|roller'),('backpack',r'backpack|ruck|pack\b|daypack|sling'),('knife',r'knife|blade|folder|fixed blade|multitool|multi-tool'),('light',r'flashlight|lumens|headlamp|torch'),('pen',r'\bpen\b|bolt action'),('open-box',r'open box|b-stock|b stock|certified|refurb|seconds|scratch'),('dac-amp',r'\bdac\b|\bamp\b|amplifier|preamp'),('headphones',r'headphone|over-ear|open-back|closed-back|iem|in-ear|earphone'),('recovery',r'massage|percussion|compression|recovery|normatec|theragun|hypervolt'),('keyboard',r'keyboard|mechanical|\bmouse\b'),('charger',r'charger|power bank|powerbank|charging station|\bw\b.*usb-c'),('waterproof',r'waterproof|weatherproof|ipx|ip6'),('damascus',r'damascus|pattern.?weld|mokume'),('multitool',r'multi-?tool|\bsak\b|swiss army|pliers|\bsuper tool\b|\bwave\b|\bsurge\b'),('camping',r'\btent\b|stove|sleeping (?:bag|pad)|bivy|hammock|tarp|quilt|camp|ultralight|bushcraft|titanium (?:pot|mug|spork|cup|stake)|headlamp|lantern'),('retro',r'retro|vintage|8-?bit|cassette|vinyl|pink floyd|dark side|the wall|wish you were here|animals|lego|brick|minifig|nanoblock'),('collectible',r'figure|statue|vinyl toy|limited edition|collab|collectible|dunny|labbit|mystery|bearbrick')]
MODELS=['hd 600','hd 650','hd 6xx','hd 660s2','hd 800s','hd 800 s','hdb 630','hd 620s','hd 560s','hd 490 pro','momentum 4','momentum 5','ie 900','ie 600','ie 200','maxwell 2','maxwell','lcd-2','lcd-x','mm-100','mm-500','sundara','arya','ananda','edition xs','he1000','focal clear','utopia','bathys','clear mg','meze 109','109 pro','aeon','expanse','boom 2','gremlin','k11','zd3','q5k','ft1','ft3','ft5','atom amp','modi','magni','asgard','bifrost','jotunheim','lyr','valhalla','icemag','shargeek','retro 67','rucker','gr1','gr2','travel pack 3','tom bihn synik','synapse','aeronaut','palma','note air','tab ultra','keychron q1','keychron q6','theragun pro','hypervolt','normatec']
def norm(s): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9.\- ]',' ',s.lower())).strip()
ACC=r'\bfor\b|pads?\b|earpads|cable|cord|stand|case|cover|adapter|ear ?tips|replacement|upgrade|headband|strap|bundle|set\b|grill|mod\b|dekoni|\bcompatible'
def model_of(t):
    if re.search(ACC,t.lower()): return None
    n=' '+norm(t).replace('hd600','hd 600').replace('hd650','hd 650').replace('hd6xx','hd 6xx').replace('hd800','hd 800')+' '
    best=None
    for m in MODELS:
        if f' {m} ' in n or f' {m}' in n and len(m)>4:
            if not best or len(m)>len(best): best=m
    return best
# ---- Slickdeals observed prices per model
pr=lambda t:(lambda m: float(m.group(1).replace(',','')) if m else None)(re.search(r'\$([\d,]+(?:\.\d\d)?)',t))
sd_obs=collections.defaultdict(list); sd_items=[]
for x in SD:
    try: d=dt.datetime.strptime(x['date'],'%a, %d %b %Y %H:%M:%S %z')
    except: continue
    p=pr(x['title']); m=model_of(x['title'])
    neg=re.search(r'pads|cable|stand|case|cover|stand|adapter',x['title'].lower())
    if p and m and not neg: sd_obs[m].append(dict(p=p,date=d.date().isoformat(),t=x['title'],link=x['link']))
    ret=re.search(r'\bat ([A-Z][\w&\.!\- ]{1,24}?)(?:\s*[\(\-|,]|$)',x['title']); 
    sd_items.append(dict(x,dt=d,price=p,model=m,retailer=(ret.group(1).strip() if ret else None)))
_acc=jload(HIST+'/model_prices.json',{})
for m,obs in sd_obs.items():
    have={o['link'] for o in _acc.get(m,[])}
    _acc.setdefault(m,[]).extend(o for o in obs if o['link'] not in have)
sd_obs=collections.defaultdict(list,_acc)
json.dump(_acc,open(HIST+'/model_prices.json','w'),separators=(',',':'))
OWN=jload(HIST+'/own.json',{})  # id -> {min, first, last_p, last_r}
def sd_low(m):
    xs=[o for o in sd_obs.get(m,[])]
    if len(xs)<2: return None
    med=statistics.median(o['p'] for o in xs); xs=[o for o in xs if o['p']>0.6*med]
    if not xs: return None
    lo=min(xs,key=lambda o:o['p']); return dict(low=lo['p'],date=lo['date'],n=len(xs),med=round(med,2),link=lo['link'])
# ---- cross-retailer min for model (shopify, new condition)
cross=collections.defaultdict(list)
BASE={'audio':.30,'charging':.35,'gadgets':.35,'bags':.10,'luggage':.30,'edc':.15,'tactical':.15,'health':.30,'apparel':.35,'home':.25,'camping':.30,'quirky':.15}
def best_variant(p):
    vs=[v for v in p['variants'] if v['a'] and v['p']>0]
    if not vs: return None
    sale=[v for v in vs if v['c']>v['p']]
    return min(sale or vs,key=lambda v:v['p'])
items=[]
for p in P:
    v=best_variant(p)
    if not v: continue
    t=p['title']; tl=t.lower()
    if re.search(r'employee|internal|staff|wholesale|spare parts|closed shop',(p['vendor'] or '').lower()+' '+' '.join(p['tags'] or []).lower()): continue
    cat=CAT_BY_STORE.get(p['store'],p['cat'])
    feats=[k for k,rx in FEAT if re.search(rx,tl+' '+(p['type'] or '').lower()+' '+' '.join(p['tags'] or []).lower())]
    if cat=='bags' and 'travel' in feats and re.search(r'carry-on|luggage|roller|check',tl): cat='luggage'
    if cat=='audio' and not ({'headphones','dac-amp','planar','r2r','tube'}&set(feats)) and v['p']<80: continue
    m=model_of(t)
    cond='used' if 'open-box' in feats else 'new'
    if m and cond=='new': cross[m].append((v['p'],p['store']))
    full=p['store'] in FULLOK and not (v['c']>v['p'])
    if full:
        if re.search(r'\b(tee|t-shirt|shirt|hood|hoodie|sock|socks)\b',tl): continue
    else:
        if not (v['c']>v['p']): continue
        if re.search(NEG,tl) or v['p']<25: continue
    if p['store']=='www.blackdiamondequipment.com' and not re.search(r'headlamp|lantern|tent|shelter|pack|trekking|pole|stove|bivy|sleeping|carabiner|cord',tl): continue
    if p['store']=='www.cutleryandmore.com' and not re.search(r'damascus|pocket|folding|multi',tl): continue
    if p['store']=='nobullproject.com' and not re.search(r'trainer|runner|boot|shoe|bag|backpack|duffle|ruck',tl): continue
    if p['store']=='www.cotopaxi.com' and not re.search(r'pack|bag|duffel|sling|luggage|carry',tl): continue
    if p['store']=='fellowproducts.com' and v['p']<60: continue
    if cat=='quirky' and not re.search(r'figure|vinyl|\blp\b|record|toy|statue|brick|lego|minifig|turntable|print|collect|dunny|labbit|knit|lighter|box set|bearbrick|jacket|pin set',tl): continue
    if p['store']=='www.dalstrong.com' and not re.search(r'damascus|chef|santoku|knife set|cleaver|bundle',tl): continue
    RET={'apos.audio','headphones.com','audio46.com'}
    items.append(dict(id=f"s{p['id']}",title=t,brand=((p['vendor'] or p['brand_store']) if p['store'] in RET else p['brand_store']).strip(),store=p['brand_store'],domain=p['store'],url=p['url'],img=p['img'],cat=cat,type=p['type'],feats=feats,model=m,cond=cond,full=full,price=v['p'],ref=(v['c'] if v['c']>v['p'] else None),variant=v['t'] if v['t']!='Default Title' else None,updated=p['updated'],src='shopify'))
# ---- anchor deals from announcements/marketplaces (non-Shopify)
ANCH=[
 dict(id='a-pd',title='Peak Design Black Friday — up to 40% off Everyday/Travel bags (select colors)',brand='Peak Design',store='Peak Design',domain='peakdesign.com',url='https://www.peakdesign.com/',cat='bags',feats=['backpack','tech-fabric','modular','travel'],price=None,ref=None,ends=ENDS['peakdesign'],src='announcement',real=82,verdict='Likely genuine — bags rarely drop below sale price',note='Sale 12:00am PT Nov 19 → 11:59pm PT Nov 30, in-stock only. Bags rarely see lower prices earlier in the year.'),
 dict(id='a-awu4',title='Apple Watch Ultra 4 (select configs)',brand='Apple',store='Amazon',domain='amazon.com',url='https://www.amazon.com/s?k=apple+watch+ultra+4',cat='health',feats=['titanium','flagship','waterproof'],price=699.99,ref=799.0,ends=ENDS['amazon'],src='marketplace',known_low=699.99,note='Matches its all-time low; has bounced to $774 since October. Apple Store alternative: full price + up to $100 gift card Nov 27–30.'),
 dict(id='a-nhp1',title='Nothing Headphone (1) Pro',brand='Nothing',store='Amazon',domain='amazon.com',url='https://www.amazon.com/s?k=nothing+headphone+1+pro',cat='audio',feats=['headphones','anc','wireless'],price=319.0,ref=399.0,ends=ENDS['amazon'],src='marketplace',note='$80 off; Nothing\'s own store sale is live too (prices unverified).'),
 dict(id='a-boom2',title='Soundcore Boom 2 portable speaker',brand='Soundcore',store='Amazon',domain='amazon.com',url='https://www.amazon.com/s?k=soundcore+boom+2',cat='audio',feats=['wireless','waterproof'],price=84.99,ref=129.99,ends=ENDS['amazon'],src='marketplace',known_low=74.99,note='Below its 2026 Amazon low (~$89.99), but Costco hit $74.99 in March. Reported price — verify on page.'),
 dict(id='e-0',title='Damascus pocket knives',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=damascus+pocket+knife&explicit=1',cat='edc',feats=['damascus', 'knife', 'super-steel'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-1',title='Handmade Damascus & pattern-welded blades',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=pattern+welded+damascus+folding+knife&explicit=1',cat='edc',feats=['damascus', 'knife'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-2',title='Titanium & Damascus EDC pens, beads, tools',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=titanium+edc+pen+bead&explicit=1',cat='edc',feats=['titanium', 'pen'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-3',title='Pink Floyd minifigs & brick figures',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=pink+floyd+minifigure+custom+brick&explicit=1',cat='quirky',feats=['retro', 'collectible'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-4',title='Retro Lego-style rock band figures',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=lego+style+custom+minifigure+rock+band&explicit=1',cat='quirky',feats=['retro', 'collectible'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-5',title='Dark Side of the Moon prism & vintage Floyd art',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=dark+side+of+the+moon+prism&explicit=1',cat='quirky',feats=['retro'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-6',title='Handmade camp gear: titanium, leather, canvas',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=titanium+camp+spork+handmade&explicit=1',cat='camping',feats=['camping', 'titanium'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-7',title='Custom leather & waxed canvas EDC carry',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=waxed+canvas+edc+pouch+handmade&explicit=1',cat='bags',feats=['modular'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
 dict(id='e-8',title='Mechanical & kinetic desk toys (machined)',brand='Etsy',store='Etsy',domain='etsy.com',url='https://www.etsy.com/search?q=machined+edc+fidget+titanium&explicit=1',cat='edc',feats=['titanium', 'collectible'],price=None,ref=None,src='search',real=60,verdict='Handmade search: no price tracking',note='A saved Etsy search. Etsy has no free price feed, so open it and sort by newest or price.'),
]
# ---- Slickdeals marketplace items (last 9 days, priced)
KWCAT={'hd 600':'audio','hd 650':'audio','hd 6xx':'audio','audeze':'audio','sennheiser':'audio','headphone amp':'audio','dac':'audio','planar headphones':'audio','closed back headphones':'audio','hifiman':'audio','fiio':'audio','topping':'audio','schiit':'audio','soundcore boom':'audio','bluetooth speaker':'audio','apple watch ultra':'health','airpods pro':'audio','macbook pro':'gadgets','ipad pro':'gadgets','nothing phone':'gadgets','nothing headphone':'audio','sharge':'charging','anker prime':'charging','ugreen':'charging','peak design':'bags','backpack':'bags','carry on luggage':'luggage','osprey':'bags','tom bihn':'bags','goruck':'tactical','5.11':'tactical','benchmade':'edc','spyderco':'edc','leatherman':'edc','flashlight':'edc','olight':'edc','nitecore':'edc','edc':'edc','titanium':'edc','oura':'health','withings':'health','garmin':'health','whoop':'health','theragun':'health','hyperice':'health','massage gun':'health','mechanical keyboard':'gadgets','keychron':'gadgets','steam deck':'gadgets','dji':'gadgets','insta360':'gadgets','kindle scribe':'gadgets','boox':'gadgets','eero':'gadgets','raspberry pi':'gadgets','bambu':'gadgets','3d printer':'gadgets','framework laptop':'gadgets','sonos':'audio','bose quietcomfort':'audio','sony wh-1000xm6':'audio','damascus':'edc','damascus knife':'edc','pocket knife':'edc','folding knife':'edc','multitool':'edc','multi-tool':'edc','gerber':'edc','victorinox':'edc','civivi':'edc','kizer':'edc','cold steel':'edc','crkt':'edc','ontario knife':'edc','morakniv':'edc','opinel':'edc','bushcraft knife':'edc','titanium pen':'edc','titanium spork':'camping','camping':'camping','camp stove':'camping','ultralight':'camping','sleeping pad':'camping','tent':'camping','hammock':'camping','headlamp':'camping','water filter':'camping','solar generator':'camping','portable power station':'camping','jetboil':'camping','helinox':'camping','nemo':'camping','snow peak':'camping','black diamond':'camping','hyperlite':'camping','lego':'quirky','lego retro':'quirky','minifigure':'quirky','pink floyd':'quirky','vinyl':'quirky','turntable':'quirky','retro console':'quirky','8bitdo':'quirky','playdate':'quirky','funko':'quirky','kidrobot':'quirky','super7':'quirky'}
seen=set(); mk=[]
for x in sorted(sd_items,key=lambda x:x['dt'],reverse=True):
    if (NOW-x['dt']).days>9 or not x['price'] or x['price']<25: continue
    k=norm(x['title'])[:60]
    if k in seen: continue
    seen.add(k); tl=x['title'].lower()
    if re.search(r'\btv\b|monitor|sd card|micro ?sd|tcl|samsung 85|vacuum|printer ink',tl) and KWCAT[x['q']] not in('gadgets',): continue
    if re.search(r'\btv\b|sd card|micro ?sd|memory card',tl): continue
    feats=[k2 for k2,rx in FEAT if re.search(rx,tl)]
    mk.append(dict(id='sd'+str(abs(hash(x['link']))%10**9),title=re.sub(r'^\$[\d,.]+\s*\|\s*','',x['title']),brand=x['q'].title(),store=x['retailer'] or 'Slickdeals',domain='slickdeals.net',url=x['link'],cat=KWCAT[x['q']],feats=feats,model=x['model'],cond='used' if 'open-box' in feats or 'open box' in tl else 'new',price=x['price'],ref=None,posted=x['dt'].isoformat(),src='slickdeals',img=x.get('img')))
items+=ANCH+mk
# ---- deal math
def label(it):
    p=it.get('price'); ref=it.get('ref'); m=it.get('model'); out={}
    claimed=(1-p/ref) if p and ref and ref>p else None
    out['claimed']=round(claimed,3) if claimed else None
    lo=sd_low(m) if m else None
    if lo and p and not (0.55<=lo['low']/p<=1.6): lo=None
    own=OWN.get(it['id'])
    if own and p and (NOW-dt.datetime.fromisoformat(own['first'])).days>=5 and (not lo or own['min']<lo['low']):
        lo=dict(low=own['min'],date=own.get('min_date'),n=(lo or {}).get('n',0)+3)
    if it.get('known_low'): lo=dict(low=it['known_low'],n=1,date=None)
    cx=[c for c in cross.get(m,[]) if c[1]!=it.get('domain')] if m and it.get('cond')=='new' else []
    cx=[c for c in cx if p and 0.55<=c[0]/p<=1.6]
    cmin=min(cx) if cx else None
    out['hist']=lo; out['elsewhere']=dict(price=cmin[0],store=cmin[1]) if cmin and p and cmin[0]<p*0.97 else None
    infl= claimed and ref/p>2.4
    score=50; verdict='Claimed discount — no price history yet'; conf='low'
    if claimed: score=35+min(claimed,0.6)*80
    if lo and p:
        r=p/lo['low']; conf='medium' if lo.get('n',1)>=3 else 'low'
        if r<=1.02: score=max(score,88); verdict=f"Lowest price seen (${lo['low']:.0f})"
        elif r<=1.10: score=min(max(score,64),78); verdict=f"Good, not the floor — seen ${lo['low']:.0f}"
        else: score=min(score,48); verdict=f"Seen cheaper: ${lo['low']:.0f}"+(f" ({lo['date'][5:]})" if lo.get('date') else '')
    if not lo and not out['elsewhere']: score=min(score,70)
    if out['elsewhere']: score=min(score,45); verdict=f"Cheaper at {out['elsewhere']['store']}: ${out['elsewhere']['price']:.0f}"
    if infl: score-=15; verdict+=' · reference price looks inflated'
    if it.get('cond')=='used': verdict+=' · open-box/B-stock'
    if it.get('full'): score=50; verdict='Full price: not on sale. Watching for a drop'
    if claimed and claimed<0.08 and not lo: score=min(score,40); verdict='Token discount (<8%)'
    out['real']=int(max(5,min(98,score))); out['verdict']=verdict; out['conf']=conf
    # will it drop further? horizon: through Jan 31
    b=BASE.get(it['cat'],.3)
    if lo and p and p/lo['low']<=1.02: b-=.15
    elif lo and p and p/lo['low']>1.10: b+=.2
    if claimed and claimed>=.30 and not infl: b-=.08
    if it.get('cond')=='used': b-=.08
    pd=max(.05,min(.85,b)); out['p_drop']=round(pd,2)
    ends=it.get('ends') or ENDS.get(it.get('domain'))
    out['ends']=ends
    if it.get('full'): out['buy']='Watch'
    elif it.get('domain')=='bestbuy.com': out['buy']='Buy now — protected'
    elif pd<.2 or (lo and p and p/lo['low']<=1.02): out['buy']='Buy now'
    elif pd>=.45: out['buy']='Wait'
    else: out['buy']='Coin flip'
    return out
for it in items:
    keep={k:it[k] for k in ('real','verdict') if k in it}
    it.update(label(it))
    if it['src']=='announcement': it.update(keep); it['buy']='Buy now'
    if it['src']=='search': it.update(keep); it['buy']='Hunt'; it['p_drop']=0
# brand stats for discovery
bs=collections.Counter(i['brand'] for i in items if i['src']=='shopify')
data=dict(generated=NOW.isoformat(),counts=dict(products_scanned=len(P),stores=len(set(p['store'] for p in P)),slickdeals=len(SD)),items=items,events=[
 dict(name='Peak Design sale ends',at=ENDS['peakdesign']),dict(name='Black Friday',at='2026-11-27T00:00:00-06:00'),dict(name='Apple gift-card event ends',at=ENDS['apple']),dict(name='Amazon BF/Cyber Monday ends',at=ENDS['amazon']),dict(name='Sennheiser + Apos sales end',at=ENDS['us.sennheiser-hearing.com']),dict(name='Best Buy own-price match ends',at='2027-01-15T23:59:00-06:00')],
 sd_history={m:sorted(v,key=lambda o:o['date']) for m,v in sd_obs.items() if len(v)>=2})
json.dump(data,open(HERE+'/.cache/data.json','w'),separators=(',',':'))
# own price history: append changes, keep running minimum
day=NOW.date().isoformat(); lines=[]
for it in items:
    p=it.get('price')
    if not p or it['src']=='announcement': continue
    o=OWN.get(it['id'])
    if not o: OWN[it['id']]=dict(min=p,min_date=day,first=NOW.isoformat(),last_p=p,last_r=it.get('ref')); lines.append(dict(id=it['id'],t=NOW.isoformat(timespec='minutes'),p=p,r=it.get('ref')))
    elif o['last_p']!=p or o.get('last_r')!=it.get('ref'):
        lines.append(dict(id=it['id'],t=NOW.isoformat(timespec='minutes'),p=p,r=it.get('ref'))); o['last_p']=p; o['last_r']=it.get('ref')
        if p<o['min']: o['min']=p; o['min_date']=day
json.dump(OWN,open(HIST+'/own.json','w'),separators=(',',':'))
with open(HIST+f'/{NOW:%Y-%m}.jsonl','a') as fh:
    for l in lines: fh.write(json.dumps(l,separators=(',',':'))+'\n')
print('history changes',len(lines))
c=collections.Counter(i['cat'] for i in items); print(len(items),c)
pass #print(collections.Counter(i['verdict'].split(' —')[0].split(':')[0] for i in items).most_common(12))

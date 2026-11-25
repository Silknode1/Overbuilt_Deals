import json, subprocess, sys, time, concurrent.futures as cf
stores=[]
import os
HERE=os.path.dirname(os.path.abspath(__file__)); os.makedirs(HERE+'/.cache',exist_ok=True)
for line in open(HERE+'/domains.txt'):
    d,n,c,w=line.strip().split('|')
    if n=='x': continue
    stores.append((d,n,c,float(w)))
OK={'www.cutleryandmore.com','prometheusdesignwerx.com','www.civivi.com','www.kizerknives.com','www.maxpedition.com','www.gerbergear.com','trueutility.com','www.wubenlight.com','www.vosteed.com','ontarioknife.com','www.chrisreeve.com','www.realsteelknives.com','www.zippo.com','opinel-usa.com','www.damascus-knife.com','www.dalstrong.com','www.blackdiamondequipment.com','nemoequipment.com','www.helinox.com','snowpeak.com','hyperlitemountaingear.com','www.gossamergear.com','zpacks.com','garagegrowngear.com','seatosummit.com','www.goalzero.com','www.bioliteenergy.com','www.vargooutdoors.com','toaksoutdoor.com','orukayak.com','rumpl.com','www.bigagnes.com','www.kelty.com','www.thermarest.com','www.kidrobot.com','www.super7.com','mondoshop.com','shop.pinkfloyd.com','store.rhino.com','apos.audio','audio46.com','fellowproducts.com','headphones.com','monos.com','nobullproject.com','sharge.com','shop.boox.com','thejamesbrand.com','us.sennheiser-hearing.com','www.64audio.com','www.ablecarry.com','www.aersf.com','www.audeze.com','www.campfireaudio.com','www.cotopaxi.com','www.evergoods.us','www.fenixlighting.com','www.goruck.com','www.hyperice.com','www.keychron.com','www.knafs.com','www.leatherman.com','www.nitecorestore.com','www.nomatic.com','www.orbitkey.com','www.tactileturn.com','www.therabody.com','www.tombihn.com','www.ugreen.com','www.vertx.com','www.wandrd.com'}
def get(url):
    r=subprocess.run(['curl','-s','-L','-m','40',url],capture_output=True)
    try: return json.loads(r.stdout)
    except Exception: return None
def pull(s):
    d,n,c,w=s; out=[]
    for page in range(1,6):
        j=get(f'https://{d}/products.json?limit=250&page={page}')
        if not j or not j.get('products'): break
        for p in j['products']:
            vs=[]
            for v in p.get('variants',[]):
                try: price=float(v.get('price') or 0)
                except: price=0
                try: cap=float(v.get('compare_at_price') or 0)
                except: cap=0
                vs.append(dict(t=v.get('title'),p=price,c=cap,a=bool(v.get('available'))))
            ims=[i for i in (p.get('images') or []) if i.get('src')]; img=None
            if ims:
                big=[i for i in ims[:3] if min(i.get('width') or 0,i.get('height') or 0)>=500]
                img=(big[0] if big and min(ims[0].get('width') or 0,ims[0].get('height') or 0)<500 else ims[0])['src']
            out.append(dict(store=d,brand_store=n,cat=c,w=w,id=p['id'],title=p['title'],vendor=p.get('vendor'),type=p.get('product_type'),tags=p.get('tags'),handle=p['handle'],url=f'https://{d}/products/{p["handle"]}',img=img,updated=p.get('updated_at'),created=p.get('created_at'),variants=vs))
        if len(j['products'])<250: break
        time.sleep(0.7)
    return d,out
allp=[]
with cf.ThreadPoolExecutor(6) as ex:
    for d,out in ex.map(pull,[s for s in stores if s[0] in OK]):
        print(d,len(out),file=sys.stderr); allp+=out
json.dump(allp,open(HERE+'/.cache/shopify_raw.json','w'))
print('total',len(allp))

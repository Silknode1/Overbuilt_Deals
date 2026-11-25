import json,math,re,os
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
D=json.load(open(HERE+'/.cache/data.json'))
PRIOR={'bias':-2.0,
 'cat':{'audio':1.2,'edc':1.2,'tactical':1.0,'bags':1.1,'luggage':0.9,'gadgets':1.0,'health':0.9,'charging':0.4,'apparel':-0.8,'home':-0.6},
 'feat':{'titanium':.8,'carbon':.6,'super-steel':.8,'planar':.8,'r2r':.6,'tube':.6,'balanced':.5,'flagship':.3,'anc':.3,'e-ink':.5,'gan':.3,'qi2':.2,'tech-fabric':.6,'modular':.4,'travel':.3,'backpack':.5,'knife':.5,'light':.3,'pen':.2,'dac-amp':.4,'headphones':.4,'recovery':.2,'keyboard':.2,'waterproof':.2,'wireless':0,'open-box':-.1,'charger':-.1,'owned':-1.8},
 'brand':{'sennheiser':.6,'audeze':.7,'apos audio':.3,'peak design':.8,'goruck':.5,'tom bihn':.4,'aer':.5,'able carry':.5,'evergoods':.5,'the james brand':.7,'tactile turn':.5,'sharge':.5,'nothing':.5,'apple':.4,'hifiman':.4,'focal':.4,'meze audio':.4,'dan clark audio':.5,'nitecore':.3,'leatherman':.3,'hyperice':.2,'nobull':.2,'fellow':-.2,'keychron':.2,'boox':.3,'soundcore':.1,'cotopaxi':-.1,'knafs':.3,'campfire audio':.4,'64 audio':.4,'vertx':.3,'wandrd':.3,'nomatic':.2,'monos':.2,'orbitkey':.2,'ugreen':0,'therabody':.1,'fenix':.2},
 'band':{'<40':-.6,'40-100':-.1,'100-500':.25,'500-1500':.1,'1500+':-.4},
 'owned':['sundara','gremlin','zd3','k11','ft1','ar5000','qr65','aiyima t8','harmonicdyne','bambu p2s','ams 2 pro']}
def band(p):
    if p is None: return '100-500'
    return '<40' if p<40 else '40-100' if p<100 else '100-500' if p<500 else '500-1500' if p<1500 else '1500+'
def feats(i):
    f=[('cat',i['cat']),('brand',i['brand'].lower()),('band',band(i.get('price')))]+[('feat',x) for x in i['feats']]
    if any(o in i['title'].lower() for o in PRIOR['owned']): f.append(('feat','owned'))
    return f
def taste(i):
    s=PRIOR['bias']+sum(PRIOR[k].get(v,0) for k,v in feats(i))
    return 1/(1+math.exp(-s))
for i in D['items']: i['t0']=round(taste(i),3)
# slim
keep=['id','title','brand','store','domain','url','cat','feats','model','cond','price','ref','variant','src','note','posted','claimed','hist','elsewhere','real','verdict','conf','p_drop','ends','buy','t0']
items=[{k:i[k] for k in keep if i.get(k) not in (None,[],'')} for i in D['items']]
for src,i in zip(D['items'],items):
    if src.get('img'): i['img']=src['img']+('&' if '?' in src['img'] else '?')+'width=480'
out=dict(generated=D['generated'],counts=D['counts'],events=D['events'],prior=PRIOR,items=items)
os.makedirs(ROOT+'/public/data',exist_ok=True)
json.dump(out,open(ROOT+'/public/data/deals.json','w'),separators=(',',':'))
print(len(items),'deals written')

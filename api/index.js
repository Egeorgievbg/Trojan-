import { randomBytes, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';

const adminEmails=(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const base=(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');
const SECRET=process.env.SESSION_SECRET||'';
const h=v=>createHash('sha256').update(String(v)).digest('hex');
const random=()=>randomBytes(32).toString('base64url');
const send=(res,code,body)=>res.status(code).json(body);
const clean=(x,max=450)=>typeof x==='string'?x.trim().slice(0,max):'';
const cookie=(req,key)=>{const pair=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(key+'='));try{return pair?decodeURIComponent(pair.slice(key.length+1)):'';}catch{return '';}};
const cookieSet=(res,name,value,maxAge,httpOnly=true)=>{const existing=res.getHeader('Set-Cookie');const next=`${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure${httpOnly?'; HttpOnly':''}`;res.setHeader('Set-Cookie',[...(existing?Array.isArray(existing)?existing:[existing]:[]),next]);};
const sql=()=>{if(!process.env.DATABASE_URL)throw Object.assign(new Error('DATABASE_URL липсва.'),{status:503});return neon(process.env.DATABASE_URL);};
const secret=()=>{if(SECRET.length<32)throw Object.assign(new Error('SESSION_SECRET не е конфигуриран.'),{status:503});return new TextEncoder().encode(SECRET);};
const validHost=(req)=>{const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host}catch{return false}};
const topics=['food','sides','drinks','restrictions','breakfast','desserts','extras'];
const allowed={food:['Скара','Пилешко','Свинско печено','Телешко','Риба','Пица','Паста','Домашна гозба','Вегетарианско','Супа','Картофки','Бургери','Ориз','Сандвичи','Плодове','Палачинки'],sides:['Шопска салата','Руска салата','Зелена салата','Картофки','Туршия','Сирена','Мезета','Разядки','Печени зеленчуци'],drinks:['Вода','Безалкохолно','Сок','Кафе','Чай','Бира','Вино','Ракия','Уиски','Без алкохол','Какао','Мляко'],breakfast:['Баница','Мекици','Яйца','Палачинки','Сандвичи','Плодове','Кисело мляко','Кафе','Чай','Зърнена закуска'],desserts:['Торта','Шоколад','Плодове','Сладолед','Сладкиши','Баклава','Домашен сладкиш'],extras:['Настолни игри','Игри за децата','Музика','Танци','Мезета','Баница'],restrictions:[]};
const adultDrinks=new Set(['Бира','Вино','Ракия','Уиски']);
const days=['2026-12-31','2027-01-01','2027-01-02'];
const pgDays=v=>'{'+v.filter(x=>days.includes(x)).join(',')+'}';
const slots=[{id:'31-snack',day:days[0],name:'Следобедно хапване'},{id:'31-dinner',day:days[0],name:'Новогодишна вечеря'},{id:'01-breakfast',day:days[1],name:'Закуска'},{id:'01-lunch',day:days[1],name:'Обяд'},{id:'01-dinner',day:days[1],name:'Вечеря'},{id:'02-breakfast',day:days[2],name:'Закуска'},{id:'02-lunch',day:days[2],name:'Лек обяд при нужда'}];
const ingredient=(name,unit,amount,category)=>({name,unit,amount,category});
const recipes=[
 {id:'grill',name:'Скара',ingredients:[ingredient('Свинско месо','g',190,'Месо'),ingredient('Пилешко месо','g',70,'Месо')]},
 {id:'chicken',name:'Печено пилешко',ingredients:[ingredient('Пилешко месо','g',240,'Месо'),ingredient('Лимон','g',25,'Плодове')]},
 {id:'pizza',name:'Пица',ingredients:[ingredient('Тесто за пица','g',160,'Тестени'),ingredient('Сирене','g',80,'Млечни'),ingredient('Домати','g',75,'Зеленчуци')]},
 {id:'pasta',name:'Паста',ingredients:[ingredient('Паста','g',115,'Тестени'),ingredient('Домати','g',120,'Зеленчуци')]},
 {id:'shopska',name:'Шопска салата',ingredients:[ingredient('Домати','g',170,'Зеленчуци'),ingredient('Краставици','g',120,'Зеленчуци'),ingredient('Сирене','g',60,'Млечни')]},
 {id:'potatoes',name:'Печени картофи',ingredients:[ingredient('Картофи','g',240,'Зеленчуци'),ingredient('Олио','ml',15,'Основни')]},
 {id:'meze',name:'Мезета и сирена',ingredients:[ingredient('Мезета','g',100,'Месо'),ingredient('Сирене','g',60,'Млечни')]},
 {id:'sandwich',name:'Сандвичи',ingredients:[ingredient('Хляб','g',90,'Тестени'),ingredient('Сирене','g',40,'Млечни')]},
 {id:'banitsa',name:'Баница',ingredients:[ingredient('Кори за баница','g',135,'Тестени'),ingredient('Сирене','g',65,'Млечни'),ingredient('Яйца','бр',0.5,'Млечни'),ingredient('Кисело мляко','g',55,'Млечни')]},
 {id:'eggs',name:'Яйца за закуска',ingredients:[ingredient('Яйца','бр',2,'Млечни'),ingredient('Хляб','g',60,'Тестени')]},
 {id:'pancakes',name:'Палачинки',ingredients:[ingredient('Брашно','g',70,'Тестени'),ingredient('Мляко','ml',150,'Млечни'),ingredient('Яйца','бр',0.6,'Млечни')]},
 {id:'fruit',name:'Плодове',ingredients:[ingredient('Сезонни плодове','g',220,'Плодове')]},
 {id:'cake',name:'Торта',ingredients:[ingredient('Торта / десерт','g',155,'Десерти')]}
];
const toToken=v=>clean(v,130);
async function guest(req){const token=toToken(req.body?.token);if(!token)return null;const db=sql();const rows=await db`SELECT household_id FROM guest_sessions WHERE token_hash=${h(token)} AND expires_at > NOW() LIMIT 1`;return rows[0]?.household_id||null;}
async function auth(req){const token=cookie(req,'troian_admin');if(!token)return null;try{const {payload}=await jwtVerify(token,secret(),{issuer:'troian-2027',audience:'troian-admin'});return adminEmails.includes(String(payload.email).toLowerCase())?payload:null;}catch{return null;}}
async function admin(req,res){const who=await auth(req);if(!who){send(res,401,{message:'Само организаторът има достъп.'});return null;}return who;}
async function publicHomes(db){const [homes,members]=await Promise.all([db`SELECT id,title FROM households ORDER BY id`,db`SELECT id,household_id,name,child,ordinal FROM members ORDER BY household_id,ordinal`]);return homes.map(f=>({...f,members:members.filter(m=>m.household_id===f.id)}));}
async function familyState(db,id){const [homes,attendance,preferences,shared]=await Promise.all([publicHomes(db),db`SELECT person_id,status,days,version FROM attendance WHERE person_id IN (SELECT id FROM members WHERE household_id=${id})`,db`SELECT person_id,topic,value,version FROM preferences WHERE person_id IN (SELECT id FROM members WHERE household_id=${id})`,db`SELECT topic,value,version FROM household_shared WHERE household_id=${id}`]);const home=homes.find(h=>h.id===id);return {family:home,attendance:Object.fromEntries(attendance.map(x=>[x.person_id,x])),answers:Object.fromEntries(home.members.map(m=>[m.id,Object.fromEntries(preferences.filter(p=>p.person_id===m.id).map(p=>[p.topic,{...p.value,version:p.version}]))])),shared:Object.fromEntries(shared.map(s=>[s.topic,{...s.value,version:s.version}]))};}
async function trends(db,exclude){const rows=await db`SELECT p.person_id,p.topic,p.value FROM preferences p JOIN attendance a ON a.person_id=p.person_id JOIN members m ON m.id=p.person_id WHERE m.household_id<>${exclude} AND a.status='yes' AND p.topic IN ('food','sides','breakfast','desserts')`;const counts=new Map();for(const row of rows){for(const name of [...new Set(Array.isArray(row.value?.selected)?row.value.selected:[])]){const key=row.topic+'|'+name;if(!counts.has(key))counts.set(key,new Set());counts.get(key).add(row.person_id);}}return [...counts].filter(([k,set])=>set.size>=2).map(([k,set])=>({topic:k.split('|')[0],name:k.split('|')[1],votes:set.size})).sort((a,b)=>b.votes-a.votes).slice(0,12);}
async function shopping(db){const items=await db`SELECT slot_id,recipe_id,portions FROM menu_items`;const map=new Map();for(const item of items){const recipe=recipes.find(x=>x.id===item.recipe_id);if(!recipe)continue;for(const ig of recipe.ingredients){const key=ig.name+'|'+ig.unit;if(!map.has(key))map.set(key,{id:key,name:ig.name,category:ig.category,unit:ig.unit,qty:0,usedIn:[]});const obj=map.get(key);obj.qty+=ig.amount*item.portions;obj.usedIn.push(slots.find(s=>s.id===item.slot_id)?.name+' · '+recipe.name);}}const bought=await db`SELECT * FROM purchases`;return [...map.values()].map(x=>{const p=bought.find(v=>v.item_id===x.id);const big=(x.unit==='g'||x.unit==='ml')&&x.qty>=1000;return {...x,quantity:big?Number((x.qty/1000).toFixed(2)):x.unit==='бр'?Math.ceil(x.qty):Number(x.qty.toFixed(1)),unit:big?(x.unit==='g'?'кг':'л'):x.unit,bought:p?.bought||false,assignedTo:p?.assigned_to||''};}).sort((a,b)=>a.category.localeCompare(b.category,'bg')||a.name.localeCompare(b.name,'bg'));}
function route(req){const p=req.query?.path;if(Array.isArray(p))return p.join('/');if(typeof p==='string')return p;const m=(req.url||'').match(/^\/api\/([^?]+)/);return m?.[1]||'';}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 const path=route(req).replace(/^\/+|\/+$/g,'');const body=req.body&&typeof req.body==='object'?req.body:{};
 if(req.method==='POST'&&!validHost(req))return send(res,403,{message:'Невалиден origin.'});
 try{
  if(req.method==='GET'&&path==='health'){
   if(!process.env.DATABASE_URL)return send(res,503,{ok:false,databaseConfigured:false,databaseReachable:false,version:'vercel-port-v1'});
   try{await sql()`SELECT 1 AS check`;return send(res,200,{ok:true,databaseConfigured:true,databaseReachable:true,version:'vercel-port-v1'});}
   catch{return send(res,503,{ok:false,databaseConfigured:true,databaseReachable:false,version:'vercel-port-v1'});}
  }
  if(req.method==='GET'&&path==='auth/google'){
   if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET||!base)return send(res,503,{message:'Google OAuth липсва.'});
   const state=random(),verifier=random(),challenge=createHash('sha256').update(verifier).digest('base64url');
   const data=await new SignJWT({state,verifier}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').setIssuer('troian-2027').setAudience('oauth').sign(secret());
   cookieSet(res,'troian_oauth',data,600);
   const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.searchParams.set('client_id',process.env.GOOGLE_CLIENT_ID);u.searchParams.set('redirect_uri',base+'/api/auth/callback');u.searchParams.set('response_type','code');u.searchParams.set('scope','openid email profile');u.searchParams.set('state',state);u.searchParams.set('code_challenge_method','S256');u.searchParams.set('code_challenge',challenge);
   return res.redirect(302,u.toString());
  }
  if(req.method==='GET'&&path==='auth/callback'){
   if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET||!base)return send(res,503,{message:'Google OAuth липсва.'});
   let authData;try{authData=await jwtVerify(cookie(req,'troian_oauth'),secret(),{issuer:'troian-2027',audience:'oauth',algorithms:['HS256']});}catch{return send(res,403,{message:'Невалидна или изтекла OAuth сесия.'});}
   if(authData.payload.state!==req.query.state||!req.query.code)return send(res,403,{message:'Невалиден OAuth state.'});
   const data=new URLSearchParams({code:String(req.query.code),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:base+'/api/auth/callback',grant_type:'authorization_code',code_verifier:String(authData.payload.verifier)});
   const result=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data});if(!result.ok)return send(res,401,{message:'Невалиден Google OAuth отговор.'});
   const resultData=await result.json();const jwt=String(resultData.id_token||'');const JWKS=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
   const {payload}=await jwtVerify(jwt,JWKS,{issuer:['https://accounts.google.com','accounts.google.com'],audience:process.env.GOOGLE_CLIENT_ID});
   if(payload.email_verified!==true||!adminEmails.includes(String(payload.email).toLowerCase()))return send(res,403,{message:'Този акаунт не е организатор.'});
   const ticket=await new SignJWT({email:payload.email}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').setIssuer('troian-2027').setAudience('troian-admin').sign(secret());
   cookieSet(res,'troian_admin',ticket,28800);cookieSet(res,'troian_oauth','',0);
   return res.redirect(302,'/#admin');
  }
  if(req.method==='GET'&&path==='admin/me'){const who=await auth(req);return who?send(res,200,{email:who.email}):send(res,401,{message:'Не си влязъл.'});}
  if(req.method==='POST'&&path==='admin/logout'){cookieSet(res,'troian_admin','',0);return send(res,200,{ok:true});}
  if(path.startsWith('admin/')&&!await auth(req))return send(res,401,{message:'Само организаторът има достъп.'});
  const routes={public:'GET','guest/join':'POST','guest/state':'POST','guest/attendance':'POST','guest/save':'POST','guest/shared':'POST','guest/trends':'POST','guest/coach':'POST','admin/overview':'GET','admin/invite':'POST','admin/menu':'POST','admin/purchase':'POST','admin/event':'POST','admin/import-preview':'POST','admin/import':'POST'};
  if(!routes[path])return send(res,404,{message:'Няма такъв маршрут.'});
  if(routes[path]!==req.method)return send(res,405,{message:'Непозволен метод.'});
  const db=sql();
  if(req.method==='GET'&&path==='public'){
   const homes=await publicHomes(db);const [info]=await db`SELECT value FROM event_settings WHERE id=1`;
   const event=info?.value||{};return send(res,200,{families:homes,event:{dates:days,nights:2,arrival:event.arrival||'',departure:event.departure||'',bring:event.bring||''}});
  }
  if(req.method==='POST'&&path==='guest/join'){
   const familyId=clean(body.familyId,55),invite=toToken(body.invite);
   if(!familyId||!invite)return send(res,401,{message:'Необходим е личен семеен линк.'});
   const rows=await db`SELECT household_id,token_hash FROM invitations WHERE household_id=${familyId}`;
   if(!rows[0]||h(invite)!==rows[0].token_hash)return send(res,401,{message:'Поканата е невалидна или сменена.'});
   const token=random();await db`INSERT INTO guest_sessions(token_hash,household_id,expires_at) VALUES (${h(token)},${familyId},NOW()+INTERVAL '70 days')`;
   return send(res,200,{token,familyId});
  }
  if(req.method==='POST'&&path==='guest/state'){
   const home=await guest(req);if(!home)return send(res,401,{message:'Необходима е семейна покана.'});
   const state=await familyState(db,home);const [info]=await db`SELECT value FROM event_settings WHERE id=1`;
   return send(res,200,{...state,event:info?.value||{}});
  }
  if(req.method==='POST'&&path==='guest/attendance'){
   const home=await guest(req);if(!home)return send(res,401,{message:'Невалидна семейна сесия.'});
   const memberId=clean(body.personId,60),status=clean(body.status,10),chosenDays=Array.isArray(body.days)?body.days.filter(x=>days.includes(x)):[];
   if(!['yes','maybe','no'].includes(status)||(status==='yes'&&chosenDays.length===0))return send(res,400,{message:'Избери присъствие.'});
   const [member]=await db`SELECT id FROM members WHERE id=${memberId} AND household_id=${home}`;if(!member)return send(res,403,{message:'Чужд участник.'});
   const version=Number(body.version||0);if(!Number.isSafeInteger(version)||version<0)return send(res,400,{message:'Невалидна версия.'});
   const result=version===0?await db`INSERT INTO attendance(person_id,status,days,version) VALUES (${memberId},${status},${pgDays(chosenDays)}::text[],1) ON CONFLICT DO NOTHING RETURNING version`:await db`UPDATE attendance SET status=${status},days=${pgDays(chosenDays)}::text[],version=version+1,updated_at=NOW() WHERE person_id=${memberId} AND version=${version} RETURNING version`;
   if(result.length===0)return send(res,409,{message:'Отговорът е променен от друго устройство. Презареди.'});
   return send(res,200,{personId:memberId,status,days:chosenDays,version:result[0].version});
  }
  if(req.method==='POST'&&path==='guest/save'){
   const home=await guest(req);if(!home)return send(res,401,{message:'Необходима е семейна покана.'});
   const personId=clean(body.personId,60),topic=clean(body.topic,24),val=body.value||{};
   if(!topics.includes(topic))return send(res,400,{message:'Непозната тема.'});
   const [person]=await db`SELECT child FROM members WHERE id=${personId} AND household_id=${home}`;if(!person)return send(res,403,{message:'Чужд участник.'});
   const choices=Array.isArray(val.selected)?[...new Set(val.selected.filter(x=>typeof x==='string'&&allowed[topic].includes(x)&&!(person.child&&topic==='drinks'&&adultDrinks.has(x))))].slice(0,16):[];
   const allergyStatus=['none','has','unknown'].includes(val.allergyStatus)?val.allergyStatus:'unknown';
   if(topic==='restrictions'&&allergyStatus==='has'&&!clean(val.allergens,260))return send(res,400,{message:'Уточни алергена или избери Не знам.'});
   const value={selected:choices,note:clean(val.note,450),allergyStatus:topic==='restrictions'?allergyStatus:'unknown',allergens:topic==='restrictions'&&allergyStatus==='has'?clean(val.allergens,260):'',dislikes:topic==='restrictions'?clean(val.dislikes,250):'',skipped:val.skipped===true};
   const version=Number(body.version||0);if(!Number.isSafeInteger(version)||version<0)return send(res,400,{message:'Невалидна версия.'});
   const result=version===0?await db`INSERT INTO preferences(person_id,topic,value,version) VALUES (${personId},${topic},${JSON.stringify(value)},1) ON CONFLICT DO NOTHING RETURNING version`:await db`UPDATE preferences SET value=${JSON.stringify(value)}::jsonb,version=version+1,updated_at=NOW() WHERE person_id=${personId} AND topic=${topic} AND version=${version} RETURNING version`;
   if(result.length===0)return send(res,409,{message:'Някой вече е редактирал този отговор. Презареди.'});
   return send(res,200,{topic,value:{...value,version:result[0].version}});
  }
  if(req.method==='POST'&&path==='guest/shared'){
   const home=await guest(req);if(!home)return send(res,401,{message:'Необходима е семейна покана.'});
   const topic=clean(body.topic,24);if(!['table','organization'].includes(topic))return send(res,400,{message:'Невалидна обща тема.'});
   const val=body.value||{},value={selected:Array.isArray(val.selected)?val.selected.filter(x=>typeof x==='string').slice(0,14).map(x=>clean(x,55)):[],note:clean(val.note,450),skipped:val.skipped===true};const version=Number(body.version||0);if(!Number.isSafeInteger(version)||version<0)return send(res,400,{message:'Невалидна версия.'});
   const result=version===0?await db`INSERT INTO household_shared(household_id,topic,value,version) VALUES (${home},${topic},${JSON.stringify(value)},1) ON CONFLICT DO NOTHING RETURNING version`:await db`UPDATE household_shared SET value=${JSON.stringify(value)}::jsonb,version=version+1,updated_at=NOW() WHERE household_id=${home} AND topic=${topic} AND version=${version} RETURNING version`;
   if(!result.length)return send(res,409,{message:'Има по-нова семейна редакция.'});return send(res,200,{topic,value:{...value,version:result[0].version}});
  }
  if(req.method==='POST'&&path==='guest/trends'){
   const home=await guest(req);if(!home)return send(res,401,{message:'Необходима е семейна покана.'});return send(res,200,{trends:await trends(db,home)});
  }
  if(req.method==='POST'&&path==='guest/coach'){
   const home=await guest(req);if(!home)return send(res,401,{message:'Необходима е семейна покана.'});
   const personId=clean(body.personId,60),topic=clean(body.topic,25);
   const [member]=await db`SELECT id,name,child FROM members WHERE id=${personId} AND household_id=${home}`;if(!member||!topics.includes(topic))return send(res,403,{message:'Непознат участник или тема.'});
   const map={food:'Какво би хапнал/а за основно?',sides:'Какви салати и мезета харесваш?',drinks:'Какво би пил/а?',restrictions:'Има ли алергии или храни, които трябва да избягваме?',breakfast:'Какво би хапнал/а за закуска?',desserts:'Какво обичаш за десерт?',extras:'Нещо допълнително за празника?'};
   let text=map[topic];if(process.env.OPENAI_API_KEY){try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',input:[{role:'system',content:'Ти си учтив български AI асистент за новогодишна семейна анкета. Задай точно един кратък въпрос по темата. Не споменавай алкохол при дете.'},{role:'user',content:JSON.stringify({name:member.name,child:member.child,topic})}],max_output_tokens:110})});if(r.ok){const data=await r.json();text=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text).filter(Boolean).join(' ')||text;}}catch{}}
   return send(res,200,{intro:'Сега е ред на '+member.name+'.',question:clean(text,230)});
  }
  if(path.startsWith('admin/')||path.startsWith('auth/')){
   if(!(await admin(req,res)))return;
   if(req.method==='GET'&&path==='admin/overview'){
    const homes=await publicHomes(db);const answers=await Promise.all(homes.map(h=>familyState(db,h.id)));const [settings]=await db`SELECT value FROM event_settings WHERE id=1`;
    const [menu,bought]=await Promise.all([db`SELECT slot_id,recipe_id,portions FROM menu_items`,shopping(db)]);
    return send(res,200,{families:answers,event:settings?.value||{},slots,recipes,menu,shopping:bought});
   }
   if(req.method==='POST'&&path==='admin/invite'){
    const familyId=clean(body.familyId,60),[home]=await db`SELECT id FROM households WHERE id=${familyId}`;if(!home)return send(res,404,{message:'Няма такова семейство.'});
    const invitation=random();await db.transaction([db`INSERT INTO invitations(household_id,token_hash,issued_at) VALUES (${familyId},${h(invitation)},NOW()) ON CONFLICT(household_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,issued_at=NOW()`,db`DELETE FROM guest_sessions WHERE household_id=${familyId}`]);
    return send(res,200,{familyId,url:base+'/#invite='+encodeURIComponent(familyId+'.'+invitation),warning:'Новият линк заменя предишния за това семейство.'});
   }
   if(req.method==='POST'&&path==='admin/menu'){
    const slot=clean(body.slotId,40),recipeId=clean(body.recipeId,40),portions=Number(body.portions);
    if(!slots.some(s=>s.id===slot)||!recipes.some(r=>r.id===recipeId)||!Number.isInteger(portions)||portions<0||portions>120)return send(res,400,{message:'Невалидно ястие или порции.'});
    if(portions===0)await db`DELETE FROM menu_items WHERE slot_id=${slot} AND recipe_id=${recipeId}`;
    else await db`INSERT INTO menu_items(slot_id,recipe_id,portions) VALUES (${slot},${recipeId},${portions}) ON CONFLICT(slot_id,recipe_id) DO UPDATE SET portions=EXCLUDED.portions`;
    return send(res,200,{ok:true,shopping:await shopping(db)});
   }
   if(req.method==='POST'&&path==='admin/purchase'){
    const id=clean(body.id,130),items=await shopping(db);if(!items.some(x=>x.id===id))return send(res,400,{message:'Продуктът не е в текущото меню.'});
    const bought=body.bought===true,assigned=clean(body.assignedTo,80);await db`INSERT INTO purchases(item_id,bought,assigned_to) VALUES (${id},${bought},${assigned}) ON CONFLICT(item_id) DO UPDATE SET bought=EXCLUDED.bought,assigned_to=EXCLUDED.assigned_to,updated_at=NOW()`;
    return send(res,200,{ok:true});
   }
   if(req.method==='POST'&&path==='admin/event'){
    const current={dates:days,nights:2,address:clean(body.address,250),navigation:clean(body.navigation,380),arrival:clean(body.arrival,90),departure:clean(body.departure,90),bring:clean(body.bring,650),notes:clean(body.notes,650)};
    if(current.navigation&&!/^https:\/\//.test(current.navigation))return send(res,400,{message:'Навигацията трябва да използва HTTPS.'});
    await db`INSERT INTO event_settings(id,value) VALUES (1,${JSON.stringify(current)}::jsonb) ON CONFLICT(id) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
    return send(res,200,{event:current});
   }

   if(req.method==='POST'&&(path==='admin/import-preview'||path==='admin/import')){
    const groups=Array.isArray(body.families)?body.families:null;
    if(!groups||groups.length<1||groups.length>4)return send(res,400,{message:'Очаквам между едно и четири домакинства.'});
    const payload={families:groups,event:body.event||null,shopping:body.shopping||null,plan:body.plan||null};
    const serialized=JSON.stringify(payload);
    if(serialized.length>1000000)return send(res,413,{message:'Експортът е прекалено голям (максимум 1 MB).'});
    const digest=h(serialized);
    const existingPrefs=await db`SELECT person_id,topic FROM preferences`;
    const existingAttendance=await db`SELECT person_id FROM attendance`;
    const existingShared=await db`SELECT household_id,topic FROM household_shared`;
    const prefKeys=new Set(existingPrefs.map(p=>p.person_id+'|'+p.topic));
    const attendingIds=new Set(existingAttendance.map(a=>a.person_id));
    const sharedKeys=new Set(existingShared.map(s=>s.household_id+'|'+s.topic));
    const answers=[],rsvps=[],shared=[];
    let unknown=0;
    const seenFamilies=new Set();
    for(const group of groups){
      const familyId=clean(group?.id,60);
      if(seenFamilies.has(familyId))return send(res,400,{message:'Дублирано домакинство в експорта.'});
      seenFamilies.add(familyId);
      const [family]=await db`SELECT id FROM households WHERE id=${familyId}`;
      if(!family){unknown++;continue;}
      const members=await db`SELECT id,child FROM members WHERE household_id=${familyId}`;
      const valid=new Map(members.map(m=>[m.id,m]));
      for(const [personId,topicMap] of Object.entries(group.answers||{})){
       const member=valid.get(personId);
       if(!member){unknown++;continue;}
       if(!topicMap||typeof topicMap!=='object'||Array.isArray(topicMap)){unknown++;continue;}
       for(const [topic,raw] of Object.entries(topicMap)){
        if(!topics.includes(topic)||!raw||typeof raw!=='object'||Array.isArray(raw)){unknown++;continue;}
        const selected=Array.isArray(raw.selected)?[...new Set(raw.selected.filter(x=>typeof x==='string'&&allowed[topic].includes(x)&&!(member.child&&topic==='drinks'&&adultDrinks.has(x))))].slice(0,16):[];
        const status=['none','has','unknown'].includes(raw.allergyStatus)?raw.allergyStatus:'unknown';
        const record={selected,note:clean(raw.note,450),allergyStatus:topic==='restrictions'?status:'unknown',allergens:topic==='restrictions'&&status==='has'?clean(raw.allergens,260):'',dislikes:topic==='restrictions'?clean(raw.dislikes,250):'',skipped:raw.skipped===true};
        answers.push({personId,topic,record});
       }
      }
      for(const [personId,status] of Object.entries(group.rsvp?.statuses||{})){
       if(!valid.has(personId)||!['yes','maybe','no'].includes(status)){unknown++;continue;}
       const rawDays=group.rsvp?.daysByPerson?.[personId]||group.rsvp?.days||[];
       const dates=Array.isArray(rawDays)?rawDays.map(v=>({'31 декември':days[0],'1 януари':days[1],'2 януари':days[2]}[v]||v)).filter(v=>days.includes(v)):[];
       rsvps.push({personId,status,dates:[...new Set(dates)]});
      }
      for(const [topic,raw] of Object.entries(group.shared||{})){
       if(!['table','organization'].includes(topic)||!raw||typeof raw!=='object'||Array.isArray(raw)){unknown++;continue;}
       shared.push({familyId,topic,record:{selected:Array.isArray(raw.selected)?raw.selected.filter(x=>typeof x==='string').slice(0,14).map(x=>clean(x,55)):[],note:clean(raw.note,450),skipped:raw.skipped===true}});
      }
    }
    const pendingAnswers=answers.filter(x=>!prefKeys.has(x.personId+'|'+x.topic));
    const pendingRsvps=rsvps.filter(x=>!attendingIds.has(x.personId));
    const pendingShared=shared.filter(x=>!sharedKeys.has(x.familyId+'|'+x.topic));
    const summary={households:seenFamilies.size,preferences:pendingAnswers.length,attendance:pendingRsvps.length,shared:pendingShared.length,existingPreferences:answers.length-pendingAnswers.length,existingAttendance:rsvps.length-pendingRsvps.length,existingShared:shared.length-pendingShared.length,ignored:unknown,archiveIncludesExtras:!!(body.event||body.shopping||body.plan)};
    if(path==='admin/import-preview')return send(res,200,{ok:true,preview:true,digest,summary,warning:'Съществуващите записи няма да се презаписват. Меню, покупки и настройки се архивират, но не се активират автоматично.'});
    if(body.confirm!==true||body.expectedDigest!==digest)return send(res,409,{message:'Първо прегледай импорта и потвърди непроменения файл.'});
    const archiveId='appdeploy-v3-'+digest.slice(0,40);
    const queries=[db`INSERT INTO migration_archives(source_id,payload,digest) VALUES (${archiveId},jsonb_build_object('source',${serialized}::jsonb,'backup',jsonb_build_object('attendance',(SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM attendance a),'preferences',(SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]'::jsonb) FROM preferences p),'shared',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM household_shared s))),${digest}) ON CONFLICT(source_id) DO NOTHING`];
    for(const x of pendingAnswers)queries.push(db`INSERT INTO preferences(person_id,topic,value,version) VALUES (${x.personId},${x.topic},${JSON.stringify(x.record)}::jsonb,1) ON CONFLICT(person_id,topic) DO NOTHING RETURNING person_id`);
    for(const x of pendingRsvps)queries.push(db`INSERT INTO attendance(person_id,status,days,version) VALUES (${x.personId},${x.status},${pgDays(x.dates)}::text[],1) ON CONFLICT(person_id) DO NOTHING RETURNING person_id`);
    for(const x of pendingShared)queries.push(db`INSERT INTO household_shared(household_id,topic,value,version) VALUES (${x.familyId},${x.topic},${JSON.stringify(x.record)}::jsonb,1) ON CONFLICT(household_id,topic) DO NOTHING RETURNING household_id`);
    const results=await db.transaction(queries);
    let offset=1;
    const count=n=>results.slice(offset,offset+=n).reduce((sum,rows)=>sum+rows.length,0);
    const importedPreferences=count(pendingAnswers.length),importedAttendance=count(pendingRsvps.length),importedShared=count(pendingShared.length);
    const reconciliation={expected:pendingAnswers.length+pendingRsvps.length+pendingShared.length,inserted:importedPreferences+importedAttendance+importedShared};
    return send(res,200,{ok:true,archiveId,reconciliation,importedPreferences,importedAttendance,importedShared,summary,warning:'Исторически данни за меню и покупки са запазени в архива за ръчна сверка. Не са презаписани активните записи.'});
   }
  }
  return send(res,404,{message:'Няма такъв маршрут.'});
 }catch(e){console.error('api request failed',{path,name:e?.name||'Error'});return send(res,e?.status||500,{message:e?.status?e.message:'Вътрешна грешка. Провери настройките на сървъра.'});}
}
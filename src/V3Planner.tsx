import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './apiClient';
import {
 ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, ChevronDown, CircleAlert,
 Copy, Heart, LockKeyhole, Mic, MicOff, PartyPopper, Plus, RefreshCw, Send,
 ShieldCheck, ShoppingBasket, Sparkles, Users, UtensilsCrossed, WandSparkles, MapPin, Clock3
} from 'lucide-react';
import './v3.css';

type Member={id:string;name:string;child:boolean};
type Family={id:string;title:string;members:Member[]};
type Rsvp={statuses:Record<string,string>;days:string[];daysByPerson?:Record<string,string[]>;version:number};
type RecordAnswer={selected:string[];note:string;allergyStatus:string;allergens:string;dislikes:string;skipped:boolean;version:number};
type Shared={selected:string[];note:string;budget:string;skipped:boolean;version:number};
type AnswerMap=Record<string,Record<string,RecordAnswer>>;
type State={family:Family;answers:AnswerMap;shared:Record<string,Shared>;rsvp:Rsvp|null;legacySuggestions:string[]};
type Trend={name:string;votes:number;category:string};
type Stage={key:string;kind:'rsvp'|'person'|'shared'|'finish';member?:Member;topic?:string};
type PhotoChoice={name:string;emoji:string;photo:string};
const photo=(id:string)=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=440&h=300&q=70';
const pics={
 meat:photo('photo-1544025162-d76694265947'),chicken:photo('photo-1532550907401-a500c9a57435'),
 pizza:photo('photo-1513104890138-7c749659a591'),fish:photo('photo-1519708227418-c8fd9a32b7a2'),
 pasta:photo('photo-1473093295043-cdd812d0e601'),veg:photo('photo-1512621776951-a57141f2eefd'),
 salad:photo('photo-1540420773420-3366772f4999'),fries:photo('photo-1573080496219-bb080dd4f877'),
 cheese:photo('photo-1486297678162-eb2a19b0a32d'),drinks:photo('photo-1535958636474-b021ee887b13'),
 wine:photo('photo-1510812431401-41d2bd2722f3'),water:photo('photo-1548839140-29a749e1cf4d'),
 coffee:photo('photo-1509042239860-f550ce710b93'),juice:photo('photo-1600271886742-f049cd451bba'),
 cake:photo('photo-1578985545062-69928b1d9587'),fruits:photo('photo-1619566636858-adf3ef46400b'),
 breakfast:photo('photo-1533089860892-a7c6f0a88666'),party:photo('photo-1492684223066-81342ee5ff30'),
 games:photo('photo-1610890716171-6b1bb98ffd09'),shop:photo('photo-1542838132-92c53300491e'),
 cook:photo('photo-1556911220-bff31c812dba')
};
const make=(name:string,emoji:string,image:string):PhotoChoice=>({name,emoji,photo:image});
const MEALS=[
 make('Скара','🔥',pics.meat),make('Пилешко','🍗',pics.chicken),make('Свинско печено','🍖',pics.meat),
 make('Телешко','🥩',pics.meat),make('Риба','🐟',pics.fish),make('Пица','🍕',pics.pizza),
 make('Паста','🍝',pics.pasta),make('Домашна гозба','🥘',pics.cook),
 make('Вегетарианско','🥗',pics.veg),make('Супа','🍲',pics.breakfast),
 make('Картофки','🍟',pics.fries),make('Бургери','🍔',pics.meat),
 make('Ориз','🍚',pics.veg),make('Сандвичи','🥪',pics.breakfast),
 make('Плодове','🍊',pics.fruits),make('Палачинки','🥞',pics.breakfast)
];
const SIDES=[
 make('Шопска салата','🥗',pics.salad),make('Руска салата','🥣',pics.salad),
 make('Зелена салата','🥬',pics.veg),make('Картофки','🍟',pics.fries),
 make('Туршия','🥒',pics.salad),make('Сирена','🧀',pics.cheese),
 make('Мезета','🍖',pics.meat),make('Разядки','🥙',pics.cheese),
 make('Печени зеленчуци','🥕',pics.veg),make('Салата с майонеза','🥣',pics.salad)
];
const DRINKS=[
 make('Вода','💧',pics.water),make('Безалкохолно','🥤',pics.juice),
 make('Сок','🧃',pics.juice),make('Кафе','☕',pics.coffee),
 make('Чай','🍵',pics.coffee),make('Бира','🍺',pics.drinks),
 make('Вино','🍷',pics.wine),make('Ракия','🥃',pics.wine),
 make('Уиски','🥃',pics.drinks),make('Без алкохол','✅',pics.water),
 make('Какао','🍫',pics.coffee),make('Мляко','🥛',pics.breakfast)
];
const SWEETS=[
 make('Баница','🥧',pics.breakfast),make('Мекици','🍩',pics.breakfast),
 make('Палачинки','🥞',pics.breakfast),make('Торта','🎂',pics.cake),
 make('Шоколад','🍫',pics.cake),make('Плодове','🍎',pics.fruits),
 make('Сладолед','🍨',pics.cake),make('Сладкиши','🧁',pics.cake),
 make('Настолни игри','🎲',pics.games),make('Игри за децата','🧩',pics.games),
 make('Музика','🎶',pics.party),make('Танци','💃',pics.party)
];
const BREAKFAST=[
 make('Баница','🥧',pics.breakfast),make('Мекици','🍩',pics.breakfast),
 make('Яйца','🍳',pics.breakfast),make('Палачинки','🥞',pics.breakfast),
 make('Сандвичи','🥪',pics.breakfast),make('Плодове','🍎',pics.fruits),
 make('Кисело мляко','🥛',pics.breakfast),make('Кафе','☕',pics.coffee),
 make('Чай','🍵',pics.coffee),make('Зърнена закуска','🥣',pics.breakfast)
];
const DESSERTS=[
 make('Торта','🎂',pics.cake),make('Шоколад','🍫',pics.cake),
 make('Плодове','🍎',pics.fruits),make('Сладолед','🍨',pics.cake),
 make('Сладкиши','🧁',pics.cake),make('Баклава','🥮',pics.cake),
 make('Домашен сладкиш','🍰',pics.cake)
];
const TABLE=[
 make('Баница','🥧',pics.breakfast),make('Мекици','🍩',pics.breakfast),
 make('Яйца','🍳',pics.breakfast),make('Палачинки','🥞',pics.breakfast),
 make('Плодове','🍎',pics.fruits),make('Торта','🎂',pics.cake),
 make('Сладкиши','🧁',pics.cake),make('Скара','🔥',pics.meat),
 make('Салати','🥗',pics.salad),make('Детско меню','🧸',pics.pizza),
 make('Мезета','🧀',pics.cheese),make('Кафе','☕',pics.coffee)
];
const ORGANIZATION=[
 make('Пазаруване','🛒',pics.shop),make('Готвене','👨‍🍳',pics.cook),
 make('Напитки','🥂',pics.drinks),make('Транспорт','🚗',pics.party),
 make('Музика','🎵',pics.party),make('Караоке','🎤',pics.party),
 make('Игри','🎲',pics.games),make('Фотографии','📷',pics.party),
 make('Подаръци','🎁',pics.party),make('Разделяме бюджета','💶',pics.shop)
];
const CHILD_DRINKS=new Set(['Вода','Безалкохолно','Сок','Кафе','Чай','Какао','Мляко','Без алкохол']);
const adultTopics=['food','sides','drinks','restrictions','breakfast','desserts','extras'];
const childTopics=['food','drinks','restrictions','breakfast','desserts','extras'];
const defaultAnswer=():RecordAnswer=>({selected:[],note:'',allergyStatus:'',allergens:'',dislikes:'',skipped:false,version:0});
const defaultShared=():Shared=>({selected:[],note:'',budget:'',skipped:false,version:0});
const localTokens=():Record<string,string>=>{try{return JSON.parse(localStorage.getItem('troyan_v3_sessions')||'{}')}catch{return {}}};
const apiError=(e:unknown)=>{const v=e as {message?:string;response?:{data?:{message?:string;error?:string};status?:number}};return v?.response?.data?.message||v?.response?.data?.error||v?.message||'Възникна грешка. Опитай отново.';};
function stagesFor(home:Family,rsvp:Rsvp|null):Stage[]{
 const flow:Stage[]=[{key:'rsvp',kind:'rsvp'}];
 for(const m of home.members){
  if(rsvp?.statuses?.[m.id]==='no')continue;
  for(const topic of m.child?childTopics:adultTopics)flow.push({key:m.id+'_'+topic,kind:'person',member:m,topic});
 }
 flow.push({key:'shared_table',kind:'shared',topic:'table'});
 flow.push({key:'shared_organization',kind:'shared',topic:'organization'});
 flow.push({key:'finish',kind:'finish'});
 return flow;
}
function selectedChoices(s:Stage){
 if(s.kind==='shared')return s.topic==='table'?TABLE:ORGANIZATION;
 if(s.topic==='food')return MEALS;
 if(s.topic==='sides')return SIDES;
 if(s.topic==='drinks')return s.member?.child?DRINKS.filter(v=>CHILD_DRINKS.has(v.name)):DRINKS;
 if(s.topic==='breakfast')return BREAKFAST;
 if(s.topic==='desserts')return DESSERTS;
 if(s.topic==='extras')return SWEETS;
 return [] as PhotoChoice[];
}
function stageTitle(s:Stage){
 if(s.kind==='rsvp')return 'Кой ще празнува с нас?';
 if(s.kind==='shared')return s.topic==='table'?'Общата ни трапеза':'Кой какво ще поеме?';
 if(s.kind==='finish')return 'Готово! Това е вашият план.';
 if(s.topic==='food')return s.member?.child?'Какво най-много обича '+s.member.name+'?':'Какво би хапнал/а '+s.member?.name+'?';
 if(s.topic==='sides')return 'Кои салати и мезета харесва '+s.member?.name+'?';
 if(s.topic==='drinks')return 'Какво предпочита да пие '+s.member?.name+'?';
 if(s.topic==='restrictions')return 'Какво трябва да избягваме за '+s.member?.name+'?';
 if(s.topic==='breakfast')return 'Какво обича за закуска '+s.member?.name+'?';
 if(s.topic==='desserts')return 'Какъв десерт ще хареса '+s.member?.name+'?';
 return 'Нещо сладко или забавно за '+s.member?.name+'?';
}
function stageSub(s:Stage){
 if(s.kind==='rsvp')return 'Отбележи всеки член на семейството и датите. Никого няма да броим за потвърдил без избор.';
 if(s.kind==='shared')return s.topic==='table'?'Закуски, десерти и общи предложения — изберете няколко.':'Пазаруване, подготовка, развлечения и общ бюджет. Не е нужно да решавате всичко сега.';
 if(s.topic==='restrictions')return 'Разделяме медицинските алергии от вкусовете. Не е необходимо да споделяш чужди чувствителни данни.';
 if(s.topic==='drinks')return s.member?.child?'Само напитки, подходящи за дете.':'Може да избереш няколко. В бележките уточни приблизителни количества или без алкохол.';
 return 'Избери няколко снимки или добави отговор със свои думи. Можеш да пропуснеш неизвестното.';
}
function ChoiceCard({item,active,onClick,disabled}:{item:PhotoChoice;active:boolean;onClick:()=>void;disabled:boolean}){
 const [failed,setFailed]=useState(false);
 return <button type="button" className={'v3-choice '+(active?'active':'')} aria-pressed={active} disabled={disabled} onClick={onClick}>
  <div className="v3-choice-photo">{!failed&&<img src={item.photo} loading="lazy" alt="" onError={()=>setFailed(true)}/>}<span className="v3-choice-emoji">{item.emoji}</span><span className="v3-choice-check">{active?<Check size={16}/>:<Plus size={15}/>}</span></div>
  <span className="v3-choice-name">{item.name}</span>
 </button>;
}
function PersonPill({person,active=false}:{person:Member;active?:boolean}){
 return <span className={'v3-pill '+(active?'active':'')}><span>{person.name.charAt(0)}</span>{person.name}{person.child&&<small>дете</small>}</span>;
}
type BrowserRecognizer=Window & {SpeechRecognition?:new()=>any;webkitSpeechRecognition?:new()=>any};

export function V3Planner({onHome,onAdmin}:{onHome:()=>void;onAdmin:()=>void}){
 const [families,setFamilies]=useState<Family[]>([]);
 const [familyId,setFamilyId]=useState('');
 const [state,setState]=useState<State|null>(null);
 const [token,setToken]=useState('');
 const [page,setPage]=useState<'choose'|'flow'>('choose');
 const [stepIndex,setStepIndex]=useState(0);
 const [answer,setAnswer]=useState<RecordAnswer>(defaultAnswer());
 const [shared,setShared]=useState<Shared>(defaultShared());
 const [rsvpStatuses,setRsvpStatuses]=useState<Record<string,string>>({});
 const [rsvpDays,setRsvpDays]=useState<string[]>([]);
 const [personDays,setPersonDays]=useState<Record<string,string[]>>({});
 const [expanded,setExpanded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [errorText,setErrorText]=useState('');
 const [trends,setTrends]=useState<Trend[]>([]);
 const [venueInfo,setVenueInfo]=useState<{address?:string;arrivalTime?:string;departureTime?:string;navigationUrl?:string;bringNotes?:string;organizerNotes?:string}|null>(null);
 const [coach,setCoach]=useState<{intro:string;question:string}|null>(null);
 const [extractBusy,setExtractBusy]=useState(false);
 const [extractCandidates,setExtractCandidates]=useState<string[]>([]);
 const [aiOpen,setAiOpen]=useState(false);
 const [aiQuestion,setAiQuestion]=useState('');
 const [aiReply,setAiReply]=useState('');
 const [aiBusy,setAiBusy]=useState(false);
 const [listening,setListening]=useState(false);
 const voiceRef=useRef<any>(null);
 const inviteAttempted=useRef(false);
 const flow=useMemo(()=>state?stagesFor(state.family,state.rsvp):[],[state]);
 const current=flow[Math.min(stepIndex,flow.length-1)];
 const choices=current?selectedChoices(current):[];
 const personNo=current?.kind==='person'&&state?state.family.members.filter(m=>state.rsvp?.statuses[m.id]!=='no').findIndex(m=>m.id===current.member?.id)+1:0;
 const guestsNo=state?.family.members.filter(m=>state.rsvp?.statuses[m.id]!=='no').length||0;
 const currentKey=current?.key||'';
 const nextLabel=flow[stepIndex+1]?.member?.name||'общата организация';
 const storedCount=state?state.family.members.reduce((n,m)=>n+Object.values(state.answers[m.id]||{}).filter(v=>!v.skipped).length,0):0;
 useEffect(()=>{
  api.get('/api/v3/families').then(r=>setFamilies(r.data.families)).catch(e=>setErrorText(apiError(e)));
 },[]);
 const loadSession=useCallback(async (t:string)=>{
  const r=await api.post('/api/v3/state',{token:t});
  const next=r.data as State;
  setToken(t);setState(next);setPage('flow');setAiOpen(false);setAiReply('');
  const steps=stagesFor(next.family,next.rsvp);
  const found=steps.findIndex(s=>{
   if(s.kind==='finish')return true;
   if(s.kind==='rsvp')return !next.rsvp;
   if(s.kind==='shared')return !next.shared[s.topic||''];
   return !next.answers[s.member!.id]?.[s.topic||''];
  });
  setStepIndex(Math.max(0,found));
  api.post('/api/v3/trends',{token:t}).then(v=>setTrends(v.data.trends||[])).catch(()=>setTrends([]));
  api.post('/api/v4/guest-info',{token:t}).then(v=>setVenueInfo(v.data.info||null)).catch(()=>setVenueInfo(null));
 },[]);
 const join=useCallback(async (id:string,code:string)=>{
  setBusy(true);setErrorText('');
  try{
   const res=await api.post('/api/v3/join',{familyId:id,code});
   const t=res.data.token as string;
   const all=localTokens();all[id]=t;localStorage.setItem('troyan_v3_sessions',JSON.stringify(all));
   await loadSession(t);
   setFamilyId(id);
   if(location.hash.startsWith('#invite='))history.replaceState(null,'',location.pathname+location.search);
  }catch(e){setErrorText(apiError(e));}finally{setBusy(false);}
 },[loadSession]);
 useEffect(()=>{
  if(inviteAttempted.current||!families.length)return;
  const hash=location.hash;
  if(!hash.startsWith('#invite='))return;
  const data=decodeURIComponent(hash.slice(8));
  const dot=data.indexOf('.');
  if(dot<0)return;
  inviteAttempted.current=true;
  join(data.slice(0,dot),data.slice(dot+1));
 },[families,join]);
 async function selectHome(id:string){
  setFamilyId(id);setErrorText('');
  const saved=localTokens()[id];
  if(saved){
   setBusy(true);
   try{await loadSession(saved);return;}catch{const all=localTokens();delete all[id];localStorage.setItem('troyan_v3_sessions',JSON.stringify(all));}
   finally{setBusy(false);}
  }
 }
 useEffect(()=>{
  if(!state||!current)return;
  if(current.kind==='rsvp'){setRsvpStatuses({...state.rsvp?.statuses});setRsvpDays([...(state.rsvp?.days||[])]);setPersonDays({...state.rsvp?.daysByPerson});}
  if(current.kind==='person')setAnswer({...defaultAnswer(),...(state.answers[current.member!.id]?.[current.topic||'']||{})});
  if(current.kind==='shared')setShared({...defaultShared(),...(state.shared[current.topic||'']||{})});
  setExpanded(false);setAiOpen(false);setAiQuestion('');setAiReply('');setErrorText('');setExtractCandidates([]);
  window.scrollTo({top:0,behavior:'instant' as ScrollBehavior});
 },[currentKey,state?.family.id]);
 useEffect(()=>{
  if(!token||!state||current?.kind!=='person')return;
  let active=true;
  setCoach(null);
  api.post('/api/v4/coach',{token,personId:current.member?.id,topic:current.topic})
   .then(r=>{if(active)setCoach(r.data);}).catch(()=>{});
  return()=>{active=false;};
 },[currentKey,token,state?.family.id]);
 function move(i:number){setStepIndex(Math.max(0,Math.min(i,flow.length-1)));window.scrollTo(0,0);}
 function toggle(name:string){
  if(current?.kind==='shared')setShared(v=>({...v,selected:v.selected.includes(name)?v.selected.filter(x=>x!==name):[...v.selected,name]}));
  else setAnswer(v=>({...v,selected:v.selected.includes(name)?v.selected.filter(x=>x!==name):[...v.selected,name]}));
 }
 async function save(skip=false){
  if(!state||!current||busy)return;
  setErrorText('');setBusy(true);
  try{
   if(current.kind==='rsvp'){
    if(!state.family.members.every(m=>['yes','maybe','no'].includes(rsvpStatuses[m.id]))){setErrorText('Избери присъствие за всеки човек.');return;}
    const r=await api.post('/api/v3/rsvp',{token,statuses:rsvpStatuses,days:rsvpDays,daysByPerson:personDays,version:state.rsvp?.version||0});
    setState(v=>v?{...v,rsvp:r.data.rsvp}:v);
    setStepIndex(1);return;
   }
   if(current.kind==='person'){
    if(current.topic==='restrictions'&&!skip&&!['none','has','unknown'].includes(answer.allergyStatus)){
     setErrorText('Избери дали има алергии, няма или не знаеш.');return;
    }
    const r=await api.post('/api/v3/save',{token,personId:current.member!.id,topic:current.topic,
      version:answer.version,value:{...answer,skipped:skip}});
    setState(v=>v?{...v,answers:{...v.answers,[current.member!.id]:{...(v.answers[current.member!.id]||{}),[current.topic!]:r.data.entry}}}:v);
   }
   if(current.kind==='shared'){
    const r=await api.post('/api/v3/shared',{token,topic:current.topic,version:shared.version,
      value:{...shared,skipped:skip}});
    setState(v=>v?{...v,shared:{...v.shared,[current.topic!]:r.data.entry}}:v);
   }
   move(stepIndex+1);
  }catch(e){
   setErrorText(apiError(e));
   const status=(e as {response?:{status?:number}})?.response?.status;
   if(status===409)await loadSession(token);
  }finally{setBusy(false);}
 }
 async function extractChoices(){
  if(current?.kind!=='person'||extractBusy||answer.note.trim().length<5)return;
  setExtractBusy(true);setErrorText('');setExtractCandidates([]);
  try{
   const r=await api.post('/api/v4/extract',{token,personId:current.member?.id,topic:current.topic,note:answer.note});
   setExtractCandidates(r.data.selected||[]);
   if(!r.data.selected?.length)setErrorText('Не разпознах сигурно съвпадение. Избери предложението ръчно.');
  }catch(e){setErrorText(apiError(e));}finally{setExtractBusy(false);}
 }
 async function askAI(){
  if(!aiQuestion.trim()||aiBusy)return;
  setAiBusy(true);setErrorText('');
  try{const r=await api.post('/api/v3/ask',{token,personId:current?.member?.id||'',question:aiQuestion});
   setAiReply(r.data.reply||'');}catch(e){setErrorText(apiError(e));}finally{setAiBusy(false);}
 }
 function dictation(){
  if(listening){voiceRef.current?.stop();setListening(false);return;}
  const browser=window as BrowserRecognizer;
  const Recognition=browser.SpeechRecognition||browser.webkitSpeechRecognition;
  if(!Recognition){setErrorText('Диктовката не е налична тук. Използвай клавиатура или отвори в Chrome.');return;}
  try{const rec=new Recognition();voiceRef.current=rec;rec.lang='bg-BG';rec.continuous=false;rec.interimResults=false;
   rec.onresult=(e:any)=>{const word=e.results?.[0]?.[0]?.transcript||'';if(current?.kind==='shared')setShared(v=>({...v,note:[v.note,word].filter(Boolean).join(' ')}));else setAnswer(v=>({...v,note:[v.note,word].filter(Boolean).join(' ')}));};
   rec.onend=()=>setListening(false);rec.onerror=()=>{setListening(false);setErrorText('Микрофонът не е достъпен.');};rec.start();setListening(true);
  }catch{setErrorText('Браузърът не позволява микрофон.');}
 }
 if(page==='choose')return <main className="v3 v3-choose">
  <div className="v3-eyebrow"><Sparkles size={16}/> TROYAN NEW YEAR 2027 · AI PARTY PLANNER</div>
  <h1>Заедно планираме.<br/><em>Всеки има думата.</em></h1>
  <p className="v3-choose-lead">Избери вашето семейство. Ще започнем с първия човек, после ще попитаме останалите и децата. Накрая ще видим какво харесва компанията.</p>
  {errorText&&<div className="v3-error" role="alert"><CircleAlert size={16}/>{errorText}</div>}
  <div className="v3-home-grid">{families.map((h,i)=><section key={h.id} className={'v3-home '+(familyId===h.id?'expanded':'')}>
    <button className="v3-home-select" disabled={busy} onClick={()=>selectHome(h.id)}>
     <span className="v3-home-index">0{i+1}</span><strong>{h.title}</strong><span className="v3-home-tags">{h.members.map(p=><span key={p.id}>{p.child?'🧸 ':''}{p.name}</span>)}</span>
     <span className="v3-home-continue">{localTokens()[h.id]?'Продължи разговора':'Отвори семейната покана'} <ArrowRight size={17}/></span>
    </button>
    {familyId===h.id&&<div className="v3-access"><strong>Без код за въвеждане</strong><p>Отвори личната покана от организатора във Viber. Семейният достъп се активира автоматично от линка.</p></div>}
   </section>)}</div>
  <p className="v3-private"><ShieldCheck size={16}/> Личните семейни отговори са достъпни само през семеен линк. В общите резултати няма имена и алергии.</p>
  <button className="v3-back" onClick={onHome}><ArrowLeft size={16}/> Към началото</button>
 </main>;
 if(!state||!current)return <main className="v3">Зареждане...</main>;
 const isPerson=current.kind==='person';
 const options=choices.slice(0,expanded?choices.length:6);
 const selected=current.kind==='shared'?shared.selected:answer.selected;
 const stepComplete=stepIndex===flow.length-1;
 return <main className="v3 v3-flow">
  <div className="v3-nav">
    <button onClick={()=>{setPage('choose');setFamilyId('')}}><ArrowLeft size={17}/> Семействата</button>
    <span>{state.family.title}</span><button onClick={onAdmin} aria-label="Организатор"><ShieldCheck size={17}/></button>
  </div>
  {venueInfo&&(venueInfo.address||venueInfo.arrivalTime||venueInfo.bringNotes||venueInfo.organizerNotes)&&<details className="v3-venue">
    <summary><MapPin size={16}/> Информация за вилата и пристигането</summary>
    <div>
     {venueInfo.address&&<p><strong>Адрес:</strong> {venueInfo.address}</p>}
     {venueInfo.arrivalTime&&<p><strong>Пристигане:</strong> {venueInfo.arrivalTime}</p>}
     {venueInfo.departureTime&&<p><strong>Напускане:</strong> {venueInfo.departureTime}</p>}
     {venueInfo.bringNotes&&<p><strong>Какво да носим:</strong> {venueInfo.bringNotes}</p>}
     {venueInfo.organizerNotes&&<p><strong>Допълнително:</strong> {venueInfo.organizerNotes}</p>}
     {venueInfo.navigationUrl&&<a href={venueInfo.navigationUrl} target="_blank" rel="noopener noreferrer">Отвори навигацията <MapPin size={14}/></a>}
    </div>
   </details>}
  <div className="v3-progress-top"><span>{stepComplete?'Обобщение':isPerson?'Човек '+personNo+' от '+guestsNo:current.kind==='rsvp'?'Подготовка':'Общо за всички'}</span><span>{Math.round(stepIndex/(flow.length-1)*100)}% от разговора</span></div>
  <div className="v3-progress"><div style={{width:Math.round(stepIndex/(flow.length-1)*100)+'%'}}/></div>
  {isPerson&&<div className="v3-member-track">{state.family.members.filter(m=>state.rsvp?.statuses[m.id]!=='no').map(p=><PersonPill key={p.id} person={p} active={p.id===current.member!.id}/>)}</div>}
  <div className="v3-stage">
   <div className="v3-agent"><span><Sparkles size={21}/></span><div><strong>Троянският организатор</strong><small>{current.kind==='person'?'Говорим за '+current.member!.name:'Планираме за цялата компания'}</small></div></div>
   {current.kind==='finish'?<section className="v3-finish">
     <div className="v3-finish-logo"><PartyPopper size={35}/></div><h2>Събрахме вашите <em>желания!</em></h2>
     <p>Отговорите са записани отделно за всеки член на семейството. Можете да се върнете и да коригирате всеки избор.</p>
     <div className="v3-finish-people">{state.family.members.map(m=><div key={m.id}><PersonPill person={m}/><span>{state.rsvp?.statuses[m.id]==='yes'?'Идва':state.rsvp?.statuses[m.id]==='maybe'?'Още уточнява':'Не идва'} · {Object.values(state.answers[m.id]||{}).filter(x=>!x.skipped).length} теми</span></div>)}</div>
     <div className="v3-trend"><h3>Какво харесват другите семейства?</h3>{trends.length?<div className="v3-trend-tags">{trends.map(t=><span key={t.category+t.name}>{t.name} <strong>{t.votes} гласа</strong></span>)}</div>:<p>Още няма достатъчно споделени предпочитания. Ще се появят, след като отговорят поне двама гости от други семейства.</p>}</div>
     <div className="v3-finish-actions"><button onClick={()=>move(0)}>Прегледай отговорите</button><button onClick={()=>{setPage('choose');setState(null)}}>Избери друго семейство</button></div>
    </section>:<>
    <div className="v3-greeting">{isPerson&&coach?.intro?coach.intro:current.kind==='rsvp'?'Хайде да уточним кой идва!':isPerson?'Сега е ред на '+current.member!.name+'.':'Остават само няколко общи въпроса.'}</div>
    <h2>{isPerson&&coach?.question?coach.question:stageTitle(current)}</h2>
    <p className="v3-description">{stageSub(current)}</p>
    {current.kind==='rsvp'&&<div className="v3-attendance">
      {state.family.members.map(p=><div className="v3-rsvp-row" key={p.id}>
        <div className="v3-rsvp-member"><span>{p.name.slice(0,1)}</span><strong>{p.name}<small>{p.child?'Дете':'Възрастен'}</small></strong></div>
        <div className="v3-rsvp-options">{[{id:'yes',label:'Идва'},{id:'maybe',label:'Може би'},{id:'no',label:'Не идва'}].map(x=><button key={x.id} className={rsvpStatuses[p.id]===x.id?'active '+x.id:''} onClick={()=>setRsvpStatuses(v=>({...v,[p.id]:x.id}))}>{x.label}</button>)}</div>
       </div>)}
       <h3>Кои дни ще бъдете в Троян?</h3><div className="v3-option-chips">{['31 декември','1 януари','2 януари','Още не знаем'].map(d=><button key={d} className={rsvpDays.includes(d)?'chosen':''} onClick={()=>setRsvpDays(v=>v.includes(d)?v.filter(x=>x!==d):[...v,d])}>{rsvpDays.includes(d)?<Check size={15}/>:<Plus size={15}/>} {d}</button>)}</div>
       <div className="v3-person-days"><h3>Ако някой пристига или тръгва по различно време</h3><p>По желание избери конкретни дни за всеки човек. Ако оставиш празно, важат общите дни.</p>{state.family.members.filter(m=>rsvpStatuses[m.id]!=='no').map(m=><div key={m.id} className="v3-person-days-row"><strong>{m.name}</strong><div className="v3-option-chips">{['31 декември','1 януари','2 януари'].map(day=><button key={day} type="button" className={(personDays[m.id]||[]).includes(day)?'chosen':''} onClick={()=>setPersonDays(v=>({...v,[m.id]:(v[m.id]||[]).includes(day)?(v[m.id]||[]).filter(d=>d!==day):[...(v[m.id]||[]),day]}))}>{day}</button>)}</div></div>)}</div>
     </div>}
    {current.kind!=='rsvp'&&current.topic==='restrictions'?<section className="v3-restrictions">
      <p><CircleAlert size={16}/> Попълнете само необходимото. Не смесваме алергии с храни, които просто не харесвате.</p>
      <div className="v3-option-chips">{[{id:'none',text:'Няма известни алергии'},{id:'has',text:'Има алергия / непоносимост'},{id:'unknown',text:'Не знам'}].map(i=><button key={i.id} className={answer.allergyStatus===i.id?'chosen':''} onClick={()=>setAnswer(v=>({...v,allergyStatus:i.id}))}>{answer.allergyStatus===i.id?<Check size={15}/>:<Plus size={15}/>} {i.text}</button>)}</div>
      {answer.allergyStatus==='has'&&<label>Какъв точно алерген или непоносимост?<textarea rows={2} value={answer.allergens} onChange={e=>setAnswer(v=>({...v,allergens:e.target.value}))} placeholder="Напр. ядки или лактоза. Не оставяй неясно."/></label>}
      <label>Какво не обича да яде? (незадължително)<textarea rows={2} value={answer.dislikes} onChange={e=>setAnswer(v=>({...v,dislikes:e.target.value}))} placeholder="Напр. не обича риба, лук или гъби."/></label>
     </section>:current.kind!=='rsvp'&&<div className="v3-choice-grid">
       {options.map(c=><ChoiceCard key={c.name} item={c} active={selected.includes(c.name)} disabled={busy} onClick={()=>toggle(c.name)}/>)}
     </div>}
    {current.kind!=='rsvp'&&choices.length>6&&<button className="v3-more" onClick={()=>setExpanded(v=>!v)}>{expanded?'По-малко предложения':'Покажи още '+(choices.length-6)} <ChevronDown size={15}/></button>}
    {current.kind!=='rsvp'&&current.topic!=='restrictions'&&<label className="v3-note">
       {current.kind==='person'&&current.topic==='drinks'?'Количества или други напитки':current.kind==='shared'?'Допълнителни идеи за всички':'Нещо друго, което да знаем?'}
       <div className="v3-note-input"><textarea rows={2} value={current.kind==='shared'?shared.note:answer.note}
        onChange={e=>current.kind==='shared'?setShared(v=>({...v,note:e.target.value})):setAnswer(v=>({...v,note:e.target.value}))}
        placeholder="Може да напишеш или да диктуваш със свои думи..." maxLength={500}/><button onClick={dictation} aria-label={listening?'Спри диктовката':'Диктувай на български'}>{listening?<MicOff size={19}/>:<Mic size={19}/>}</button></div></label>}
    {current.kind==='person'&&current.topic!=='restrictions'&&answer.note.trim().length>4&&<section className="v3-extract">
      <button type="button" onClick={extractChoices} disabled={extractBusy}>{extractBusy?'Разпознавам...':'Разпознай изборите от текста'} <WandSparkles size={16}/></button>
      {extractCandidates.length>0&&<div className="v3-extract-results">
       <p>Предложения: {extractCandidates.join(', ')}. Потвърди ги преди да продължиш.</p>
       <button type="button" onClick={()=>{setAnswer(v=>({...v,selected:[...new Set([...v.selected,...extractCandidates])]}));setExtractCandidates([]);}}><Check size={14}/> Добави</button>
       <button type="button" onClick={()=>setExtractCandidates([])}>Откажи</button>
      </div>}
     </section>}
    {current.kind==='shared'&&current.topic==='organization'&&<label className="v3-budget">Ориентировъчен бюджет за вашето семейство (незадължително)<input value={shared.budget} onChange={e=>setShared(v=>({...v,budget:e.target.value}))} maxLength={80} placeholder="Напр. 100 евро общо или ще уточним"/></label>}
    {trends.length>0&&current.kind==='person'&&current.topic==='food'&&<div className="v3-trend"><h3>Какво вече харесват останалите?</h3><div className="v3-trend-tags">{trends.filter(x=>x.category==='food').slice(0,4).map(t=><span key={t.name}>{t.name} <strong>{t.votes} гласа</strong></span>)}</div><small>Показват се само общи резултати от други семейства, без имена.</small></div>}
    <section className="v3-ai"><button className="v3-ai-toggle" onClick={()=>setAiOpen(v=>!v)}><WandSparkles size={18}/><span>Попитай AI за идея или уточнение</span><ChevronDown size={16}/></button>
     {aiOpen&&<div className="v3-ai-content"><p>Можеш да питаш за рецепти, детско меню, количества и подготовка. AI вижда само предпочитанията на вашето семейство.</p><div className="v3-ai-ask"><input value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)} maxLength={400} placeholder="Напр. Какво да предложим на децата?" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();askAI();}}}/><button onClick={askAI} disabled={aiBusy||!aiQuestion.trim()} aria-label="Попитай AI">{aiBusy?<RefreshCw size={17}/>:<Send size={17}/>}</button></div>{aiReply&&<div className="v3-ai-answer">{aiReply}</div>}</div>}
    </section>
    {current.kind!=='rsvp'&&<div className="v3-pick-count"><CheckCircle2 size={16}/> {selected.length} избрани предложения · можеш да избереш повече от едно</div>}
    </>}
    {errorText&&<div className="v3-error" role="alert"><CircleAlert size={16}/>{errorText}</div>}
   </div>
   {current.kind!=='finish'&&<div className="v3-actionbar"><button className="v3-previous" onClick={()=>move(stepIndex-1)} disabled={busy||stepIndex===0}><ArrowLeft size={16}/> Назад</button>
     {current.kind!=='rsvp'&&<button className="v3-skip" onClick={()=>save(true)} disabled={busy}>Не знам / пропусни</button>}
     <button className="v3-next" disabled={busy} onClick={()=>save(false)}>{busy?'Записване...':'Запази и продължи'} <ArrowRight size={17}/></button>
   </div>}
  </main>;
}

type AdminFamily={id:string;title:string;members:Member[];rsvp:Rsvp|null;answers:AnswerMap;shared:Record<string,Shared>;answered:number};
export function V3Admin({onGenerate}:{onGenerate:()=>void}){
 const [families,setFamilies]=useState<AdminFamily[]>([]);
 const [invites,setInvites]=useState<Array<{id:string;title:string;code:string|null}>>([]);
 const [loading,setLoading]=useState(false);
 const [messageText,setMessageText]=useState('');
 const [open,setOpen]=useState('');
 async function refresh(){
  setLoading(true);setMessageText('');
  try{
   const overview=api.get('/api/admin/v3/overview').catch(async()=>{
    const safe=await api.get('/api/v3/families');
    return {data:{families:(safe.data.families||[]).map((h:Family)=>({...h,rsvp:null,answers:Object.fromEntries(h.members.map(p=>[p.id,{}])),shared:{},answered:0}))}};
   });
   const [a,b]=await Promise.all([overview,api.get('/api/admin/v3/invites')]);
   setFamilies(a.data.families||[]);setInvites(b.data.items||[]);
  }catch(e){setMessageText(apiError(e));}finally{setLoading(false);}
 }
 useEffect(()=>{refresh();},[]);
 async function createLinks(){
  setLoading(true);setMessageText('');
  try{const r=await api.post('/api/admin/v3/invites',{});setInvites(r.data.items||[]);
   setMessageText('Поканите са генерирани. Изпрати правилния линк на всяко семейство.');}
  catch(e){setMessageText(apiError(e));}finally{setLoading(false);}
 }
 async function copyInvite(item:{id:string;code:string|null}){
  if(!item.code)return;
  const link=location.origin+'/#invite='+item.id+'.'+item.code;
  try{await navigator.clipboard.writeText(link);setMessageText('Линкът е копиран за Viber.');}
  catch{setMessageText('Неуспешно копиране. Отвори от Chrome.');}
 }
 return <section className="v3-admin">
   <div className="v3-admin-title"><div><small>V3 · СЕМЕЙСТВА И ПОКАНИ</small><h3>Организаторски контрол</h3><p>Лични семейни покани, индивидуални отговори и обобщения от компанията.</p></div><button onClick={refresh} disabled={loading}><RefreshCw size={16}/> Обнови</button></div>
   <div className="v3-admin-invites"><div><h4>Семейни покани за Viber</h4><p>Тези линкове са лични. Всяко семейство вижда само собствените си отговори.</p></div><button onClick={createLinks} disabled={loading}><LockKeyhole size={16}/> {invites.every(i=>i.code)?'Покажи / обнови':'Генерирай'} поканите</button></div>
   {messageText&&<div className="v3-admin-msg">{messageText}</div>}
   <div className="v3-admin-grid">{families.map(h=>{
    const invitation=invites.find(i=>i.id===h.id);
    const confirmed=h.members.filter(m=>h.rsvp?.statuses?.[m.id]==='yes').length;
    const topics=h.members.reduce((n,m)=>n+Object.values(h.answers[m.id]||{}).filter(e=>!e.skipped).length,0);
    return <div className="v3-admin-family" key={h.id}><div className="v3-admin-family-title"><strong>{h.title}</strong><span>{confirmed} потвърдили</span></div>
      <small>{topics} попълнени индивидуални теми · {h.members.length} участници</small>
      <div className="v3-admin-actions"><button disabled={!invitation?.code} onClick={()=>invitation&&copyInvite(invitation)}><Copy size={15}/> Копирай семеен линк</button><button onClick={()=>setOpen(open===h.id?'':h.id)}>{open===h.id?'Скрий':'Подробности'} <ChevronDown size={15}/></button></div>
      {open===h.id&&<div className="v3-admin-details">{h.members.map(p=>{
       const entry=h.answers[p.id]||{};
       return <div key={p.id}><strong>{p.name} {p.child?'(дете)':''}</strong><small>{h.rsvp?.statuses?.[p.id]==='yes'?'Идва':h.rsvp?.statuses?.[p.id]==='no'?'Не идва':'Не е потвърден'}</small>
        {Object.entries(entry).map(([topic,value])=><p key={topic}><b>{topic}:</b> {value.selected.join(', ')} {value.note||''} {topic==='restrictions'&&value.allergens?'Алергени: '+value.allergens:''} {topic==='restrictions'&&value.dislikes?'Не харесва: '+value.dislikes:''}</p>)}
       </div>;
      })}</div>}
    </div>;
   })}</div>
   <div className="v3-admin-footer"><div><h4>Общо меню и пазаруване</h4><p>Генерира от потвърдените отговори на хората, без двойно отчитане на V3 изборите.</p></div><button onClick={onGenerate}><Sparkles size={17}/> Генерирай меню</button></div>
  </section>;
}
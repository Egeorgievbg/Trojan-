import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import { ArrowRight, ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, Heart, Mic, MicOff, Plus, RefreshCw, ShieldCheck, ShoppingBasket, Sparkles, Users, UtensilsCrossed, Wine, WandSparkles, X, Send, PartyPopper, Copy, CalendarDays, Coffee, Gift, CakeSlice, Music2, MessageCircle, AlertCircle } from 'lucide-react';
import './family.css';

type Member = {id:string;name:string;child:boolean;group:string};
type Family = {id:string;title:string;ids:string[];members:Member[]};
type Choice = {title:string;icon:string;photo?:string;description?:string};
type Answers = {
  selected:string[];
  notes:string;
  perPerson:Record<string,string[]>;
  personNotes:Record<string,string>;
  statuses:Record<string,string>;
  days:string[];
};
type Section={id:string;name:string;question:string;subtitle:string;kind:'attendance'|'gallery'|'per-person'|'restrictions'|'notes';choices:Choice[];icon:string};
type Snapshot={family:Family;answers:Record<string,Answers>};
const photo=(id:string)=>'https://images.unsplash.com/'+id+'?auto=format&fit=crop&w=480&h=330&q=70';
const P={
  grill:photo('photo-1544025162-d76694265947'),
  chicken:photo('photo-1532550907401-a500c9a57435'),
  pizza:photo('photo-1513104890138-7c749659a591'),
  fish:photo('photo-1519708227418-c8fd9a32b7a2'),
  pasta:photo('photo-1473093295043-cdd812d0e601'),
  veg:photo('photo-1512621776951-a57141f2eefd'),
  salad:photo('photo-1540420773420-3366772f4999'),
  fries:photo('photo-1573080496219-bb080dd4f877'),
  cheese:photo('photo-1486297678162-eb2a19b0a32d'),
  boards:photo('photo-1508424757105-b6d5ad9329d0'),
  wine:photo('photo-1510812431401-41d2bd2722f3'),
  beer:photo('photo-1535958636474-b021ee887b13'),
  coffee:photo('photo-1509042239860-f550ce710b93'),
  juice:photo('photo-1600271886742-f049cd451bba'),
  water:photo('photo-1548839140-29a749e1cf4d'),
  breakfast:photo('photo-1533089860892-a7c6f0a88666'),
  eggs:photo('photo-1525351484163-7529414344d8'),
  cake:photo('photo-1578985545062-69928b1d9587'),
  fruit:photo('photo-1619566636858-adf3ef46400b'),
  icecream:photo('photo-1563805042-7684c019e1cb'),
  soup:photo('photo-1547592180-85f173990554'),
  party:photo('photo-1492684223066-81342ee5ff30'),
  games:photo('photo-1610890716171-6b1bb98ffd09'),
  fireworks:photo('photo-1498931299472-f7a63a5a1cfa'),
  gift:photo('photo-1513201099705-a9746e1e201f'),
  shop:photo('photo-1542838132-92c53300491e'),
  cook:photo('photo-1556911220-bff31c812dba')
};
const opt=(title:string,icon:string,photoUrl?:string,description?:string):Choice=>({title,icon,photo:photoUrl,description});
const SECTIONS:Section[]=[
  {id:'attendance',name:'Кой идва?',question:'Кои от вас ще бъдат в Троян и за кои дни?',subtitle:'Отбележи за всеки човек. Няма нужда всеки да попълва отделна анкета.',kind:'attendance',icon:'👨‍👩‍👧',choices:[]},
  {id:'mains',name:'Основно меню',question:'Да започнем с вкусното! Какво да има на новогодишната трапеза?',subtitle:'Можеш да избереш няколко. После ще уточним специалните предпочитания.',kind:'gallery',icon:'🍖',choices:[opt('Скара','🔥',P.grill),opt('Пилешко','🍗',P.chicken),opt('Пица','🍕',P.pizza),opt('Риба','🐟',P.fish),opt('Паста','🍝',P.pasta),opt('Без месо','🥗',P.veg),opt('Домашни гозби','🥘',P.cook),opt('Свинско печено','🍖',P.grill)]},
  {id:'salads',name:'Салати и мезета',question:'А около основното — какви салати, мезета и гарнитури обичате?',subtitle:'Избирай свободно повече от едно предложение.',kind:'gallery',icon:'🥗',choices:[opt('Шопска салата','🥗',P.salad),opt('Руска салата','🥣',P.salad),opt('Картофки','🍟',P.fries),opt('Сирена','🧀',P.cheese),opt('Мезета','🍖',P.boards),opt('Зелена салата','🥬',P.veg),opt('Туршия','🥒',P.salad),opt('Разядки','🥙',P.boards)]},
  {id:'drinks',name:'Напитки',question:'Какво пие всеки от възрастните?',subtitle:'Избери човек и отбележи напитките му. Можеш да впишеш и количества.',kind:'per-person',icon:'🥂',choices:[opt('Вода','💧',P.water),opt('Безалкохолно','🥤',P.juice),opt('Сок','🧃',P.juice),opt('Вино','🍷',P.wine),opt('Бира','🍺',P.beer),opt('Ракия','🥃',P.wine),opt('Кафе','☕',P.coffee),opt('Без алкохол','✅',P.water)]},
  {id:'children',name:'За децата',question:'А какво ще е вкусно за малките празнуващи?',subtitle:'Отделно за всяко дете, за да не остане гладно и най-претенциозното.',kind:'per-person',icon:'🧸',choices:[opt('Пица','🍕',P.pizza),opt('Картофки','🍟',P.fries),opt('Паста','🍝',P.pasta),opt('Пилешко','🍗',P.chicken),opt('Супа','🍲',P.soup),opt('Плодове','🍎',P.fruit),opt('Палачинки','🥞',P.breakfast),opt('Сладки неща','🧁',P.cake)]},
  {id:'restrictions',name:'Важно за храната',question:'Има ли алергии, непоносимости или храни, които някой не яде?',subtitle:'Поотделно за всеки. Ако няма ограничения, отбележи това изрично в полето.',kind:'restrictions',icon:'💚',choices:[]},
  {id:'breakfast',name:'Закуски',question:'Сутринта след купона — на какво бихте се зарадвали?',subtitle:'Предложи повече от един вариант за общата закуска.',kind:'gallery',icon:'☕',choices:[opt('Баница','🥧',P.breakfast),opt('Мекици','🍩',P.breakfast),opt('Яйца','🍳',P.eggs),opt('Сандвичи','🥪',P.breakfast),opt('Палачинки','🥞',P.breakfast),opt('Плодове','🍊',P.fruit),opt('Кафе','☕',P.coffee),opt('Кисело мляко','🥛',P.breakfast)]},
  {id:'desserts',name:'Десерти',question:'Какво сладко да предвидим за всички?',subtitle:'Различните вкусове могат да съжителстват на една маса.',kind:'gallery',icon:'🎂',choices:[opt('Домашна торта','🎂',P.cake),opt('Сладолед','🍨',P.icecream),opt('Шоколад','🍫',P.cake),opt('Плодове','🍇',P.fruit),opt('Бисквити','🍪',P.cake),opt('Баклава','🥮',P.cake)]},
  {id:'organization',name:'Организация',question:'Кой какво може да поеме за празника?',subtitle:'Пазаруване, приготвяне, транспорт, бюджет — каквото ви е удобно.',kind:'gallery',icon:'🛒',choices:[opt('Можем да пазаруваме','🛒',P.shop),opt('Можем да сготвим','👨‍🍳',P.cook),opt('Ще донесем напитки','🥂',P.wine),opt('Ще донесем храна','🥘',P.grill),opt('Помощ с транспорт','🚗',P.party),opt('Да разделим бюджета','💶',P.shop)]},
  {id:'fun',name:'Купонът',question:'Освен яденето — какво ще направи вечерта още по-яка?',subtitle:'Избирай музика, игри или идеи, подходящи за всички.',kind:'gallery',icon:'🎉',choices:[opt('Хубава музика','🎶',P.party),opt('Танци','💃',P.party),opt('Настолни игри','🎲',P.games),opt('Игри за децата','🧩',P.games),opt('Караоке','🎤',P.party),opt('Подаръчета','🎁',P.gift),opt('Снимки за спомен','📷',P.fireworks)]},
  {id:'extras',name:'Нещо друго?',question:'Пропуснахме ли нещо важно за вашето семейство?',subtitle:'Място за идеи, въпроси, допълнителни нужди и всички дребни детайли.',kind:'notes',icon:'✨',choices:[]}
].map(s=>({...s,choices:s.choices||[]}));
const blank=():Answers=>({selected:[],notes:'',perPerson:{},personNotes:{},statuses:{},days:[]});
const sessionKeys=()=>{try{return JSON.parse(localStorage.getItem('troian_family_sessions_v2')||'{}') as Record<string,string>;}catch{return {};}};
const message=(e:unknown)=>{const o=e as {message?:string;response?:{data?:{error?:string};status?:number}};return o?.response?.data?.error||o?.message||'Възникна грешка. Опитай пак.'};
const PHOTO_CREDIT='Снимки: Unsplash';
function VisualChoice({choice,active,onClick,disabled}:{choice:Choice;active:boolean;onClick:()=>void;disabled:boolean}){
  return <button type="button" disabled={disabled} aria-pressed={active} className={'fp-choice '+(active?'chosen':'')} onClick={onClick}>
    <span className="fp-choice-art"><span className="fp-choice-fallback">{choice.icon}</span>{choice.photo&&<img loading="lazy" src={choice.photo} alt={choice.title} onError={e=>{e.currentTarget.style.display='none';}}/>}<span className="fp-choice-check">{active?<Check size={15}/>:<Plus size={15}/>}</span></span>
    <span className="fp-choice-title">{choice.title}</span>
  </button>;
}
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onend:(()=>void)|null;onerror:((event:{error:string})=>void)|null;start:()=>void;stop:()=>void};
type BrowserSpeech=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};

export function FamilyPlanner({onBack,onAdmin}:{onBack:()=>void;onAdmin:()=>void}){
  const [families,setFamilies]=useState<Family[]>([]);
  const [family,setFamily]=useState<Family|null>(null);
  const [token,setToken]=useState('');
  const [answers,setAnswers]=useState<Record<string,Answers>>({});
  const [stepIndex,setStepIndex]=useState(0);
  const [draft,setDraft]=useState<Answers>(blank());
  const [person,setPerson]=useState('');
  const [mode,setMode]=useState<'choose'|'talk'|'finished'>('choose');
  const [assistant,setAssistant]=useState('Кажи ми какво обичате — ще го съберем в един общ план.');
  const [review,setReview]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const [listening,setListening]=useState(false);
  const [individualMode,setIndividualMode]=useState(false);
  const [aiQuestion,setAiQuestion]=useState('');
  const [aiReply,setAiReply]=useState('');
  const [asking,setAsking]=useState(false);
  const mic=useRef<Recognition|null>(null);
  const scroll=useRef<HTMLDivElement|null>(null);
  const step=SECTIONS[stepIndex];
  useEffect(()=>{api.get('/api/families').then(r=>setFamilies(r.data.families)).catch(e=>setErr(message(e)));return()=>mic.current?.stop();},[]);
  useEffect(()=>{if(mode==='talk'){requestAnimationFrame(()=>{document.querySelector('.fp-session')?.scrollIntoView({behavior:'auto',block:'start'});});}},[mode,stepIndex]);
  const completed=Object.keys(answers).length;
  const members=family?.members||[];
  const activeMembers=members.filter(p=>draft.statuses[p.id]!=='no' && answers.attendance?.statuses?.[p.id]!=='no');
  const shownPeople=step?.id==='drinks'?activeMembers.filter(p=>!p.child):step?.id==='children'?activeMembers.filter(p=>p.child):activeMembers;
  const currentPerson=shownPeople.find(p=>p.id===person)||shownPeople[0];
  const choices=step?.choices||[];
  const perMemberChoice=step?.kind==='per-person'||(step?.kind==='gallery'&&individualMode);
  const selected=currentPerson&&perMemberChoice?draft.perPerson[currentPerson.id]||[]:draft.selected;
  const alreadySelected=selected.length;
  const progress=Math.round(completed/SECTIONS.length*100);
  function applyStep(i:number,current:Record<string,Answers>=answers,nextFamily=family){
    setStepIndex(i);setDraft(current[SECTIONS[i].id]||blank());
    setIndividualMode(false);setAiQuestion('');setAiReply('');
    setPerson(nextFamily?.members.filter(m=>SECTIONS[i].id==='drinks'?!m.child:SECTIONS[i].id==='children'?m.child:true)[0]?.id||'');
  }
  async function openFamily(chosen:Family){
    setBusy(true);setErr('');
    try{
      let stored=sessionKeys()[chosen.id]||'';
      let state:Snapshot|null=null;
      if(stored){try{const r=await api.post('/api/family/state',{token:stored});state=r.data;}catch{stored='';}}
      if(!stored){
        const joined=await api.post('/api/family/join',{householdId:chosen.id});
        stored=joined.data.token;
        const map=sessionKeys();map[chosen.id]=stored;localStorage.setItem('troian_family_sessions_v2',JSON.stringify(map));
        const r=await api.post('/api/family/state',{token:stored});state=r.data;
      }
      if(!state)throw new Error('Неуспешно зареждане на семейството.');
      setToken(stored);setFamily(state.family);setAnswers(state.answers);
      const pending=SECTIONS.findIndex(s=>!state!.answers[s.id]);
      if(pending<0){setMode('finished');setReview('Анкетата е запазена. Може да прегледате и редактирате всеки отговор.');}
      else{applyStep(pending,state.answers,state.family);setMode('talk');}
      setAssistant('Супер! Нека да подредим желанията на всички от вашата група.');
    }catch(e){setErr(message(e));}finally{setBusy(false);}
  }
  function toggleChoice(title:string){
    if((step.kind==='per-person'||(step.kind==='gallery'&&individualMode))&&currentPerson){
      setDraft(d=>{const items=d.perPerson[currentPerson.id]||[];return {...d,perPerson:{...d.perPerson,[currentPerson.id]:items.includes(title)?items.filter(x=>x!==title):[...items,title]}}});
    }else setDraft(d=>({...d,selected:d.selected.includes(title)?d.selected.filter(x=>x!==title):[...d.selected,title]}));
  }
  function updateStatus(id:string,status:string){setDraft(d=>({...d,statuses:{...d.statuses,[id]:status}}));}
  async function saveStep(skip=false){
    if(!family||busy)return;
    if(step.id==='attendance'&&!skip&&!Object.keys(draft.statuses).length){setErr('Отбележи поне един човек или избери „Пропусни“ за по-късно.');return;}
    setBusy(true);setErr('');
    const payload=skip?blank():draft;
    try{
      let currentToken=token;
      let response;
      try{response=await api.post('/api/family/save',{token:currentToken,section:step.id,value:payload});}
      catch(e){
        const status=(e as {response?:{status?:number}})?.response?.status;
        if(status!==401&&!/сесията/i.test(message(e)))throw e;
        const joined=await api.post('/api/family/join',{householdId:family.id});
        currentToken=joined.data.token;setToken(currentToken);
        const map=sessionKeys();map[family.id]=currentToken;localStorage.setItem('troian_family_sessions_v2',JSON.stringify(map));
        response=await api.post('/api/family/save',{token:currentToken,section:step.id,value:payload});
      }
      const updated={...answers,[step.id]:response.data.value as Answers};
      setAnswers(updated);
      setAssistant(response.data.acknowledgement||'Записах избора.');
      if(stepIndex>=SECTIONS.length-1){
        setMode('finished');setReview('Събрахме предпочитанията. Подготвям кратко резюме.');
        try{const result=await api.post('/api/family/review',{token:currentToken});setReview(result.data.message);}
        catch{setReview('Запазихме отговорите на цялото семейство. Организаторът ще ги обобщи с останалите.');}
      }else applyStep(stepIndex+1,updated,family);
    }catch(e){setErr(message(e));}finally{setBusy(false);}
  }
  async function askAI(){
    if(!aiQuestion.trim()||asking||!family)return;
    setAsking(true);setErr('');setAiReply('');
    try{
      const r=await api.post('/api/family/ask',{token,topic:step.id,question:aiQuestion.trim()});
      setAiReply(r.data.reply||'');
    }catch(e){setErr(message(e));}finally{setAsking(false);}
  }
  function voice(){
    if(listening){mic.current?.stop();setListening(false);return;}
    const w=window as BrowserSpeech;const C=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!C){setErr('За диктовка използвай Chrome или клавиатурата на телефона.');return;}
    try{const rec=new C();mic.current=rec;rec.lang='bg-BG';rec.continuous=false;rec.interimResults=false;
      rec.onresult=e=>{const spoken=e.results[e.results.length-1]?.[0]?.transcript||'';if(spoken)setDraft(d=>({...d,notes:[d.notes,spoken].filter(Boolean).join(' ')}));};
      rec.onend=()=>setListening(false);rec.onerror=()=>{setListening(false);setErr('Микрофонът не е достъпен тук. Можеш да напишеш отговора.');};
      rec.start();setListening(true);
    }catch{setListening(false);setErr('Браузърът не позволява диктовка в този прозорец.');}
  }
  function doShare(){
    const text=['Нова година в Троян 2027','Ние от '+(family?.title||'компанията')+' попълнихме предпочитанията си.',review,'https://2027-9haq3i.v2.appdeploy.ai/'].join('\n\n');
    if(navigator.share)navigator.share({title:'Нова година в Троян',text}).catch(()=>{});
    else navigator.clipboard?.writeText(text).then(()=>setAssistant('Текстът е копиран.')).catch(()=>setErr('Копирането не е достъпно тук.'));
  }
  if(mode==='choose')return <main className="fp fp-chooser"><div className="fp-intro">
    <div className="fp-preamble"><Sparkles size={16}/> НАШИЯТ ПРАЗНИЧЕН AI АСИСТЕНТ</div>
    <h1>Една анкета.<br/><em>За цялото семейство.</em></h1>
    <p>Избери своята компания, после заедно ще решим какво ще хапваме, пием, пазаруваме и правим в Троян. Със снимки, няколко избора и истински AI разговор.</p>
    <div className="fp-perks"><span><Check size={14}/> Без регистрация</span><span><Check size={14}/> Всички от семейството</span><span><Check size={14}/> Запазва отговорите</span></div>
  </div>
  {err&&<p className="fp-error" role="alert">{err}</p>}
  <div className="fp-family-grid">{families.map((g,i)=><button className="fp-family-tile" key={g.id} disabled={busy} onClick={()=>openFamily(g)}>
    <span className="fp-family-top"><span className="fp-family-number">0{i+1}</span><span className="fp-family-symbol">✦</span></span>
    <span className="fp-family-title">{g.title}</span><span className="fp-member-chips">{g.members.map(m=><span key={m.id} className={m.child?'is-child':''}>{m.name}{m.child?' · дете':''}</span>)}</span>
    <span className="fp-family-link">{sessionKeys()[g.id]?'Продължи семейния разговор':'Започни за семейството'} <ArrowRight size={17}/></span>
  </button>)}</div><p className="fp-privacy"><ShieldCheck size={15}/> Данните се използват за организацията на това събиране. Линкът е за поканените.</p>
  <button className="fp-backplain" onClick={onBack}><ArrowLeft size={15}/> Към началото</button></main>;
  if(!family)return <main className="fp">Зареждане...</main>;
  if(mode==='finished')return <main className="fp fp-finished"><div className="fp-finish-panel"><div className="fp-party-icon"><PartyPopper size={36}/></div><span className="fp-preamble">ГОТОВО · {completed} ОТ {SECTIONS.length} ТЕМИ</span><h2>Супер, <em>вашата компания е готова!</em></h2><p>{review}</p><div className="fp-finish-members">{family.members.map(m=><span key={m.id}>{m.child?'🧸':'✓'} {m.name}</span>)}</div><div className="fp-finish-actions"><button className="fp-primary" onClick={()=>{applyStep(0);setMode('talk')}}><RefreshCw size={17}/> Прегледай и промени</button><button className="fp-secondary" onClick={doShare}><Copy size={16}/> Сподели</button></div><button className="fp-textlink" onClick={()=>{setFamily(null);setMode('choose')}}>Попълни за друга група</button></div></main>;
  return <main className="fp fp-session">
    <div className="fp-session-top"><button onClick={()=>{setMode('choose');setErr('')}}><ArrowLeft size={16}/> Семействата</button><span>{family.title}</span><button onClick={onAdmin} aria-label="Организатор"><ShieldCheck size={17}/></button></div>
    <div className="fp-progress"><div style={{width:progress+'%'}}/></div>
    <div className="fp-layout">
      <aside className="fp-sidebar">
        <div className="fp-sidebar-icon"><WandSparkles size={25}/></div><span className="fp-preamble">TROYAN · NEW YEAR 2027</span>
        <h2>Всичко за<br/><em>нашата вечер.</em></h2>
        <p>{family.title}</p>
        <div className="fp-steps">{SECTIONS.map((s,i)=><button disabled={busy} className={'fp-step '+(i===stepIndex?'on':'')+' '+(answers[s.id]?'complete':'')} key={s.id} onClick={()=>applyStep(i)}>
          <span>{answers[s.id]?<Check size={13}/>:s.icon}</span><strong>{s.name}</strong>{i===stepIndex&&<ChevronRight size={14}/>}</button>)}</div>
      </aside>
      <section className="fp-talk">
        <div className="fp-chathead"><div className="fp-bot"><Sparkles size={19}/></div><div><strong>Троянският организатор</strong><small><span/> Разговор за цялото семейство</small></div><span className="fp-counter">{stepIndex+1}/{SECTIONS.length}</span></div>
        <div className="fp-chatbody" ref={scroll}>
          <div className="fp-dayline">НОВА ГОДИНА · ТРОЯН 2027</div>
          {stepIndex===0&&<div className="fp-bubble"><strong>Здравейте, {family.title.split(',')[0]}!</strong><p>Ще минем през менюто, напитките, децата, бюджета и забавленията. Отговаряш за всички наведнъж.</p></div>}
          {stepIndex>0&&<div className="fp-context"><Sparkles size={15}/><span>{assistant}</span></div>}
          <div className="fp-bubble fp-question"><small>ТЕМА {stepIndex+1} · {step.name.toUpperCase()}</small><h3>{step.question}</h3><p>{step.subtitle}</p></div>
          <div className="fp-answer">
            {step.kind==='attendance'&&<>
              <div className="fp-answer-label"><Users size={16}/> Кой ще присъства?</div>
              <div className="fp-status-list">{members.map(m=><div className="fp-status-row" key={m.id}>
                <span className="fp-status-person"><span>{m.name[0]}</span><strong>{m.name}<small>{m.child?'Дете':'Възрастен'}</small></strong></span>
                <span className="fp-status-actions">{([{v:'yes',t:'Идва'},{v:'maybe',t:'Може би'},{v:'no',t:'Не идва'}] as const).map(c=><button className={draft.statuses[m.id]===c.v?'active '+c.v:''} onClick={()=>updateStatus(m.id,c.v)} key={c.v} disabled={busy}>{c.t}</button>)}</span>
              </div>)}</div>
              <div className="fp-answer-label"><CalendarDays size={16}/> Кои дни ще сте в Троян?</div>
              <div className="fp-mini-options">{['31 декември','1 януари','2 януари','Още не знаем'].map(d=><button className={draft.days.includes(d)?'active':''} key={d} disabled={busy} onClick={()=>setDraft(x=>({...x,days:x.days.includes(d)?x.days.filter(v=>v!==d):[...x.days,d]}))}>{draft.days.includes(d)?<Check size={14}/>:<Plus size={14}/>} {d}</button>)}</div>
            </>}
            {step.kind==='gallery'&&<div className="fp-individual-control"><button className={individualMode?'active':''} onClick={()=>{setIndividualMode(v=>!v);setPerson(activeMembers[0]?.id||'')}} type="button"><Users size={15}/>{individualMode?'Обратно към общите предложения':'Избери отделно за човек'}</button><span>{individualMode?'Личните избори са допълнение към общите':'По избор · за различни вкусове'}</span></div>}
            {step.kind==='gallery'&&individualMode&&<div className="fp-person-tabs">{activeMembers.map(m=><button key={m.id} className={currentPerson?.id===m.id?'active':''} onClick={()=>setPerson(m.id)}><span>{m.name.charAt(0)}</span>{m.name}</button>)}</div>}
            {step.kind==='per-person'&&<>
              <div className="fp-answer-label"><Users size={16}/> За кого избираш?</div>
              <div className="fp-person-tabs">{shownPeople.map(m=><button key={m.id} className={currentPerson?.id===m.id?'active':''} onClick={()=>setPerson(m.id)} disabled={busy}><span>{m.name.charAt(0)}</span>{m.name}</button>)}</div>
              {!shownPeople.length&&<p className="fp-hint">Няма участници за тази категория. Може да преминеш нататък.</p>}
            </>}
            {(step.kind==='gallery'||step.kind==='per-person')&&<div className="fp-photo-grid">{choices.map(item=><VisualChoice key={item.title} choice={item} disabled={busy||perMemberChoice&&!currentPerson} active={selected.includes(item.title)} onClick={()=>toggleChoice(item.title)}/>)}</div>}
            {step.kind==='restrictions'&&<>
              <div className="fp-alert"><AlertCircle size={17}/> <span>Алергиите и обикновените предпочитания са различни. Посочи конкретната информация за всеки човек. Не приемаме автоматично, че ястие е безопасно.</span></div>
              {members.map(m=><label className="fp-person-note" key={m.id}><strong>{m.child?'🧸':'👤'} {m.name}</strong><textarea rows={2} disabled={busy} placeholder="Алергии, непоносимости или храни, които не обича. Или: Няма ограничения." value={draft.personNotes[m.id]||''} onChange={e=>setDraft(x=>({...x,personNotes:{...x.personNotes,[m.id]:e.target.value}}))}/></label>)}
            </>}
            {step.kind==='per-person'&&currentPerson&&<label className="fp-specific-note"><span>Още за {currentPerson.name} — количества или специални предпочитания</span><input value={draft.personNotes[currentPerson.id]||''} placeholder={step.id==='drinks'?'Напр. 2 бири, без твърд алкохол':'Напр. не обича лук'} onChange={e=>setDraft(x=>({...x,personNotes:{...x.personNotes,[currentPerson.id]:e.target.value}}))} disabled={busy}/></label>}
            {step.kind!=='restrictions'&&<div className="fp-note-box"><label htmlFor="fp-note"><MessageCircle size={16}/> {step.kind==='notes'?'Разкажи каквото е важно':'Искаш да добавиш нещо със свои думи?'}</label><div className="fp-note-editor"><textarea id="fp-note" value={draft.notes} rows={step.kind==='notes'?5:2} disabled={busy} maxLength={900} onChange={e=>setDraft(x=>({...x,notes:e.target.value}))} placeholder={step.id==='organization'?'Напр. можем да вземем продуктите в София; бюджет около 80 € на възрастен.':step.id==='extras'?'Напиши всички допълнителни желания, въпроси и идеи...':'Напиши или диктувай, както би казал в разговор...'}/><button type="button" className={listening?'recording':''} onClick={voice} disabled={busy} aria-label={listening?'Спри микрофона':'Диктувай на български'}>{listening?<MicOff size={19}/>:<Mic size={19}/>}</button></div></div>}
            <div className="fp-ask-panel">
              <div className="fp-ask-heading"><WandSparkles size={18}/><span><strong>Попитай AI каквото искаш</strong><small>Идеи, количества, рецепти, меню или организация за цялото семейство.</small></span></div>
              <div className="fp-ask-form"><input value={aiQuestion} maxLength={450} onChange={e=>setAiQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();askAI();}}} placeholder="Напр. Какво да направим за децата, ако има пица?" disabled={asking||busy} aria-label="Въпрос към AI асистента"/><button type="button" disabled={!aiQuestion.trim()||asking||busy} onClick={askAI}>{asking?<RefreshCw className="fp-spin" size={17}/>:<Send size={17}/>}</button></div>
              {aiReply&&<div className="fp-ask-response" role="status"><Sparkles size={15}/><div className="fp-ask-content"><p>{aiReply}</p><button type="button" onClick={()=>{const memo=['Въпрос: '+aiQuestion.trim(),'AI идея (за преглед): '+aiReply].join(' | ');setDraft(x=>({...x,notes:[x.notes,memo].filter(Boolean).join('\n').slice(0,900)}));setAiReply('');setAiQuestion('');}}><Plus size={14}/> Добави към бележките за менюто</button></div></div>}
            </div>
            <p className="fp-selected-indicator"><CheckCircle2 size={15}/> {step.kind==='attendance'?Object.keys(draft.statuses).length+' отбелязани участници':step.kind==='restrictions'?Object.values(draft.personNotes).filter(Boolean).length+' индивидуални бележки':alreadySelected+' избрани предложения'} · Можеш да избереш повече от едно.</p>
          </div><div className="fp-scroll-anchor"/>
        </div>
        {err&&<div className="fp-error" role="alert"><AlertCircle size={15}/>{err}<button onClick={()=>setErr('')} aria-label="Затвори"><X size={14}/></button></div>}
        <div className="fp-bottom"><div className="fp-button-row"><button className="fp-previous" onClick={()=>stepIndex?applyStep(stepIndex-1):setMode('choose')} disabled={busy}><ArrowLeft size={16}/> Назад</button><button className="fp-skip" onClick={()=>saveStep(true)} disabled={busy}>Пропусни</button><button className="fp-primary" onClick={()=>saveStep()} disabled={busy}>{busy?<><RefreshCw className="fp-spin" size={17}/> Записвам...</>:stepIndex===SECTIONS.length-1?<>Завърши <Check size={17}/></>:<>Запази и продължи <ArrowRight size={17}/></>}</button></div><div className="fp-bottom-message"><ShieldCheck size={13}/> Записва се за цялото семейство · {progress}% готово</div></div>
      </section>
    </div><div className="fp-photo-credit">{PHOTO_CREDIT}</div>
  </main>;
}

export function FamilyAdmin({onGenerate}:{onGenerate:()=>void}){
  const [result,setResult]=useState<{families:Array<Family&{answers:Record<string,Answers>;completed:number}>;totalSections:number}|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  async function refresh(){setLoading(true);setError('');try{const r=await api.get('/api/admin/families');setResult(r.data);}catch(e){setError(message(e));}finally{setLoading(false);}}
  useEffect(()=>{refresh();},[]);
  const counts=useMemo(()=>{const tally:Record<string,number>={};if(!result)return [];for(const f of result.families){for(const [section,value] of Object.entries(f.answers)){if(['restrictions','attendance','extras'].includes(section))continue;const unique=[...value.selected,...Object.values(value.perPerson).flat()];for(const label of unique)tally[label]=(tally[label]||0)+1;}}return Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,9);},[result]);
  return <section className="fp-admin-block"><div className="fp-admin-heading"><div><span className="fp-preamble">НОВО · СЕМЕЙНИ АНКЕТИ</span><h3>Общият план на компанията</h3><p>Една анкета за всяка група, с персонални отговори за деца и възрастни.</p></div><button onClick={refresh} disabled={loading} className="fp-admin-reload"><RefreshCw size={15}/> Обнови</button></div>
    {error&&<p className="fp-error">{error}</p>}
    {!result?<p>Зареждане на семействата...</p>:<><div className="fp-admin-families">{result.families.map(f=>{
      const attending=f.answers.attendance?.statuses||{};
      const yes=Object.values(attending).filter(s=>s==='yes').length;
      return <div className="fp-admin-family" key={f.id}><div><strong>{f.title}</strong><small>{yes} потвърдили · {f.members.length} поканени</small></div><span className="fp-admin-progress">{f.completed}/{result.totalSections} теми</span><div className="fp-admin-line"><span style={{width:f.completed/result.totalSections*100+'%'}}/></div><p>{Object.entries(f.answers).filter(([key])=>!['restrictions','attendance'].includes(key)).flatMap(([,v])=>v.selected).slice(0,7).join(' · ')||'Все още няма предпочитания'}</p></div>;
    })}</div><div className="fp-admin-summary"><div><h4>Най-често избирани предложения</h4><div className="fp-admin-pills">{counts.length?counts.map(([label,n])=><span key={label}>{label} <strong>{n}</strong></span>):<small>Очакваме първите отговори от семействата.</small>}</div></div><button className="fp-primary" onClick={onGenerate}><WandSparkles size={16}/> Генерирай общо меню</button></div></>}
  </section>;
}
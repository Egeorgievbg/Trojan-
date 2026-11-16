import { homeCounts, homePage } from './home.js';
import { icon, loadingMark } from './interface.js';

const app=document.getElementById('app');
const HOUSEHOLDS=[];
const PHOTO=[['aerial.jpg','Общ изглед към имота'],['veranda.jpg','Уютната веранда'],['garden-wide.jpg','Дворът'],['garden-terrace.jpg','Къщата и терасата'],['garden-loungers.jpg','Кът за почивка'],['bedroom.jpg','Спалнята']];
const DATES=['2026-12-31','2027-01-01','2027-01-02','2027-01-03'];const D_LABEL={'2026-12-31':'31 декември','2027-01-01':'1 януари','2027-01-02':'2 януари','2027-01-03':'3 януари'};
const TOPICS=['food','sides','drinks','restrictions','breakfast','desserts','extras'];
const LABELS={food:'Основни ястия',sides:'Салати и мезета',drinks:'Напитки',restrictions:'Алергии и ограничения',breakfast:'Закуски',desserts:'Десерти',extras:'Още идеи'};
const ALLERGEN_CATEGORIES=['Зърнени храни с глутен','Ракообразни','Яйца','Риба','Фъстъци','Соя','Мляко','Ядки','Целина','Синап','Сусам','Сулфити','Лупина','Мекотели','Друго'];
const RESTRICTION_TYPES=[['allergy','Алергия'],['intolerance','Непоносимост'],['sensitivity','Чувствителност'],['unknown','Не е уточнено']];
const CHOICES={
 food:['🔥|Скара','🍗|Пилешко','🍖|Свинско печено','🥩|Телешко','🐟|Риба','🍕|Пица','🍝|Паста','🍲|Домашна гозба','🥗|Вегетарианско','🥣|Супа','🍟|Картофки','🍔|Бургери','🍚|Ориз','🥪|Сандвичи','🍊|Плодове','🥞|Палачинки'],
 sides:['🥗|Шопска салата','🥣|Руска салата','🥬|Зелена салата','🍟|Картофки','🥒|Туршия','🧀|Сирена','🥩|Мезета','🥙|Разядки','🥕|Печени зеленчуци'],
 drinks:['💧|Вода','🥤|Безалкохолно','🧃|Сок','☕|Кафе','🍵|Чай','🍺|Бира','🍷|Вино','🥃|Ракия','🥃|Уиски','✅|Без алкохол','🍫|Какао','🥛|Мляко'],
 breakfast:['🥧|Баница','🍩|Мекици','🍳|Яйца','🥞|Палачинки','🥪|Сандвичи','🍎|Плодове','🥛|Кисело мляко','☕|Кафе','🍵|Чай','🥣|Зърнена закуска'],
 desserts:['🎂|Торта','🍫|Шоколад','🍎|Плодове','🍨|Сладолед','🧁|Сладкиши','🥮|Баклава','🍰|Домашен сладкиш'],
 extras:['🎲|Настолни игри','🧩|Игри за децата','🎶|Музика','💃|Танци','🍖|Мезета','🥧|Баница'],
 table:['🥧|Баница','🥞|Палачинки','🎂|Торта','🧀|Сирена','🍖|Скара','🥗|Шопска салата','🍎|Плодове'],
 organization:['🛒|Пазаруване','👨‍🍳|Готвене','🎵|Музика','🎲|Игри','📷|Фотографии','🎁|Подаръци']
};
const CHILD_ALCOHOL=new Set(['Бира','Вино','Ракия','Уиски']);
const Q={food:n=>`Какво би хапнал/а ${n}?`,sides:n=>`Какви салати и мезета харесва ${n}?`,drinks:n=>`Какво предпочита да пие ${n}?`,restrictions:n=>`Има ли алергии или ограничения за ${n}?`,breakfast:n=>`Какво обича за закуска ${n}?`,desserts:n=>`Какъв десерт ще хареса ${n}?`,extras:n=>`Какво още да подготвим за ${n}?`};
let families=[],publicOverview=null,eventInfo={},guest=null,guestToken='',guestStep=0,guestDraft=null,adminData=null,adminTab='overview',message='',error='',coach='',photoIndex=null,saveState='idle';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round=v=>Number.isFinite(v)?Number(v.toFixed(2)):0;
const limit=(a,n=500)=>String(a||'').slice(0,n);
async function legacyApi(path,body=null){const response=await fetch('/api/'+path,{method:body===null?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)});const data=await response.json().catch(()=>({message:'Сървърът не отговори.'}));if(!response.ok)throw Error(data.message||data.error||'Неуспешна заявка.');return data;}
function banner(){return `<header class="header"><div class="header-inner"><div class="logo">TROЯN <b>·</b> NY 2027</div><nav><a href="/" data-nav="home">Начало</a><a href="/#villa" data-nav="villa">Вилата</a><a href="/#program" data-nav="program">Програма</a><button class="primary-nav" data-action="family">Семейна анкета →</button></nav></div></header>`;}
function showError(){return (error?`<div class="error" role="alert">${esc(error)}</div>`:'')+(message?`<div class="notice" role="status">${esc(message)}</div>`:'');}
function heroTimer(){const ms=Math.max(0,new Date('2026-12-31T00:00:00+02:00')-new Date());return ms<=0?'Празничните дни настъпиха!':`${Math.floor(ms/86400000)} дни · ${String(Math.floor(ms/3600000)%24).padStart(2,'0')} часа · ${String(Math.floor(ms/60000)%60).padStart(2,'0')} минути`;}
function legacyRenderHome(){const homes=families.length?families:HOUSEHOLDS;app.innerHTML=banner()+`
 <main><section class="hero"><div class="hero-inner"><div class="eyebrow">ПРАЗНУВАМЕ ЗАЕДНО · 2026 / 2027</div><h1>Нова година<br><em>в Троян.</em></h1><p>Четири дни. Три нощувки. Една компания. Много спомени.</p><div class="hero-info"><span>📅 31 декември – 2 януари</span><span>👨‍👩‍👧‍👦 14 поканени</span><span>📍 Троян, България</span></div><div class="buttons"><button class="btn btn-gold" data-action="family">Попълни за семейството →</button><a href="#villa" class="btn btn-ghost">Разгледай вилата</a></div></div><div class="countdown"><span>ДО НАШЕТО СЪБИРАНЕ</span><strong id="countdown">${heroTimer()}</strong></div></section>
 <section class="section"><div class="section-header"><span class="eyebrow">НАШЕТО СЪБИРАНЕ</span><h2>Повече от една <em>новогодишна вечеря.</em></h2><p>Нека планираме заедно храната, напитките и забавленията за възрастните и децата — без излишно пазаруване.</p></div><div class="features"><article class="feature"><span class="emoji">🍽️</span><strong>Меню за три дни</strong><p>Закуски, обяди, вечеря, десерти и детски предпочитания.</p></article><article class="feature"><span class="emoji">👨‍👩‍👧‍👦</span><strong>Всеки има думата</strong><p>Един възрастен попълва за хората от своето домакинство.</p></article><article class="feature"><span class="emoji">🛒</span><strong>Общ списък за покупки</strong><p>Одобрени ястия, порции, количества и отговорници.</p></article></div></section>
 <section id="villa" class="section"><div class="section-header"><span class="eyebrow">МЯСТОТО</span><h2>Нашият <em>уютен кът.</em></h2><p>Истински снимки на вилата. Летните удобства не са потвърдени за зимния сезон.</p></div><div class="photo-grid">${PHOTO.map(([file,title],i)=>`<button class="photo-tile" data-photo="${i}" aria-label="Разгледай: ${esc(title)}"><img src="/images/${file}" loading="${i?'lazy':'eager'}" alt="${esc(title)}"><span>${esc(title)}</span></button>`).join('')}</div></section>
 <section id="program" class="section"><div class="section-header"><span class="eyebrow">31.12 – 03.01</span><h2>Четири дни <em>заедно.</em></h2><p>Предложение за организация. Часовете ще бъдат потвърдени допълнително.</p></div><div class="days"><article class="day-card"><div class="date">31</div><div><small>ДЕКЕМВРИ · ДЕН 1</small><h3>Посрещаме 2027</h3><ul><li>Пристигане</li><li>Следобедно хапване</li><li>Празнична вечеря</li></ul></div></article><article class="day-card"><div class="date">01</div><div><small>ЯНУАРИ · ДЕН 2</small><h3>Първият ден</h3><ul><li>Закуска</li><li>Обяд и игри</li><li>Вечеря</li></ul></div></article><article class="day-card"><div class="date">02</div><div><small>ЯНУАРИ · ДЕН 3</small><h3>Още спомени</h3><ul><li>Закуска</li><li>Лек обяд при нужда</li><li>Отпътуване</li></ul></div></article></div></section>
 <section class="section"><div class="section-header"><span class="eyebrow">КОМПАНИЯТА</span><h2>Четири <em>домакинства.</em></h2><p>Един общ празник, но отделни предпочитания за всеки човек.</p></div><div class="family-grid">${homes.map((h,i)=>`<article class="family-card"><span class="number">0${i+1}</span><h3>${esc(h.title)}</h3>${h.members.map(m=>`<small>${m.child?'✦ ':''}${esc(m.name)}</small>`).join('')}</article>`).join('')}</div></section>
 <section class="section"><div class="section-cta"><div><span class="eyebrow">AI PARTY CONCIERGE</span><h2>А ти какво би <em>хапнал?</em></h2><p>Отвори семейния линк от Viber. Ще попитаме за всеки възрастен и дете поотделно. Без въвеждане на код.</p><button class="btn btn-gold" data-action="family">Към анкетата →</button></div><div style="font-size:90px" aria-hidden="true">✨</div></div></section></main>
 <footer class="footer">Троян · Нова година 2027 · Лично пространство за нашата компания <button class="back-btn" data-action="admin">Организатор</button></footer>`;
 attach();document.querySelector('#countdown')?.replaceChildren(document.createTextNode(heroTimer()));}
function renderNoInvite(){app.innerHTML=banner()+`<div class="guest-shell"><div class="interview" style="max-width:660px;margin:45px auto"><span class="step-label">СЕМЕЙНА АНКЕТА</span><h2>Няма код за вход.</h2>${showError()}<p class="subtitle">За да попълниш анкетата за твоето домакинство, отвори <strong>личния семеен линк от Viber</strong>. Така никой не може да редактира чуждите отговори.</p><div class="notice">Семействата не се отключват само с избор на име — личният линк служи като разрешение.</div><button class="btn btn-pine" data-action="home">Към началната страница →</button></div></div>`;attach();}
function legacyGuestSteps(){if(!guest)return[];const steps=[{kind:'attendance',key:'rsvp'}];for(const m of guest.family.members){if(guest.attendance?.[m.id]?.status==='no')continue;for(const t of TOPICS){if(m.child&&t==='sides')continue;steps.push({kind:'person',key:m.id+'_'+t,person:m,topic:t});}}steps.push({kind:'shared',key:'shared_table',topic:'table'},{kind:'shared',key:'shared_organization',topic:'organization'},{kind:'done',key:'done'});return steps;}
function legacyCurrent(){const steps=legacyGuestSteps();return steps[Math.min(guestStep,steps.length-1)];}
function legacyFreshDraft(step){if(step.kind==='person'){const record=guest.answers?.[step.person.id]?.[step.topic]||{};return {selected:record.selected||[],note:record.note||'',allergyStatus:record.allergyStatus||'unknown',restrictionType:record.restrictionType||'unknown',allergenCategories:record.allergenCategories||[],allergens:record.allergens||'',dislikes:record.dislikes||'',skipped:record.skipped||false,version:record.version||0};}if(step.kind==='shared'){const record=guest.shared?.[step.topic]||{};return {selected:record.selected||[],note:record.note||'',version:record.version||0};}return {};}
function legacySelectGuestStage(i){const list=legacyGuestSteps();guestStep=Math.max(0,Math.min(i,list.length-1));guestDraft=legacyFreshDraft(list[guestStep]);coach='';error='';message='';legacyRenderGuest();if(list[guestStep].kind==='person')requestCoach(list[guestStep]);window.scrollTo({top:0,behavior:'instant'});}
function legacyRenderGuest(){if(!guest)return renderNoInvite();const stages=legacyGuestSteps(),step=stages[Math.min(guestStep,stages.length-1)];if(!step)return renderNoInvite();const progress=Math.round(guestStep/(stages.length-1)*100);const subtitle=step.kind==='person'?`Сега попълваме за ${step.person.name}. Избери повече от една възможност или напиши собствен отговор.`:step.kind==='attendance'?'Отбележи кой идва и за кои дни. Това определя порциите и покупките.':'Общи предложения за нашето домакинство.';
 let title=step.kind==='person'?Q[step.topic](step.person.name):step.kind==='attendance'?'Кой ще празнува с нас?':step.kind==='shared'?(step.topic==='table'?'Общата ни трапеза':'Кой какво ще поеме?'):'Вашето семейство е готово!';
 const people=guest.family.members.filter(x=>guest.attendance?.[x.id]?.status!=='no');
 const chosen=guestDraft?.selected||[];const options=step.kind==='person'?(CHOICES[step.topic]||[]).filter(x=>!(step.person.child&&step.topic==='drinks'&&CHILD_ALCOHOL.has(x.split('|')[1]))):step.kind==='shared'?CHOICES[step.topic]:[];
 const content=step.kind==='attendance'?guest.family.members.map(m=>{const v=guest.attendance?.[m.id]||{},status=v.status||'',days=v.days||[];return `<section class="rsvp-person"><strong>${esc(m.name)} ${m.child?'· дете':''}</strong><div class="row-controls">${[['yes','Идва'],['maybe','Може би'],['no','Не идва']].map(([key,label])=>`<button data-status="${esc(m.id)}|${key}" class="${status===key?'active':''}" type="button">${label}</button>`).join('')}</div><small>Дни на присъствие:</small><div class="chips" style="margin-top:7px">${DATES.map(d=>`<button data-day="${esc(m.id)}|${d}" class="chip ${days.includes(d)?'active':''}">${D_LABEL[d]}</button>`).join('')}</div></section>`}).join(''):
 step.kind==='done'?`<div class="notice">Отговорите са записани отделно за всеки човек. Можеш да ги редактираш с бутона отдолу. Организаторът ще ги обедини в менюто.</div><div class="people">${guest.family.members.map(m=>`<span>${esc(m.name)} · ${esc(guest.attendance?.[m.id]?.status==='yes'?'Идва':guest.attendance?.[m.id]?.status==='no'?'Не идва':'Не е потвърден')}</span>`).join('')}</div><button class="btn btn-pine" data-action="restart">Прегледай отначало</button>`:
 step.topic==='restrictions'?`<div class="form-field">Има ли алергии или непоносимости?<div class="chips" style="margin-top:10px">${[['none','Няма известни'],['has','Има'],['unknown','Не знам']].map(([v,label])=>`<button class="chip ${guestDraft.allergyStatus===v?'active':''}" data-allergy="${v}">${label}</button>`).join('')}</div></div>${guestDraft.allergyStatus==='has'?`<label class="form-field">Какъв е точният алерген?<textarea id="allergens" rows="2" maxlength="260" placeholder="Например ядки, лактоза...">${esc(guestDraft.allergens)}</textarea></label>`:''}<label class="form-field">Какво не харесва? (незадължително)<textarea id="dislikes" rows="2" maxlength="250">${esc(guestDraft.dislikes)}</textarea></label>`:
 `<div class="choice-grid">${options.map(v=>{const [emoji,name]=v.split('|');return `<button class="choice ${chosen.includes(name)?'active':''}" data-choice="${esc(name)}"><span class="image">${emoji}</span><span>${esc(name)} ${chosen.includes(name)?'✓':''}</span></button>`}).join('')}</div><label class="form-field">Нещо друго? Можеш да пишеш или да диктуваш.<textarea rows="3" maxlength="450" id="note" placeholder="Допълнителни предпочитания или приблизителни количества...">${esc(guestDraft.note||'')}</textarea></label>`;
 app.innerHTML=banner()+`<main class="guest-shell"><div class="guest-header"><button class="back-btn" data-action="home">← Начало</button><span>${esc(guest.family.title)}</span><button class="back-btn" data-action="admin">Организатор</button></div><div class="progress" aria-label="Напредък ${progress}%"><div style="width:${progress}%"></div></div><div class="people">${people.map(p=>`<span class="${step.person?.id===p.id?'current':''}">${esc(p.name)}</span>`).join('')}</div><section class="interview"><div class="agent"><div class="agent-avatar">✦</div><div><strong>Троянският AI организатор</strong><small>${step.kind==='person'?'Разговаряме за '+esc(step.person.name):'Подготвяме празника заедно'}</small></div></div><div class="step-label">${step.kind==='person'?esc(LABELS[step.topic]):step.kind==='attendance'?'ПРИСЪСТВИЕ':step.kind==='shared'?'ОБЩА ОРГАНИЗАЦИЯ':'ОБОБЩЕНИЕ'} · ${progress}%</div><h2 id="question">${esc(coach||title)}</h2><p class="subtitle">${esc(subtitle)}</p>${showError()}${content}${step.kind==='person'&&step.topic==='food'?`<section class="trends"><strong>Какво харесват другите?</strong><div id="trends">Обобщените резултати се показват само след достатъчно гласове.</div></section>`:''}${guest.event?.address?`<details class="guest-details"><summary>Адрес и полезна информация</summary><p>${esc(guest.event.address)}</p>${guest.event.navigation?`<a rel="noopener noreferrer" target="_blank" href="${esc(guest.event.navigation)}">Навигация</a>`:''}</details>`:''}</section><div class="actions"><button class="plain" data-action="back" ${guestStep===0?'disabled':''}>← Назад</button>${step.kind!=='attendance'&&step.kind!=='done'?`<button class="plain" data-action="skip">Пропусни</button>`:''}${step.kind==='done'?'':`<button class="btn btn-gold" data-action="next">Запази и продължи →</button>`}</div></main>`;
 attach();if(step.kind==='person'&&step.topic==='food')loadTrends();}
function legacyAttach(){app.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>actions(el.dataset.action)));app.querySelectorAll('[data-photo]').forEach(el=>el.addEventListener('click',()=>showPhoto(Number(el.dataset.photo))));app.querySelectorAll('[data-choice]').forEach(el=>el.addEventListener('click',()=>{legacyCaptureDraft();const name=el.dataset.choice;guestDraft.selected=guestDraft.selected.includes(name)?guestDraft.selected.filter(x=>x!==name):[...guestDraft.selected,name];legacyRenderGuest();}));app.querySelectorAll('[data-allergy]').forEach(el=>el.addEventListener('click',()=>{legacyCaptureDraft();guestDraft.allergyStatus=el.dataset.allergy;legacyRenderGuest();}));app.querySelectorAll('[data-status]').forEach(el=>el.addEventListener('click',()=>{const [id,status]=el.dataset.status.split('|');guest.attendance[id]={...(guest.attendance[id]||{}),status,days:status!=='no'&&!(guest.attendance[id]?.days?.length)?[...DATES]:(guest.attendance[id]?.days||[])};legacyRenderGuest();}));app.querySelectorAll('[data-day]').forEach(el=>el.addEventListener('click',()=>{const [id,day]=el.dataset.day.split('|');const existing=guest.attendance[id]||{};guest.attendance[id]={...existing,days:(existing.days||[]).includes(day)?existing.days.filter(x=>x!==day):[...(existing.days||[]),day]};legacyRenderGuest();}));}
function legacyCaptureDraft(){if(!guestDraft)return;const note=document.querySelector('#note');if(note)guestDraft.note=limit(note.value);const alle=document.querySelector('#allergens');if(alle)guestDraft.allergens=limit(alle.value,260);const dislikes=document.querySelector('#dislikes');if(dislikes)guestDraft.dislikes=limit(dislikes.value,250);}
async function requestCoach(step){try{const out=await api('guest/coach',{token:guestToken,personId:step.person.id,topic:step.topic});if(current()?.key===step.key&&out.question){coach=out.question;const h=document.querySelector('#question');if(h)h.textContent=coach;}}catch{}}
async function loadTrends(){try{const data=await api('guest/trends',{token:guestToken});const ele=document.querySelector('#trends');if(ele)ele.innerHTML=data.trends?.length?data.trends.map(v=>`<span class="chip">${esc(v.name)} · ${v.votes} гласа</span>`).join(''):'<p>Още няма достатъчно анонимизирани гласове от други домакинства.</p>';}catch{}}
async function legacyNext(skip=false){const step=legacyCurrent();if(!step||step.kind==='done')return;legacyCaptureDraft();error='';message='';try{
 if(step.kind==='attendance'){if(!guest.family.members.every(m=>['yes','maybe','no'].includes(guest.attendance?.[m.id]?.status||'')))throw Error('Избери присъствие за всеки човек.');if(guest.family.members.some(m=>guest.attendance[m.id].status==='yes'&&!(guest.attendance[m.id].days||[]).length))throw Error('Избери поне един ден за всеки потвърден участник.');for(const m of guest.family.members){const v=guest.attendance[m.id];const saved=await api('guest/attendance',{token:guestToken,personId:m.id,status:v.status,days:v.days||[],version:v.version||0});guest.attendance[m.id]=saved;}selectGuestStage(1);return;}
 if(step.kind==='person'){const value={...guestDraft,skipped:skip};const res=await api('guest/save',{token:guestToken,personId:step.person.id,topic:step.topic,version:guestDraft.version,value});guest.answers[step.person.id]={...(guest.answers[step.person.id]||{}),[step.topic]:res.value};}
 else if(step.kind==='shared'){const res=await api('guest/shared',{token:guestToken,topic:step.topic,value:{...guestDraft,skipped:skip},version:guestDraft.version});guest.shared[step.topic]=res.value;}
 selectGuestStage(guestStep+1);
 }catch(e){error=e.message;renderGuest();}}
async function legacyLoadGuest(token,homeId){try{guestToken=token;guest=await legacyApi('guest/state',{token});localStorage.setItem('troian_guest_'+homeId,token);localStorage.setItem('troian_last_home',homeId);guestStep=0;legacySelectGuestStage(0);}catch(e){guest=null;error=e.message;renderNoInvite();}}
async function fromInvite(hash){let raw;try{raw=decodeURIComponent(hash.replace(/^#invite=/,''));}catch{error='Невалиден семеен линк.';return renderNoInvite();}const dot=raw.indexOf('.');if(dot<1)return renderNoInvite();const homeId=raw.slice(0,dot),invite=raw.slice(dot+1);try{const joined=await api('guest/join',{familyId:homeId,invite});history.replaceState(null,'',location.pathname);await loadGuest(joined.token,homeId);}catch(e){error=e.message;renderNoInvite();}}
async function legacyActions(name){if(name==='home'){history.replaceState(null,'',location.pathname);error='';legacyRenderHome();return;}if(name==='villa'||name==='program'){legacyRenderHome();return;}if(name==='family'){if(guest)return legacyRenderGuest();const home=localStorage.getItem('troian_last_home');const token=home&&localStorage.getItem('troian_guest_'+home);if(token){await legacyLoadGuest(token,home);return;}renderNoInvite();return;}if(name==='admin'){location.hash='admin';await legacyShowAdmin();return;}if(name==='back'){legacyCaptureDraft();legacySelectGuestStage(guestStep-1);return;}if(name==='next')return legacyNext(false);if(name==='skip')return legacyNext(true);if(name==='restart')return legacySelectGuestStage(0);}
let photoTrigger;
function showPhoto(index, trigger) {
 const [file,title]=PHOTO[index];
 let modal=document.querySelector('#lightbox');
 const selectedControl=document.activeElement?.dataset?.dir;
 if (!modal) {
  photoTrigger=trigger ?? document.activeElement;
  modal=document.createElement('dialog');
  modal.id='lightbox';
  modal.className='home-lightbox';
  modal.setAttribute('aria-label','Галерия на вилата');
  modal.addEventListener('cancel',event=>{event.preventDefault();closePhoto();});
  modal.addEventListener('click',event=>{if(event.target===modal)closePhoto();});
  modal.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
   event.preventDefault();
   turnPhoto(event.key==='ArrowRight'?1:-1);
  });
  document.body.appendChild(modal);
 }
 photoIndex=index;
 const filename=file.replace('.jpg','');
 modal.innerHTML=`<div class="home-lightbox-inner">
  <header><strong>${esc(title)} · ${index+1} / ${PHOTO.length}</strong>
   <button type="button" data-close aria-label="Затвори">${icon('close')}</button></header>
  <img src="/images/${filename}-1280.webp" alt="${esc(title)}">
  <nav aria-label="Снимки"><button type="button" data-dir="-1" aria-label="Предишна снимка">${icon('back')}</button>
   <button type="button" data-dir="1" aria-label="Следваща снимка">${icon('next')}</button></nav></div>`;
 modal.querySelector('[data-close]').onclick=closePhoto;
 modal.querySelectorAll('[data-dir]').forEach(button=>button.onclick=()=>turnPhoto(Number(button.dataset.dir)));
 if (!modal.open) {
  if (modal.showModal) modal.showModal();
  else modal.setAttribute('open','');
 }
 modal.querySelector(selectedControl==='1'?'[data-dir="1"]':selectedControl==='-1'?'[data-dir="-1"]':'[data-close]').focus?.({preventScroll:true});
}
function turnPhoto(delta) { showPhoto((photoIndex+delta+PHOTO.length)%PHOTO.length); }
function closePhoto() {
 const modal=document.querySelector('#lightbox');
 if(!modal)return;
 modal.close?.();
 modal.remove();
 photoIndex=null;
 photoTrigger?.focus?.({preventScroll:true});
 photoTrigger=null;
}
function legacyAdminView(){if(!adminData)return'';const {families:groups,recipes,slots,menu,shopping,event}=adminData;
 if(adminTab==='overview')return `<div class="admin-grid">${groups.map(f=>`<section class="admin-card"><h3>${esc(f.family.title)}</h3><p>${f.family.members.length} участници · ${f.family.members.filter(m=>f.attendance[m.id]?.status==='yes').length} потвърдили</p><button class="btn btn-pine" data-invite="${esc(f.family.id)}">Създай личен линк за Viber</button><div class="invite-output" id="invite-${esc(f.family.id)}"></div><details><summary>Отговори по хора</summary>${f.family.members.map(m=>`<p><strong>${esc(m.name)}</strong> · ${esc(f.attendance[m.id]?.status||'Няма отговор')}<br>${Object.entries(f.answers[m.id]||{}).map(([k,v])=>`${esc(LABELS[k]||k)}: ${esc((v.selected||[]).join(', '))}${v.allergyStatus&&k==='restrictions'?` · Алергии: ${esc({none:'Няма известни',has:'Има',unknown:'Не знам'}[v.allergyStatus]||'Не знам')}`:''}${v.allergens?` · Алергени: ${esc(v.allergens)}`:''}${v.dislikes?` · Не харесва: ${esc(v.dislikes)}`:''}${v.note?` · Бележка: ${esc(v.note)}`:''}${v.skipped?' · Пропуснато':''}`).join('<br>')}</p>`).join('')}</details></section>`).join('')}</div><div class="notice">Ново генериране на линк за семейство заменя стария му линк. Запази и изпрати новия веднага.</div>`;
 if(adminTab==='menu')return `<div class="admin-grid">${slots.map(s=>{const rows=menu.filter(x=>x.slot_id===s.id);return `<section class="admin-card"><span class="step-label">${esc(D_LABEL[s.day])}</span><h3>${esc(s.name)}</h3><p>Избери рецепта и брой порции. Изчисляването на съставките е детерминирано.</p>${recipes.map(r=>`<div class="row-controls" style="align-items:center;margin:7px 0"><strong style="font-size:12px;flex:1">${esc(r.name)}</strong><input type="number" min="0" max="120" step="1" data-serving="${esc(s.id)}|${esc(r.id)}" value="${rows.find(x=>x.recipe_id===r.id)?.portions||0}" style="width:72px;padding:8px"><button data-save-recipe="${esc(s.id)}|${esc(r.id)}">Запази</button></div>`).join('')}</section>`}).join('')}</div>`;
 if(adminTab==='shopping')return `<section class="admin-card"><h3>Общ списък за пазаруване</h3><p>Количествата са приблизителни, според одобрените порции. Проверявайте алергени и наличности.</p><button class="btn btn-pine" data-export="shopping">Експорт CSV ↓</button><div class="table-wrap"><table class="data-table"><thead><tr><th>Купено</th><th>Продукт</th><th>Количество</th><th>Отговорник</th></tr></thead><tbody>${shopping.map(x=>`<tr><td><input type="checkbox" data-purchase="${esc(x.id)}" ${x.bought?'checked':''}></td><td><strong>${esc(x.name)}</strong><small style="display:block">${esc(x.category)}</small></td><td>${x.quantity} ${esc(x.unit)}</td><td><input placeholder="Кой купува?" data-assignee="${esc(x.id)}" value="${esc(x.assignedTo)}"></td></tr>`).join('')}</tbody></table></div></section>`;
 if(adminTab==='info')return `<section class="admin-card" style="max-width:720px"><h3>Информация за вилата</h3>${[['address','Точен адрес'],['navigation','HTTPS навигация'],['arrival','Настаняване'],['departure','Освобождаване'],['bring','Какво да носим'],['notes','Други указания']].map(([key,label])=>`<label>${label}<textarea rows="${key==='notes'||key==='bring'?3:1}" data-setting="${key}">${esc(event[key]||'')}</textarea></label>`).join('')}<button class="btn btn-gold" data-save-event>Запази информацията</button></section>`;
 return'';}
function legacyRenderAdmin(){if(!adminData)return;app.innerHTML=banner()+`<main class="admin-shell"><div class="guest-header"><button data-action="home" class="back-btn">← Начало</button><span>Контролен център · Троян 2027</span><button class="back-btn" data-logout>Изход</button></div><h1 style="font-size:45px;margin:26px 0 12px">Организацията на <em>празника.</em></h1><p style="color:#7b8c7b;font-size:13px">${adminData.families.length} домакинства · ${adminData.families.reduce((n,f)=>n+f.family.members.length,0)} поканени · 2 нощувки / 3 дни</p><div class="admin-nav">${[['overview','Домакинства'],['menu','Меню'],['shopping','Пазаруване'],['info','Вилата']].map(([key,label])=>`<button data-tab="${key}" class="${adminTab===key?'active':''}">${label}</button>`).join('')}</div>${showError()}${legacyAdminView()}</main>`;
 attach();app.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{adminTab=btn.dataset.tab;error='';message='';renderAdmin()});app.querySelectorAll('[data-invite]').forEach(btn=>btn.onclick=()=>createInvite(btn.dataset.invite));app.querySelectorAll('[data-save-recipe]').forEach(btn=>btn.onclick=()=>saveRecipe(btn.dataset.saveRecipe));app.querySelectorAll('[data-purchase]').forEach(btn=>btn.onchange=()=>savePurchase(btn.dataset.purchase,btn.checked));app.querySelectorAll('[data-assignee]').forEach(btn=>btn.onblur=()=>savePurchase(btn.dataset.assignee,null,btn.value));app.querySelector('[data-save-event]')?.addEventListener('click',saveEvent);app.querySelector('[data-logout]')?.addEventListener('click',async()=>{await api('admin/logout',{});adminData=null;location.hash='';renderHome()});app.querySelector('[data-export]')?.addEventListener('click',exportShopping);}
async function createInvite(id){try{const data=await api('admin/invite',{familyId:id});const box=document.getElementById('invite-'+id);box.innerHTML=`<div class="notice"><strong>Нов личен линк:</strong><textarea rows="3" readonly>${esc(data.url)}</textarea><button class="btn btn-pine" data-copy>Копирай линка</button><p>${esc(data.warning)}</p></div>`;box.querySelector('[data-copy]').onclick=async()=>{try{if(typeof navigator!=='undefined'&&navigator.clipboard)await navigator.clipboard.writeText(data.url);else{const field=box.querySelector('textarea');field.focus();field.select();document.execCommand?.('copy');}}catch{}message='Линкът е готов за изпращане във Viber.';renderAdmin()};}catch(e){error=e.message;renderAdmin()}}
async function saveRecipe(key){const [slotId,recipeId]=key.split('|');const input=[...app.querySelectorAll('[data-serving]')].find(x=>x.dataset.serving===key);try{await api('admin/menu',{slotId,recipeId,portions:Number(input.value)});adminData=await api('admin/overview');message='Порциите са запазени.';renderAdmin();}catch(e){error=e.message;renderAdmin()}}
async function savePurchase(id,bought=null,assignedTo=null){const item=adminData.shopping.find(x=>x.id===id);if(!item)return;try{await api('admin/purchase',{id,bought:bought===null?item.bought:bought,assignedTo:assignedTo===null?item.assignedTo:assignedTo});adminData=await api('admin/overview');message='Покупката е актуализирана.';renderAdmin()}catch(e){error=e.message;renderAdmin()}}
async function saveEvent(){const value=Object.fromEntries([...app.querySelectorAll('[data-setting]')].map(x=>[x.dataset.setting,x.value]));try{await api('admin/event',value);adminData=await api('admin/overview');message='Информацията за вилата е запазена.';renderAdmin()}catch(e){error=e.message;renderAdmin()}}
function exportShopping(){const rows=[['Продукт','Категория','Количество','Единица','Купено','Отговорник'],...adminData.shopping.map(x=>[x.name,x.category,String(x.quantity),x.unit,x.bought?'Да':'Не',x.assignedTo])];const csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='troian-pazaruvane.csv';link.click();URL.revokeObjectURL(url)}
let editionPromise;
let overviewPromise;
let guestScreen;
let organizerScreen;
let homeObserver;
let activeRoute = '';
let pathGeneration = 0;

function leaveV2Screen() {
  pathGeneration++;
  guestScreen?.dispose();
  organizerScreen?.dispose();
  homeObserver?.disconnect();
  guestScreen = null;
  organizerScreen = null;
}

function openHome() {
  leaveV2Screen();
  history.replaceState(null, '', '/');
  renderHome();
}

function currentEdition() {
  editionPromise ??= api('v2/status').then(value => value.available === true).catch(error => {
    if (error.status === 404) return false;
    editionPromise = null;
    throw error;
  });
  return editionPromise;
}

async function openPrivate(kind, link = '') {
  leaveV2Screen();
  activeRoute = kind;
  const opened = pathGeneration;
  app.innerHTML = `<main class="loading-shell" role="status">${loadingMark()}<span>Зарежда се…</span></main>`;
  try {
    const [v2, screen] = await Promise.all([
      currentEdition(), kind === 'admin' ? import('./organizer.js') : import('./survey.js')
    ]);
    if (opened !== pathGeneration) return;
    if (kind === 'admin') {
      if (!v2) return showLegacyAdmin();
      organizerScreen = screen.mountOrganizer({ app, onHome: openHome });
    } else {
      if (!v2) return link ? fromInvite(link) : guest ? renderGuest() : renderNoInvite();
      guestScreen = screen.mountGuest({ app, link, onHome: openHome });
    }
  } catch {
    if (opened !== pathGeneration) return;
    app.innerHTML = `<main class="t27"><section class="t27-entry t27-surface">
      <h1>Връзката прекъсна</h1><p role="alert">Страницата не успя да се зареди.</p>
      <button type="button" class="t27-btn t27-btn--primary">Опитай отново</button>
      <a class="t27-btn" href="/">Начало</a></section></main>`;
    app.querySelector('button').addEventListener('click', () => openPrivate(kind, link));
  }
}

function openSurvey(link = '') { return openPrivate('survey', link); }
function showAdmin() { return openPrivate('admin'); }

function route() {
  const hash = location.hash;
  if (hash === '#admin') return showAdmin();
  if (location.pathname === '/thank-you' && !hash) return openSurvey();
  if (hash.startsWith('#invite=')) return openSurvey(hash);
  if (hash === '#survey') return openSurvey();
  if (activeRoute !== 'home') {
    leaveV2Screen();
    renderHome();
    if (hash === '#villa' || hash === '#program') document.querySelector(hash)?.scrollIntoView();
  }
}

window.addEventListener('hashchange',route);

function init() {
  purgeOldGuestStorage();
  route();
}

/* Production UX layer: private guest state, resilient drafts and a review-first flow. */
function purgeOldGuestStorage() {
  try {
    const storage = window.localStorage;
    for (const key of Object.keys(storage)) {
      if (/^troian_(guest_|state_v2:|draft_v2:|attendance_v2:|last_home$)/.test(key)) storage.removeItem(key);
    }
  } catch {}
}
function browserStorage(){return null;}
function readStored(key){const store=browserStorage();if(!store)return null;try{const raw=store.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}}
function writeStored(key,value){const store=browserStorage();if(!store)return;try{store.setItem(key,JSON.stringify(value));}catch{}}
function removeStored(key){const store=browserStorage();if(!store)return;try{store.removeItem(key);}catch{}}
function draftKey(step){return guest&&step?`troian_draft_v2:${guest.family.id}:${step.key}`:'';}
function attendanceKey(){return guest?`troian_attendance_v2:${guest.family.id}`:'';}
function snapshotKey(homeId=guest?.family?.id){return homeId?`troian_state_v2:${homeId}`:'';}
function saveDraftLocally(step){const key=draftKey(step);if(key&&guestDraft)writeStored(key,{...guestDraft,dirty:true,updatedAt:Date.now()});}
function clearDraftLocally(step){const key=draftKey(step);if(key)removeStored(key);}
function saveAttendanceLocally(){const key=attendanceKey();if(key&&guest)writeStored(key,{attendance:guest.attendance,dirty:true,updatedAt:Date.now()});}
function clearAttendanceLocally(){const key=attendanceKey();if(key)removeStored(key);}
function mergeLocalAttendance(){const local=readStored(attendanceKey());if(local?.dirty&&local.attendance)guest.attendance={...guest.attendance,...local.attendance};}
function saveGuestSnapshot(homeId=guest?.family?.id){const key=snapshotKey(homeId);if(key&&guest)writeStored(key,guest);}
async function api(path,body=null){
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timer=typeof setTimeout==='function'?setTimeout(()=>controller?.abort(),15000):null;
 try{
  const options={method:body===null?'GET':'POST',headers:body===null?{}:{'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body)};
  if(controller)options.signal=controller.signal;
  const response=await fetch('/api/'+path,options);
  const data=await response.json().catch(()=>({message:'Сървърът не отговори.'}));
  if(!response.ok)throw Object.assign(new Error(data.message||data.error||'Неуспешна заявка.'),{status:response.status});
  return data;
 }catch(e){
  if(e?.name==='AbortError')throw Error('Заявката отне твърде дълго. Провери връзката и опитай отново.');
  if(e instanceof TypeError)throw Error('Няма връзка със сървъра. Въведеното остана запазено на това устройство.');
  throw e;
 }finally{if(timer&&typeof clearTimeout==='function')clearTimeout(timer);}
}
function renderHome() {
 activeRoute = 'home';
 app.innerHTML = homePage(publicOverview, PHOTO, heroTimer());
 attach();
 homeObserver?.disconnect();
 if (typeof IntersectionObserver === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
   homeObserver = new IntersectionObserver(entries => {
     for (const {target, isIntersecting} of entries) {
       if (!isIntersecting) continue;
       target.classList.add('motion-in');
       homeObserver?.unobserve(target);
     }
   }, {threshold:0.12});
   app.querySelectorAll('[data-home-motion]').forEach(element => homeObserver.observe(element));
 }
 overviewPromise ??= api('public').then(data => {
   publicOverview = data.overview;
   eventInfo = data.event || {};
 }).catch(() => { overviewPromise = null; });
 void overviewPromise.then(() => {
   const counts = app.querySelector('#home-counts');
   if (counts) counts.innerHTML = homeCounts(publicOverview);
 });
}
function guestSteps(){
 if(!guest)return[];
 const steps=[{kind:'attendance',key:'rsvp'}];
 for(const person of guest.family.members){
  if(guest.attendance?.[person.id]?.status==='no')continue;
  for(const topic of TOPICS)steps.push({kind:'person',key:person.id+'_'+topic,person,topic});
 }
 steps.push({kind:'shared',key:'shared_table',topic:'table'},{kind:'shared',key:'shared_organization',topic:'organization'},{kind:'done',key:'done'});
 return steps;
}
function current(){const steps=guestSteps();return steps[Math.min(guestStep,steps.length-1)];}
function freshDraft(step){
 const server=step.kind==='person'?(guest.answers?.[step.person.id]?.[step.topic]||{}):step.kind==='shared'?(guest.shared?.[step.topic]||{}):{};
 const local=readStored(draftKey(step));
 const source=local?.dirty?{...server,...local}:server;
 if(step.kind==='person')return {selected:Array.isArray(source.selected)?source.selected:[],note:source.note||'',allergyStatus:source.allergyStatus||'unknown',restrictionType:source.restrictionType||'unknown',allergenCategories:Array.isArray(source.allergenCategories)?source.allergenCategories:[],allergens:source.allergens||'',dislikes:source.dislikes||'',skipped:source.skipped===true,version:Number(source.version||0)};
 if(step.kind==='shared')return {selected:Array.isArray(source.selected)?source.selected:[],note:source.note||'',skipped:source.skipped===true,version:Number(source.version||0)};
 return {};
}
function selectGuestStage(i,keepNotice=false){
 const list=guestSteps();guestStep=Math.max(0,Math.min(i,list.length-1));guestDraft=freshDraft(list[guestStep]);coach='';error='';if(!keepNotice)message='';renderGuest();
 if(list[guestStep].kind==='person')requestCoach(list[guestStep]);
 if(typeof window!=='undefined'&&typeof window.scrollTo==='function')window.scrollTo({top:0,behavior:'instant'});
}
function saveStateLabel(){return saveState==='saving'?'Запазва…':saveState==='saved'?'Запазено на сървъра':'';}
function statusText(status){return status==='yes'?'Идва':status==='maybe'?'Може би':status==='no'?'Не идва':'Не е попълнено';}
function restrictionTypeText(value){return RESTRICTION_TYPES.find(([key])=>key===value)?.[1]||'Не е уточнено';}
function reviewRow(person,topic,record,stageIndex){
 const selected=Array.isArray(record?.selected)?record.selected:[];
 const details=topic==='restrictions'?[record?.allergyStatus==='has'?`${restrictionTypeText(record?.restrictionType)}: ${[...(record.allergenCategories||[]),record.allergens].filter(Boolean).join(', ')||'неуточнено'}`:record?.allergyStatus==='none'?'Няма известни алергии или непоносимости':'Алергиите не са уточнени',record?.dislikes?'Не харесва: '+record.dislikes:''].filter(Boolean):[selected.join(', '),record?.note||''].filter(Boolean);
 return `<div class="review-row"><div><strong>${esc(LABELS[topic]||topic)}</strong><span>${esc(details.join(' · ')||'Няма избор')}</span></div><button class="plain review-edit" type="button" data-review-step="${stageIndex}">Редакция</button></div>`;
}
function reviewContent(){
 const stages=guestSteps();
 return `<div class="notice review-intro"><strong>Провери всичко преди потвърждение.</strong><br>Всеки ред се записва отделно и може да бъде редактиран.</div><div class="review-grid">${guest.family.members.map(person=>{const attendance=guest.attendance?.[person.id]||{};const stagesForPerson=stages.filter(x=>x.kind==='person'&&x.person.id===person.id);const rows=TOPICS.map(topic=>{const record=guest.answers?.[person.id]?.[topic];const stage=stagesForPerson.find(x=>x.topic===topic);return record||stage?reviewRow(person,topic,record||{},stage?stages.indexOf(stage):0):'';}).join('');return `<article class="review-card"><div class="review-card-head"><div><strong>${esc(person.name)}</strong><span>${person.child?'Дете':'Възрастен'}</span></div><button class="plain review-edit" type="button" data-review-step="0">Присъствие</button></div><p class="review-attendance">${esc(statusText(attendance.status))}${attendance.days?.length?' · '+attendance.days.map(d=>D_LABEL[d]).join(', '):''}</p>${rows||'<p class="muted">Няма допълнителни отговори.</p>'}</article>`;}).join('')}</div><article class="review-card"><div class="review-card-head"><div><strong>Обща организация</strong><span>Домакинството</span></div></div>${['table','organization'].map(topic=>{const record=guest.shared?.[topic]||{};const stage=stages.find(x=>x.kind==='shared'&&x.topic===topic);return reviewRow({},topic,record,stage?stages.indexOf(stage):0);}).join('')}</article>`;
}
function renderGuest(){
 if(!guest)return renderNoInvite();
 const stages=guestSteps(),step=current();if(!step)return renderNoInvite();
 const progress=stages.length<2?100:Math.round(guestStep/(stages.length-1)*100);
 const subtitle=step.kind==='person'?`Сега попълваме за ${step.person.name}. Избери повече от една възможност или напиши собствен отговор.`:step.kind==='attendance'?'Отбележи кой идва и за кои дни. Можеш да избереш различни дни за всеки човек.':'Общи предложения за нашето домакинство.';
 const title=step.kind==='person'?Q[step.topic](step.person.name):step.kind==='attendance'?'Кой ще празнува с нас?':step.kind==='shared'?(step.topic==='table'?'Общата ни трапеза':'Кой какво ще поеме?'):'Вашето семейство е готово!';
 const people=guest.family.members.filter(x=>guest.attendance?.[x.id]?.status!=='no');
 const chosen=guestDraft?.selected||[];
 const options=step.kind==='person'?(CHOICES[step.topic]||[]).filter(x=>!(step.person.child&&step.topic==='drinks'&&CHILD_ALCOHOL.has(x.split('|')[1]))):step.kind==='shared'?CHOICES[step.topic]||[]:[];
 const content=step.kind==='attendance'?guest.family.members.map(person=>{const value=guest.attendance?.[person.id]||{},status=value.status||'',selectedDays=value.days||[];return `<section class="rsvp-person"><strong>${esc(person.name)} ${person.child?'· дете':''}</strong><div class="row-controls">${[['yes','Идва'],['maybe','Може би'],['no','Не идва']].map(([key,label])=>`<button type="button" data-status="${esc(person.id)}|${key}" class="${status===key?'active':''}" aria-pressed="${status===key}">${label}</button>`).join('')}</div><small>Дни на присъствие:</small><div class="chips" style="margin-top:7px">${DATES.map(day=>`<button type="button" data-day="${esc(person.id)}|${day}" class="chip ${selectedDays.includes(day)?'active':''}" ${status==='no'?'disabled':''} aria-pressed="${selectedDays.includes(day)}">${D_LABEL[day]}</button>`).join('')}</div></section>`}).join(''):
   step.kind==='done'?reviewContent():step.topic==='restrictions'?`<div class="form-field">Има ли алергии или непоносимости?<div class="chips" style="margin-top:10px">${[['none','Няма известни'],['has','Има'],['unknown','Не знам']].map(([value,label])=>`<button type="button" class="chip ${guestDraft.allergyStatus===value?'active':''}" data-allergy="${value}" aria-pressed="${guestDraft.allergyStatus===value}">${label}</button>`).join('')}</div></div>${guestDraft.allergyStatus==='has'?`<div class="form-field"><strong>Какъв тип е ограничението?</strong><div class="chips" style="margin-top:10px">${RESTRICTION_TYPES.map(([value,label])=>`<button type="button" class="chip ${guestDraft.restrictionType===value?'active':''}" data-restriction-type="${value}" aria-pressed="${guestDraft.restrictionType===value}">${label}</button>`).join('')}</div></div><div class="form-field"><strong>Какво трябва да избягваме?</strong><small>Избери всичко приложимо. Това помага на организатора да провери рецептите.</small><div class="choice-grid restriction-grid" style="margin-top:10px">${ALLERGEN_CATEGORIES.map(name=>`<button type="button" class="choice ${guestDraft.allergenCategories.includes(name)?'active':''}" data-allergen-category="${esc(name)}" aria-pressed="${guestDraft.allergenCategories.includes(name)}"><span class="image">⚠️</span><span>${esc(name)} ${guestDraft.allergenCategories.includes(name)?'✓':''}</span></button>`).join('')}</div><label class="form-field">Друго уточнение или конкретен продукт<textarea data-draft-input id="allergens" rows="2" maxlength="260" placeholder="Например конкретна марка, съставка или кръстосан контакт...">${esc(guestDraft.allergens)}</textarea></label></div>`:''}<label class="form-field">Какво не харесва или предпочита да избягва? (незадължително)<textarea data-draft-input id="dislikes" rows="2" maxlength="250" placeholder="Това е предпочитание, не медицинска информация.">${esc(guestDraft.dislikes)}</textarea></label>`:
 `<div class="choice-grid">${options.map(value=>{const [emoji,name]=value.split('|');return `<button type="button" class="choice ${chosen.includes(name)?'active':''}" data-choice="${esc(name)}" aria-pressed="${chosen.includes(name)}"><span class="image">${emoji}</span><span>${esc(name)} ${chosen.includes(name)?'✓':''}</span></button>`}).join('')}</div><label class="form-field">Нещо друго? Можеш да пишеш или да диктуваш.<textarea data-draft-input rows="3" maxlength="450" id="note" placeholder="Допълнителни предпочитания или приблизителни количества...">${esc(guestDraft.note||'')}</textarea></label>`;
 const saveLabel=saveStateLabel();
 app.innerHTML=banner()+`<main class="guest-shell"><div class="guest-header"><button class="back-btn" data-action="home">← Начало</button><span>${esc(guest.family.title)}</span><span class="guest-secure">Лична покана</span></div><div class="progress" aria-label="Напредък ${progress}%"><div style="width:${progress}%"></div></div><div class="progress-copy">Стъпка ${guestStep+1} от ${stages.length} · ${progress}%</div><div class="people">${people.map(person=>`<span class="${step.person?.id===person.id?'current':''}">${esc(person.name)}</span>`).join('')}</div><section class="interview"><div class="agent"><div class="agent-avatar">✦</div><div><strong>Троянският AI организатор</strong><small>${step.kind==='person'?'Разговаряме за '+esc(step.person.name):'Подготвяме празника заедно'}</small></div></div><div class="step-label">${step.kind==='person'?esc(LABELS[step.topic]):step.kind==='attendance'?'ПРИСЪСТВИЕ':step.kind==='shared'?'ОБЩА ОРГАНИЗАЦИЯ':'ОБОБЩЕНИЕ'} · ${progress}%</div><h2 id="question">${esc(coach||title)}</h2><p class="subtitle">${esc(subtitle)}</p>${saveLabel?`<div class="save-state ${saveState}" role="status">${esc(saveLabel)}</div>`:''}${showError()}${content}${step.kind==='person'&&step.topic==='food'?`<section class="trends"><strong>Какво харесват другите?</strong><div id="trends">Обобщените резултати се показват само след достатъчно гласове.</div></section>`:''}${guest.event?.address?`<details class="guest-details"><summary>Адрес и полезна информация</summary><p>${esc(guest.event.address)}</p>${guest.event.navigation?`<a rel="noopener noreferrer" target="_blank" href="${esc(guest.event.navigation)}">Навигация</a>`:''}</details>`:''}</section><div class="actions">${step.kind==='done'?`<button class="plain" data-action="back">← Назад</button><button class="btn btn-gold" data-action="confirm">Потвърждавам отговорите</button>`:`<button class="plain" data-action="back" ${guestStep===0?'disabled':''}>← Назад</button>${step.kind!=='attendance'?`<button class="plain" data-action="skip">Пропусни</button>`:''}<button class="btn btn-gold" data-action="next" ${saveState==='saving'?'disabled':''}>${saveState==='saving'?'Запазва…':'Запази и продължи →'}</button>`}</div></main>`;
 attach();if(step.kind==='person'&&step.topic==='food')loadTrends();
}
function captureDraft(){
 if(!guestDraft)return;
 const note=document.querySelector('#note');if(note)guestDraft.note=limit(note.value);
 const allergens=document.querySelector('#allergens');if(allergens)guestDraft.allergens=limit(allergens.value,260);
 const dislikes=document.querySelector('#dislikes');if(dislikes)guestDraft.dislikes=limit(dislikes.value,250);
 saveDraftLocally(current());
}
function attach(){
 app.querySelectorAll('[data-action]').forEach(element=>element.addEventListener('click',()=>actions(element.dataset.action)));
 app.querySelectorAll('[data-photo]').forEach(element=>element.addEventListener('click',()=>showPhoto(Number(element.dataset.photo),element)));
 app.querySelectorAll('[data-choice]').forEach(element=>element.addEventListener('click',()=>{captureDraft();const name=element.dataset.choice;guestDraft.selected=guestDraft.selected.includes(name)?guestDraft.selected.filter(x=>x!==name):[...guestDraft.selected,name];saveDraftLocally(current());renderGuest();}));
 app.querySelectorAll('[data-allergy]').forEach(element=>element.addEventListener('click',()=>{captureDraft();guestDraft.allergyStatus=element.dataset.allergy;saveDraftLocally(current());renderGuest();}));
 app.querySelectorAll('[data-restriction-type]').forEach(element=>element.addEventListener('click',()=>{captureDraft();guestDraft.restrictionType=element.dataset.restrictionType;saveDraftLocally(current());renderGuest();}));
 app.querySelectorAll('[data-allergen-category]').forEach(element=>element.addEventListener('click',()=>{captureDraft();const category=element.dataset.allergenCategory;guestDraft.allergenCategories=guestDraft.allergenCategories.includes(category)?guestDraft.allergenCategories.filter(item=>item!==category):[...guestDraft.allergenCategories,category];saveDraftLocally(current());renderGuest();}));
 app.querySelectorAll('[data-draft-input]').forEach(element=>element.addEventListener('input',()=>captureDraft()));
 app.querySelectorAll('[data-status]').forEach(element=>element.addEventListener('click',()=>{const [id,status]=element.dataset.status.split('|');const previous=guest.attendance[id]||{};guest.attendance[id]={...previous,status,days:status==='no'?[]:(previous.days?.length?previous.days:[...DATES])};saveAttendanceLocally();renderGuest();}));
 app.querySelectorAll('[data-day]').forEach(element=>element.addEventListener('click',()=>{const [id,day]=element.dataset.day.split('|');const previous=guest.attendance[id]||{};guest.attendance[id]={...previous,days:(previous.days||[]).includes(day)?previous.days.filter(x=>x!==day):[...(previous.days||[]),day]};saveAttendanceLocally();renderGuest();}));
 app.querySelectorAll('[data-review-step]').forEach(element=>element.addEventListener('click',()=>selectGuestStage(Number(element.dataset.reviewStep))));
}
async function next(skip=false){
 const step=current();if(!step||step.kind==='done')return;captureDraft();error='';message='';saveState='saving';renderGuest();
 try{
  if(step.kind==='attendance'){
   if(!guest.family.members.every(person=>['yes','maybe','no'].includes(guest.attendance?.[person.id]?.status||'')))throw Error('Избери присъствие за всеки човек.');
   if(guest.family.members.some(person=>guest.attendance[person.id].status!=='no'&&!(guest.attendance[person.id].days||[]).length))throw Error('Избери поне един ден за всеки участник, който може да дойде.');
   for(const person of guest.family.members){const value=guest.attendance[person.id];const saved=await api('guest/attendance',{token:guestToken,personId:person.id,status:value.status,days:value.days||[],version:value.version||0});guest.attendance[person.id]=saved;}
   clearAttendanceLocally();saveGuestSnapshot();saveState='saved';message='Присъствието е записано.';selectGuestStage(1,true);return;
  }
  if(step.kind==='person'){const value={...guestDraft,skipped:skip};const saved=await api('guest/save',{token:guestToken,personId:step.person.id,topic:step.topic,version:guestDraft.version,value});guest.answers[step.person.id]={...(guest.answers[step.person.id]||{}),[step.topic]:saved.value};}
  else if(step.kind==='shared'){const saved=await api('guest/shared',{token:guestToken,topic:step.topic,value:{...guestDraft,skipped:skip},version:guestDraft.version});guest.shared[step.topic]=saved.value;}
  clearDraftLocally(step);saveGuestSnapshot();saveState='saved';message='Запазено.';selectGuestStage(guestStep+1,true);
 }catch(e){saveState='error';error=e.message;renderGuest();}
}
async function loadGuest(token,homeId){
 try{guestToken=token;guest=await api('guest/state',{token});mergeLocalAttendance();saveGuestSnapshot(homeId);writeStored('troian_guest_'+homeId,token);writeStored('troian_last_home',homeId);guestStep=0;saveState='idle';selectGuestStage(0);}catch(e){const cached=readStored(snapshotKey(homeId));if(cached?.family){guest=cached;mergeLocalAttendance();guestStep=0;saveState='error';error='Временна загуба на връзката. Показваме последно запазеното състояние; промените ще се изпратят при възстановяване.';selectGuestStage(0);return;}guest=null;error=e.message;renderNoInvite();}
}
async function actions(name){
 if(name==='home'){error='';message='';openHome();return;}
 if(name==='villa'||name==='program'){renderHome();return;}
 if(name==='family')return openSurvey();
 if(name==='admin'){if(location.hash==='#admin')await showAdmin();else location.hash='admin';return;}
 if(name==='back'){captureDraft();selectGuestStage(guestStep-1);return;}
 if(name==='next')return next(false);
 if(name==='skip')return next(true);
 if(name==='restart'){saveState='idle';return selectGuestStage(0);}
 if(name==='confirm'){saveState='saved';message='Всички отговори са записани. Благодарим!';renderGuest();}
}
function adminAnswerText(topic,value){
 const selected=Array.isArray(value?.selected)?value.selected:[];
 const parts=[`${LABELS[topic]||topic}: ${selected.join(', ')}`];
 if(topic==='restrictions'){
  parts.push(`Алергии/ограничения: ${{none:'Няма известни',has:'Има',unknown:'Не знам'}[value.allergyStatus]||'Не знам'}`);
  if(value.restrictionType&&value.restrictionType!=='unknown')parts.push(`Тип: ${restrictionTypeText(value.restrictionType)}`);
  if(Array.isArray(value.allergenCategories)&&value.allergenCategories.length)parts.push(`Категории: ${value.allergenCategories.join(', ')}`);
 }
 if(value.allergens)parts.push(`Уточнение: ${value.allergens}`);
 if(value.dislikes)parts.push(`Не харесва: ${value.dislikes}`);
 if(value.note)parts.push(`Бележка: ${value.note}`);
 if(value.skipped)parts.push('Пропуснато');
 return parts.map(esc).join(' · ');
}
function adminView(){
 if(!adminData)return'';
 const groups=adminData.families||[],recipes=adminData.recipes||[],slots=adminData.slots||[],menu=adminData.menu||[],shopping=adminData.shopping||[],event=adminData.event||{};
 if(adminTab==='overview'){
  const members=groups.flatMap(f=>f.family.members),yes=members.filter(m=>groups.find(f=>f.family.id===m.household_id)?.attendance?.[m.id]?.status==='yes').length,pending=members.filter(m=>{const family=groups.find(f=>f.family.members.some(x=>x.id===m.id));return !family?.attendance?.[m.id]?.status;}).length,allergies=members.filter(m=>{const family=groups.find(f=>f.family.members.some(x=>x.id===m.id));return family?.answers?.[m.id]?.restrictions?.allergyStatus==='has';}).length;
  return `<div class="admin-metrics"><div><strong>${groups.length}</strong><span>домакинства</span></div><div><strong>${yes}</strong><span>потвърдили</span></div><div><strong>${pending}</strong><span>без отговор</span></div><div class="metric-alert"><strong>${allergies}</strong><span>алергии</span></div></div><div class="admin-grid">${groups.map(f=>{const confirmed=f.family.members.filter(m=>['yes','maybe'].includes(f.attendance[m.id]?.status)).length;const allergyCount=f.family.members.filter(m=>f.answers[m.id]?.restrictions?.allergyStatus==='has').length;return `<section class="admin-card"><div class="card-heading"><h3>${esc(f.family.title)}</h3>${allergyCount?`<span class="alert-badge">⚠ ${allergyCount} алергии</span>`:''}</div><p>${f.family.members.length} участници · ${confirmed} отговорили</p><button class="btn btn-pine" data-invite="${esc(f.family.id)}">Създай личен линк за Viber</button><div class="invite-output" id="invite-${esc(f.family.id)}"></div><details><summary>Отговори по хора</summary>${f.family.members.map(person=>`<p><strong>${esc(person.name)}</strong> · ${esc(f.attendance[person.id]?.status||'Няма отговор')}<br>${Object.entries(f.answers[person.id]||{}).map(([topic,value])=>adminAnswerText(topic,value)).join('<br>')}</p>`).join('')}</details></section>`}).join('')}</div><div class="notice">Личните линкове са единственият достъп до домакинство. Генерирането на нов линк обезсилва стария.</div>`;
 }
 if(adminTab==='menu')return `<div class="admin-grid">${slots.map(slot=>{const rows=menu.filter(x=>x.slot_id===slot.id);return `<section class="admin-card"><span class="step-label">${esc(D_LABEL[slot.day])}</span><h3>${esc(slot.name)}</h3><p>Избери рецепта и брой порции. Количествата в списъка се преизчисляват автоматично.</p>${recipes.map(recipe=>`<div class="row-controls admin-recipe-row"><strong>${esc(recipe.name)}</strong><input type="number" min="0" max="120" step="1" data-serving="${esc(slot.id)}|${esc(recipe.id)}" value="${rows.find(x=>x.recipe_id===recipe.id)?.portions||0}" aria-label="Порции ${esc(recipe.name)}"><button type="button" data-save-recipe="${esc(slot.id)}|${esc(recipe.id)}">Запази</button></div>`).join('')}</section>`}).join('')}</div>`;
 if(adminTab==='shopping')return `<section class="admin-card"><h3>Общ списък за пазаруване</h3><p>Количествата са според седемте хранения и одобрените порции. Маркерите се запазват при повторно генериране.</p><button class="btn btn-pine" data-export="shopping">Експорт CSV ↓</button>${shopping.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Купено</th><th>Продукт</th><th>Количество</th><th>Отговорник</th></tr></thead><tbody>${shopping.map(item=>`<tr><td><input type="checkbox" data-purchase="${esc(item.id)}" ${item.bought?'checked':''} aria-label="Купено: ${esc(item.name)}"></td><td><strong>${esc(item.name)}</strong><small style="display:block">${esc(item.category)}</small></td><td>${item.quantity} ${esc(item.unit)}</td><td><input placeholder="Кой купува?" data-assignee="${esc(item.id)}" value="${esc(item.assignedTo)}"></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Добави рецепти и порции в „Меню“, за да се появи списъкът.</div>'}</section>`;
 if(adminTab==='info')return `<section class="admin-card" style="max-width:720px"><h3>Информация за вилата</h3>${[['address','Точен адрес'],['navigation','HTTPS навигация'],['arrival','Настаняване'],['departure','Освобождаване'],['bring','Какво да носим'],['notes','Други указания']].map(([key,label])=>`<label>${label}<textarea rows="${key==='notes'||key==='bring'?3:1}" data-setting="${key}">${esc(event[key]||'')}</textarea></label>`).join('')}<button class="btn btn-gold" data-save-event>Запази информацията</button></section>`;
 return'';
}
function renderAdmin(){
 if(!adminData)return;
 const groups=adminData.families||[];
 app.innerHTML=banner()+`<main class="admin-shell"><div class="guest-header"><button data-action="home" class="back-btn">← Начало</button><span>Контролен център · Троян 2027</span><button class="back-btn" data-logout>Изход</button></div><h1 style="font-size:45px;margin:26px 0 12px">Организацията на <em>празника.</em></h1><p class="admin-subtitle">${groups.length} домакинства · ${groups.reduce((total,f)=>total+f.family.members.length,0)} поканени · 2 нощувки / 3 дни</p><div class="admin-nav">${[['overview','Домакинства'],['menu','Меню'],['shopping','Пазаруване'],['info','Вилата']].map(([key,label])=>`<button type="button" data-tab="${key}" class="${adminTab===key?'active':''}">${label}</button>`).join('')}</div>${showError()}${adminView()}</main>`;
 attach();app.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{adminTab=button.dataset.tab;error='';message='';renderAdmin()});app.querySelectorAll('[data-invite]').forEach(button=>button.onclick=()=>createInvite(button.dataset.invite));app.querySelectorAll('[data-save-recipe]').forEach(button=>button.onclick=()=>saveRecipe(button.dataset.saveRecipe));app.querySelectorAll('[data-purchase]').forEach(button=>button.onchange=()=>savePurchase(button.dataset.purchase,button.checked));app.querySelectorAll('[data-assignee]').forEach(input=>input.onblur=()=>savePurchase(input.dataset.assignee,null,input.value));app.querySelector('[data-save-event]')?.addEventListener('click',saveEvent);app.querySelector('[data-logout]')?.addEventListener('click',async()=>{await api('admin/logout',{});adminData=null;location.hash='';renderHome()});app.querySelector('[data-export]')?.addEventListener('click',exportShopping);
}
async function showLegacyAdmin(){
 error='';message='';app.innerHTML=banner()+'<main class="loading-shell" aria-live="polite">Зареждаме контролния център…</main>';
 try{await api('admin/me');adminData=await api('admin/overview');renderAdmin();}
 catch(e){app.innerHTML=banner()+`<div class="guest-shell"><section class="interview" style="max-width:550px;margin:42px auto"><span class="step-label">САМО ЗА ОРГАНИЗАТОРА</span><h2>Защитен вход</h2><p class="subtitle">Гостите нямат код за вход. Организаторът влиза с разрешения Google акаунт.</p><a class="btn btn-pine" href="/api/auth/google">Вход с Google →</a><p class="error-copy">${esc(e.message)}</p></section></div>`;attach();}
}

Promise.resolve().then(init).catch(err=>{
 console.error('App initialization failed',err);
 if(!app)return;
 app.innerHTML='<main style="min-height:100vh;padding:38px 20px;display:grid;place-items:center;font-family:system-ui;background:#fafaf7;color:#224534"><section style="max-width:560px"><h1>Нова година в Троян</h1><p>Възникна проблем при зареждането. Презареди страницата. Ако проблемът остане, свържи се с организатора.</p><button id="retry-loading" style="padding:13px 20px;background:#dcb878;border:0;border-radius:9px">Опитай отново</button></section></main>';
 app.querySelector('#retry-loading')?.addEventListener('click',()=>location.reload());
});

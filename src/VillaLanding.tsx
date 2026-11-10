import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import {
  ArrowRight, CalendarDays, Camera, ChevronLeft, ChevronRight,
  Clock3, LockKeyhole, MapPin, PartyPopper, ShieldCheck,
  Sparkles, Users, UtensilsCrossed, X
} from 'lucide-react';
import './villa.css';
import { ShoppingBasket } from 'lucide-react';

type Guest = { id: string; name: string; child: boolean };
type Family = { id: string; title: string; members: Guest[] };
const photos = [
  {src: '/resources/villa-aerial.jpg', alt: 'Въздушен изглед към къщите и двора', title: 'Мястото на нашата Нова година', detail: 'Общ изглед към имота'},
  {src: '/resources/villa-veranda.jpg', alt: 'Веранда с места за отдих', title: 'Уютната веранда', detail: 'Пространство за отдих'},
  {src: '/resources/villa-garden-wide.jpg', alt: 'Панорамен изглед на двора и пътеките', title: 'Зеленият двор', detail: 'Изглед към двора'},
  {src: '/resources/villa-garden-terrace.jpg', alt: 'Двор с тераса и къща', title: 'Място за компанията', detail: 'Външно пространство'},
  {src: '/resources/villa-garden-loungers.jpg', alt: 'Градина с шезлонги и открита зона за сядане', title: 'Кът за почивка', detail: 'Двор и зона за отдих'},
  {src: '/resources/villa-bedroom.jpg', alt: 'Спалня с бяло легло и дървена облицовка', title: 'Уютно настаняване', detail: 'Снимка на спалня'}
];
type Photo = typeof photos[number];
const days = [
 {day: '31', month: 'ДЕК', title: 'Събираме компанията', tag: 'Ден 1', items: ['Пристигане и настаняване', 'Следобедно хапване и подготовка', 'Празнична вечеря и посрещане на 2027']},
 {day: '01', month: 'ЯНУ', title: 'Първият ден на 2027', tag: 'Ден 2', items: ['Закуска за големи и малки', 'Обяд и време заедно', 'Вечеря, игри и забавления']},
 {day: '02', month: 'ЯНУ', title: 'Още малко спомени', tag: 'Ден 3', items: ['Закуска и събиране на багажа', 'План за остатъците от храната', 'Отпътуване според уговорката']}
];
function PhotoFrame({photo, onClick, mediaReady, className = ''}: {photo: Photo; onClick: () => void; mediaReady: boolean; className?: string}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <button className={'villa-photo ' + className} type="button" onClick={onClick} aria-label={'Отвори снимката: ' + photo.title}>
    {mediaReady && !failed && <img src={photo.src} alt={photo.alt} loading={photo.src.includes('aerial') ? 'eager' : 'lazy'} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    {(!mediaReady || !loaded || failed) && <span className="villa-photo-fallback"><Camera size={24}/><small>Снимка на вилата</small><span>{!mediaReady || failed ? 'Очаква качване' : 'Зареждане...'}</span></span>}
    <span className="villa-photo-shade"/>
    <span className="villa-photo-caption"><strong>{photo.title}</strong><small>{photo.detail}</small></span>
    <span className="villa-photo-open"><Camera size={17}/></span>
  </button>;
}
function Countdown() {
  const [remaining, setRemaining] = useState({days: 0, hours: 0, minutes: 0, passed: false});
  useEffect(() => {
    const update = () => {
      const goal = new Date('2026-12-31T00:00:00+02:00').getTime();
      const diff = Math.max(0, goal - Date.now());
      setRemaining({days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, minutes: Math.floor(diff / 60000) % 60, passed: diff <= 0});
    };
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="villa-countdown" aria-label="Обратно броене до Нова година">
    {remaining.passed ? <strong>Празничните дни настъпиха!</strong> : <>
      <span>ДО НАШЕТО СЪБИРАНЕ</span>
      <div><strong>{remaining.days}<small>дни</small></strong><strong>{String(remaining.hours).padStart(2, '0')}<small>часа</small></strong><strong>{String(remaining.minutes).padStart(2, '0')}<small>минути</small></strong></div>
    </>}
  </div>;
}
export default function VillaLanding({onStart, onAdmin}: {onStart: () => void; onAdmin: () => void}) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [mediaReady, setMediaReady] = useState(false);
  const [publicInfo, setPublicInfo] = useState<{arrivalTime?:string;departureTime?:string;bringNotes?:string}|null>(null);
  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setMediaReady(true);
    probe.onerror = () => setMediaReady(false);
    probe.src = '/resources/villa-aerial.jpg';
    api.get('/api/v4/info').then(r=>setPublicInfo(r.data.info||null)).catch(()=>{});
  }, []);
  const [modalIndex, setModalIndex] = useState<number|null>(null);
  useEffect(() => {
    api.get('/api/v3/families').then(r => setFamilies(r.data.families || [])).catch(() => setFamilies([]));
  }, []);
  useEffect(() => {
    if (modalIndex === null) return;
    const key = (event: KeyboardEvent) => {
      if(event.key === 'Escape')setModalIndex(null);
      if(event.key === 'ArrowRight')setModalIndex(v => v === null ? null : (v+1)%photos.length);
      if(event.key === 'ArrowLeft')setModalIndex(v => v === null ? null : (v-1+photos.length)%photos.length);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [modalIndex]);
  const guests = families.flatMap(f => f.members);
  const [touchX, setTouchX] = useState<number|null>(null);
  return <main className="villa-landing" id="villa-top">
    <section className="villa-hero" aria-label="Нова година в Троян">
      <div className="villa-hero-image" style={{backgroundImage: mediaReady ? 'linear-gradient(90deg,rgba(8,32,27,.9),rgba(8,32,27,.5)),url(/resources/villa-aerial.jpg)' : 'linear-gradient(120deg,#25503c,#102f27)'}}/>
      <div className="villa-hero-overlay"/>
      <div className="villa-hero-inner">
        <div className="villa-tag"><Sparkles size={15}/> ПРАЗНУВАМЕ ЗАЕДНО · 2026 / 2027</div>
        <h1>Нова година<br/><em>в Троян.</em></h1>
        <p>Три дни. Две нощувки. Една компания. Много спомени.</p>
        <div className="villa-hero-info"><span><CalendarDays size={17}/> 31.12.2026 — 02.01.2027</span><span><Users size={17}/> {guests.length || 14} поканени</span><span><MapPin size={17}/> Троян, България</span></div>
        <div className="villa-buttons">
          <button className="villa-btn-primary" onClick={onStart}>Попълни за семейството <ArrowRight size={18}/></button>
          <a className="villa-btn-secondary" href="#villa-gallery">Разгледай вилата <Camera size={17}/></a>
        </div>
        <p className="villa-hero-disclaimer">Нашето частно място за информация, меню и общо пазаруване.</p>
      </div>
      <Countdown/>
    </section>

    <section className="villa-welcome villa-section">
      <div className="villa-section-heading"><span className="villa-overline">НАШЕТО СЪБИРАНЕ</span><h2>Повече от една <em>новогодишна вечеря.</em></h2><p>Ще бъдем заедно от 31 декември до 2 януари. Нека подготвим храната и напитките за всички, без излишно пазаруване и без да пропускаме децата.</p></div>
      <div className="villa-feature-row">
        <article><span><UtensilsCrossed/></span><strong>Меню за три дни</strong><p>Вечеря, закуски, обяди, десерти и нещо за малките.</p></article>
        <article><span><Users/></span><strong>Всяко семейство има думата</strong><p>Един човек отговаря за своите близки, поотделно за всеки.</p></article>
        <article><span><ShoppingBasket/></span><strong>Умен план за покупки</strong><p>Обединени предпочитания, количества и разпределени задачи.</p></article>
      </div>
    </section>

    <section className="villa-gallery-section villa-section" id="villa-gallery">
      <div className="villa-section-heading villa-gallery-header"><div><span className="villa-overline">МЯСТОТО</span><h2>Нашият <em>уютен кът.</em></h2></div><p>Истински кадри от вилата. Изображенията са от топъл сезон; наличността на сезонните удобства през зимата не е потвърдена.</p></div>
      <div className="villa-gallery-grid">
        {photos.map((photo,i) => <PhotoFrame key={photo.src} photo={photo} onClick={() => mediaReady && setModalIndex(i)} mediaReady={mediaReady} className={'villa-gallery-' + i}/>)}
      </div>
    </section>

    <section className="villa-timeline-section villa-section" id="villa-program">
      <div className="villa-section-heading"><span className="villa-overline">ПЛАНИРАМЕ 3 ДНИ</span><h2>Две нощувки. <em>Толкова много възможности.</em></h2><p>Това е предложена програма. Организаторът ще потвърди часовете и храненията след семейните анкети.</p></div>
      <div className="villa-days">{days.map(d => <article key={d.day + d.month} className="villa-day"><div className="villa-day-date"><strong>{d.day}</strong><span>{d.month}</span></div><div className="villa-day-content"><small>{d.tag}</small><h3>{d.title}</h3><ul>{d.items.map(v => <li key={v}>{v}</li>)}</ul></div></article>)}</div>
    </section>

    {publicInfo&&(publicInfo.arrivalTime||publicInfo.departureTime||publicInfo.bringNotes)&&<section className="villa-public-info villa-section" id="villa-info"><div className="villa-section-heading"><span className="villa-overline">ПОЛЕЗНА ИНФОРМАЦИЯ</span><h2>Преди да <em>тръгнем.</em></h2><p>Последни указания от организатора. Точният адрес и навигацията са достъпни през личните семейни покани.</p></div><div className="villa-info-cards">{publicInfo.arrivalTime&&<article><Clock3 size={20}/><h3>Пристигане</h3><p>{publicInfo.arrivalTime}</p></article>}{publicInfo.departureTime&&<article><Clock3 size={20}/><h3>Напускане</h3><p>{publicInfo.departureTime}</p></article>}{publicInfo.bringNotes&&<article><Camera size={20}/><h3>Какво да носим</h3><p>{publicInfo.bringNotes}</p></article>}</div></section>}
    <section className="villa-families-section villa-section" id="villa-company">
      <div className="villa-section-heading"><span className="villa-overline">КОМПАНИЯТА</span><h2>Кой ще е <em>част от празника?</em></h2><p>{guests.length || 14} поканени, четири групи. Потвържденията се събират чрез личните семейни покани.</p></div>
      <div className="villa-family-grid">{families.map((f,i) => <article key={f.id} className="villa-family-card"><span>0{i+1}</span><h3>{f.title}</h3><div>{f.members.map(m => <small key={m.id}>{m.child ? '✦ ' : ''}{m.name}{m.child ? ' · дете' : ''}</small>)}</div></article>)}</div>
    </section>

    <section className="villa-final-cta villa-section">
      <div><span className="villa-overline">НАПРАВЕНО ЗА НАШАТА КОМПАНИЯ</span><h2>Какво обичате <em>вие?</em></h2><p>AI организаторът ще те попита последователно за всеки човек от семейството. После ще съберем желанията на всички в един общ план.</p><button className="villa-btn-primary" onClick={onStart}>Започни семейния разговор <ArrowRight size={17}/></button></div>
      <div className="villa-final-side"><PartyPopper size={65}/><span>31.12 — 02.01</span><p>Планираме заедно. Празнуваме спокойно.</p></div>
    </section>
    <div className="villa-organizer-link"><button onClick={onAdmin}><LockKeyhole size={15}/> Контролен център за организатора</button></div>

    {mediaReady && modalIndex !== null && <div className="villa-lightbox" role="dialog" aria-modal="true" aria-label="Галерия на вилата" onTouchStart={e => setTouchX(e.touches[0].clientX)} onTouchEnd={e => {if(touchX === null)return;const delta=e.changedTouches[0].clientX-touchX;if(Math.abs(delta)>55)setModalIndex(i=>i===null?null:(i+(delta<0?1:photos.length-1))%photos.length);setTouchX(null);}}>
      <button className="villa-lightbox-close" aria-label="Затвори галерията" onClick={() => setModalIndex(null)}><X/></button>
      <button className="villa-lightbox-arrow" aria-label="Предишна" onClick={() => setModalIndex(i => i===null?null:(i-1+photos.length)%photos.length)}><ChevronLeft/></button>
      <figure><img src={photos[modalIndex].src} alt={photos[modalIndex].alt} onError={e=>{e.currentTarget.style.display='none';}}/><figcaption>{photos[modalIndex].title} <small>{modalIndex+1} / {photos.length}</small></figcaption></figure>
      <button className="villa-lightbox-arrow" aria-label="Следваща" onClick={() => setModalIndex(i=>i===null?null:(i+1)%photos.length)}><ChevronRight/></button>
    </div>}
  </main>;
}
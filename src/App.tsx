import { useEffect, useMemo, useRef, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import { Message } from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import './chat.css';
import { V3Planner, V3Admin } from './V3Planner';
import VillaLanding from './VillaLanding';
import V4Admin from './V4Admin';
import {
  ArrowRight,
  ArrowLeft,
  Mic,
  MicOff,
  Send,
  Volume2,
  Sparkles,
  Snowflake,
  Users,
  UtensilsCrossed,
  Wine,
  Heart,
  Check,
  ShieldCheck,
  ChevronDown,
  LogOut,
  ShoppingBasket,
  ClipboardList,
  Pencil,
  LoaderCircle,
  RefreshCw,
  CalendarDays,
  CheckCircle2,
  Download,
  PartyPopper,
  Menu,
  MapPin,
  X,
} from 'lucide-react';

type Guest = { id: string; name: string; group: string; child: boolean };
type Row = { step: string; answer: string; reply: string; nextQuestion?: string; normalizedStatus?: string; at: string };
type PersonStats = Guest & {
  answers: Record<string, string>;
  progress: number;
  total: number;
  status: string;
  complete: boolean;
};
type ShopItem = {
  name: string;
  category: string;
  amount: number;
  unit: string;
  bought: boolean;
};
type PartyPlan = {
  introduction: string;
  menu: string[];
  shopping: ShopItem[];
  assumptions: string;
  generatedAt: string;
};
type Summary = {
  people: PersonStats[];
  invited: number;
  confirmed: number;
  adults: number;
  children: number;
  completed: number;
  declined: number;
  maybe: number;
  missingNames: number;
  plan: PartyPlan | null;
};
type Screen = 'home' | 'family' | 'select' | 'chat' | 'done' | 'admin';
type Step = { id: string; q: string; tips: string[] };
const STEPS: Step[] = [
  {
    id: 'attendance',
    q: 'Ще празнуваме ли заедно в Троян?',
    tips: ['Идвам', 'Още не знам', 'Няма да мога'],
  },
  {
    id: 'dates',
    q: 'За кои дни планираш да бъдеш с компанията?',
    tips: ['Само на 31 декември', '31 декември и 1 януари', 'Още уточнявам'],
  },
  {
    id: 'food',
    q: 'Какво най-много ти се хапва на празничната трапеза?',
    tips: [
      'Скара',
      'Домашно готвено',
      'Пилешко',
      'Вегетарианско',
      'Пица / паста',
    ],
  },
  {
    id: 'restrictions',
    q: 'Има ли храни, които избягваш, или алергии, които трябва да предвидим?',
    tips: [
      'Нямам ограничения',
      'Не ям свинско',
      'Не ям месо',
      'Ще напиша подробно',
    ],
  },
  {
    id: 'salads',
    q: 'Кои салати, мезета или гарнитури ти харесват?',
    tips: ['Шопска салата', 'Руска салата', 'Картофки', 'Сирена', 'Туршия'],
  },
  {
    id: 'drinks',
    q: 'Какво предпочиташ за пиене? Ако искаш, кажи и ориентировъчно количество за целия престой.',
    tips: ['Без алкохол', 'Вино', 'Бира', 'Ракия', 'Вода и сок'],
  },
  {
    id: 'breakfast',
    q: 'А за закуска и нещо сладко какво би предпочел?',
    tips: ['Баница', 'Яйца', 'Мекици', 'Плодове', 'Шоколад / десерт'],
  },
  {
    id: 'bring',
    q: 'Можеш ли да приготвиш или донесеш нещо за общата трапеза?',
    tips: [
      'Ще пазарувам',
      'Мога да сготвя',
      'Ще донеса напитки',
      'Нека уточним после',
    ],
  },
  {
    id: 'ideas',
    q: 'Последно: имаш ли специално пожелание или идея за купона?',
    tips: ['Всичко е супер!', 'Искам музика и игри', 'Имам предложение'],
  },
];
const relevant = (g: Guest) =>
  STEPS.filter(s => !(g.child && (s.id === 'drinks' || s.id === 'bring')));
const initialSessionMap = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem('troian_sessions_v1') || '{}');
  } catch {
    return {};
  }
};
const getErr = (e: unknown) => {
  const obj = e as {
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };
  return (
    obj?.response?.data?.error ||
    obj?.response?.data?.message ||
    obj?.message ||
    'Възникна грешка. Опитай отново.'
  );
};

type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{transcript:string}>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: {error:string}) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechBrowser = Window & {
  SpeechRecognition?: new () => VoiceRecognition;
  webkitSpeechRecognition?: new () => VoiceRecognition;
};

function MountainScene() {
  return (
    <div className="mountain-scene" aria-hidden="true">
      <svg viewBox="0 0 900 350" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="mount" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#406357" />
            <stop offset="1" stopColor="#133d32" />
          </linearGradient>
        </defs>
        <circle cx="712" cy="83" r="42" fill="#ead4aa" opacity=".75" />
        <path
          d="M0 260 L130 90 L212 200 L332 42 L468 211 L554 102 L682 235 L801 115 L900 230 V350 H0Z"
          fill="url(#mount)"
          opacity=".82"
        />
        <path
          d="M0 300 L140 180 L252 273 L398 160 L515 285 L668 143 L797 269 L900 189 V350 H0Z"
          fill="#0e2b25"
          opacity=".88"
        />
        <path
          d="M0 330 L100 250 L185 314 L316 235 L449 337 L606 245 L752 319 L900 239 V350H0Z"
          fill="#08251e"
        />
        <g fill="#d8b982" opacity=".65">
          <circle cx="74" cy="49" r="2" />
          <circle cx="204" cy="19" r="1.5" />
          <circle cx="478" cy="81" r="2" />
          <circle cx="846" cy="50" r="2" />
        </g>
      </svg>
    </div>
  );
}
function Mark() {
  return (
    <div className="mark">
      <span className="mark-star">✦</span>
      <strong>T</strong>
      <small>NY</small>
    </div>
  );
}
function App() {
  const [screen, setScreen] = useState<Screen>(
    location.hash === '#admin' ? 'admin' : location.hash.startsWith('#invite=') ? 'family' : 'home'
  );
  const [roster, setRoster] = useState<Guest[]>([]);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [token, setToken] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [clarification, setClarification] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(
    null
  );
  const [authLoaded, setAuthLoaded] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<'overview' | 'guests' | 'menu' | 'shopping' | 'info'>(
    'overview'
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const speechRef = useRef<VoiceRecognition | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    api
      .get('/api/roster')
      .then(r => setRoster(r.data.guests))
      .catch(e => setErrorText(getErr(e)));
    auth
      .getUser()
      .then(u => setUser(u))
      .catch(() => {})
      .finally(() => setAuthLoaded(true));
  }, []);
  useEffect(() => {
    if (screen === 'admin' && user) loadAdmin();
  }, [screen, user]);
  useEffect(() => {
    const browser = window as SpeechBrowser;
    setVoiceSupported(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => { try { speechRef.current?.stop(); } catch { /* already stopped */ } };
  }, []);
  useEffect(() => {
    if (screen === 'chat') messageEndRef.current?.scrollIntoView({block:'end',behavior:'smooth'});
  }, [screen, index, rows, busy]);

  const stages = guest ? relevant(guest) : STEPS;
  const step = stages[index];
  const completedAnswers = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({ ...a, [r.step]: r.answer }),
        {} as Record<string, string>
      ),
    [rows]
  );
  const groups = useMemo(
    () => [...new Set(roster.map(p => p.group))],
    [roster]
  );
  const finished = guest ? completedAnswers.attendance === 'Няма да мога' || stages.every(s => !!completedAnswers[s.id]) : false;
  const previousStep = stages[index - 1];
  const previousRow = previousStep ? [...rows].reverse().find(r => r.step === previousStep.id) : undefined;
  const question = clarification || previousRow?.nextQuestion || step?.q || '';
  const greeting = guest?.id === 'evgeni' ? 'Генчо' : (guest?.name || 'приятелю');
  function startVoice() {
    if(listening){speechRef.current?.stop();setListening(false);return;}
    const browser = window as SpeechBrowser;
    const Speech = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if(!Speech){setErrorText('Диктовката не се поддържа тук. Отвори линка в Chrome или използвай клавиатурата.');return;}
    try {
      const rec=new Speech();
      speechRef.current=rec;
      rec.lang='bg-BG';rec.continuous=false;rec.interimResults=false;
      rec.onresult=(event)=>{
        const captured=event.results[event.results.length-1]?.[0]?.transcript?.trim()||'';
        if(captured)setInput(prev=>(prev ? prev+' ' : '')+captured);
      };
      rec.onerror=(event)=>{
        setListening(false);
        if(event.error !== 'no-speech' && event.error !== 'aborted') setErrorText('Микрофонът не е достъпен. Провери разрешението или използвай текста.');
      };
      rec.onend=()=>setListening(false);
      rec.start();setListening(true);
    } catch {setListening(false);setErrorText('Микрофонът не може да се използва в този браузър.');}
  }
  function readQuestion(){
    if(!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(question);
    utterance.lang='bg-BG';utterance.rate=1;
    window.speechSynthesis.speak(utterance);
  }

  function navigate(s: Screen) {
    setErrorText('');
    setScreen(s);
    if (s !== 'chat') { try { speechRef.current?.stop(); } catch { /* stopped */ } setListening(false); }
    location.hash = s === 'admin' ? 'admin' : '';
    window.scrollTo(0, 0);
  }
  async function choose(p: Guest) {
    setBusy(true);
    setErrorText('');
    try {
      const saved = initialSessionMap()[p.id];
      let nextToken = saved;
      let data: { guest: Guest; rows: Row[] } | null = null;
      if (saved) {
        try {
          const result = await api.post('/api/me', { token: saved });
          data = result.data;
        } catch {
          nextToken = '';
        }
      }
      if (!nextToken) {
        const joined = await api.post('/api/join', { personId: p.id });
        nextToken = joined.data.token;
        const map = initialSessionMap();
        map[p.id] = nextToken;
        localStorage.setItem('troian_sessions_v1', JSON.stringify(map));
      }
      const answers = data?.rows || [];
      const current = answers.reduce(
        (acc, r) => ({...acc,[r.step]:r.step==='attendance'?(r.normalizedStatus||r.answer):r.answer}),
        {} as Record<string,string>
      );
      const questions = relevant(p);
      const first = questions.findIndex(s => !current[s.id] || (s.id==='attendance' && !['Идвам','Още не знам','Няма да мога'].includes(current[s.id])));
      setGuest(p);
      setToken(nextToken);
      setRows(answers);
      setClarification('');
      setIndex(first < 0 ? questions.length : first);
      navigate(first < 0 || current.attendance === 'Няма да мога' ? 'done' : 'chat');
    } catch (e) {
      setErrorText(getErr(e));
    } finally {
      setBusy(false);
    }
  }
  async function send(value: string) {
    const answer = value.trim();
    if (!guest || !step || busy || !answer) return;
    setBusy(true);
    setErrorText('');
    try {
      // Existing V1 sessions were saved under a different database ID.
      // Recover transparently if a chat was left open before that fix.
      let res;
      try {
        res = await api.post('/api/reply', { token, step: step.id, answer });
      } catch (replyError) {
        const failure = getErr(replyError);
        const responseStatus = (replyError as { response?: { status?: number }; status?: number })?.response?.status;
        if (responseStatus !== 401 && !/Сесията е (изтекла|невалидна)/i.test(failure)) throw replyError;
        const recovered = await api.post('/api/join', { personId: guest.id });
        const replacementToken = recovered.data?.token as string;
        if (!replacementToken) throw new Error('Неуспешно възстановяване на сесията.');
        const map = initialSessionMap();
        map[guest.id] = replacementToken;
        localStorage.setItem('troian_sessions_v1', JSON.stringify(map));
        setToken(replacementToken);
        res = await api.post('/api/reply', { token: replacementToken, step: step.id, answer });
      }
      const updated = rows.filter(r => r.step !== step.id);
      updated.push({
        step: step.id,
        answer,
        reply: res.data.reply,
        nextQuestion: res.data.nextQuestion,
        normalizedStatus: res.data.normalizedStatus,
        at: new Date().toISOString(),
      });
      setRows(updated);
      setInput('');
      if(res.data.needsClarification){
        setClarification(res.data.nextQuestion || 'Ще бъдеш ли с нас?');
        return;
      }
      setClarification('');
      if (index + 1 >= stages.length || (step.id === 'attendance' && res.data.normalizedStatus === 'Няма да мога')) navigate('done');
      else setIndex(index + 1);
    } catch (e) {
      setErrorText(getErr(e));
    } finally {
      setBusy(false);
    }
  }
  async function loadAdmin() {
    setBusy(true);
    setErrorText('');
    try {
      const r = await api.get('/api/admin/summary');
      setSummary(r.data);
    } catch (e) {
      setErrorText(getErr(e));
    } finally {
      setBusy(false);
    }
  }
  async function generatePlan() {
    setBusy(true);
    setErrorText('');
    try {
      const r = await api.post('/api/admin/plan', {});
      setSummary(v => (v ? { ...v, plan: r.data.plan } : v));
      setTab('menu');
    } catch (e) {
      setErrorText(getErr(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggleItem(i: number, bought: boolean) {
    if (!summary?.plan) return;
    setBusy(true);
    try {
      const r = await api.post('/api/admin/item', { index: i, bought });
      setSummary(v =>
        v && v.plan
          ? { ...v, plan: { ...v.plan, shopping: r.data.shopping } }
          : v
      );
    } catch (e) {
      setErrorText(getErr(e));
    } finally {
      setBusy(false);
    }
  }
  async function rename(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    setErrorText('');
    try {
      await api.post('/api/admin/rename', { id, name: editName.trim() });
      setEditing(null);
      await loadAdmin();
      const r = await api.get('/api/roster');
      setRoster(r.data.guests);
    } catch (e) {
      setErrorText(getErr(e));
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    if (!summary?.plan) return;
    const rows = [
      ['Категория', 'Продукт', 'Количество', 'Единица', 'Купено'],
      ...summary.plan.shopping.map(i => [
        i.category,
        i.name,
        String(i.amount),
        i.unit,
        i.bought ? 'Да' : 'Не',
      ]),
    ];
    const csv =
      '\ufeff' +
      rows
        .map(r => r.map(x => '"' + x.replace(/"/g, '""') + '"').join(','))
        .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'troian-pazaruvane.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  const progress = guest
    ? Math.round(
        (Object.keys(completedAnswers).filter(k => stages.some(s => s.id === k))
          .length /
          stages.length) *
          100
      )
    : 0;
  return (
    <div className={screen === 'chat' ? 'app-shell in-chat' : 'app-shell'}>
      <header className="topbar">
        <div className="nav-inner">
          <button
            className="brand"
            onClick={() => navigate('home')}
            aria-label="Начало"
          >
            <Mark />
            <span>
              <strong>TROЯN</strong>
              <small>NEW YEAR • 2027</small>
            </span>
          </button>
          <nav className={mobileNav ? 'nav-links open' : 'nav-links'}>
            <button
              onClick={() => {
                navigate('home');
                setMobileNav(false);
              }}
            >
              Начало
            </button>
            <button
              onClick={() => {
                navigate('family');
                setMobileNav(false);
              }}
            >
              Участници
            </button>
            <button
              className="admin-nav"
              onClick={() => {
                navigate('admin');
                setMobileNav(false);
              }}
            >
              <ShieldCheck size={16} /> Организатор
            </button>
          </nav>
          <button
            className="mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Меню"
          >
            {mobileNav ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {errorText && (
        <div className="error-toast" role="alert">
          <span>{errorText}</span>
          <button onClick={() => setErrorText('')} aria-label="Затвори">
            ×
          </button>
        </div>
      )}
      {screen === 'home' && <VillaLanding onStart={() => navigate('family')} onAdmin={() => navigate('admin')} />}
      {screen === 'family' && <V3Planner onHome={() => navigate('home')} onAdmin={() => navigate('admin')} />}
      {screen === 'select' && (
        <main className="page-container">
          <div className="page-heading">
            <span className="section-kicker">ЗАПОЧВАМЕ ОТТУК</span>
            <h2>
              Кой си <em>ти?</em>
            </h2>
            <p>
              Избери името си. За децата въпросите се попълват от родител.
              Данните се запазват автоматично.
            </p>
          </div>
          <div className="group-grid">
            {groups.map(g => (
              <section className="group-card" key={g}>
                <h3>
                  <Users size={17} />
                  {g}
                </h3>
                <div className="member-list">
                  {roster
                    .filter(p => p.group === g)
                    .map(p => (
                      <button
                        key={p.id}
                        className="member"
                        disabled={busy}
                        onClick={() => choose(p)}
                      >
                        <span className={'avatar ' + (p.child ? 'child' : '')}>
                          {p.name.charAt(0)}
                        </span>
                        <span className="member-name">
                          {p.name}
                          <small>
                            {p.child ? 'Дете · попълва родител' : 'Възрастен'}
                          </small>
                        </span>
                        {initialSessionMap()[p.id] ? (
                          <span className="resume-chip">Продължи</span>
                        ) : null}
                        <ArrowRight size={17} />
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
          <p className="privacy-note">
            <ShieldCheck size={16} /> Отговорите са видими само за организатора.
            Не е нужна регистрация.
          </p>
        </main>
      )}

      {screen === 'chat' && guest && step && (
        <main className="conversation-page" aria-label="Разговор с празничния асистент">
          <div className="talk-topline">
            <button className="talk-back" onClick={() => navigate('select')} aria-label="Назад към участниците"><ArrowLeft size={18}/><span>Участници</span></button>
            <span className="talk-progress-label">{guest.child ? 'За дете · ' : ''}{index + 1} от {stages.length}</span>
          </div>
          <div className="talk-progress"><span style={{width: progress+'%'}}/></div>
          <section className="talk-shell">
            <header className="talk-header">
              <div className="talk-agent-icon"><Sparkles size={19}/></div>
              <div className="talk-header-text"><strong>Троянският организатор</strong><small><span className="status-dot"/> Твоят празничен AI помощник</small></div>
              <button className="talk-read" onClick={readQuestion} aria-label="Прочети въпроса на глас" title="Чуй въпроса"><Volume2 size={20}/></button>
            </header>
            <div className="talk-history" role="log" aria-live="polite" aria-relevant="additions">
              <div className="talk-day"><span>НОВА ГОДИНА В ТРОЯН · 2027</span></div>
              <div className="talk-welcome"><span>✦</span><div><strong>Здрасти, {greeting}!</strong><p>{guest.child ? 'Хайде да изберем какво ще е вкусно за малкия празнуващ.' : 'Аз ще помогна да измислим менюто и напитките за компанията. Просто ми отговаряй както си говорим.'}</p></div></div>
              {rows.filter(r=>stages.findIndex(s=>s.id===r.step)>=0 && stages.findIndex(s=>s.id===r.step)<index).map((r,i)=>{
                const n=stages.findIndex(s=>s.id===r.step);
                const prior=n>0?[...rows].reverse().find(x=>x.step===stages[n-1].id):undefined;
                return <div className="talk-turn" key={r.at+'-'+i}>
                  <Message model={{message:prior?.nextQuestion||stages[n]?.q||'',sentTime:'',sender:'Организатор',direction:'incoming',position:'single'}}/>
                  <Message model={{message:r.answer,sentTime:'',sender:guest.name,direction:'outgoing',position:'single'}}/>
                  {r.reply&&<div className="talk-ack">{r.reply}</div>}
                </div>;
              })}
              <div className="talk-current"><div className="talk-question">{question}</div><small>Може да напишеш или да кажеш отговора.</small></div>
              {busy&&<div className="talk-thinking"><span/><span/><span/> Записвам и обмислям...</div>}
              <div ref={messageEndRef}/>
            </div>
            <div className="talk-bottom">
              <div className="talk-quicklist" aria-label="Бързи отговори">
                {step.tips.map(t=><button key={t} disabled={busy} onClick={()=>send(t)}>{t}<ArrowRight size={12}/></button>)}
              </div>
              <div className="talk-composer">
                <label className="sr-only" htmlFor="party-answer">Твоят отговор</label>
                <textarea id="party-answer" rows={2} value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(input)}}}
                  placeholder={listening?'Слушам те...':'Напиши отговора си тук...'}
                  disabled={busy} maxLength={450} autoComplete="off" enterKeyHint="send"/>
                <button className={'talk-mic '+(listening?'listening':'')} type="button" onClick={startVoice} disabled={busy} aria-label={listening?'Спри диктовката':'Диктувай на български'} title={voiceSupported?'Диктувай на български':'Диктовката не се поддържа тук'}>{listening?<MicOff size={20}/>:<Mic size={20}/>}</button>
                <button className="talk-send" type="button" onClick={()=>send(input)} disabled={busy||!input.trim()} aria-label="Изпрати отговор"><Send size={19}/></button>
              </div>
              <div className="talk-footbar">
                <span><ShieldCheck size={13}/> Отговорът се запазва</span>
                {index>0?<button onClick={()=>{setInput('');setIndex(Math.max(0,index-1))}} disabled={busy}><ArrowLeft size={14}/> Предишен</button>:<span>Напредваме заедно ✦</span>}
              </div>
            </div>
          </section>
        </main>
      )}
      {screen === 'done' && guest && (
        <main className="page-container">
          <div className="done-panel">
            <div className="done-symbol">
              <PartyPopper size={35} />
            </div>
            <span className="section-kicker">ГОТОВО, БЛАГОДАРИМ ТИ!</span>
            <h2>
              {guest.name}, <em>ще бъде страхотно!</em>
            </h2>
            <p>
              {finished
                ? 'Отговорите ти са записани.'
                : 'Запазихме отговорите дотук.'}{' '}
              Ето какво знаем за предпочитанията ти:
            </p>
            <div className="review-list">
              {stages
                .filter(s => completedAnswers[s.id])
                .map(s => (
                  <div key={s.id}>
                    <small>{s.q}</small>
                    <strong>{completedAnswers[s.id]}</strong>
                  </div>
                ))}
            </div>
            <div className="done-actions">
              <button className="btn gold" onClick={() => navigate('family')}>
                Попълни за друг човек <Users size={17} />
              </button>
              <button
                className="btn outline"
                onClick={() => {
                  setIndex(0);
                  navigate('chat');
                }}
              >
                Прегледай и редактирай <Pencil size={16} />
              </button>
            </div>
          </div>
        </main>
      )}
      {screen === 'admin' && (
        <main className="page-container admin-container">
          <div className="page-heading">
            <span className="section-kicker">ТОЧНОТО МЯСТО ЗА ПЛАНА</span>
            <h2>
              Контролният <em>център.</em>
            </h2>
            <p>
              Всички отговори, менюто и списъкът за покупки — събрани на едно
              място.
            </p>
          </div>
          {!authLoaded ? (
            <div className="center-status">
              <LoaderCircle className="spin" /> Проверка на достъпа...
            </div>
          ) : !user ? (
            <div className="admin-login">
              <ShieldCheck size={32} />
              <h3>Само за организатора</h3>
              <p>
                За да защитим личните предпочитания, тук е нужен вход с Google
                акаунта на организатора.
              </p>
              <button
                className="btn gold"
                onClick={() =>
                  auth.signInWithRedirect().catch(e => setErrorText(getErr(e)))
                }
              >
                Вход за организатора <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <>
              <div className="admin-toolbar">
                <div className="signed-in">
                  <ShieldCheck size={18} />{' '}
                  {user.email || user.name || 'Вписан организатор'}
                </div>
                <div>
                  <button
                    className="icon-button"
                    onClick={loadAdmin}
                    disabled={busy}
                    title="Обнови"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() =>
                      auth.signOut().then(() => {
                        setUser(null);
                        setSummary(null);
                      })
                    }
                    title="Изход"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
              <div className="admin-tabs">
                {(
                  [
                    { id: 'overview', label: 'Обобщение', icon: ClipboardList },
                    { id: 'guests', label: 'Участници', icon: Users },
                    { id: 'menu', label: 'Меню', icon: UtensilsCrossed },
                    {
                      id: 'shopping',
                      label: 'Пазаруване',
                      icon: ShoppingBasket,
                    },
                    { id: 'info', label: 'Вилата', icon: MapPin },
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={tab === t.id ? 'active' : ''}
                  >
                    <t.icon size={16} />
                    {t.label}
                  </button>
                ))}
              </div>
              {busy && !summary && (
                <div className="center-status">
                  <LoaderCircle className="spin" /> Зареждане...
                </div>
              )}
              {tab === 'overview' && <V3Admin onGenerate={() => setTab('menu')}/>}
              {(tab === 'menu' || tab === 'shopping' || tab === 'info') && <V4Admin mode={tab}/>}
              {summary && (
                <div className="admin-content">
                  {tab === 'overview' && (
                    <>
                      <div className="stats-grid">
                        {[
                          { n: summary.invited, l: 'Поканени', icon: Users },
                          {
                            n: summary.confirmed,
                            l: 'Потвърдили',
                            icon: CheckCircle2,
                          },
                          {
                            n: summary.children,
                            l: 'Деца, потвърдили',
                            icon: Heart,
                          },
                          {
                            n: summary.completed,
                            l: 'Попълнени анкети',
                            icon: ClipboardList,
                          },
                        ].map(s => (
                          <article className="stat-card" key={s.l}>
                            <s.icon size={23} />
                            <strong>{s.n}</strong>
                            <small>{s.l}</small>
                          </article>
                        ))}
                      </div>
                      <div className="admin-note">
                        <Sparkles size={20} />
                        <div>
                          <strong>Празничният план започва тук</strong>
                          <p>
                            {summary.missingNames} детски имена за допълване ·{' '}
                            {summary.maybe} колебаещи се · {summary.declined}{' '}
                            отказали.
                          </p>
                        </div>
                      </div>
                      <div className="admin-row">
                        <div>
                          <h3>AI план за меню и покупки</h3>
                          <p>
                            Генерирай предложение от събраните отговори. Цените
                            и количествата остават ориентировъчни.
                          </p>
                        </div>
                        <button
                          className="btn gold"
                          onClick={generatePlan}
                          disabled={busy}
                        >
                          {busy ? 'Генерира се...' : 'Генерирай меню'}
                          <Sparkles size={17} />
                        </button>
                      </div>
                    </>
                  )}
                  {tab === 'guests' && (
                    <div className="table-card">
                      <div className="table-title">
                        <h3>Всички участници</h3>
                        <span>{summary.invited} поканени</span>
                      </div>
                      {summary.people.map(p => (
                        <div className="guest-admin-row" key={p.id}>
                          <div className={'avatar ' + (p.child ? 'child' : '')}>
                            {p.name.charAt(0)}
                          </div>
                          <div className="admin-guest-info">
                            {editing === p.id ? (
                              <div className="rename-form">
                                <input
                                  autoFocus
                                  value={editName}
                                  onChange={e => setEditName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') rename(p.id);
                                  }}
                                />
                                <button onClick={() => rename(p.id)}>
                                  Запази
                                </button>
                              </div>
                            ) : (
                              <>
                                <strong>{p.name}</strong>
                                <small>
                                  {p.group} · {p.child ? 'дете' : 'възрастен'} ·{' '}
                                  {p.progress}/{p.total} отговора
                                </small>
                              </>
                            )}
                          </div>
                          <span
                            className={
                              'status-pill ' +
                              (p.status === 'Идвам' ? 'yes' : '')
                            }
                          >
                            {p.status}
                          </span>
                          <button
                            className="mini-edit"
                            title="Редактирай името"
                            onClick={() => {
                              setEditing(p.id);
                              setEditName(p.name);
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
                      ))}
                      <p className="table-footnote">
                        Двете неизвестни детски имена могат да се попълнят с
                        иконата за редакция. Децата не отговарят самостоятелно.
                      </p>
                    </div>
                  )}
                  {false && tab === 'menu' && (
                    <>
                      <div className="admin-row">
                        <div>
                          <h3>Предложение за празничното меню</h3>
                          <p>AI анализира единствено потвърдените отговори.</p>
                        </div>
                        <button
                          className="btn gold"
                          onClick={generatePlan}
                          disabled={busy}
                        >
                          <Sparkles size={17} />
                          {busy ? 'Изчакване...' : 'Генерирай отговорите'}
                        </button>
                      </div>
                      {summary.plan ? (
                        <div className="menu-card">
                          <p className="menu-intro">
                            {summary.plan.introduction}
                          </p>
                          {summary.plan.menu.map((item, i) => (
                            <div className="menu-line" key={i}>
                              <span>{String(i + 1).padStart(2, '0')}</span>
                              {item}
                            </div>
                          ))}
                          <p className="assumptions">
                            {summary.plan.assumptions}
                          </p>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <UtensilsCrossed size={32} />
                          <p>
                            Още няма генерирано меню. Натисни бутона, за да
                            създадеш предложение.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {false && tab === 'shopping' && (
                    <>
                      <div className="admin-row">
                        <div>
                          <h3>Общ списък за пазаруване</h3>
                          <p>
                            Отбелязвай закупените продукти. Количествата са
                            ориентировъчни.
                          </p>
                        </div>
                        <button
                          className="btn outline"
                          onClick={exportCsv}
                          disabled={!summary.plan}
                        >
                          <Download size={17} /> Експорт CSV
                        </button>
                      </div>
                      {summary.plan ? (
                        <div className="shopping-card">
                          {summary.plan.shopping.map((it, i) => (
                            <label
                              key={i}
                              className={
                                'shop-row ' + (it.bought ? 'bought' : '')
                              }
                            >
                              <input
                                type="checkbox"
                                checked={it.bought}
                                onChange={e => toggleItem(i, e.target.checked)}
                                disabled={busy}
                              />
                              <span className="shop-label">
                                <strong>{it.name}</strong>
                                <small>{it.category}</small>
                              </span>
                              <span className="quantity">
                                {it.amount} {it.unit}
                              </span>
                            </label>
                          ))}
                          <div className="shop-footer">
                            {summary.plan.shopping.filter(i => i.bought).length}{' '}
                            от {summary.plan.shopping.length} продукта купени
                          </div>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <ShoppingBasket size={32} />
                          <p>
                            Генерирай меню, за да получиш списъка за пазаруване.
                          </p>
                          <button className="btn gold" onClick={generatePlan}>
                            Генерирай списък <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      )}
      <footer className="footer">
        <div>
          <Mark />
          <span>
            Нова година в Троян{' '}
            <small>НАПРАВЕНО С ЛЮБОВ ЗА НАШАТА КОМПАНИЯ</small>
          </span>
        </div>
        <p>31.12.2026 — 02.01.2027 · 2 нощувки / 3 дни</p>
      </footer>
    </div>
  );
}
export default App;

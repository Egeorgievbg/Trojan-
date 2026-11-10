import { randomUUID } from 'node:crypto';
import { v3Routes, mergeV3IntoPeople } from './v3';
import { v4Routes } from './v4';
import {
  router,
  json,
  error,
  db,
  ai,
  requireAuth,
  requireAdminEmailAllowlist,
} from '@appdeploy/sdk';

const ADMIN_EMAILS = ['genchoooo@gmail.com'];
type Guest = { id: string; name: string; group: string; child: boolean };
type Entry = {
  id?: string;
  token: string;
  personId: string;
  step: string;
  answer: string;
  reply: string;
  nextQuestion?: string;
  normalizedStatus?: string;
  at: string;
};
const BASE: Guest[] = [
  { id: 'evgeni', name: 'Евгени', group: 'Евгени и Илияна', child: false },
  { id: 'iliyana', name: 'Илияна', group: 'Евгени и Илияна', child: false },
  { id: 'ivelin', name: 'Ивелин', group: 'Евгени и Илияна', child: true },
  { id: 'vesko', name: 'Веско', group: 'Веско и Мария', child: false },
  { id: 'maria', name: 'Мария', group: 'Веско и Мария', child: false },
  { id: 'momchil', name: 'Момчил', group: 'Веско и Мария', child: true },
  { id: 'velina', name: 'Велина', group: 'Веско и Мария', child: true },
  { id: 'desi', name: 'Деси', group: 'Деси и Иванчо', child: false },
  { id: 'ivancho', name: 'Иванчо', group: 'Деси и Иванчо', child: false },
  {
    id: 'desi-child',
    name: 'Дете на Деси и Иванчо',
    group: 'Деси и Иванчо',
    child: true,
  },
  { id: 'nakata', name: 'Наката', group: 'Наката и Викито', child: false },
  { id: 'vikito', name: 'Викито', group: 'Наката и Викито', child: false },
  { id: 'magito', name: 'Магито', group: 'Наката и Викито', child: false },
  {
    id: 'magi-child',
    name: 'Синът на Магито',
    group: 'Наката и Викито',
    child: true,
  },
];
const STEPS = [
  'attendance',
  'dates',
  'food',
  'restrictions',
  'salads',
  'drinks',
  'breakfast',
  'bring',
  'ideas',
];
const now = () => new Date().toISOString();
const clean = (v: unknown, len = 450) =>
  typeof v === 'string' ? v.trim().slice(0, len) : '';

async function listAll<T extends Record<string, unknown>>(
  table: string,
  filter?: Record<string, unknown>
): Promise<(T & { id: string })[]> {
  const results: (T & { id: string })[] = [];
  let nextToken: string | undefined;
  for (let i = 0; i < 12; i++) {
    const page = await db.list<T>(table, {
      limit: 100,
      ...(filter ? { filter } : {}),
      ...(nextToken ? { nextToken } : {}),
    });
    results.push(...(page.items as (T & { id: string })[]));
    if (!page.nextToken) break;
    nextToken = page.nextToken;
  }
  return results;
}
async function roster(): Promise<Guest[]> {
  const overrides = await listAll<{ name: string }>('party_names');
  const map = new Map(overrides.map(r => [r.id, r.name]));
  return BASE.map(p => ({ ...p, name: map.get(p.id) || p.name }));
}
async function verify(token: unknown): Promise<{ personId: string } | null> {
  const t = clean(token, 120);
  if (!/^[a-f0-9-]{36}$/.test(t)) return null;
  const data = await db.get<{ personId: string }>('party_sessions', [t], {
    consistent: true,
  });
  return data[0] || null;
}
function normalizeAttendance(answer: string): string | null {
  const t=answer.toLocaleLowerCase('bg-BG').trim();
  if(t==='идвам')return 'Идвам';
  if(t==='още не знам')return 'Още не знам';
  if(t==='няма да мога')return 'Няма да мога';
  if(/не знам|не съм сигур|може би|колебая|колеба|ще видим|още уточня|ако успея|не е сигурно|вероятно/.test(t))return 'Още не знам';
  if(/няма да|не мога|не идвам|не дойда|няма как|отказвам|няма да съм/.test(t))return 'Няма да мога';
  if(/ще дойда|ще идвам|ще бъда|ще сме|идвам|брой ме|брои ме|разбира се|присъствам|участвам|да,|точно така/.test(t))return 'Идвам';
  return null;
}
function latest(rows: Entry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of [...rows].sort((a, b) => a.at.localeCompare(b.at)))
    result[row.step] = row.step === 'attendance'
      ? row.normalizedStatus || normalizeAttendance(row.answer) || 'Неуточнено'
      : row.answer;
  return result;
}
async function summaryData() {
  const [persons, rows] = await Promise.all([
    roster(),
    listAll<Entry>('party_answers'),
  ]);
  const grouped: Record<string, Entry[]> = {};
  for (const row of rows) (grouped[row.personId] ||= []).push(row);
  const people = persons.map(p => {
    const answers = latest(grouped[p.id] || []);
    const total = STEPS.length - (p.child ? 2 : 0);
    const progress = Object.keys(answers).filter(k => STEPS.includes(k)).length;
    return {
      ...p,
      answers,
      progress,
      total,
      complete: progress >= total,
      status: answers.attendance || 'Без отговор',
    };
  });
  await updateFamilySummary(people);
  await mergeV3IntoPeople(people);
  const confirmed = people.filter(p => p.status === 'Идвам');
  return {
    people,
    invited: people.length,
    confirmed: confirmed.length,
    children: confirmed.filter(p => p.child).length,
    adults: confirmed.filter(p => !p.child).length,
    completed: people.filter(p => p.complete).length,
    maybe: people.filter(p => p.status === 'Още не знам').length,
    declined: people.filter(p => p.status === 'Няма да мога').length,
    missingNames: people.filter(
      p =>
        ['desi-child', 'magi-child'].includes(p.id) &&
        p.name === BASE.find(b => b.id === p.id)?.name
    ).length,
  };
}
function starterPlan(people: Awaited<ReturnType<typeof summaryData>>) {
  const a = people.adults,
    c = people.children,
    n = a + c;
  const shopping = [
    {
      name: 'Месо за скара',
      category: 'Основни',
      amount: Number((a * 0.32 + c * 0.16).toFixed(2)),
      unit: 'кг',
      bought: false,
    },
    {
      name: 'Домати',
      category: 'Зеленчуци',
      amount: Number((n * 0.17).toFixed(2)),
      unit: 'кг',
      bought: false,
    },
    {
      name: 'Краставици',
      category: 'Зеленчуци',
      amount: Number((n * 0.12).toFixed(2)),
      unit: 'кг',
      bought: false,
    },
    {
      name: 'Сирене',
      category: 'Млечни',
      amount: Number((n * 0.08).toFixed(2)),
      unit: 'кг',
      bought: false,
    },
    {
      name: 'Картофи',
      category: 'Зеленчуци',
      amount: Number((n * 0.22).toFixed(2)),
      unit: 'кг',
      bought: false,
    },
    {
      name: 'Хляб',
      category: 'Тестени',
      amount: Math.ceil(n / 3),
      unit: 'бр.',
      bought: false,
    },
    {
      name: 'Минерална вода',
      category: 'Напитки',
      amount: Number((n * 1.5).toFixed(1)),
      unit: 'л',
      bought: false,
    },
    {
      name: 'Сок / безалкохолни',
      category: 'Напитки',
      amount: Number((n * 0.5).toFixed(1)),
      unit: 'л',
      bought: false,
    },
  ];
  return {
    introduction:
      'Начално ориентировъчно предложение за една вечеря. Променете количествата след потвържденията и избора на рецепти.',
    menu: [
      'Шопска салата и разядки',
      'Скара с картофена гарнитура',
      'Плодове и десерт',
      'Отделна детска порция според предпочитанията',
    ],
    shopping,
    assumptions:
      'За една вечеря, с базови примерни порции. Алкохол не е включен без изрично потвърдени количества.',
    generatedAt: now(),
  };
}
async function savePlan(plan: Record<string, unknown>) {
  // Stable chosen ID is needed for reading and updating the plan later.
  const item = { ...plan, id: 'current' };
  const inserted = await db.tx.add('party_plan', [item]);
  if (!inserted[0]) {
    const patched = await db.tx.update('party_plan', [{ id: 'current', record: item }], { patch: true });
    if (!patched[0]) throw new Error('Неуспешно запазване на плана.');
  }
}
type FamilyValue = {
  selected: string[];
  notes: string;
  perPerson: Record<string,string[]>;
  personNotes: Record<string,string>;
  statuses: Record<string,string>;
  days: string[];
};
type FamilyRow = { id:string; householdId:string; section:string; value:FamilyValue; updatedAt:string };
const HOUSEHOLDS = [
  {id:'family-evgeni',title:'Евгени, Илияна и Ивелин',ids:['evgeni','iliyana','ivelin']},
  {id:'family-vesko',title:'Веско, Мария и децата',ids:['vesko','maria','momchil','velina']},
  {id:'family-desi',title:'Деси, Иванчо и детето',ids:['desi','ivancho','desi-child']},
  {id:'family-nakata',title:'Наката, Викито, Магито и детето',ids:['nakata','vikito','magito','magi-child']}
];
const FAMILY_SECTIONS=['attendance','mains','salads','drinks','children','restrictions','breakfast','desserts','organization','fun','extras'];
function familyKey(householdId:string,section:string){return householdId+'_'+section;}
function familyMeta(householdId:string){return HOUSEHOLDS.find(h=>h.id===householdId);}
function safeList(value:unknown,max=15):string[]{
  if(!Array.isArray(value))return [];
  return [...new Set(value.filter(x=>typeof x==='string').map(x=>clean(x,90)).filter(Boolean))].slice(0,max);
}
function cleanFamilyValue(raw:unknown, householdId:string):FamilyValue {
  const r=(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}) as Record<string,unknown>;
  const ids=familyMeta(householdId)?.ids||[];
  const perPerson:Record<string,string[]>={};
  const personNotes:Record<string,string>={};
  const statuses:Record<string,string>={};
  const origPer=(r.perPerson&&typeof r.perPerson==='object'?r.perPerson:{}) as Record<string,unknown>;
  const origNotes=(r.personNotes&&typeof r.personNotes==='object'?r.personNotes:{}) as Record<string,unknown>;
  const origStatus=(r.statuses&&typeof r.statuses==='object'?r.statuses:{}) as Record<string,unknown>;
  for(const id of ids){
    perPerson[id]=safeList(origPer[id],12);
    personNotes[id]=clean(origNotes[id],320);
    if(['yes','maybe','no'].includes(String(origStatus[id])))statuses[id]=String(origStatus[id]);
  }
  return {selected:safeList(r.selected,18),notes:clean(r.notes,900),perPerson,personNotes,statuses,days:safeList(r.days,4)};
}
async function getFamilyAnswers(householdId:string):Promise<Record<string,FamilyValue>> {
  const keys=FAMILY_SECTIONS.map(s=>familyKey(householdId,s));
  const items=await db.get<FamilyRow>('party_family_answers',keys,{consistent:true});
  const out:Record<string,FamilyValue>={};
  items.forEach((item,index)=>{if(item&&item.householdId===householdId&&item.section===FAMILY_SECTIONS[index])out[item.section]=item.value;});
  return out;
}
async function allFamilyAnswers(){
  const result:{id:string;title:string;ids:string[];answers:Record<string,FamilyValue>;completed:number}[]=[];
  for(const h of HOUSEHOLDS){
    const answers=await getFamilyAnswers(h.id);
    result.push({...h,answers,completed:Object.keys(answers).length});
  }
  return result;
}
async function familySession(token:unknown):Promise<{householdId:string}|null>{
  const id=clean(token,100);
  if(!/^[a-f0-9-]{36}$/.test(id))return null;
  const items=await db.get<{householdId:string}>('party_family_sessions',[id],{consistent:true});
  const session=items[0];
  return session&&familyMeta(session.householdId)?session:null;
}
async function updateFamilySummary(people:Array<{id:string;answers:Record<string,string>;progress:number;total:number;complete:boolean;status:string}>){
  const homes=await allFamilyAnswers();
  for(const home of homes){
    if(!home.completed)continue;
    const rsvp=home.answers.attendance;
    for(const memberId of home.ids){
      const p=people.find(x=>x.id===memberId);
      if(!p)continue;
      const status=rsvp?.statuses?.[memberId];
      if(status)p.answers.attendance=status==='yes'?'Идвам':status==='maybe'?'Още не знам':'Няма да мога';
      if(rsvp?.days?.length)p.answers.dates=rsvp.days.join(', ');
      for(const key of FAMILY_SECTIONS.filter(s=>s!=='attendance')){
        const data=home.answers[key];
        if(!data)continue;
        const own=(data.perPerson?.[memberId]||[]).join(', ');
        const note=data.personNotes?.[memberId]||'';
        const common=(key==='drinks'||key==='children'||key==='restrictions')?'':data.selected.join(', ');
        const combined=[common,own,note,data.notes].filter(Boolean).join(' · ');
        if(combined)p.answers[key]=combined;
      }
      p.status=p.answers.attendance||'Без отговор';
      p.progress=home.completed;
      p.total=FAMILY_SECTIONS.length;
      p.complete=home.completed>=FAMILY_SECTIONS.length;
    }
  }
}

const admin = [requireAuth(), requireAdminEmailAllowlist(ADMIN_EMAILS)];

export const handler = router({
  ...v3Routes,
  ...v4Routes,
'GET /api/families': [async () => {
    const guests=await roster();
    return json({families:HOUSEHOLDS.map(h=>({...h,members:guests.filter(g=>h.ids.includes(g.id))})),sections:FAMILY_SECTIONS});
  }],
  'POST /api/family/join': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'POST /api/family/state': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'POST /api/family/save': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'POST /api/family/ask': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'POST /api/family/review': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'GET /api/admin/families': [...admin,async () => {
    const people=await roster();
    const families=await allFamilyAnswers();
    return json({families:families.map(f=>({...f,members:people.filter(p=>f.ids.includes(p.id))})),totalSections:FAMILY_SECTIONS.length});
  }],
  'GET /api/roster': [
    async () =>
      json({
        guests: await roster(),
        event: { title: 'Нова година в Троян', year: '2027' },
      }),
  ],
  'POST /api/join': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'POST /api/me': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'POST /api/reply': [async () => error('Маршрутът е заменен с V3. Използвай семейната покана.', 410)],
  'GET /api/admin/summary': [
    ...admin,
    async () => {
      const stats = await summaryData();
      const plan = await db.get<Record<string, unknown>>('party_plan', [
        'current',
      ]);
      return json({ ...stats, plan: plan[0] || null });
    },
  ],
  'POST /api/admin/rename': [
    ...admin,
    async ({ body }) => {
      const b = (body || {}) as Record<string, unknown>;
      const id = clean(b.id, 50),
        name = clean(b.name, 65);
      if (!BASE.some(p => p.id === id) || name.length < 2)
        return error('Невалидно име.', 400);
      const record = { id, name };
      const added = await db.tx.add('party_names', [record]);
      if (!added[0]) {
        const patched = await db.tx.update('party_names', [{ id, record }], { patch: true });
        if (!patched[0]) return error('Неуспешно запазване на името.', 500);
      }
      return json({ ok: true });
    },
  ],
  'POST /api/admin/plan': [
    ...admin,
    async () => {
      const stats = await summaryData();
      const baseline = starterPlan(stats);
      if (stats.confirmed === 0)
        return json({
          plan: baseline,
          notice:
            'Няма потвърдили участници. Показваме примерен шаблон, без да го записваме като окончателен.',
        });
      const confirmed = stats.people
        .filter(p => p.status === 'Идвам')
        .map(p => ({category:p.child?'дете':'възрастен',preferences:p.answers}));
      // Individual preferences have already been normalized into stats.people.
      let plan = baseline;
      try {
        const result = await ai.generate({
          system:
            'Български кулинарен организатор. Върни САМО валиден JSON обект с ключове introduction (string), menu (array от 3-7 кратки string), shopping (array до 18 обекта {name:string, category:string, amount:number, unit:string, bought:false}), assumptions (string). Ползвай само обобщени предпочитания. Алергиите са ограничения: не твърди, че дадена храна е безопасна. Количествата са ориентировъчни за ЕДНА празнична вечеря. Напитките с алкохол добавяй само при изрично посочени количества, иначе не добавяй. Няма нужда от имена и лични детайли.',
          prompt:
            'Възрастни: ' +
            stats.adults +
            ', деца: ' +
            stats.children +
            '. Отговори: ' +
            JSON.stringify({people:confirmed}).slice(0, 6500),
          schema:{
            type:'object',
            properties:{
              introduction:{type:'string'},
              menu:{type:'array',items:{type:'string'}},
              shopping:{type:'array',items:{type:'object',properties:{
                name:{type:'string'},category:{type:'string'},
                amount:{type:'number'},unit:{type:'string'},bought:{type:'boolean'}
              },required:['name','category','amount','unit','bought']}},
              assumptions:{type:'string'}
            },
            required:['introduction','menu','shopping','assumptions']
          },
          maxTokens: 1700,
          thinkingMode: 'FAST',
        });
        const raw = result.text
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/, '')
          .trim();
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (Array.isArray(parsed.menu) && Array.isArray(parsed.shopping)) {
          const shopping = parsed.shopping
            .slice(0, 20)
            .filter(
              (x): x is Record<string, unknown> =>
                typeof x === 'object' && x !== null
            )
            .map(x => ({
              name: clean(x.name, 90),
              category: clean(x.category, 40),
              amount: Math.max(0, Number(x.amount) || 0),
              unit: clean(x.unit, 12),
              bought: false,
            }))
            .filter(x => x.name && x.unit && x.amount);
          if (shopping.length)
            plan = {
              introduction:
                clean(parsed.introduction, 450) || baseline.introduction,
              menu: parsed.menu
                .slice(0, 8)
                .map(v => clean(v, 130))
                .filter(Boolean),
              shopping,
              assumptions:
                clean(parsed.assumptions, 350) || baseline.assumptions,
              generatedAt: now(),
            };
        }
      } catch (e) {
        console.warn('Plan AI fallback', String(e));
      }
      const previousPlan=await db.get<{shopping?:Array<{name:string;unit:string;bought:boolean}>}>('party_plan',['current'],{consistent:true});
      const alreadyBought=new Set((previousPlan[0]?.shopping||[]).filter(i=>i.bought).map(i=>i.name.toLocaleLowerCase('bg-BG').trim()+'|'+i.unit));
      plan.shopping=plan.shopping.map(i=>({...i,bought:alreadyBought.has(i.name.toLocaleLowerCase('bg-BG').trim()+'|'+i.unit)}));
      await savePlan(plan);
      return json({
        plan,
        notice:
          'Предложението е ориентировъчно и подлежи на преглед от организатора.',
      });
    },
  ],
  'POST /api/admin/item': [
    ...admin,
    async ({ body }) => {
      const b = (body || {}) as Record<string, unknown>;
      const index = Number(b.index),
        bought = b.bought === true;
      const rows = await db.get<Record<string, unknown>>(
        'party_plan',
        ['current'],
        { consistent: true }
      );
      const plan = rows[0];
      if (
        !plan ||
        !Array.isArray(plan.shopping) ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= plan.shopping.length
      )
        return error('Няма такъв продукт.', 400);
      const shopping = [...plan.shopping];
      shopping[index] = { ...shopping[index], bought };
      await db.update('party_plan', [
        { id: 'current', record: { ...plan, shopping } },
      ]);
      return json({ ok: true, shopping });
    },
  ],
});

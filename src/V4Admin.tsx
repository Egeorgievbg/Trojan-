import { useEffect, useState } from 'react';
import { api } from '@appdeploy/client';
import { Check, Download, RefreshCw, Save } from 'lucide-react';
import './v4-admin.css';

type Selection={recipeId:string;portions:number};
type Slot={id:string;date:string;dayLabel:string;meal:string;adults:number;children:number;selections:Selection[];proposals:{id:string;name:string;votes:number}[]};
type Item={id:string;name:string;category:string;quantity:number;unit:string;assignedTo:string;bought:boolean;usedIn:string[]};
type Plan={approved:boolean;version:number;slots:Slot[];shopping:Item[];drinks:{name:string;people:number}[]};
type Info={address:string;arrivalTime:string;departureTime:string;navigationUrl:string;bringNotes:string;organizerNotes:string};
const empty:Info={address:'',arrivalTime:'',departureTime:'',navigationUrl:'',bringNotes:'',organizerNotes:''};
const err=(e:unknown)=>{const x=e as {message?:string;response?:{data?:{message?:string;error?:string}}};return x?.response?.data?.message||x?.response?.data?.error||x?.message||'Възникна грешка.';};

export default function V4Admin({mode}:{mode:'menu'|'shopping'|'info'}){
 const [plan,setPlan]=useState<Plan|null>(null);
 const [selection,setSelection]=useState<Record<string,Selection[]>>({});
 const [info,setInfo]=useState<Info>(empty);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 async function reload(){
  setBusy(true);setNotice('');
  try{
   const [p,v]=await Promise.all([api.get('/api/admin/v4/plan'),api.get('/api/admin/v4/info')]);
   const data=p.data as Plan;setPlan(data);
   setSelection(Object.fromEntries(data.slots.map(s=>[s.id,s.selections.map(x=>({...x}))])));
   setInfo({...empty,...v.data.info});
  }catch(e){setNotice(err(e));}finally{setBusy(false);}
 }
 useEffect(()=>{reload();},[]);
 function toggle(slot:Slot,id:string){
  setSelection(old=>{
   const list=old[slot.id]||[];
   return {...old,[slot.id]:list.some(x=>x.recipeId===id)?list.filter(x=>x.recipeId!==id):[...list,{recipeId:id,portions:Math.ceil(slot.adults+slot.children*.65)}]};
  });
 }
 async function savePlan(){
  setBusy(true);setNotice('');
  try{
   const r=await api.post('/api/admin/v4/plan',{selection,version:plan?.version||0});
   const next=r.data as Plan;setPlan(next);
   setSelection(Object.fromEntries(next.slots.map(s=>[s.id,s.selections.map(x=>({...x}))])));
   setNotice('Менюто е одобрено. Покупките са изчислени от рецептите и посочените порции.');
  }catch(e){setNotice(err(e));}finally{setBusy(false);}
 }
 async function saveItem(item:Item,bought:boolean,assignedTo:string){
  setBusy(true);setNotice('');
  try{
   await api.post('/api/admin/v4/purchase',{id:item.id,bought,assignedTo});
   setPlan(old=>old?{...old,shopping:old.shopping.map(x=>x.id===item.id?{...x,bought,assignedTo}:x)}:old);
  }catch(e){setNotice(err(e));}finally{setBusy(false);}
 }
 async function saveInfo(){
  setBusy(true);setNotice('');
  try{const r=await api.post('/api/admin/v4/info',info);setInfo({...empty,...r.data.info});setNotice('Информацията за вилата е запазена.');}
  catch(e){setNotice(err(e));}finally{setBusy(false);}
 }
 function exportCsv(){
  if(!plan)return;
  const rows=[['Категория','Продукт','Количество','Единица','Купено','Отговорник'],...plan.shopping.map(x=>[x.category,x.name,String(x.quantity),x.unit,x.bought?'Да':'Не',x.assignedTo])];
  const content='\ufeff'+rows.map(r=>r.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=blob;a.download='troian-shopping-3days.csv';a.click();URL.revokeObjectURL(blob);
 }
 return <section className="v4-admin">
  <div className="v4-admin-head"><div><small>31 ДЕКЕМВРИ — 2 ЯНУАРИ · 2 НОЩУВКИ</small><h2>{mode==='menu'?'Меню по дни':mode==='shopping'?'Общо пазаруване':'Детайли за вилата'}</h2></div><button onClick={reload} disabled={busy}><RefreshCw size={16}/> Обнови</button></div>
  {notice&&<div className="v4-admin-alert" role="status">{notice}</div>}
  {!plan&&<p>Зареждане...</p>}
  {plan&&mode==='menu'&&<>
   <p className="v4-admin-help">{plan.approved?'Менюто е одобрено. Можеш да коригираш порциите.':'Предварителен план: предложенията не са одобрени, докато не натиснеш Запази менюто.'}</p>
   <div className="v4-day-list">{plan.slots.map(s=><article key={s.id} className="v4-day">
    <div className="v4-day-title"><div><small>{s.dayLabel} · {s.date}</small><h3>{s.meal}</h3></div><span>{s.adults} възрастни · {s.children} деца</span></div>
    <div className="v4-day-recipes">{s.proposals.map(r=>{
     const chosen=(selection[s.id]||[]).find(x=>x.recipeId===r.id);
     return <div key={r.id} className={'v4-day-recipe '+(chosen?'active':'')}>
      <button onClick={()=>toggle(s,r.id)}><span>{chosen?<Check size={14}/>:null}</span><strong>{r.name}</strong>{r.votes>0&&<small>{r.votes} гласа</small>}</button>
      {chosen&&<label>Порции<input aria-label={'Порции '+r.name} type="number" min={0} max={90} value={chosen.portions} onChange={e=>setSelection(prev=>({...prev,[s.id]:(prev[s.id]||[]).map(x=>x.recipeId===r.id?{...x,portions:Math.min(90,Math.max(0,Number(e.target.value)||0))}:x)}))}/></label>}
     </div>;
    })}</div>
    {s.adults+s.children===0&&<p className="v4-no-attendance">Няма потвърдени участници за този ден — не добавяй порции без проверка.</p>}
   </article>)}</div>
   <div className="v4-admin-end"><p>Количествата са ориентировъчни и не гарантират безопасност при хранителни алергии. Не се добавя алкохол автоматично.</p><button className="v4-affirm" onClick={savePlan} disabled={busy}><Save size={17}/> {plan.approved?'Запази промените':'Одобри менюто'}</button></div>
   <div className="v4-drinks"><h3>Предпочитани напитки</h3><p>Брой хора, не количество за покупка.</p><div>{plan.drinks.map(x=><span key={x.name}>{x.name} · {x.people}</span>)}{plan.drinks.length===0&&<small>Няма подадени предпочитания.</small>}</div></div>
  </>}
  {plan&&mode==='shopping'&&(!plan.approved?<div className="v4-admin-alert">Първо одобри ястията и порциите в раздел „Меню“.</div>:<>
   <div className="v4-shop-head"><strong>{plan.shopping.filter(x=>x.bought).length} / {plan.shopping.length}</strong> закупени продукти <button onClick={exportCsv}><Download size={16}/> CSV</button></div>
   <div>{plan.shopping.map(item=><div key={item.id} className="v4-shop-row">
    <input type="checkbox" checked={item.bought} disabled={busy} onChange={e=>saveItem(item,e.target.checked,item.assignedTo)} aria-label={'Купен '+item.name}/>
    <div><strong>{item.name}</strong><small>{item.category}</small><details><summary>Използва се за</summary>{item.usedIn.map(x=><p key={x}>{x}</p>)}</details></div>
    <strong>{item.quantity} {item.unit}</strong>
    <input className="v4-owner" defaultValue={item.assignedTo} placeholder="Кой купува?" onBlur={e=>{if(e.target.value!==item.assignedTo)saveItem(item,item.bought,e.target.value)}}/>
   </div>)}</div>
  </>)}
  {mode==='info'&&<div className="v4-settings">
   <label>Точен адрес<input value={info.address} onChange={e=>setInfo(p=>({...p,address:e.target.value}))} placeholder="Попълни потвърден адрес"/></label>
   <label>Навигационен линк (HTTPS)<input value={info.navigationUrl} onChange={e=>setInfo(p=>({...p,navigationUrl:e.target.value}))} placeholder="https://..."/></label>
   <label>Настаняване<input value={info.arrivalTime} onChange={e=>setInfo(p=>({...p,arrivalTime:e.target.value}))} placeholder="Час и инструкции"/></label>
   <label>Освобождаване<input value={info.departureTime} onChange={e=>setInfo(p=>({...p,departureTime:e.target.value}))} placeholder="Час и инструкции"/></label>
   <label>Какво да носим<textarea rows={3} value={info.bringNotes} onChange={e=>setInfo(p=>({...p,bringNotes:e.target.value}))}/></label>
   <label>Други указания<textarea rows={3} value={info.organizerNotes} onChange={e=>setInfo(p=>({...p,organizerNotes:e.target.value}))}/></label>
   <button className="v4-affirm" onClick={saveInfo} disabled={busy}><Save size={17}/> Запази информацията</button>
  </div>}
 </section>;
}
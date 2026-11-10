/**
 * Transitional Vercel client. Requests remain on this origin and are forwarded
 * server-side to the existing AppDeploy API by vercel.json.
 * Do not treat this as a full backend/data migration.
 */
type ApiResult<T = any> = {data:T};
type HttpMethod = 'GET' | 'POST';
async function request<T = any>(method:HttpMethod, path:string, data?:unknown):Promise<ApiResult<T>>{
 if(!path.startsWith('/api/'))throw new Error('Unexpected API path');
 let response:Response;
 try{
  response=await fetch(path,{method,credentials:'same-origin',headers:{'Accept':'application/json','Content-Type':'application/json'},body:method==='POST'?JSON.stringify(data??{}):undefined});
 }catch{
  throw new Error('Няма връзка със сървъра. Опитай отново.');
 }
 const payload=await response.json().catch(()=>({message:'Невалиден отговор от сървъра.'}));
 if(!response.ok){
  const message=payload?.message||payload?.error||('HTTP '+response.status);
  throw Object.assign(new Error(message),{response:{status:response.status,data:payload}});
 }
 return {data:payload as T};
}
export const api={
 get:<T = any>(path:string)=>request<T>('GET',path),
 post:<T = any>(path:string,body?:unknown)=>request<T>('POST',path,body)
};
const adminSite='https://2027-9haq3i.v2.appdeploy.ai/#admin';
/** Organizer identity is still provided by AppDeploy during this transitional deployment. */
export const auth={
 getUser:async():Promise<{email?:string;name?:string}|null>=>null,
 signInWithRedirect:async()=>{window.location.assign(adminSite);},
 signOut:async()=>{}
};

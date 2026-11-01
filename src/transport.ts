const endpoint='https://segfhjlieiuiukapqaam.supabase.co/functions/v1/exam';
const key='qingjuan-session-v2';
export function rememberSession(token:string){sessionStorage.setItem(key,token)}
export function clearSession(){sessionStorage.removeItem(key)}
export function apiFetch(init:RequestInit={}){
 const headers=new Headers(init.headers);const token=sessionStorage.getItem(key);
 if(token)headers.set('x-session-token',token);
 return fetch(endpoint,{...init,headers});
}

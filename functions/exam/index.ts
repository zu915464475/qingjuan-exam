import postgres from 'npm:postgres@3.4.7';
import {validateQuestion,sample,grade,publicQuestion, type Question} from './exam.ts';
const pool = postgres(Deno.env.get('SUPABASE_DB_URL')!, {prepare:false,max:1,idle_timeout:20,connect_timeout:15,types:{bigint:{to:20,from:[20],serialize:String,parse:Number}}});
const allowedOrigins = new Set(['https://zu915464475.github.io','http://localhost:5175','http://127.0.0.1:5175']);
Deno.serve(async (req:Request) => {
 const origin=req.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://zu915464475.github.io','Vary':'Origin','Access-Control-Allow-Headers':'content-type,x-session-token,apikey','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store'};
 if(origin&&!allowedOrigins.has(origin))return Response.json({error:'请求来源无效'},{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','POST'].includes(req.method))return Response.json({error:'请求方法不支持'},{status:405,headers:cors});
 try {
 const response=await pool.begin(async(sql:any)=>{
 await sql.unsafe('SET LOCAL search_path TO qingjuan, pg_catalog');
 const prepare=(query:string)=>{
  let args:any[]=[];
  const exec=()=>{let n=0;return sql.unsafe(query.replace(/\?/g,()=>'$'+(++n)),args)};
  const stmt={bind:(...values:any[])=>{args=values;return stmt},all:async()=>({results:await exec()}),first:async()=>(await exec())[0]||null,run:async()=>{const rows=await exec();return {meta:{changes:rows.count}}}};
  return stmt;
 };
 const db=()=>({prepare,batch:async(stmts:any[])=>{for(const s of stmts)await s.run()}});
const now=()=>Date.now();
const all=async(sql:string,...args:any[])=> (await db().prepare(sql).bind(...args).all()).results as any[];
const one=async(sql:string,...args:any[])=>await db().prepare(sql).bind(...args).first() as any;
const run=async(sql:string,...args:any[])=>await db().prepare(sql).bind(...args).run();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function password(p:string,salt=crypto.randomUUID()){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return salt+':'+hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256));}
const json=(v:any,status=200)=>Response.json(v,{status,headers:cors});
async function user(req:Request){const token=req.headers.get('x-session-token');return token?await one('SELECT u.id,u.name,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires>?',await hash(token),now()):null;}
function cleanAnswers(value:any,qs:Question[]){if(!value||typeof value!=='object'||Array.isArray(value))throw Error('答案格式不正确');const result:Record<string,number[]>={};for(const q of qs){const a=value[q.id]||[];if(!Array.isArray(a)||a.length>q.options.length||new Set(a).size!==a.length||a.some(n=>!Number.isInteger(n)||n<0||n>=q.options.length)||(q.type!=='multiple'&&a.length>1))throw Error('答案选项不正确');result[q.id]=a;}return result;}
async function finish(a:any,answers:any){const qs=JSON.parse(a.snapshot).questions;await run('UPDATE attempts SET answers=?,score=?,submitted=? WHERE id=? AND submitted IS NULL',JSON.stringify(answers),grade(qs,answers),now(),a.id);return await one('SELECT * FROM attempts WHERE id=? FOR UPDATE',a.id);}
async function visibleAttempt(a:any){if(!a.submitted&&now()>=a.deadline)a=await finish(a,JSON.parse(a.answers));const snap=JSON.parse(a.snapshot);return {...a,snapshot:{...snap,questions:a.submitted?snap.questions:snap.questions.map(publicQuestion)},answers:JSON.parse(a.answers)};}
async function GET(req:Request){try{const u=await user(req);if(!u)return json({user:null,setup:false});const exams=await all('SELECT * FROM exams ORDER BY created DESC');const records=await all(u.role==='teacher'?'SELECT a.*,u.name FROM attempts a JOIN users u ON u.id=a.user_id ORDER BY a.started DESC LIMIT 300':'SELECT a.*,u.name FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.user_id=? ORDER BY a.started DESC LIMIT 100',...(u.role==='teacher'?[]:[u.id]));const history=[];for(let a of records){if(!a.submitted&&now()>=a.deadline)a={...await finish(a,JSON.parse(a.answers)),name:a.name};const snap=JSON.parse(a.snapshot);history.push({id:a.id,name:a.name,title:snap.title,count:snap.questions.length,score:a.score,submitted:a.submitted,started:a.started,deadline:a.deadline});}return json({user:u,questions:u.role==='teacher'?(await all('SELECT body FROM questions ORDER BY created DESC')).map(q=>JSON.parse(q.body)):[],exams:exams.filter(e=>u.role==='teacher'||e.active).map(e=>({...JSON.parse(e.body),active:!!e.active})),history});}catch{return json({error:'读取失败，请检查数据库连接'},500)}}
async function POST(req:Request){try{
  const origin=req.headers.get('origin');if(!origin||!allowedOrigins.has(origin))return json({error:'请求来源无效'},403);
  const raw=await req.text();if(raw.length>1000000)return json({error:'提交内容过大'},413);const v=JSON.parse(raw),action=v.action;const u=await user(req);
  if(['login','register','setup'].includes(action)){
    const name=String(v.name||'').trim(),p=String(v.password||'');if(!/^[\p{L}\p{N}_@.\- ]{2,40}$/u.test(name)||p.length<8||p.length>128)throw Error('用户名需 2–40 字；密码需 8–128 位');
    await all('SELECT pg_advisory_xact_lock(hashtext(?))','auth:'+name);const limitId=await hash(name);const limit=await one('SELECT * FROM auth_limits WHERE id=?',limitId);if(limit&&limit.until>now()&&limit.count>=8)return json({error:'尝试次数过多，请 15 分钟后重试'},429);
    await run('INSERT INTO auth_limits(id,count,until) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN auth_limits.until<? THEN 1 ELSE auth_limits.count+1 END,until=CASE WHEN auth_limits.until<? THEN excluded.until ELSE auth_limits.until END',limitId,now()+900000,now(),now());
    if(action==='setup')return json({error:'教师账号已迁移，请使用原账号登录'},403);
    if(action==='register'){if(!await one("SELECT id FROM users WHERE role='teacher' LIMIT 1"))throw Error('请先由教师初始化网站');await run("INSERT INTO users(id,name,password,role) VALUES(?,?,?,'student')",crypto.randomUUID(),name,await password(p));}
    const found=await one('SELECT * FROM users WHERE name=?',name);if(!found||await password(p,found.password.split(':')[0])!==found.password)return json({error:'用户名或密码不正确'},401);
    const token=crypto.randomUUID()+crypto.randomUUID();await run('INSERT INTO sessions(id,user_id,expires) VALUES(?,?,?)',await hash(token),found.id,now()+86400000);await run('DELETE FROM auth_limits WHERE id=?',limitId);return json({ok:true,token});
  }
  if(!u)return json({error:'请先登录'},401);
  if(action==='logout'){const token=req.headers.get('x-session-token');if(token)await run('DELETE FROM sessions WHERE id=?',await hash(token));return json({ok:true});}
  if(['saveQuestion','deleteQuestion','import','createExam','toggleExam'].includes(action)&&u.role!=='teacher')return json({error:'仅教师可进行此操作'},403);
  if(action==='saveQuestion'){const q=validateQuestion(v.question);await run('INSERT INTO questions(id,body,created) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body',q.id,JSON.stringify(q),now());return json({ok:true});}
  if(action==='deleteQuestion'){await run('DELETE FROM questions WHERE id=?',v.id);return json({ok:true});}
  if(action==='import'){if(!Array.isArray(v.questions)||!v.questions.length||v.questions.length>100)throw Error('每次可导入 1–100 道题');const qs=v.questions.map((q:any)=>validateQuestion({...q,id:crypto.randomUUID()}));await db().batch(qs.map((q:Question)=>db().prepare('INSERT INTO questions(id,body,created) VALUES(?,?,?)').bind(q.id,JSON.stringify(q),now())));return json({ok:true});}
  if(action==='createExam'){const title=String(v.title||'').trim();if(!title||title.length>100||!Number.isInteger(v.count)||v.count<1||v.count>100||!Number.isInteger(v.minutes)||v.minutes<1||v.minutes>180)throw Error('请填写标题、1–100 道题及 1–180 分钟时长');const subject=String(v.subject||'');const pool=(await all('SELECT body FROM questions')).map(q=>JSON.parse(q.body)).filter(q=>!subject||q.subject===subject);if(pool.length<v.count)throw Error(`该范围仅有 ${pool.length} 道题，请减少题数`);const exam={id:crypto.randomUUID(),title,count:v.count,minutes:v.minutes,subject};await run('INSERT INTO exams(id,body,active,created) VALUES(?,?,1,?)',exam.id,JSON.stringify(exam),now());return json({ok:true});}
  if(action==='toggleExam'){await run('UPDATE exams SET active=1-active WHERE id=?',v.id);return json({ok:true});}
  if(action==='start'){
    if(u.role!=='student')throw Error('请使用学生账号参加考试');await all('SELECT pg_advisory_xact_lock(hashtext(?))','start:'+u.id+':'+v.id);const e=await one('SELECT * FROM exams WHERE id=? AND active=1',v.id);if(!e)throw Error('考试已关闭');const previous=await one('SELECT * FROM attempts WHERE user_id=? AND exam_id=? AND submitted IS NULL ORDER BY started DESC LIMIT 1',u.id,v.id);if(previous&&previous.deadline>now())return json({attempt:await visibleAttempt(previous)});if(previous)await finish(previous,JSON.parse(previous.answers));
    const exam=JSON.parse(e.body),pool=(await all('SELECT body FROM questions')).map(q=>JSON.parse(q.body)).filter(q=>!exam.subject||q.subject===exam.subject);const qs=sample(pool,exam.count),id=crypto.randomUUID(),time=now();await run('INSERT INTO attempts(id,user_id,exam_id,snapshot,answers,started,deadline) VALUES(?,?,?,?,?,?,?)',id,u.id,v.id,JSON.stringify({...exam,questions:qs}),'{}',time,time+exam.minutes*60000);return json({attempt:await visibleAttempt(await one('SELECT * FROM attempts WHERE id=? FOR UPDATE',id))});
  }
  if(['attempt','saveAnswers','submit'].includes(action)){let a=await one('SELECT * FROM attempts WHERE id=? FOR UPDATE',v.id);if(!a||(a.user_id!==u.id&&!(u.role==='teacher'&&action==='attempt')))return json({error:'无权访问该答卷'},403);
    if(action!=='attempt'&&!a.submitted){if(now()>=a.deadline)a=await finish(a,JSON.parse(a.answers));else{const answers=cleanAnswers(v.answers,JSON.parse(a.snapshot).questions);if(action==='submit')a=await finish(a,answers);else{await run('UPDATE attempts SET answers=? WHERE id=? AND submitted IS NULL',JSON.stringify(answers),a.id);a=await one('SELECT * FROM attempts WHERE id=? FOR UPDATE',a.id);}}}return json({attempt:await visibleAttempt(a)});}
  return json({error:'未知操作'},400);
}catch(e:any){if(e?.code)throw e;return json({error:e?.message||'请求格式不正确'},400)}}

 return req.method==='GET'?await GET(req):await POST(req);
 });
 return response;
 }catch(e:any){console.error('exam_error',e?.code||'request_failed');return Response.json({error:e?.code==='23505'?'用户名或记录已存在':'服务暂时不可用，请稍后重试'},{status:e?.code==='23505'?409:500,headers:cors});}
});

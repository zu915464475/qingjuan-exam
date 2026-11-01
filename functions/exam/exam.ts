export type Question = {id:string; stem:string; type:'single'|'multiple'|'boolean'; subject:string; difficulty:string; options:string[]; answer:number[]; explanation:string};
export function validateQuestion(v:any):Question {
  if(!v || typeof v.stem!=='string' || !v.stem.trim() || v.stem.length>8000) throw Error('请填写题干（最多 8000 字）');
  if(!['single','multiple','boolean'].includes(v.type)) throw Error('题型不正确');
  const options=v.type==='boolean'?['正确','错误']:v.options;
  if(!Array.isArray(options)||options.length<2||options.length>8||options.some((s:any)=>typeof s!=='string'||!s.trim()||s.length>2000)) throw Error('请填写 2–8 个有效选项');
  if(!Array.isArray(v.answer)||!v.answer.length||v.answer.some((n:any)=>!Number.isInteger(n)||n<0||n>=options.length)||new Set(v.answer).size!==v.answer.length||(v.type!=='multiple'&&v.answer.length!==1)) throw Error('请选择有效的正确答案');
  return {id:typeof v.id==='string'?v.id:crypto.randomUUID(),stem:v.stem.trim(),type:v.type,subject:String(v.subject||'通用').trim().slice(0,60)||'通用',difficulty:['简单','中等','困难'].includes(v.difficulty)?v.difficulty:'中等',options:options.map((s:string)=>s.trim()),answer:[...v.answer].sort(),explanation:String(v.explanation||'').slice(0,8000)};
}
export function sample<T>(pool:T[],count:number):T[]{
  if(!Number.isInteger(count)||count<1||count>pool.length) throw Error('符合条件的题目不足，请补充题库或减少题数');
  const a=[...pool]; for(let i=a.length-1;i>0;i--){const range=i+1,limit=Math.floor(4294967296/range)*range;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0]}while(n>=limit); const j=n%range;[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,count);
}
export function grade(questions:Question[],answers:Record<string,number[]>){return questions.reduce((score,q)=>score+(JSON.stringify([...(answers[q.id]||[])].sort())===JSON.stringify([...q.answer].sort())?1:0),0)}
export function publicQuestion(q:Question){const {answer,explanation,...safe}=q;return safe;}

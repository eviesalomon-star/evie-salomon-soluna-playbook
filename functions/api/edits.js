// Shared text edits for the playbook, stored in the D1 database bound as DB (see wrangler.toml).
const KEY_SHA256="f320f4c463ba09ada4ab95372423d734e8b66c467c26bb15f835b7466a16d8d1";
async function sha(t){ const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t||"")); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"content-type,x-pb-key","access-control-allow-methods":"GET,POST,OPTIONS"};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store",...CORS}});
async function init(env){ await env.DB.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)").run(); await env.DB.prepare("CREATE TABLE IF NOT EXISTS seen (origin TEXT PRIMARY KEY, n INTEGER, last INTEGER)").run(); }
async function load(env,k="edits"){ const r=await env.DB.prepare("SELECT v FROM kv WHERE k=?1").bind(k).first(); return r?JSON.parse(r.v):{}; }
async function store(env,o,k="edits"){ await env.DB.prepare("INSERT INTO kv (k,v) VALUES (?1,?2) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(k,JSON.stringify(o)).run(); }
export async function onRequest({request,env}){
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:CORS});
  if(!env.DB) return J({error:"not configured"},503);
  if(await sha(request.headers.get("x-pb-key"))!==KEY_SHA256) return J({error:"forbidden"},403);
  await init(env);
  const og=request.headers.get("origin")||"(same-site)"; await env.DB.prepare("INSERT INTO seen (origin,n,last) VALUES (?1,1,?2) ON CONFLICT(origin) DO UPDATE SET n=n+1,last=?2").bind(og.slice(0,200),Date.now()).run();
  if(new URL(request.url).searchParams.get("seen")) return J((await env.DB.prepare("SELECT * FROM seen").all()).results);
  const K=new URL(request.url).searchParams.get("k"); if(request.method==="GET"&&(K==="base"||K==="moves")) return J(await load(env,K));
  if(request.method==="GET") return J(await load(env));
  if(request.method==="POST"){
    let b; try{ b=await request.json(); }catch(e){ return J({error:"bad json"},400); }
    const all=await load(env);
    if(b.replaceAll){ await store(env,b.replaceAll); if(b.base) await store(env,b.base,"base"); return J({ok:true}); }
    if(b.reset){ await store(env,{}); await store(env,{},"moves"); return J({ok:true}); }
    if(b.move){ const {view,path,order,sig}=b; if(typeof view!=="string"||!/^p(_\d+)*$/.test(String(path))||!Array.isArray(order)) return J({error:"bad move"},400);
      const mv=await load(env,"moves"); mv[view]=mv[view]||{}; mv[view][path]={order:order.slice(0,1000).map(Number),sig:String(sig).slice(0,100),hide:Array.isArray(b.hide)?b.hide.slice(0,1000).map(Number):[],hideT:Array.isArray(b.hideT)?b.hideT.slice(0,200).map(x=>String(x).slice(0,240)):[],t:Date.now()}; await store(env,mv,"moves"); return J({ok:true}); }
    const {view,i,o,n,del}=b||{}; if(typeof view!=="string"||!/^\d+$/.test(String(i))) return J({error:"bad edit"},400);
    all[view]=all[view]||{};
    if(del||n===o) delete all[view][i]; else all[view][i]={o:String(o).slice(0,5000),n:String(n).slice(0,5000),t:Date.now()};
    await store(env,all); return J({ok:true});
  }
  return J({error:"method"},405);
}

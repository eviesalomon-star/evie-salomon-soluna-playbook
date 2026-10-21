// Shared text edits for the playbook. Needs a KV binding named EDITS in Cloudflare Pages settings.
const KEY_SHA256="f320f4c463ba09ada4ab95372423d734e8b66c467c26bb15f835b7466a16d8d1";
async function sha(t){ const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t||"")); return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,"0")).join(""); }
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function load(env){ const t=await env.EDITS.get("edits"); return t?JSON.parse(t):{}; }
export async function onRequest({request,env}){
  if(!env.EDITS) return J({error:"not configured"},503);
  if(await sha(request.headers.get("x-pb-key"))!==KEY_SHA256) return J({error:"forbidden"},403);
  if(request.method==="GET") return J(await load(env));
  if(request.method==="POST"){
    let b; try{ b=await request.json(); }catch(e){ return J({error:"bad json"},400); }
    const all=await load(env);
    if(b.reset){ await env.EDITS.put("edits","{}"); return J({ok:true}); }
    const {view,i,o,n,del}=b||{}; if(typeof view!=="string"||!/^\d+$/.test(String(i))) return J({error:"bad edit"},400);
    all[view]=all[view]||{};
    if(del||n===o) delete all[view][i]; else all[view][i]={o:String(o).slice(0,5000),n:String(n).slice(0,5000),t:Date.now()};
    await env.EDITS.put("edits",JSON.stringify(all)); return J({ok:true});
  }
  return J({error:"method"},405);
}

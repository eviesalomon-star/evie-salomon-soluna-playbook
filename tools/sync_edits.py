#!/usr/bin/env python3
"""Bridge: merge playbook edits between the website (D1) and the Claude artifact db.
Usage: sync_edits.py ARTIFACT_EDITS.json  -> prints merged edits JSON (write it to the artifact doc shared/edits as {"edits": ...})
Three-way merge against the last synced base kept in D1, so deletions on either side stick."""
import json,sys,urllib.request
API="https://evie-salomon-soluna-playbook.pages.dev/api/edits"; KEY="qgEc5o_ikFSNb92qv3Ex7Yge4E6FVt72"
def req(url,body=None):
    r=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers={"x-pb-key":KEY,"content-type":"application/json","user-agent":"pb-sync"})
    return json.load(urllib.request.urlopen(r,timeout=30))
def flat(o):
    return {(v,i):r for v,recs in (o or {}).items() for i,r in (recs or {}).items() if isinstance(r,dict) and isinstance(r.get("n"),str)}
def nest(f):
    o={}
    for (v,i),r in f.items(): o.setdefault(v,{})[i]=r
    return o
raw=json.load(open(sys.argv[1])); art=raw.get("edits",raw) if isinstance(raw,dict) else {}
A=flat(art); W=flat(req(API)); B=flat(req(API+"?k=base"))
M={}
for k in set(A)|set(W)|set(B):
    a,w,b=A.get(k),W.get(k),B.get(k)
    if a==w: r=a
    elif a==b: r=w            # only website changed (or deleted)
    elif w==b: r=a            # only artifact changed (or deleted)
    else:                      # both changed: newest wins; deletion loses to an edit
        r=max([x for x in (a,w) if x],key=lambda x:x.get("t",0),default=None)
    if r: M[k]=r
m=nest(M)
if M!=W or M!=B: req(API,{"replaceAll":m,"base":m})
print(json.dumps(m))
print(f"artifact {len(A)}, website {len(W)}, merged {len(M)}",file=sys.stderr)

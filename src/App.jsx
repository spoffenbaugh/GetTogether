import { useState, useEffect, useCallback } from "react";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function isoDate(y,m,d){ return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
function calendarDays(year,month){
  const first=new Date(year,month,1).getDay(), total=new Date(year,month+1,0).getDate(), cells=[];
  for(let i=0;i<first;i++) cells.push(null);
  for(let d=1;d<=total;d++) cells.push(d);
  return cells;
}
function today(){ const n=new Date(); return {y:n.getFullYear(),m:n.getMonth()}; }
const TIMES = Array.from({length:24},(_,i)=>{ const h=i%12||12,p=i<12?"AM":"PM"; return `${h}:00 ${p}`; });
function uid(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

// Storage — uses localStorage so data persists in the browser.
// For a multi-user production app, swap these with real API calls to a backend.
const LS = {
  get(key){ try{ return localStorage.getItem(key); }catch{ return null; } },
  set(key,val){ try{ localStorage.setItem(key,val); }catch{} },
};

async function saveEvent(id,data){ LS.set(`gt:event:${id}`, JSON.stringify(data)); }
async function loadEvent(id){
  const raw=LS.get(`gt:event:${id}`);
  return raw ? JSON.parse(raw) : null;
}
async function saveResponse(eid,gid,data){
  // store a list of response IDs per event, then each response separately
  const idsRaw=LS.get(`gt:resp-ids:${eid}`);
  const ids=idsRaw?JSON.parse(idsRaw):[];
  if(!ids.includes(gid)) ids.push(gid);
  LS.set(`gt:resp-ids:${eid}`, JSON.stringify(ids));
  LS.set(`gt:resp:${eid}:${gid}`, JSON.stringify(data));
}
async function loadAllResponses(eid){
  const idsRaw=LS.get(`gt:resp-ids:${eid}`);
  const ids=idsRaw?JSON.parse(idsRaw):[];
  return ids.map(gid=>{ const r=LS.get(`gt:resp:${eid}:${gid}`); return r?JSON.parse(r):null; }).filter(Boolean);
}

// Router
function useHash(){
  const [hash,setHash]=useState(window.location.hash.slice(1)||"");
  useEffect(()=>{ const h=()=>setHash(window.location.hash.slice(1)||""); window.addEventListener("hashchange",h); return()=>window.removeEventListener("hashchange",h); },[]);
  return hash;
}
function navigate(p){ window.location.hash=p; }

// Design tokens
const C = {
  bg:       "#141414",
  surface:  "#1c1c1c",
  surfaceHi:"#242424",
  border:   "#2a2a2a",
  borderHi: "#333",
  accent:   "#e8714a",
  accentBg: "#e8714a18",
  text:     "#f0ebe4",
  textMid:  "#8a8480",
  textDim:  "#4a4744",
  green:    "#52b788",
  yellow:   "#d4a843",
};

const font = "'Plus Jakarta Sans', 'DM Sans', sans-serif";

// Base components
function Card({ children, style={} }){
  return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16,...style}}>{children}</div>;
}

function FieldLabel({ children }){
  return <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{children}</div>;
}

function TextInput({ value, onChange, placeholder }){
  const [focused,setFocused]=useState(false);
  return(
    <input value={value} onChange={onChange} placeholder={placeholder}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      style={{
        display:"block",width:"100%",boxSizing:"border-box",
        background:C.surfaceHi,
        border:`1.5px solid ${focused?C.accent:C.border}`,
        borderRadius:10,padding:"11px 14px",
        fontSize:14,color:C.text,marginBottom:20,outline:"none",
        fontFamily:font,transition:"border-color .15s",
      }}
    />
  );
}

function Btn({ children, onClick, disabled, variant="primary", fullWidth, style={} }){
  const [hov,setHov]=useState(false);
  const base={
    fontFamily:font,fontSize:13,fontWeight:600,
    borderRadius:9,padding:"10px 18px",cursor:disabled?"not-allowed":"pointer",
    transition:"all .15s",outline:"none",border:"none",
    width:fullWidth?"100%":undefined,
    opacity:disabled?.4:1,
  };
  const v={
    primary:{ background:disabled?C.border:hov?"#d4623b":C.accent, color:"#fff" },
    ghost:  { background:hov?C.surfaceHi:"transparent", color:hov?C.text:C.textMid, border:`1px solid ${C.border}` },
  };
  return(
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{...base,...v[variant],...style}}>
      {children}
    </button>
  );
}

function NavArrow({ children, onClick }){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?C.surfaceHi:"transparent",border:`1px solid ${hov?C.borderHi:"transparent"}`,
        cursor:"pointer",width:30,height:30,borderRadius:6,
        display:"flex",alignItems:"center",justifyContent:"center",
        color:hov?C.text:C.textMid,fontSize:16,transition:"all .12s",fontFamily:font}}>
      {children}
    </button>
  );
}

// Calendar
function DayCell({ d, sel, dis, onToggle }){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onToggle} onMouseEnter={()=>!dis&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        aspectRatio:"1",borderRadius:8,border:"none",cursor:dis?"default":"pointer",
        background: sel ? C.accent : hov ? C.surfaceHi : "transparent",
        color: sel ? "#fff" : dis ? C.textDim : C.text,
        fontWeight:sel?600:400,fontSize:13,
        transition:"all .12s",outline:"none",fontFamily:font,
      }}>{d}</button>
  );
}

function Calendar({ year, month, selected, onToggle, isDisabled }){
  const cells=calendarDays(year,month);
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
      {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:500,color:C.textDim,paddingBottom:6}}>{d}</div>)}
      {cells.map((d,i)=>{
        if(!d) return <div key={`e${i}`}/>;
        const iso=isoDate(year,month,d);
        const sel=selected.includes(iso), dis=isDisabled?isDisabled(iso):false;
        return <DayCell key={iso} d={d} sel={sel} dis={dis} onToggle={()=>!dis&&onToggle(iso)}/>;
      })}
    </div>
  );
}

// Time grid
function TimeCell({ t, sel, avail, onToggle }){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onToggle} onMouseEnter={()=>avail&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        border:`1.5px solid ${sel?C.accent:hov?C.borderHi:C.border}`,
        borderRadius:8,padding:"7px 0",
        background:sel?C.accentBg:"transparent",
        color:sel?C.accent:avail?C.textMid:C.textDim,
        fontWeight:sel?600:400,fontSize:12,
        cursor:avail?"pointer":"default",
        transition:"all .12s",outline:"none",fontFamily:font,
      }}>{t}</button>
  );
}

function TimeGrid({ available, selected, onToggle }){
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
      {TIMES.map(t=>{
        const avail=!available||available.includes(t), sel=selected.includes(t);
        return <TimeCell key={t} t={t} sel={sel} avail={avail} onToggle={()=>avail&&onToggle(t)}/>;
      })}
    </div>
  );
}

// Shared
function Pill({ label }){
  return <span style={{background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:99,padding:"3px 10px",fontSize:12,color:C.textMid,fontWeight:500}}>{label}</span>;
}

function MonthNav({ cal, onPrev, onNext }){
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <NavArrow onClick={onPrev}>‹</NavArrow>
      <span style={{fontSize:13,fontWeight:600,color:C.text}}>{MONTHS[cal.m]} {cal.y}</span>
      <NavArrow onClick={onNext}>›</NavArrow>
    </div>
  );
}

function LinkBox({ label, url }){
  const [copied,setCopied]=useState(false);
  function copy(){ navigator.clipboard.writeText(url).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  return(
    <div style={{marginBottom:14}}>
      {label && <div style={{fontSize:12,fontWeight:500,color:C.textMid,marginBottom:6}}>{label}</div>}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{flex:1,background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,
          padding:"9px 13px",fontSize:12,color:C.textMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{url}</div>
        <Btn variant={copied?"primary":"ghost"} onClick={copy} style={{padding:"9px 16px",fontSize:12,flexShrink:0}}>
          {copied?"Copied ✓":"Copy link"}
        </Btn>
      </div>
    </div>
  );
}

function PageWrap({ children, maxWidth=540, style={} }){
  return <div style={{maxWidth,margin:"0 auto",padding:"36px 20px",...style}}>{children}</div>;
}

function PageHeader({ title, sub, noMargin }){
  return(
    <div style={{marginBottom:noMargin?0:28}}>
      <h2 style={{fontFamily:font,fontSize:22,fontWeight:700,color:C.text,margin:"0 0 4px"}}>{title}</h2>
      {sub && <p style={{fontSize:13,color:C.textMid,margin:0}}>{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }){
  return <div style={{fontSize:11,fontWeight:600,color:C.textMid,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8,marginTop:4}}>{children}</div>;
}

function Centered({ children }){
  return <div style={{padding:80,textAlign:"center",color:C.textMid,fontSize:14}}>{children}</div>;
}

// ── Host Create ───────────────────────────────────────────────────────────────
function HostCreate(){
  const [cal,setCal]=useState(today());
  const [days,setDays]=useState([]);
  const [times,setTimes]=useState([]);
  const [title,setTitle]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(null);

  const toggleDay=iso=>setDays(d=>d.includes(iso)?d.filter(x=>x!==iso):[...d,iso].sort());
  const toggleTime=t=>setTimes(d=>d.includes(t)?d.filter(x=>x!==t):[...d,t]);
  const prevMonth=()=>setCal(c=>c.m===0?{y:c.y-1,m:11}:{y:c.y,m:c.m-1});
  const nextMonth=()=>setCal(c=>c.m===11?{y:c.y+1,m:0}:{y:c.y,m:c.m+1});

  async function create(){
    if(!title.trim()||!days.length||!times.length) return;
    setSaving(true);
    const id=uid();
    await saveEvent(id,{title:title.trim(),days,times,created:Date.now()});
    setDone(id); setSaving(false);
  }

  if(done){
    const guestUrl=`${location.origin}${location.pathname}#guest/${done}`;
    const hostUrl=`${location.origin}${location.pathname}#results/${done}`;
    return(
      <PageWrap>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:13,fontWeight:500,color:C.green,marginBottom:6}}>✓ Poll created</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:4}}>You're all set!</div>
          <div style={{fontSize:14,color:C.textMid}}>Share the guest link and check back here for results.</div>
        </div>
        <Card><LinkBox label="Share with guests" url={guestUrl}/></Card>
        <Card><LinkBox label="Your results page — save this link" url={hostUrl}/></Card>
        <Btn variant="ghost" onClick={()=>navigate("")}>← Create another</Btn>
      </PageWrap>
    );
  }

  const ready=title.trim()&&days.length&&times.length;
  return(
    <PageWrap>
      <PageHeader title="New availability poll" sub="Pick when you're free — guests choose from your options."/>

      <FieldLabel>Event name</FieldLabel>
      <TextInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Coffee catch-up, team sync…"/>

      <FieldLabel>Available days</FieldLabel>
      <Card>
        <MonthNav cal={cal} onPrev={prevMonth} onNext={nextMonth}/>
        <Calendar year={cal.y} month={cal.m} selected={days} onToggle={toggleDay}/>
      </Card>

      <FieldLabel>Available times</FieldLabel>
      <Card>
        <TimeGrid selected={times} onToggle={toggleTime}/>
      </Card>

      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <Pill label={`${days.length} day${days.length!==1?"s":""} selected`}/>
        <Pill label={`${times.length} time${times.length!==1?"s":""} selected`}/>
      </div>

      <Btn onClick={create} disabled={saving||!ready} fullWidth style={{padding:"13px"}}>
        {saving?"Creating…":"Create poll & get link"}
      </Btn>
    </PageWrap>
  );
}

// ── Guest View ────────────────────────────────────────────────────────────────
function GuestView({ eventId }){
  const [event,setEvent]=useState(null);
  const [loading,setLoading]=useState(true);
  const [name,setName]=useState("");
  const [days,setDays]=useState([]);
  const [times,setTimes]=useState([]);
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const [cal,setCal]=useState(today());

  useEffect(()=>{
    loadEvent(eventId).then(e=>{
      setEvent(e); setLoading(false);
      if(e?.days?.length){ const d=new Date(e.days[0]+"T00:00:00"); setCal({y:d.getFullYear(),m:d.getMonth()}); }
    });
  },[eventId]);

  const toggleDay=iso=>{ if(!event.days.includes(iso))return; setDays(d=>d.includes(iso)?d.filter(x=>x!==iso):[...d,iso].sort()); };
  const toggleTime=t=>setTimes(d=>d.includes(t)?d.filter(x=>x!==t):[...d,t]);
  const prevMonth=()=>setCal(c=>c.m===0?{y:c.y-1,m:11}:{y:c.y,m:c.m-1});
  const nextMonth=()=>setCal(c=>c.m===11?{y:c.y+1,m:0}:{y:c.y,m:c.m+1});

  async function submit(){
    if(!name.trim())return;
    setSaving(true);
    await saveResponse(eventId,uid(),{name:name.trim(),days,times,submitted:Date.now()});
    setDone(true); setSaving(false);
  }

  if(loading) return <Centered>Loading…</Centered>;
  if(!event) return <Centered>Event not found.</Centered>;
  if(done) return(
    <PageWrap style={{textAlign:"center",paddingTop:80}}>
      <div style={{width:52,height:52,borderRadius:14,background:C.green+"22",border:`1px solid ${C.green}44`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 20px"}}>✓</div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Response saved!</div>
      <div style={{fontSize:14,color:C.textMid}}>Thanks for filling out <span style={{color:C.text,fontWeight:500}}>{event.title}</span>.</div>
    </PageWrap>
  );

  return(
    <PageWrap>
      <PageHeader title={event.title} sub="Pick the days and times that work for you."/>

      <FieldLabel>Your name</FieldLabel>
      <TextInput value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <FieldLabel>Days that work</FieldLabel>
        <span style={{fontSize:12,color:C.textMid,marginBottom:8}}>{event.days.length} offered</span>
      </div>
      <Card>
        <MonthNav cal={cal} onPrev={prevMonth} onNext={nextMonth}/>
        <Calendar year={cal.y} month={cal.m} selected={days} onToggle={toggleDay} isDisabled={iso=>!event.days.includes(iso)}/>
        <div style={{fontSize:11,color:C.textDim,marginTop:10}}>Only dates the host offered are selectable</div>
      </Card>

      <FieldLabel>Times that work</FieldLabel>
      <Card>
        <TimeGrid available={event.times} selected={times} onToggle={toggleTime}/>
      </Card>

      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <Pill label={`${days.length} day${days.length!==1?"s":""}`}/>
        <Pill label={`${times.length} time${times.length!==1?"s":""}`}/>
      </div>

      <Btn onClick={submit} disabled={saving||!name.trim()} fullWidth style={{padding:"13px"}}>
        {saving?"Submitting…":"Submit availability"}
      </Btn>
    </PageWrap>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultsView({ eventId }){
  const [event,setEvent]=useState(null);
  const [responses,setResponses]=useState([]);
  const [loading,setLoading]=useState(true);

  const reload=useCallback(async()=>{
    setLoading(true);
    const [e,r]=await Promise.all([loadEvent(eventId),loadAllResponses(eventId)]);
    setEvent(e); setResponses(r); setLoading(false);
  },[eventId]);

  useEffect(()=>{ reload(); },[reload]);

  if(loading) return <Centered>Loading…</Centered>;
  if(!event) return <Centered>Event not found.</Centered>;

  const dayCount={}, timeCount={};
  for(const r of responses){
    for(const d of r.days||[]) dayCount[d]=(dayCount[d]||0)+1;
    for(const t of r.times||[]) timeCount[t]=(timeCount[t]||0)+1;
  }

  function barColor(count){
    if(!responses.length) return C.border;
    const p=count/responses.length;
    return p===1?C.green:p>=.5?C.yellow:C.accent;
  }

  return(
    <PageWrap maxWidth={660}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:28}}>
        <PageHeader title={event.title} sub={`${responses.length} response${responses.length!==1?"s":""} so far`} noMargin/>
        <Btn variant="ghost" onClick={reload}>Refresh</Btn>
      </div>

      {responses.length===0 ? (
        <Card style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:13,color:C.textMid}}>No responses yet — share the guest link below.</div>
        </Card>
      ) : (
        <>
          <SectionTitle>Day overlap</SectionTitle>
          <Card>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              {[...event.days].sort().map(iso=>{
                const count=dayCount[iso]||0, pct=count/(responses.length||1)*100;
                const d=new Date(iso+"T00:00:00");
                const label=`${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`;
                return(
                  <div key={iso} style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:110,fontSize:13,color:C.textMid,flexShrink:0}}>{label}</div>
                    <div style={{flex:1,background:C.surfaceHi,borderRadius:99,height:7,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:99,background:barColor(count),width:`${pct}%`,transition:"width .35s"}}/>
                    </div>
                    <div style={{fontSize:12,color:barColor(count),fontWeight:600,width:36,textAlign:"right"}}>{count}/{responses.length}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <SectionTitle>Time overlap</SectionTitle>
          <Card>
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              {event.times.map(t=>{
                const count=timeCount[t]||0, pct=count/(responses.length||1)*100;
                return(
                  <div key={t} style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:72,fontSize:13,color:C.textMid,flexShrink:0}}>{t}</div>
                    <div style={{flex:1,background:C.surfaceHi,borderRadius:99,height:7,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:99,background:barColor(count),width:`${pct}%`,transition:"width .35s"}}/>
                    </div>
                    <div style={{fontSize:12,color:barColor(count),fontWeight:600,width:36,textAlign:"right"}}>{count}/{responses.length}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <SectionTitle>Who responded</SectionTitle>
          <Card>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {responses.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                  background:C.surfaceHi,border:`1px solid ${C.border}`,
                  borderRadius:8,padding:"7px 12px"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",background:C.accent,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>
                    {r.name?.[0]?.toUpperCase()||"?"}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:C.text}}>{r.name}</div>
                    <div style={{fontSize:11,color:C.textMid}}>{(r.days||[]).length}d · {(r.times||[]).length}t</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:20,marginTop:4}}>
        <div style={{fontSize:12,color:C.textMid,marginBottom:10}}>Guest link to share</div>
        <LinkBox url={`${location.origin}${location.pathname}#guest/${eventId}`}/>
      </div>
    </PageWrap>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
function Landing(){
  return(
    <div style={{maxWidth:440,margin:"0 auto",padding:"90px 20px 60px",textAlign:"center"}}>
      <div style={{width:52,height:52,borderRadius:14,background:C.accent,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:24,margin:"0 auto 24px",boxShadow:`0 8px 24px ${C.accent}44`}}>
        📅
      </div>
      <h1 style={{fontFamily:font,fontSize:36,fontWeight:800,color:C.text,margin:"0 0 12px",letterSpacing:"-.02em"}}>
        Gettogether
      </h1>
      <p style={{fontSize:15,color:C.textMid,lineHeight:1.75,margin:"0 0 40px"}}>
        The simplest way to find a time that works.<br/>
        Set your availability, share a link, done.
      </p>
      <Btn onClick={()=>navigate("create")} style={{padding:"13px 32px",fontSize:14}}>
        Create a poll
      </Btn>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const hash=useHash();
  const [,route,param]=hash.match(/^([^/]*)\/?(.*)$/)||[];

  let view;
  if(!route||route==="")    view=<Landing/>;
  else if(route==="create") view=<HostCreate/>;
  else if(route==="guest")  view=<GuestView eventId={param}/>;
  else if(route==="results")view=<ResultsView eventId={param}/>;
  else                       view=<Centered>Page not found.</Centered>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:font}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input::placeholder { color: #4a4744; }
        ::-webkit-scrollbar { width:6px; background:#141414; }
        ::-webkit-scrollbar-thumb { background:#2a2a2a; border-radius:3px; }
        ::selection { background:#e8714a33; }
      `}</style>

      <header style={{position:"sticky",top:0,zIndex:10,
        background:"#141414e8",backdropFilter:"blur(12px)",
        borderBottom:`1px solid #2a2a2a`,
        padding:"0 24px",height:52,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>navigate("")} style={{background:"none",border:"none",cursor:"pointer",
          display:"flex",alignItems:"center",gap:10,padding:0}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.accent,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📅</div>
          <span style={{fontFamily:font,fontWeight:700,fontSize:15,color:C.text}}>Gettogether</span>
        </button>
        <Btn variant="ghost" onClick={()=>navigate("create")} style={{padding:"6px 14px",fontSize:12}}>
          + New poll
        </Btn>
      </header>

      {view}
    </div>
  );
}

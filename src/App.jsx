import { useState, useEffect, useCallback } from "react";

const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
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
function fmtDay(iso){ const d=new Date(iso+"T00:00:00"); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; }
function fmtDate(ts){ const d=new Date(ts); return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}, ${d.getFullYear()}`; }

// Time helpers — times stored as "HH:MM" 24hr strings
function toMinutes(t){ const [h,m]=t.split(":").map(Number); return h*60+m; }
function fromMinutes(mins){ const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`; }
function fmtTime(t){
  if(!t) return "";
  const [h,m]=t.split(":").map(Number);
  const ampm=h<12?"AM":"PM", hr=h%12||12;
  return `${hr}:${String(m).padStart(2,"0")} ${ampm}`;
}
function timeSlots(start, end){
  // Generate 15-min increments between start and end inclusive
  const slots=[];
  let cur=toMinutes(start);
  const endM=toMinutes(end);
  while(cur<=endM){ slots.push(fromMinutes(cur)); cur+=15; }
  return slots;
}
function uid(){ return Math.random().toString(36).slice(2,10).toUpperCase(); }
function sortedDays(avail){ return Object.keys(avail).sort(); }

// availability shape (host):   { "2026-05-15": null | { start:"14:00", end:"16:00" } }
// availability shape (guest):  { "2026-05-15": null | "14:30" }  (null = day works, no time)

function getHostId(){
  let id=localStorage.getItem("gt:hostId");
  if(!id){ id=uid(); localStorage.setItem("gt:hostId",id); }
  return id;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path, options={}){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    headers:{
      "apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,
      "Content-Type":"application/json","Prefer":"return=representation",
      ...(options.headers||{}),
    },
  });
  if(!res.ok){ const err=await res.text(); throw new Error(err); }
  const text=await res.text();
  return text?JSON.parse(text):null;
}
async function saveEvent(id,data){
  await sbFetch("events",{method:"POST",body:JSON.stringify({id,title:data.title,availability:data.availability,host_id:data.hostId})});
}
async function loadEvent(id){
  const rows=await sbFetch(`events?id=eq.${id}&limit=1`);
  if(!rows||rows.length===0) return null;
  return {title:rows[0].title,availability:rows[0].availability,createdAt:rows[0].created_at};
}
async function loadHostEvents(hostId){
  const rows=await sbFetch(`events?host_id=eq.${hostId}&order=created_at.desc`);
  return rows||[];
}
async function saveResponse(eventId,guestId,data){
  await sbFetch("responses",{method:"POST",body:JSON.stringify({id:guestId,event_id:eventId,name:data.name,availability:data.availability})});
}
async function loadAllResponses(eventId){
  const rows=await sbFetch(`responses?event_id=eq.${eventId}`);
  return (rows||[]).map(r=>({name:r.name,availability:r.availability}));
}
async function loadResponseCounts(eventIds){
  if(!eventIds.length) return {};
  const rows=await sbFetch(`responses?event_id=in.(${eventIds.join(",")})&select=event_id`);
  const counts={};
  for(const r of (rows||[])){ counts[r.event_id]=(counts[r.event_id]||0)+1; }
  return counts;
}
async function deleteEvent(eventId){
  await sbFetch(`responses?event_id=eq.${eventId}`,{method:"DELETE"});
  await sbFetch(`events?id=eq.${eventId}`,{method:"DELETE"});
}

// ── Router ────────────────────────────────────────────────────────────────────
function useHash(){
  const [hash,setHash]=useState(window.location.hash.slice(1)||"");
  useEffect(()=>{
    const h=()=>setHash(window.location.hash.slice(1)||"");
    window.addEventListener("hashchange",h);
    return()=>window.removeEventListener("hashchange",h);
  },[]);
  return hash;
}
function navigate(p){ window.location.hash=p; }

// ── Design tokens ─────────────────────────────────────────────────────────────
const C={
  bg:"#141414",surface:"#1c1c1c",surfaceHi:"#242424",
  border:"#2a2a2a",borderHi:"#333",
  accent:"#e8714a",accentBg:"#e8714a18",
  text:"#f0ebe4",textMid:"#8a8480",textDim:"#4a4744",
  green:"#52b788",yellow:"#d4a843",
};
const font="'Plus Jakarta Sans','DM Sans',sans-serif";

function Logo({ size=28, radius=8 }){
  return(
    <svg width={size} height={size} viewBox="0 0 512 512" style={{borderRadius:radius,display:"block"}}>
      <rect x="131" y="141" width="250" height="230" rx="26" fill="none" stroke="#e8714a" strokeWidth="15"/>
      <rect x="131" y="196" width="250" height="15" fill="#e8714a"/>
      <rect x="183" y="130" width="18" height="48" rx="9" fill="#e8714a"/>
      <rect x="311" y="130" width="18" height="48" rx="9" fill="#e8714a"/>
      <rect x="163" y="248" width="30" height="30" rx="7" fill="#e8714a"/>
      <rect x="241" y="248" width="30" height="30" rx="7" fill="#e8714a"/>
      <rect x="319" y="248" width="30" height="30" rx="7" fill="#e8714a"/>
      <rect x="163" y="306" width="30" height="30" rx="7" fill="#e8714a"/>
      <rect x="241" y="306" width="30" height="30" rx="7" fill="#e8714a"/>
    </svg>
  );
}

// ── Base UI ───────────────────────────────────────────────────────────────────
function Card({ children, style={}, onClick }){
  return <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:16,cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}
function FieldLabel({ children }){
  return <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:8}}>{children}</div>;
}
function TextInput({ value, onChange, placeholder }){
  const [f,setF]=useState(false);
  return(
    <input value={value} onChange={onChange} placeholder={placeholder}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={{display:"block",width:"100%",boxSizing:"border-box",
        background:C.surfaceHi,border:`1.5px solid ${f?C.accent:C.border}`,
        borderRadius:10,padding:"11px 14px",fontSize:14,color:C.text,
        marginBottom:20,outline:"none",fontFamily:font,transition:"border-color .15s"}}/>
  );
}
function Btn({ children, onClick, disabled, variant="primary", fullWidth, style={} }){
  const [hov,setHov]=useState(false);
  const base={fontFamily:font,fontSize:13,fontWeight:600,borderRadius:9,padding:"10px 18px",
    cursor:disabled?"not-allowed":"pointer",transition:"all .15s",outline:"none",border:"none",
    width:fullWidth?"100%":undefined,opacity:disabled?.4:1};
  const v={
    primary:{background:disabled?C.border:hov?"#d4623b":C.accent,color:"#fff"},
    ghost:{background:hov?C.surfaceHi:"transparent",color:hov?C.text:C.textMid,border:`1px solid ${C.border}`},
    danger:{background:hov?"#ff224420":"transparent",color:"#ff4455",border:"1px solid #ff445530"},
  };
  return(
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{...base,...v[variant],...style}}>{children}</button>
  );
}
function NavArrow({ children, onClick }){
  const [hov,setHov]=useState(false);
  return(
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?C.surfaceHi:"transparent",border:`1px solid ${hov?C.borderHi:"transparent"}`,
        cursor:"pointer",width:30,height:30,borderRadius:6,display:"flex",alignItems:"center",
        justifyContent:"center",color:hov?C.text:C.textMid,fontSize:16,transition:"all .12s",fontFamily:font}}>
      {children}
    </button>
  );
}
function Pill({ label, color }){
  return <span style={{background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:99,padding:"3px 10px",fontSize:12,color:color||C.textMid,fontWeight:500}}>{label}</span>;
}
function SectionTitle({ children }){
  return <div style={{fontSize:11,fontWeight:600,color:C.textMid,letterSpacing:".06em",textTransform:"uppercase",marginBottom:8,marginTop:4}}>{children}</div>;
}
function Centered({ children }){
  return <div style={{padding:80,textAlign:"center",color:C.textMid,fontSize:14}}>{children}</div>;
}
function PageWrap({ children, maxWidth=560, style={} }){
  return <div style={{maxWidth,margin:"0 auto",padding:"36px 20px",...style}}>{children}</div>;
}
function PageHeader({ title, sub, noMargin }){
  return(
    <div style={{marginBottom:noMargin?0:28}}>
      <h2 style={{fontFamily:font,fontSize:22,fontWeight:700,color:C.text,margin:"0 0 4px"}}>{title}</h2>
      {sub&&<p style={{fontSize:13,color:C.textMid,margin:0}}>{sub}</p>}
    </div>
  );
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
      {label&&<div style={{fontSize:12,fontWeight:500,color:C.textMid,marginBottom:6}}>{label}</div>}
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

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>onChange(!value)}>
      <div style={{width:38,height:22,borderRadius:99,background:value?C.accent:C.surfaceHi,
        border:`1px solid ${value?C.accent:C.border}`,position:"relative",transition:"all .2s",flexShrink:0}}>
        <div style={{position:"absolute",top:3,left:value?18:3,width:14,height:14,
          borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
      </div>
      <span style={{fontSize:13,color:value?C.text:C.textMid,fontWeight:value?500:400}}>{label}</span>
    </div>
  );
}

// ── Time picker — hour/minute with 15-min increments ─────────────────────────
function TimePicker({ value, onChange, min, max, label }){
  // value: "HH:MM" 24hr or null
  // Generates all 15-min slots, optionally bounded by min/max
  const allSlots = [];
  for(let h=0;h<24;h++) for(let m=0;m<60;m+=15) allSlots.push(fromMinutes(h*60+m));
  const slots = min||max ? allSlots.filter(s=>{
    const sm=toMinutes(s);
    if(min&&sm<toMinutes(min)) return false;
    if(max&&sm>toMinutes(max)) return false;
    return true;
  }) : allSlots;

  const [open,setOpen]=useState(false);
  const display = value ? fmtTime(value) : "Select time";

  return(
    <div style={{position:"relative",display:"inline-block"}}>
      {label&&<div style={{fontSize:12,color:C.textMid,marginBottom:5}}>{label}</div>}
      <button onClick={()=>setOpen(o=>!o)}
        style={{background:C.surfaceHi,border:`1.5px solid ${open?C.accent:C.border}`,
          borderRadius:8,padding:"8px 14px",fontSize:13,color:value?C.text:C.textMid,
          cursor:"pointer",fontFamily:font,fontWeight:value?500:400,
          display:"flex",alignItems:"center",gap:8,minWidth:120,transition:"border-color .15s"}}>
        <span style={{flex:1,textAlign:"left"}}>{display}</span>
        <span style={{color:C.textDim,fontSize:10}}>▾</span>
      </button>
      {open&&(
        <>
          <div style={{position:"fixed",inset:0,zIndex:50}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,zIndex:51,
            background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:10,
            boxShadow:"0 8px 32px rgba(0,0,0,.5)",maxHeight:200,overflowY:"auto",minWidth:130}}>
            {slots.map(s=>(
              <div key={s} onClick={()=>{ onChange(s); setOpen(false); }}
                style={{padding:"8px 14px",fontSize:13,cursor:"pointer",
                  background:value===s?C.accentBg:"transparent",
                  color:value===s?C.accent:C.text,fontWeight:value===s?600:400,
                  transition:"background .1s"}}
                onMouseEnter={e=>{ if(value!==s) e.target.style.background=C.surfaceHi; }}
                onMouseLeave={e=>{ if(value!==s) e.target.style.background="transparent"; }}>
                {fmtTime(s)}
              </div>
            ))}
            {slots.length===0&&<div style={{padding:"12px 14px",fontSize:12,color:C.textMid}}>No slots available</div>}
          </div>
        </>
      )}
    </div>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function DayCell({ d, state, onToggle }){
  const [hov,setHov]=useState(false);
  const bg=state==="has-time"?C.accent:state==="selected"?C.accentBg:state==="date-only"?"#1e3a2e":hov&&state!=="disabled"?C.surfaceHi:"transparent";
  const color=state==="has-time"?"#fff":state==="selected"?C.accent:state==="date-only"?C.green:state==="disabled"?C.textDim:C.text;
  const border=state==="selected"?`2px solid ${C.accent}`:state==="date-only"?`2px solid ${C.green}`:"2px solid transparent";
  return(
    <button onClick={onToggle} onMouseEnter={()=>state!=="disabled"&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{aspectRatio:"1",borderRadius:8,border,cursor:state==="disabled"?"default":"pointer",
        background:bg,color,fontWeight:["has-time","selected","date-only"].includes(state)?600:400,
        fontSize:13,transition:"all .12s",outline:"none",fontFamily:font}}>{d}</button>
  );
}

function Calendar({ year, month, availability, isDisabled, selectedDay, onSelectDay }){
  const cells=calendarDays(year,month);
  return(
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
      {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:500,color:C.textDim,paddingBottom:6}}>{d}</div>)}
      {cells.map((d,i)=>{
        if(!d) return <div key={`e${i}`}/>;
        const iso=isoDate(year,month,d);
        const dis=isDisabled?isDisabled(iso):false;
        const isAdded=iso in availability;
        const tw=availability[iso];
        const hasTime=isAdded&&tw!==null&&tw?.start;
        const dateOnly=isAdded&&!hasTime;
        const isSel=selectedDay===iso;
        const state=dis?"disabled":hasTime?"has-time":dateOnly?"date-only":isSel?"selected":"normal";
        return <DayCell key={iso} d={d} state={state} onToggle={()=>{ if(dis)return; onSelectDay(iso); }}/>;
      })}
    </div>
  );
}

// ── Host Day Editor ───────────────────────────────────────────────────────────
function HostDayEditor({ availability, setAvailability, cal, onPrevMonth, onNextMonth }){
  const [activeDay,setActiveDay]=useState(null);

  function handleDayClick(iso){
    if(!(iso in availability)) setAvailability(prev=>({...prev,[iso]:null}));
    setActiveDay(iso);
  }
  function removeDay(iso){
    setAvailability(prev=>{ const n={...prev}; delete n[iso]; return n; });
    if(activeDay===iso) setActiveDay(null);
  }
  function setTimeWindow(iso, field, val){
    setAvailability(prev=>{
      const cur=prev[iso]||{start:"09:00",end:"10:00"};
      const next={...cur,[field]:val};
      // ensure end >= start
      if(field==="start"&&toMinutes(val)>=toMinutes(next.end)){
        next.end=fromMinutes(toMinutes(val)+60);
        if(toMinutes(next.end)>=24*60) next.end="23:45";
      }
      if(field==="end"&&toMinutes(val)<=toMinutes(next.start)){
        next.start=fromMinutes(toMinutes(val)-60);
        if(toMinutes(next.start)<0) next.start="00:00";
      }
      return {...prev,[iso]:next};
    });
  }
  function toggleTime(iso, hasTime){
    setAvailability(prev=>({...prev,[iso]:hasTime?{start:"09:00",end:"10:00"}:null}));
  }

  const days=sortedDays(availability);
  const activeTw=activeDay?availability[activeDay]:undefined;
  const activeHasTime=activeTw&&activeTw!==null&&activeTw?.start;

  return(
    <div>
      <Card>
        <MonthNav cal={cal} onPrev={onPrevMonth} onNext={onNextMonth}/>
        <Calendar year={cal.y} month={cal.m} availability={availability}
          selectedDay={activeDay} onSelectDay={handleDayClick}/>
        <div style={{fontSize:11,color:C.textDim,marginTop:10,display:"flex",gap:16}}>
          <span><span style={{color:C.accent}}>■</span> Has time window</span>
          <span><span style={{color:C.green}}>■</span> Date only</span>
        </div>
      </Card>

      {activeDay?(
        <Card style={{borderColor:C.borderHi}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:13,fontWeight:600,color:C.text}}>{fmtDay(activeDay)}</div>
            <Btn variant="danger" style={{padding:"4px 10px",fontSize:11}} onClick={()=>removeDay(activeDay)}>Remove</Btn>
          </div>

          <Toggle
            value={!!activeHasTime}
            onChange={v=>toggleTime(activeDay,v)}
            label="Add a time window for this day"/>

          {activeHasTime&&(
            <div style={{marginTop:16,padding:14,background:C.surfaceHi,borderRadius:10,display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}>
              <TimePicker label="Start time" value={activeTw.start} onChange={v=>setTimeWindow(activeDay,"start",v)}/>
              <div style={{fontSize:13,color:C.textMid,paddingBottom:8}}>to</div>
              <TimePicker label="End time" value={activeTw.end} onChange={v=>setTimeWindow(activeDay,"end",v)} min={fromMinutes(toMinutes(activeTw.start)+15)}/>
              <div style={{fontSize:12,color:C.textMid,paddingBottom:8}}>
                {timeSlots(activeTw.start,activeTw.end).length} slots available to guests
              </div>
            </div>
          )}
        </Card>
      ):(
        <Card style={{textAlign:"center",padding:28,borderStyle:"dashed"}}>
          <div style={{fontSize:13,color:C.textMid}}>
            {days.length===0?"Click a date to add it":"Click a date to configure it"}
          </div>
        </Card>
      )}

      {days.length>0&&(
        <div style={{marginTop:4}}>
          <SectionTitle>Your days</SectionTitle>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {days.map(iso=>{
              const tw=availability[iso];
              const hasTime=tw&&tw?.start;
              return(
                <div key={iso} onClick={()=>setActiveDay(iso)}
                  style={{display:"flex",alignItems:"center",gap:10,
                    background:activeDay===iso?C.surfaceHi:C.surface,
                    border:`1px solid ${activeDay===iso?C.borderHi:C.border}`,
                    borderRadius:8,padding:"8px 12px",cursor:"pointer"}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.text,flex:1}}>{fmtDay(iso)}</div>
                  <div style={{fontSize:12,color:hasTime?C.accent:C.green}}>
                    {hasTime?`${fmtTime(tw.start)} – ${fmtTime(tw.end)}`:"Date only"}
                  </div>
                  <div style={{fontSize:11,color:C.textDim}}>›</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Guest Day Editor ──────────────────────────────────────────────────────────
function GuestDayEditor({ availability, setAvailability, offered, cal, onPrevMonth, onNextMonth }){
  // offered: { iso: null | { start, end } }
  // availability: { iso: null | "HH:MM" }  — guest's picks

  function toggleDay(iso){
    setAvailability(prev=>{
      const n={...prev};
      if(iso in n){ delete n[iso]; } else { n[iso]=null; }
      return n;
    });
  }
  function setGuestTime(iso, val){
    setAvailability(prev=>({...prev,[iso]:val}));
  }

  const offeredDays=sortedDays(offered);

  return(
    <div>
      <Card>
        <MonthNav cal={cal} onPrev={onPrevMonth} onNext={onNextMonth}/>
        <Calendar year={cal.y} month={cal.m}
          availability={availability}
          selectedDay={null}
          onSelectDay={toggleDay}
          isDisabled={iso=>!offered[iso]&&offered[iso]!==null&&!(iso in offered)}/>
        <div style={{fontSize:11,color:C.textDim,marginTop:10}}>Only the host's offered dates are selectable</div>
      </Card>

      {sortedDays(availability).length>0&&(
        <div style={{marginTop:4}}>
          <SectionTitle>Your selected days</SectionTitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sortedDays(availability).map(iso=>{
              const offeredTw=offered[iso];
              const hasWindow=offeredTw&&offeredTw?.start;
              const guestTime=availability[iso];
              const slots=hasWindow?timeSlots(offeredTw.start,offeredTw.end):[];
              return(
                <Card key={iso} style={{marginBottom:0,padding:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text}}>{fmtDay(iso)}</div>
                      {hasWindow&&(
                        <div style={{fontSize:11,color:C.textMid,marginTop:2}}>
                          Host window: {fmtTime(offeredTw.start)} – {fmtTime(offeredTw.end)}
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      {hasWindow?(
                        <TimePicker
                          value={guestTime}
                          onChange={v=>setGuestTime(iso,v)}
                          min={offeredTw.start}
                          max={offeredTw.end}
                          label="Your time"/>
                      ):(
                        <span style={{fontSize:12,color:C.green}}>Date only — no time needed</span>
                      )}
                      <button onClick={()=>{ setAvailability(prev=>{ const n={...prev}; delete n[iso]; return n; }); }}
                        style={{background:"none",border:"none",cursor:"pointer",color:C.textDim,fontSize:16,padding:"0 4px"}}>✕</button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {sortedDays(availability).length===0&&offeredDays.length>0&&(
        <Card style={{textAlign:"center",padding:28,borderStyle:"dashed"}}>
          <div style={{fontSize:13,color:C.textMid}}>Click a date above to select it</div>
        </Card>
      )}
    </div>
  );
}

// ── My Polls ──────────────────────────────────────────────────────────────────
function MyPolls(){
  const [events,setEvents]=useState([]);
  const [counts,setCounts]=useState({});
  const [loading,setLoading]=useState(true);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [deleting,setDeleting]=useState(false);

  useEffect(()=>{
    async function load(){
      const hostId=getHostId();
      const evts=await loadHostEvents(hostId);
      setEvents(evts);
      if(evts.length){ const c=await loadResponseCounts(evts.map(e=>e.id)); setCounts(c); }
      setLoading(false);
    }
    load();
  },[]);

  async function handleDelete(id){
    setDeleting(true);
    await deleteEvent(id);
    setEvents(prev=>prev.filter(e=>e.id!==id));
    setCounts(prev=>{ const n={...prev}; delete n[id]; return n; });
    setConfirmDelete(null); setDeleting(false);
  }

  if(loading) return <Centered>Loading your polls…</Centered>;

  return(
    <PageWrap maxWidth={620}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:12}}>
        <PageHeader title="My Polls" sub="All the polls you've created on this device." noMargin/>
        <Btn onClick={()=>navigate("create")} style={{padding:"9px 18px"}}>+ New poll</Btn>
      </div>

      {events.length===0?(
        <Card style={{textAlign:"center",padding:48}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo size={48} radius={12}/></div>
          <div style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:8}}>No polls yet</div>
          <div style={{fontSize:13,color:C.textMid,marginBottom:24}}>Create your first poll to get started.</div>
          <Btn onClick={()=>navigate("create")}>Create a poll</Btn>
        </Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {events.map(evt=>{
            const responseCount=counts[evt.id]||0;
            const guestUrl=`${location.origin}${location.pathname}#guest/${evt.id}`;
            const days=Object.keys(evt.availability||{}).length;
            return(
              <Card key={evt.id} style={{marginBottom:0}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{evt.title}</div>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,color:C.textMid}}>{fmtDate(evt.created_at)}</span>
                      <span style={{fontSize:12,color:C.textDim}}>·</span>
                      <span style={{fontSize:12,color:C.textMid}}>{days} day{days!==1?"s":""}</span>
                      <span style={{fontSize:12,color:C.textDim}}>·</span>
                      <span style={{fontSize:12,color:responseCount>0?C.accent:C.textMid,fontWeight:responseCount>0?600:400}}>
                        {responseCount} response{responseCount!==1?"s":""}
                      </span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap"}}>
                    <Btn variant="ghost" style={{padding:"7px 14px",fontSize:12}} onClick={()=>navigator.clipboard.writeText(guestUrl).catch(()=>{})}>Copy guest link</Btn>
                    <Btn style={{padding:"7px 14px",fontSize:12}} onClick={()=>navigate(`results/${evt.id}`)}>View results</Btn>
                    <Btn variant="danger" style={{padding:"7px 14px",fontSize:12}} onClick={()=>setConfirmDelete(evt.id)}>Delete</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {confirmDelete&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",
          alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
          <div style={{background:C.surface,border:`1px solid ${C.borderHi}`,borderRadius:14,padding:28,maxWidth:380,width:"100%"}}>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>Delete this poll?</div>
            <div style={{fontSize:13,color:C.textMid,marginBottom:24}}>This will permanently delete the poll and all responses. This cannot be undone.</div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn variant="ghost" onClick={()=>setConfirmDelete(null)} disabled={deleting}>Cancel</Btn>
              <Btn variant="danger" onClick={()=>handleDelete(confirmDelete)} disabled={deleting}>{deleting?"Deleting…":"Yes, delete it"}</Btn>
            </div>
          </div>
        </div>
      )}
    </PageWrap>
  );
}

// ── Host Create ───────────────────────────────────────────────────────────────
function HostCreate(){
  const [cal,setCal]=useState(today());
  const [availability,setAvailability]=useState({});
  const [title,setTitle]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(null);

  const days=sortedDays(availability);
  const ready=title.trim()&&days.length>0;

  async function create(){
    if(!ready) return;
    setSaving(true);
    const id=uid(), hostId=getHostId();
    await saveEvent(id,{title:title.trim(),availability,hostId});
    setDone(id); setSaving(false);
  }

  if(done){
    const guestUrl=`${location.origin}${location.pathname}#guest/${done}`;
    return(
      <PageWrap>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:13,fontWeight:500,color:C.green,marginBottom:6}}>✓ Poll created</div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:4}}>You're all set!</div>
          <div style={{fontSize:14,color:C.textMid}}>Share the guest link below. Find this poll anytime in My Polls.</div>
        </div>
        <Card><LinkBox label="Share with guests" url={guestUrl}/></Card>
        <div style={{display:"flex",gap:10,marginTop:4}}>
          <Btn variant="ghost" onClick={()=>navigate("mypolls")}>← My Polls</Btn>
          <Btn onClick={()=>navigate(`results/${done}`)}>View results →</Btn>
        </div>
      </PageWrap>
    );
  }

  return(
    <PageWrap>
      <PageHeader title="New poll" sub="Add days, and optionally a time window for each one."/>
      <FieldLabel>Event name</FieldLabel>
      <TextInput value={title} onChange={e=>setTitle(e.target.value)} placeholder="Coffee catch-up, team sync…"/>
      <FieldLabel>Your availability</FieldLabel>
      <HostDayEditor availability={availability} setAvailability={setAvailability} cal={cal}
        onPrevMonth={()=>setCal(c=>c.m===0?{y:c.y-1,m:11}:{y:c.y,m:c.m-1})}
        onNextMonth={()=>setCal(c=>c.m===11?{y:c.y+1,m:0}:{y:c.y,m:c.m+1})}/>
      <div style={{display:"flex",gap:8,margin:"20px 0",flexWrap:"wrap"}}>
        <Pill label={`${days.length} day${days.length!==1?"s":""}`}/>
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
  const [availability,setAvailability]=useState({});
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);
  const [cal,setCal]=useState(today());

  useEffect(()=>{
    loadEvent(eventId).then(e=>{
      setEvent(e); setLoading(false);
      if(e?.availability){
        const firstDay=Object.keys(e.availability).sort()[0];
        if(firstDay){ const d=new Date(firstDay+"T00:00:00"); setCal({y:d.getFullYear(),m:d.getMonth()}); }
      }
    });
  },[eventId]);

  const selectedDays=sortedDays(availability);

  async function submit(){
    if(!name.trim()||selectedDays.length===0) return;
    // validate: days with time window must have a time selected
    const needsTime=selectedDays.some(iso=>{
      const tw=event.availability[iso];
      return tw&&tw?.start&&availability[iso]===null;
    });
    if(needsTime){ alert("Please select a time for each day that has a time window."); return; }
    setSaving(true);
    await saveResponse(eventId,uid(),{name:name.trim(),availability});
    setDone(true); setSaving(false);
  }

  if(loading) return <Centered>Loading…</Centered>;
  if(!event)  return <Centered>Event not found.</Centered>;
  if(done) return(
    <PageWrap style={{textAlign:"center",paddingTop:80}}>
      <div style={{width:52,height:52,borderRadius:14,background:C.green+"22",border:`1px solid ${C.green}44`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 20px"}}>✓</div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Response saved!</div>
      <div style={{fontSize:14,color:C.textMid}}>Thanks for responding to <span style={{color:C.text,fontWeight:500}}>{event.title}</span>.</div>
    </PageWrap>
  );

  const offeredDays=sortedDays(event.availability);
  return(
    <PageWrap>
      <PageHeader title={event.title} sub="Select the days that work for you."/>
      <FieldLabel>Your name</FieldLabel>
      <TextInput value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <FieldLabel>Your availability</FieldLabel>
        <span style={{fontSize:12,color:C.textMid,marginBottom:8}}>{offeredDays.length} day{offeredDays.length!==1?"s":""} offered</span>
      </div>
      <GuestDayEditor availability={availability} setAvailability={setAvailability}
        offered={event.availability} cal={cal}
        onPrevMonth={()=>setCal(c=>c.m===0?{y:c.y-1,m:11}:{y:c.y,m:c.m-1})}
        onNextMonth={()=>setCal(c=>c.m===11?{y:c.y+1,m:0}:{y:c.y,m:c.m+1})}/>
      <div style={{display:"flex",gap:8,margin:"20px 0",flexWrap:"wrap"}}>
        <Pill label={`${selectedDays.length} day${selectedDays.length!==1?"s":""} selected`} color={selectedDays.length>0?C.accent:C.textMid}/>
      </div>
      <Btn onClick={submit} disabled={saving||!name.trim()||selectedDays.length===0} fullWidth style={{padding:"13px"}}>
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
  if(!event)  return <Centered>Event not found.</Centered>;

  const offeredDays=sortedDays(event.availability);

  return(
    <PageWrap maxWidth={680}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:28}}>
        <div>
          <button onClick={()=>navigate("mypolls")} style={{background:"none",border:"none",cursor:"pointer",
            color:C.textMid,fontSize:13,fontFamily:font,marginBottom:8,padding:0,display:"block"}}>← My Polls</button>
          <PageHeader title={event.title} sub={`${responses.length} response${responses.length!==1?"s":""} so far`} noMargin/>
        </div>
        <Btn variant="ghost" onClick={reload}>Refresh</Btn>
      </div>

      {responses.length===0?(
        <Card style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:13,color:C.textMid,marginBottom:16}}>No responses yet.</div>
          <LinkBox label="Share this guest link to get responses" url={`${location.origin}${location.pathname}#guest/${eventId}`}/>
        </Card>
      ):(
        <>
          <SectionTitle>Responses by day</SectionTitle>
          {offeredDays.map(iso=>{
            const tw=event.availability[iso];
            const hasWindow=tw&&tw?.start;
            const dayResponses=responses.filter(r=>iso in (r.availability||{}));
            return(
              <Card key={iso} style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:dayResponses.length?14:0}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text}}>{fmtDay(iso)}</div>
                    {hasWindow&&<div style={{fontSize:11,color:C.textMid,marginTop:2}}>Window: {fmtTime(tw.start)} – {fmtTime(tw.end)}</div>}
                  </div>
                  <Pill label={`${dayResponses.length} of ${responses.length} available`} color={dayResponses.length===responses.length?C.green:dayResponses.length>0?C.yellow:C.textMid}/>
                </div>
                {dayResponses.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {dayResponses.map((r,i)=>{
                      const guestTime=r.availability[iso];
                      return(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                          background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px"}}>
                          <div style={{width:24,height:24,borderRadius:"50%",background:C.accent,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>
                            {r.name?.[0]?.toUpperCase()||"?"}
                          </div>
                          <div>
                            <div style={{fontSize:12,fontWeight:500,color:C.text}}>{r.name}</div>
                            {hasWindow&&guestTime&&<div style={{fontSize:11,color:C.accent}}>{fmtTime(guestTime)}</div>}
                            {hasWindow&&!guestTime&&<div style={{fontSize:11,color:C.textDim}}>No time selected</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {dayResponses.length===0&&<div style={{fontSize:12,color:C.textDim}}>No one selected this day yet.</div>}
              </Card>
            );
          })}

          <SectionTitle>All respondents</SectionTitle>
          <Card>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {responses.map((r,i)=>{
                const days=Object.keys(r.availability||{}).length;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                    background:C.surfaceHi,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:C.accent,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>
                      {r.name?.[0]?.toUpperCase()||"?"}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:C.text}}>{r.name}</div>
                      <div style={{fontSize:11,color:C.textMid}}>{days} day{days!==1?"s":""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:20,marginTop:4}}>
            <LinkBox label="Guest link to share" url={`${location.origin}${location.pathname}#guest/${eventId}`}/>
          </div>
        </>
      )}
    </PageWrap>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
function Landing(){
  return(
    <div style={{maxWidth:440,margin:"0 auto",padding:"90px 20px 60px",textAlign:"center"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:24}}><Logo size={52} radius={14}/></div>
      <h1 style={{fontFamily:font,fontSize:36,fontWeight:800,color:C.text,margin:"0 0 12px",letterSpacing:"-.02em"}}>Gettogether</h1>
      <p style={{fontSize:15,color:C.textMid,lineHeight:1.75,margin:"0 0 40px"}}>
        The simplest way to find a time that works.<br/>
        Set your availability, share a link, done.
      </p>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
        <Btn onClick={()=>navigate("create")} style={{padding:"13px 32px",fontSize:14}}>Create a poll</Btn>
        <Btn variant="ghost" onClick={()=>navigate("mypolls")} style={{padding:"13px 32px",fontSize:14}}>My Polls</Btn>
      </div>
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
  else if(route==="mypolls")view=<MyPolls/>;
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
      <header style={{position:"sticky",top:0,zIndex:10,background:"#141414e8",backdropFilter:"blur(12px)",
        borderBottom:`1px solid #2a2a2a`,padding:"0 24px",height:52,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={()=>navigate("")} style={{background:"none",border:"none",cursor:"pointer",
          display:"flex",alignItems:"center",gap:10,padding:0}}>
          <Logo size={28} radius={8}/>
          <span style={{fontFamily:font,fontWeight:700,fontSize:15,color:C.text}}>Gettogether</span>
        </button>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn variant="ghost" onClick={()=>navigate("mypolls")} style={{padding:"6px 14px",fontSize:12}}>My Polls</Btn>
          <Btn onClick={()=>navigate("create")} style={{padding:"6px 14px",fontSize:12}}>+ New poll</Btn>
        </div>
      </header>
      {view}
    </div>
  );
}
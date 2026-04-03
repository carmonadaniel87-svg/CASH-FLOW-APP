import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

// ─── SUPABASE AUTH + DATA ────────────────────────────────────────────────────
const SUPA_URL = "https://gyypefzjnrgtkgprfglr.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5eXBlZnpqbnJndGtncHJmZ2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzQ5NTcsImV4cCI6MjA5MDc1MDk1N30.U65ZwdEdH6a1JOX7Iib9OskXB3mYqnyzqJQjnuX2RAw";
async function supaSignUp(email,password){const r=await fetch(SUPA_URL+'/auth/v1/signup',{method:'POST',headers:{'apikey':SUPA_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});return r.json();}
async function supaSignIn(email,password){const r=await fetch(SUPA_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':SUPA_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});return r.json();}
async function supaSignOut(token){try{await fetch(SUPA_URL+'/auth/v1/logout',{method:'POST',headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+token}});}catch(_){}}
async function supaLoad(token,userId){try{const r=await fetch(SUPA_URL+'/rest/v1/app_data?user_id=eq.'+userId+'&select=data',{headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+token}});const rows=await r.json();if(rows?.[0]?.data?.accounts)return rows[0].data;}catch(_){}return null;}
async function supaSave(token,userId,data){try{await fetch(SUPA_URL+'/rest/v1/app_data',{method:'POST',headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},body:JSON.stringify({user_id:userId,data,updated_at:new Date().toISOString()})});}catch(_){}}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATS = {
  ingreso: ["💰 Salario","💼 Freelance","🏦 Inversión","🏘️ Arriendo","🎁 Regalo","📈 Rendimiento","🤝 Comisión","💸 Otro"],
  gasto:   ["🏠 Vivienda","🍔 Comida","🚗 Transporte","💊 Salud","🎉 Ocio","👗 Ropa","📚 Educación","💡 Servicios","📱 Tecnología","💸 Otro"],
};
const B_COLORS  = ["#39FF14","#1565C0","#AD1457","#E65100","#6A1B9A","#00838F","#558B2F","#37474F","#F9A825","#0277BD"];
const C_COLORS  = ["#39FF14","#1565C0","#AD1457","#E65100","#6A1B9A","#008h38F","#558B2F","#FF4444","#F9A825","#0277BD","#37474F","#00695C"];
const EMOJIS    = ["💛","🏠","🚗","🌱","✈️","🎓","💡","🏦","🌐","💼","📦","🏢","📢","🔧","💰","🎯","🎵","🐶","🏋️","🍕","🎮","🌸","⭐","🔥","💎"];
const W_EMOJIS  = ["💵","🏦","💳","🪙","💴","🏧","📱","🤑","🏠","💰","💎","🏪"];
const ACC_EMOJIS= ["💛","🏠","🚗","🌱","✈️","🎓","💡","💼","🏪","🎯","⭐","🔥","💎","🌸","🎵"];
const GENERAL_ID = "general";
const PRESETS   = [{key:"today",label:"Hoy"},{key:"month",label:"Este mes"},{key:"7d",label:"7 días"},{key:"30d",label:"30 días"},{key:"all",label:"Todo"},{key:"custom",label:"Personalizado"}];

const DEFAULT_ACCOUNT = () => ({
  id: "acc_"+Date.now()+"_"+Math.floor(Math.random()*9999),
  name: "Mis finanzas", emoji:"💛", color:"#FF7043",
  transactions:[], budgets:[],
  wallets: [
    { id:"lw_ef_"+Date.now(),    name:"Efectivo",       emoji:"💵", color:"#39FF14", currency:"COP" },
    { id:"lw_ah_"+(Date.now()+1),name:"Cuenta ahorros", emoji:"🏦", color:"#1565C0", currency:"COP" },
  ],
});

// ─── UTILS ────────────────────────────────────────────────────────────────────
const sid    = v  => String(v ?? "");
const uid    = () => "id_"+Date.now()+"_"+Math.floor(Math.random()*9999);
const now    = () => new Date().toISOString();
const today  = () => new Date().toISOString().slice(0,10);
const fCOP   = n  => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n||0);
const fUSD   = n  => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n||0);
const fAmt   = (n,cur) => cur==="USD" ? fUSD(n) : fCOP(n);
const fDate  = s  => new Date(s).toLocaleDateString("es-CO",{day:"2-digit",month:"short"});
const fTime  = s  => new Date(s).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"});
const fMon   = s  => new Date(s).toLocaleDateString("es-CO",{month:"short",year:"2-digit"});
const toB64  = f  => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });

function getDateBounds(dr) {
  const end=new Date(); end.setHours(23,59,59,999);
  const start=new Date();
  if(!dr||dr.preset==="all") return null;
  if(dr.preset==="today") { start.setHours(0,0,0,0); return {from:start,to:end}; }
  if(dr.preset==="7d")     { start.setDate(start.getDate()-6); start.setHours(0,0,0,0); return {from:start,to:end}; }
  if(dr.preset==="30d")    { start.setDate(start.getDate()-29); start.setHours(0,0,0,0); return {from:start,to:end}; }
  if(dr.preset==="month")  { start.setDate(1); start.setHours(0,0,0,0); return {from:start,to:end}; }
  if(dr.preset==="custom"&&dr.from&&dr.to) {
    const f=new Date(dr.from); f.setHours(0,0,0,0);
    const t=new Date(dr.to);   t.setHours(23,59,59,999);
    return {from:f,to:t};
  }
  return null;
}
const inRange = (t,bounds) => !bounds || (new Date(t.datetime)>=bounds.from && new Date(t.datetime)<=bounds.to);

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [appData, setAppData] = useState({
    accounts: [DEFAULT_ACCOUNT()],
    activeAccountId: null,
  });
  const [loaded,      setLoaded]      = useState(false);
  const [user,        setUser]        = useState(null);
  const [authTab,     setAuthTab]     = useState('login');
  const [authEmail,   setAuthEmail]   = useState('');
  const [authPass,    setAuthPass]    = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError,   setAuthError]   = useState('');

  const [mainTab,     setMainTab]     = useState(0); // 0=dashboard 1=cuenta activa
  const [tab,         setTab]         = useState(0); // sub-tabs dentro de cuenta
  const [modal,       setModal]       = useState(null);
  const [toast,       setToast]       = useState(null);
  const [search,      setSearch]      = useState("");
  const [txFilter,    setTxFilter]    = useState(0);
  const [chTab,       setChTab]       = useState(0);
  const [dateRange,   setDateRange]   = useState({preset:"today"});
  const [showDR,      setShowDR]      = useState(false);
  const [hideWallets, setHideWallets] = useState(false);
  const [hideCOP,     setHideCOP]     = useState(false);
  const [hideUSD,     setHideUSD]     = useState(false);

  // Forms
  const [txF,  setTxF]  = useState({type:"gasto",amount:"",category:"",desc:"",budgetId:GENERAL_ID,selectedBudgets:{},multiWallet:false,walletAmounts:{},walletId:"",evidenceFile:null,evidenceName:""});
  const [bF,   setBF]   = useState({name:"",emoji:"🎯",color:"#39FF14",pct:"",goal:""});
  const [wF,   setWF]   = useState({name:"",emoji:"💵",color:"#39FF14",currency:"COP",isGlobal:false});
  const [trF,  setTrF]  = useState({trType:"budget",from:"",to:"",amount:"",currency:"COP"});
const [accF, setAccF] = useState({name:"",emoji:"💛",color:"#FF7043"});
  const [bdDR, setBdDR] = useState({preset:"all"});
  const [editingB, setEditingB] = useState(null);
  const [editingW, setEditingW] = useState(null);
const [editingAcc,setEditingAcc]=useState(null);
  const evidRef=useRef(); const amtRef=useRef();

  // ── Active account ──────────────────────────────────────────────────────────
  const activeId  = appData.activeAccountId || appData.accounts[0]?.id;
  const account   = appData.accounts.find(a=>a.id===activeId) || appData.accounts[0];
  const txs       = account?.transactions || [];
  const bgs       = account?.budgets      || [];
  const allWls    = account?.wallets      || []; // all wallets for this account

  // ── Persist ─────────────────────────────────────────────────────────────────
  useEffect(()=>{ async function load(){
    const cloud = await supaLoad();
    if(cloud && cloud.accounts){ setAppData(cloud); setLoaded(true); return; }
    try{ const r=localStorage.getItem("finanzas_v7"); if(r){ setAppData(JSON.parse(r)); setLoaded(true); return; } }catch(_){}
    setLoaded(true);
  } load(); },[]);
  useEffect(()=>{ if(!loaded)return; localStorage.setItem("finanzas_v7",JSON.stringify(appData)); },[appData,loaded]);
  useEffect(()=>{ if(modal?.type==="tx"&&amtRef.current) setTimeout(()=>amtRef.current?.focus(),130); },[modal]);

  // ── Updaters ────────────────────────────────────────────────────────────────
  const upAcc   = fn => setAppData(p=>({...p,accounts:p.accounts.map(a=>a.id===activeId?fn(a):a)}));
  const pop     = msg => { setToast(msg); setTimeout(()=>setToast(null),2800); };
  const closeM  = () => { setModal(null); setEditingB(null); setEditingW(null); setEditingAcc(null); };

  // ── Wallet helpers ──────────────────────────────────────────────────────────
  // Balance of a wallet — looks at the account that owns it
  const getWalletBal = (wid) => {
    const ownerAcc = appData.accounts.find(a=>a.wallets.some(w=>sid(w.id)===sid(wid))) || account;
    return ownerAcc.transactions.reduce((s,t)=>{
      if(t.type==="ingreso"){
        if(t.multiWallet&&t.walletAmounts) return s+(parseFloat(t.walletAmounts[sid(wid)])||0);
        if(sid(t.walletId)===sid(wid))     return s+t.amount;
      }
      if(t.type==="gasto"){
        if(t.multiWallet&&t.walletAmounts) return s-(parseFloat(t.walletAmounts[sid(wid)])||0);
        if(sid(t.walletId)===sid(wid))     return s-t.amount;
      }
      if(t.type==="wtransfer"&&sid(t.fromWallet)===sid(wid)) return s-t.amount;
      if(t.type==="wtransfer"&&sid(t.toWallet)===sid(wid))   return s+t.amount;
      return s;
    },0);
  };

  // ── Budget helpers ──────────────────────────────────────────────────────────
  // Acumulado = ingresos asignados + transferencias recibidas - transferencias enviadas
  const getAllocated = (id,bds=null) => {
    const fromIncome = txs.filter(t=>t.type==="ingreso"&&t.allocations&&(bds?inRange(t,bds):true)).reduce((s,t)=>s+(t.allocations[sid(id)]||0),0);
    const fromTrans  = txs.filter(t=>t.type==="transfer"&&(bds?inRange(t,bds):true)).reduce((s,t)=>{
      if(sid(t.to)===sid(id))   return s+t.amount;
      if(sid(t.from)===sid(id)) return s-t.amount;
      return s;
    },0);
    return fromIncome + fromTrans;
  };
  const getSpent     = (id,bds=null) => txs.filter(t=>t.type==="gasto"&&sid(t.budgetId)===sid(id)&&(bds?inRange(t,bds):true)).reduce((s,t)=>s+t.amount,0);

  const generalBalByCur = cur => txs.reduce((s,t)=>{
    if(t.type==="ingreso"){
      const w=allWls.find(w=>sid(w.id)===sid(t.walletId));
      const tc=w?.currency||"COP"; if(tc!==cur) return s;
      const asgn=t.allocations?Object.values(t.allocations).reduce((a,v)=>a+(parseFloat(v)||0),0):0;
      return s+(t.amount-asgn);
    }
    if(t.type==="gasto"&&sid(t.budgetId)===GENERAL_ID){
      const w=allWls.find(w=>sid(w.id)===sid(t.walletId));
      if((w?.currency||"COP")!==cur) return s; return s-t.amount;
    }
    if(cur==="COP"&&t.type==="transfer"&&sid(t.from)===GENERAL_ID) return s-t.amount;
    if(cur==="COP"&&t.type==="transfer"&&sid(t.to)===GENERAL_ID)   return s+t.amount;
    return s;
  },0);

  const generalBalCOP  = generalBalByCur("COP");
  const generalBalUSD  = generalBalByCur("USD");
  const generalBal     = generalBalCOP;
  const generalHasBoth = generalBalCOP>0&&generalBalUSD>0;
  const getAvail       = id => sid(id)===GENERAL_ID ? generalBal : getAllocated(id)-getSpent(id);
  const getBudgetTxs   = bid => txs.filter(t=>(t.type==="gasto"&&sid(t.budgetId)===sid(bid))||(t.type==="ingreso"&&t.allocations&&t.allocations[sid(bid)])||(t.type==="transfer"&&(sid(t.from)===sid(bid)||sid(t.to)===sid(bid))));

  // ── Filtered for period ─────────────────────────────────────────────────────
  const bounds   = getDateBounds(dateRange);
  const filtered = txs.filter(t=>inRange(t,bounds));
  const txCurrency = t => (allWls.find(w=>sid(w.id)===sid(t.walletId))?.currency)||"COP";
  const totalInCOP  = filtered.filter(t=>t.type==="ingreso"&&txCurrency(t)==="COP").reduce((s,t)=>s+t.amount,0);
  const totalInUSD  = filtered.filter(t=>t.type==="ingreso"&&txCurrency(t)==="USD").reduce((s,t)=>s+t.amount,0);
  const totalOutCOP = filtered.filter(t=>t.type==="gasto"&&txCurrency(t)==="COP").reduce((s,t)=>s+t.amount,0);
  const totalOutUSD = filtered.filter(t=>t.type==="gasto"&&txCurrency(t)==="USD").reduce((s,t)=>s+t.amount,0);
  const balanceCOP  = totalInCOP-totalOutCOP;
  const balanceUSD  = totalInUSD-totalOutUSD;
  const hasUSD      = allWls.some(w=>w.currency==="USD");
  const totalPct    = bgs.reduce((s,b)=>s+b.pct,0);

  // ── Open modals ─────────────────────────────────────────────────────────────
  const openTx = (opts={}) => {
    setTxF({type:opts.txType||"gasto",amount:"",category:"",desc:"",budgetId:opts.budgetId?sid(opts.budgetId):GENERAL_ID,selectedBudgets:{},multiWallet:false,walletAmounts:{},walletId:allWls[0]?.id||"",evidenceFile:null,evidenceName:""});
    setModal({type:"tx",budgetId:opts.budgetId?sid(opts.budgetId):null});
  };
  const openBudget  = (b=null)  => { setEditingB(b);   setBF(b?{name:b.name,emoji:b.emoji,color:b.color,pct:String(b.pct),goal:b.goal?String(b.goal):""}:{name:"",emoji:"🎯",color:"#39FF14",pct:"",goal:""}); setModal({type:"budget"}); };
  const openWallet  = (w=null)  => { setEditingW(w);   setWF(w?{name:w.name,emoji:w.emoji,color:w.color,currency:w.currency||"COP"}:{name:"",emoji:"💵",color:"#39FF14",currency:"COP"}); setModal({type:"wallet"}); };
  const openTransfer= (opts={}) => { setTrF({trType:opts.trType||"budget",from:opts.from||"",to:"",amount:"",currency:"COP"}); setModal({type:"transfer"}); };
  const openAccModal= (a=null)  => { setEditingAcc(a); setAccF(a?{name:a.name,emoji:a.emoji,color:a.color}:{name:"",emoji:"💛",color:"#FF7043"}); setModal({type:"account"}); };
  const openBudgetDetail=(b)    => { setBdDR({preset:"all"}); setModal({type:"budgetDetail",budget:b}); };

  // ── Add transaction ─────────────────────────────────────────────────────────
  async function addTx() {
    const amt=parseFloat(String(txF.amount).replace(/[^0-9,.]/g,"").replace(",","."));
    if(!amt||isNaN(amt)||!txF.category){ pop("⚠️ Completa monto y categoría"); return; }

    if(txF.type==="ingreso"){
      if(txF.multiWallet){
        const wSum=Object.values(txF.walletAmounts).reduce((s,v)=>s+(parseFloat(v)||0),0);
        if(Math.abs(wSum-amt)>1){ pop(`⚠️ Los montos suman ${fCOP(wSum)}, deben sumar ${fCOP(amt)}`); return; }
      }
      const allocations={};
      bgs.forEach(b=>{ if(txF.selectedBudgets[sid(b.id)]) allocations[sid(b.id)]=Math.round(amt*b.pct/100); });
      const t={id:uid(),type:"ingreso",amount:amt,category:txF.category,desc:txF.desc,datetime:now(),allocations,multiWallet:txF.multiWallet,walletId:txF.multiWallet?null:txF.walletId,walletAmounts:txF.multiWallet?{...txF.walletAmounts}:null};
      upAcc(a=>({...a,transactions:[t,...a.transactions]}));
      pop("💰 Ingreso registrado");
    } else {
      // GASTO — validate each wallet
      if(txF.multiWallet){
        const wSum=Object.values(txF.walletAmounts).reduce((s,v)=>s+(parseFloat(v)||0),0);
        if(Math.abs(wSum-amt)>1){ pop(`⚠️ Los montos suman ${fCOP(wSum)}, deben sumar ${fCOP(amt)}`); return; }
        // Check each wallet has enough
        for(const [wid,val] of Object.entries(txF.walletAmounts)){
          const v=parseFloat(val)||0; if(v<=0) continue;
          const bal=getWalletBal(wid);
          if(v>bal+0.01){ const w=allWls.find(x=>sid(x.id)===sid(wid)); pop(`⛔ ${w?.name||"Billetera"} solo tiene ${fCOP(bal)}`); return; }
        }
      } else {
        const bid=txF.budgetId||GENERAL_ID;
        const avail=getAvail(bid);
        if(amt>avail+0.01){ pop(`⛔ Saldo insuficiente — disponible ${fCOP(avail)}`); return; }
        const walBal=getWalletBal(txF.walletId);
        if(txF.walletId&&amt>walBal+0.01){ const w=allWls.find(x=>sid(x.id)===sid(txF.walletId)); pop(`⛔ ${w?.name||"Billetera"} solo tiene ${fCOP(walBal)}`); return; }
      }
      let evidence=null;
      if(txF.evidenceFile){ try{ evidence=await toB64(txF.evidenceFile); }catch(_){} }
      const bid=txF.budgetId||GENERAL_ID;
      const t={id:uid(),type:"gasto",amount:amt,category:txF.category,desc:txF.desc,datetime:now(),budgetId:bid,multiWallet:txF.multiWallet,walletId:txF.multiWallet?null:txF.walletId,walletAmounts:txF.multiWallet?{...txF.walletAmounts}:null,...(evidence?{evidence}:{})};
      upAcc(a=>({...a,transactions:[t,...a.transactions]}));
      pop("📝 Gasto registrado");
    }
    closeM();
  }

  // ── Budget CRUD ─────────────────────────────────────────────────────────────
  const saveBudget = () => {
    const pct=parseFloat(bF.pct); if(!bF.name||isNaN(pct)||pct<=0) return;
    const goal=bF.goal?parseFloat(String(bF.goal).replace(/[^0-9,.]/g,"").replace(",",".")):null;
    if(editingB) upAcc(a=>({...a,budgets:a.budgets.map(b=>b.id===editingB.id?{...b,...bF,pct,goal}:b)}));
    else         upAcc(a=>({...a,budgets:[...a.budgets,{id:uid(),...bF,pct,goal}]}));
    pop(editingB?"✅ Actualizado":"🎯 Presupuesto creado"); closeM();
  };
  const delBudget = id => { upAcc(a=>({...a,budgets:a.budgets.filter(b=>sid(b.id)!==sid(id))})); pop("🗑️ Eliminado"); };
  const delTx     = id => { upAcc(a=>({...a,transactions:a.transactions.filter(t=>sid(t.id)!==sid(id))})); pop("🗑️ Eliminado"); };

  // ── Wallet CRUD ─────────────────────────────────────────────────────────────
  const saveWallet = () => {
    if(!wF.name) return;
    if(editingW) upAcc(a=>({...a,wallets:a.wallets.map(w=>sid(w.id)===sid(editingW.id)?{...w,...wF}:w)}));
    else         upAcc(a=>({...a,wallets:[...a.wallets,{id:uid(),...wF}]}));
    pop(editingW?"✅ Actualizado":"💳 Billetera creada"); closeM();
  };
  const delWallet = w => {
    upAcc(a=>({...a,wallets:a.wallets.filter(x=>sid(x.id)!==sid(w.id))}));
    pop("🗑️ Eliminada");
  };

  // ── Account CRUD ─────────────────────────────────────────────────────────────
  const saveAccount = () => {
    if(!accF.name) return;
    if(editingAcc){
      setAppData(p=>({...p,accounts:p.accounts.map(a=>a.id===editingAcc.id?{...a,...accF}:a)}));
      pop("✅ Cuenta actualizada");
    } else {
      const newAcc={...DEFAULT_ACCOUNT(),...accF,id:uid()};
      setAppData(p=>({...p,accounts:[...p.accounts,newAcc],activeAccountId:newAcc.id}));
      pop("✨ Cuenta creada"); setMainTab(1);
    }
    closeM();
  };
  const delAccount = id => {
    setAppData(p=>{
      const remaining=p.accounts.filter(a=>a.id!==id);
      return {...p,accounts:remaining.length?remaining:[DEFAULT_ACCOUNT()],activeAccountId:remaining[0]?.id||null};
    }); pop("🗑️ Cuenta eliminada"); closeM();
  };
  const switchAccount = id => { setAppData(p=>({...p,activeAccountId:id})); setMainTab(1); };

  // ── Transfer ─────────────────────────────────────────────────────────────────
  const doTransfer = () => {
    const amt=parseFloat(String(trF.amount).replace(/[^0-9,.]/g,"").replace(",","."));
    if(!amt||isNaN(amt)||!trF.from||!trF.to||trF.from===trF.to){ pop("⚠️ Completa origen y destino distintos"); return; }
    if(trF.trType==="wallet"){
      const fromBal=getWalletBal(trF.from);
      if(amt>fromBal+0.01){ pop(`⛔ Saldo insuficiente — disponible ${fCOP(fromBal)}`); return; }
      const fw=allWls.find(w=>sid(w.id)===trF.from), tw=allWls.find(w=>sid(w.id)===trF.to);
      upAcc(a=>({...a,transactions:[{id:uid(),type:"wtransfer",amount:amt,fromWallet:sid(trF.from),toWallet:sid(trF.to),datetime:now(),category:"↔️ Billeteras",desc:`${fw?.emoji||""} ${fw?.name||""} → ${tw?.emoji||""} ${tw?.name||""}`},...a.transactions]}));
      pop("↔️ Transferencia entre billeteras");
    } else {
      const avail=sid(trF.from)===GENERAL_ID?(trF.currency==="USD"?generalBalUSD:generalBalCOP):getAvail(trF.from);
      if(amt>avail+0.01){ pop(`⛔ Saldo insuficiente — disponible ${fCOP(avail)}`); return; }
      const fn=trF.from===GENERAL_ID?"Bolsillo general":bgs.find(b=>sid(b.id)===trF.from)?.name||"";
      const tn=trF.to===GENERAL_ID?"Bolsillo general":bgs.find(b=>sid(b.id)===trF.to)?.name||"";
      upAcc(a=>({...a,transactions:[{id:uid(),type:"transfer",amount:amt,from:sid(trF.from),to:sid(trF.to),datetime:now(),category:"↔️ Transferencia",desc:`${fn} → ${tn}`},...a.transactions]}));
      pop("↔️ Transferencia realizada");
    }
    closeM();
  };

  // ── Chart helpers ─────────────────────────────────────────────────────────────
  const catData = type => { const m={}; filtered.filter(t=>t.type===type).forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; }); return Object.entries(m).map(([k,v],i)=>({name:k.split(" ").slice(1).join(" "),full:k,value:v,color:C_COLORS[i%C_COLORS.length]})).sort((a,b)=>b.value-a); };
  const monthlyData = () => { const m={}; txs.filter(t=>["ingreso","gasto","transfer","wtransfer"].includes(t.type)).forEach(t=>{ const k=fMon(t.datetime); if(!m[k]) m[k]={month:k,ingresos:0,gastos:0,transferencias:0}; if(t.type==="ingreso") m[k].ingresos+=t.amount; else if(t.type==="gasto") m[k].gastos+=t.amount; else m[k].transferencias+=t.amount; }); return Object.values(m).slice(-6); };
  const budgetChartData = () => bgs.map(b=>({name:b.name,acumulado:getAllocated(sid(b.id),bounds),gastado:getSpent(sid(b.id),bounds),color:b.color}));
  const listTxs = filtered.filter(t=>{ if(txFilter===1&&t.type!=="ingreso") return false; if(txFilter===2&&t.type!=="gasto"&&t.type!=="transfer"&&t.type!=="wtransfer") return false; if(search){ const q=search.toLowerCase(); return (t.category||"").toLowerCase().includes(q)||(t.desc||"").toLowerCase().includes(q); } return true; });

  // Dashboard data — sum all wallets across all accounts
  const dashAllWls   = appData.accounts.flatMap(a=>a.wallets);
  const dashTotalCOP = dashAllWls.filter(w=>(w.currency||"COP")!=="USD").reduce((s,w)=>s+getWalletBal(w.id),0);
  const dashTotalUSD = dashAllWls.filter(w=>w.currency==="USD").reduce((s,w)=>s+getWalletBal(w.id),0);

  // ── EXPORT FUNCTIONS ───────────────────────────────────────────────────────
  const [showExport, setShowExport] = useState(false);
  const [exportPeriod, setExportPeriod] = useState("current");
  const [downloadLinks, setDownloadLinks] = useState([]); // "current" | "all"

  function fmtDT(iso) { try{ return new Date(iso).toLocaleString("es-CO"); }catch(_){ return iso||""; } }

  // ── CSV EXPORT ─────────────────────────────────────────────────────────────
  function toCSV(rows) {
    if(!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape  = v => { const s=String(v??''); return s.includes(',')|| s.includes('"')||s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; };
    return [headers.map(escape).join(','), ...rows.map(r=>headers.map(h=>escape(r[h])).join(','))].join('\n');
  }

  function downloadCSV(csv, filename) {
    const bom  = '\uFEFF';
    const blob = new Blob([bom+csv], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    setDownloadLinks(prev=>[{url, filename, ts:Date.now()}, ...prev.slice(0,4)]);
  }

  function getExportTxs() {
    const b = exportPeriod==="current" ? bounds : null;
    return b ? txs.filter(t=>inRange(t,b)) : txs;
  }

  function exportMovimientos() {
    try {
      const rows = getExportTxs().map(t=>({
        "Fecha":       fmtDT(t.datetime),
        "Tipo":        t.type==="ingreso"?"Ingreso":t.type==="gasto"?"Gasto":"Transferencia",
        "Categoría":   t.category||"",
        "Descripción": t.desc||"",
        "Billetera":   t.walletId?(allWls.find(w=>sid(w.id)===sid(t.walletId))?.name||""):t.multiWallet?"Múltiple":"",
        "Presupuesto": t.budgetId&&t.budgetId!==GENERAL_ID?(bgs.find(b=>sid(b.id)===sid(t.budgetId))?.name||""):"General",
        "Monto":       t.type==="gasto"?-t.amount:t.amount,
      }));
      downloadCSV(toCSV(rows), `movimientos_${account?.name||"cuenta"}_${today()}.csv`);
      pop("📥 Descargando movimientos...");
    } catch(e){ pop("❌ Error al exportar: "+e.message); }
  }

  function exportCategorias() {
    try {
      const inMap={}, outMap={};
      getExportTxs().forEach(t=>{ if(t.type==="ingreso") inMap[t.category]=(inMap[t.category]||0)+t.amount; if(t.type==="gasto") outMap[t.category]=(outMap[t.category]||0)+t.amount; });
      const cats=[...new Set([...Object.keys(inMap),...Object.keys(outMap)])];
      const rows=cats.map(c=>({ "Categoría":c, "Ingresos":inMap[c]||0, "Gastos":outMap[c]||0, "Neto":(inMap[c]||0)-(outMap[c]||0) }));
      downloadCSV(toCSV(rows), `categorias_${account?.name||"cuenta"}_${today()}.csv`);
      pop("📥 Descargando categorías...");
    } catch(e){ pop("❌ Error: "+e.message); }
  }

  function exportPresupuestos() {
    try {
      const expBounds=exportPeriod==="current"?bounds:null;
      const rows=bgs.map(b=>({
        "Presupuesto":  b.name,
        "% asignado":   b.pct,
        "Meta":         b.goal||"Sin meta",
        "Acumulado":    getAllocated(sid(b.id),expBounds),
        "Gastado":      getSpent(sid(b.id),expBounds),
        "Disponible":   getAvail(sid(b.id)),
      }));
      rows.push({"Presupuesto":"Bolsillo general","% asignado":"","Meta":"","Acumulado":"","Gastado":"","Disponible":generalBalCOP});
      downloadCSV(toCSV(rows), `presupuestos_${account?.name||"cuenta"}_${today()}.csv`);
      pop("📥 Descargando presupuestos...");
    } catch(e){ pop("❌ Error: "+e.message); }
  }

  function exportBilleteras() {
    try {
      const rows=allWls.map(w=>({ "Billetera":w.name, "Moneda":w.currency||"COP", "Saldo":getWalletBal(w.id) }));
      downloadCSV(toCSV(rows), `billeteras_${account?.name||"cuenta"}_${today()}.csv`);
      pop("📥 Descargando billeteras...");
    } catch(e){ pop("❌ Error: "+e.message); }
  }

  function exportDashboard() {
    try {
      const rows=appData.accounts.flatMap(a=>a.wallets.map(w=>({
        "Cuenta":     a.name,
        "Billetera":  w.name,
        "Moneda":     w.currency||"COP",
        "Saldo":      getWalletBal(w.id),
      })));
      downloadCSV(toCSV(rows), `dashboard_consolidado_${today()}.csv`);
      pop("📥 Descargando dashboard...");
    } catch(e){ pop("❌ Error: "+e.message); }
  }

    const REPORTS = [
    { key:"mov",     label:"Movimientos",            desc:"Todos los ingresos y egresos con detalle", icon:"↕", fn:exportMovimientos },
    { key:"cat",     label:"Resumen por categoría",  desc:"Totales agrupados por categoría",          icon:"⊞", fn:exportCategorias },
    { key:"bud",     label:"Presupuestos",            desc:"Estado de cada presupuesto y meta",        icon:"◎", fn:exportPresupuestos },
    { key:"wal",     label:"Billeteras",              desc:"Saldo actual por billetera",               icon:"▣", fn:exportBilleteras },
    { key:"dash",    label:"Dashboard consolidado",   desc:"Resumen de todas las cuentas",             icon:"◈", fn:exportDashboard },
  ];

  const periodLabel = () => { if(dateRange.preset==="all") return "Todo el tiempo"; if(dateRange.preset==="today") return "Hoy"; if(dateRange.preset==="7d") return "7 días"; if(dateRange.preset==="30d") return "30 días"; if(dateRange.preset==="month") return "Este mes"; if(dateRange.preset==="custom"&&dateRange.from&&dateRange.to) return `${fDate(dateRange.from+"T00:00:00")} – ${fDate(dateRange.to+"T00:00:00")}`; return ""; };

  // ── Palette & styles ──────────────────────────────────────────────────────────
  // Dark neon palette — always the same regardless of account color
  const pal = {
    bg:        "#0A0A0A",
    card:      "#111111",
    card2:     "#0D0D0D",
    border:    "#1A1A1A",
    border2:   "#1E1E1E",
    accent:    "#39FF14",
    accentDim: "#39FF1415",
    accentBorder:"#39FF1425",
    red:       "#FF4444",
    redDim:    "#FF444412",
    redBorder: "#FF444425",
    text:      "#F0F0F0",
    textMuted: "#888888",
    textDim:   "#444444",
    monoFont:  "'JetBrains Mono',monospace",
    headFont:  "'Space Grotesk',sans-serif",
  };

  const g = {
    // Layout
    app:      { minHeight:"100vh", background:pal.bg, fontFamily:"'Nunito',sans-serif", paddingBottom:90 },
    hdr:      { padding:"20px 18px 0" },
    // Account row
    accRow:   { display:"flex", alignItems:"center", gap:10, marginBottom:12 },
    accBadge: { display:"flex", alignItems:"center", gap:8, background:pal.card, borderRadius:12, padding:"7px 12px", border:`1px solid ${pal.border}`, flex:1, cursor:"pointer" },
    accEmoji: { fontSize:20 },
    accName:  { flex:1, fontWeight:800, fontSize:14, color:pal.text, margin:0, fontFamily:pal.headFont },
    accSub:   { fontSize:10, color:pal.accent, opacity:.55, margin:"1px 0 0" },
    // Main tabs
    mainTabs: { display:"flex", gap:6, marginBottom:14 },
    mTab:     a=>({ flex:1, padding:"9px 0", borderRadius:12, border:`1px solid ${a?pal.accent:pal.border}`, background:a?pal.accentDim:"transparent", color:a?pal.accent:pal.textDim, fontFamily:pal.headFont, fontWeight:800, fontSize:12, cursor:"pointer" }),
    // Balance hero
    heroCard: { background:"#001400", border:`1px solid ${pal.accentBorder}`, borderRadius:16, padding:"18px 16px", marginBottom:12 },
    heroLbl:  { fontSize:10, color:pal.accent, margin:"0 0 6px", textTransform:"uppercase", letterSpacing:"1.5px", fontWeight:700, opacity:.7, fontFamily:pal.headFont },
    heroAmt:  { fontSize:34, fontWeight:900, color:pal.accent, margin:0, fontFamily:pal.headFont, lineHeight:1 },
    heroCur:  { fontSize:11, color:pal.accent, opacity:.4, margin:"5px 0 0" },
    // Summary cards
    sumRow:   { display:"flex", gap:8, marginBottom:12, padding:"0 18px" },
    sCard:    (c,bg)=>({ flex:1, background:bg||pal.card2, border:`1px solid ${pal.border}`, borderLeft:`3px solid ${c}`, borderRadius:"0 12px 12px 0", padding:"12px 13px" }),
    sLbl:     c=>({ fontSize:10, color:c, margin:"0 0 4px", opacity:.6, textTransform:"uppercase", letterSpacing:".5px", fontFamily:pal.headFont }),
    sVal:     c=>({ fontSize:16, fontWeight:800, color:c, margin:0, fontFamily:pal.headFont }),
    sPer:     { fontSize:10, color:pal.textDim, margin:"3px 0 0", fontWeight:600 },
    // Dashboard
    dashCard: { background:pal.card, borderRadius:14, padding:14, marginBottom:10, border:`1px solid ${pal.border}` },
    dashTot:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 },
    totCard:  c=>({ background:c+"18", borderRadius:12, padding:"10px 13px", border:`1px solid ${c}25` }),
    totLbl:   c=>({ fontSize:10, fontWeight:800, color:c, textTransform:"uppercase", letterSpacing:.8, margin:0, fontFamily:pal.headFont }),
    totVal:   c=>({ fontSize:16, fontWeight:900, color:c, margin:"4px 0 0", fontFamily:pal.headFont }),
    walletRow:{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", background:pal.card, borderRadius:12, marginBottom:6, border:`1px solid ${pal.border}` },
    walletIcon:c=>({ width:34, height:34, borderRadius:9, background:c+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }),
    walletInfo:{ flex:1, minWidth:0 },
    walletName:{ fontWeight:800, fontSize:13, color:pal.text, margin:0, fontFamily:pal.headFont },
    walletSub: { fontSize:10, color:pal.textDim, margin:"1px 0 0" },
    walletAmt: c=>({ fontWeight:900, fontSize:14, color:c, whiteSpace:"nowrap", fontFamily:pal.headFont }),
    breakRow:  { display:"flex", justifyContent:"space-between", fontSize:11, color:pal.textDim, padding:"2px 0" },
    globalPill:{ fontSize:10, background:"#88878018", color:"#888780", padding:"1px 7px", borderRadius:20, fontWeight:700 },
    localPill: c=>({ fontSize:10, background:c+"18", color:c, padding:"1px 7px", borderRadius:20, fontWeight:700 }),
    // Date range
    drBar:    { display:"flex", gap:5, padding:"0 18px 10px", overflowX:"auto" },
    drBtn:    a=>({ flexShrink:0, padding:"5px 12px", borderRadius:20, border:`1px solid ${a?pal.accent:pal.border2}`, background:a?pal.accentDim:"transparent", color:a?pal.accent:pal.textDim, fontFamily:pal.headFont, fontWeight:700, fontSize:11, cursor:"pointer" }),
    // Wallet cards row
    wRow:     { display:"flex", gap:9, padding:"0 18px 12px", overflowX:"auto" },
    wCard:    w=>({ minWidth:130, background:pal.card, borderRadius:14, padding:"11px 13px", border:`1px solid ${pal.border}`, borderTop:`3px solid ${w.color}`, flexShrink:0, cursor:"pointer" }),
    wLbl:     c=>({ fontSize:10, fontWeight:800, color:c, letterSpacing:.8, textTransform:"uppercase", margin:0, fontFamily:pal.headFont }),
    wVal:     c=>({ fontSize:15, fontWeight:900, color:c, margin:"4px 0 0", fontFamily:pal.headFont }),
    // Eye toggles
    eyeRow:   { display:"flex", alignItems:"center", padding:"0 18px 5px" },
    eyeLbl:   { flex:1, fontSize:10, fontWeight:800, color:pal.textDim, textTransform:"uppercase", letterSpacing:.8, margin:0 },
    eyeBtn:   { background:"none", border:"none", cursor:"pointer", fontSize:15, opacity:.5, padding:"0 2px" },
    // Bolsillo general
    genCard:  { background:pal.card, borderRadius:16, padding:14, marginBottom:10, border:`1px solid ${pal.border}`, borderLeft:"5px solid #444" },
    genRow:   { display:"flex", alignItems:"center", gap:10 },
    genIcon:  { width:36, height:36, borderRadius:10, background:"#44444418", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 },
    // Tabs
    tabs:     { display:"flex", padding:"0 18px", gap:6, marginBottom:14 },
    tab:      a=>({ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, padding:"13px 4px", borderRadius:50, border:`1px solid ${a?pal.accent:pal.border2}`, background:a?pal.accent:"transparent", cursor:"pointer", transition:"all .2s" }),
    tabIcon:  a=>({ /* SVG color handled inline */ }),
    tabLbl:   a=>({ fontSize:10, fontWeight:800, color:a?"#000":pal.textDim, fontFamily:pal.headFont, lineHeight:1 }),
    sec:      { padding:"0 18px" },
    // Search & filter
    srchWrap: { position:"relative", marginBottom:10 },
    srchInp:  { width:"100%", padding:"9px 13px 9px 34px", borderRadius:11, border:`1px solid ${pal.border}`, fontFamily:"'Nunito',sans-serif", fontWeight:600, fontSize:13, color:pal.text, background:pal.card, boxSizing:"border-box", outline:"none" },
    srchIcon: { position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", fontSize:14, opacity:.4 },
    fRow:     { display:"flex", gap:7, marginBottom:12 },
    fBtn:     a=>({ flex:1, padding:"6px 4px", borderRadius:20, border:`1px solid ${a?pal.accent:pal.border}`, background:a?pal.accent:"transparent", color:a?"#000":pal.textDim, fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:11, cursor:"pointer" }),
    // TX list
    txList:   { display:"flex", flexDirection:"column", gap:7 },
    txItem:   { background:pal.card, borderRadius:13, padding:"11px 12px", display:"flex", alignItems:"center", gap:9, border:`1px solid ${pal.border}` },
    txIcon:   c=>({ width:34, height:34, borderRadius:9, background:c+"15", border:`1px solid ${c}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }),
    txInfo:   { flex:1, minWidth:0 },
    txCat:    { fontWeight:800, fontSize:13, color:pal.text, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:pal.headFont },
    txSub:    { fontSize:11, color:pal.textDim, margin:"1px 0 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    txMeta:   { fontSize:10, color:"#333", margin:"2px 0 0", fontFamily:pal.monoFont },
    txAmt:    t=>({ fontWeight:900, fontSize:14, color:t==="ingreso"?pal.accent:t==="transfer"||t==="wtransfer"?"#4499FF":pal.red, whiteSpace:"nowrap", fontFamily:pal.headFont }),
    delBtn:   { background:"none", border:"none", cursor:"pointer", fontSize:13, opacity:.2, color:pal.text, padding:"0 2px", flexShrink:0 },
    // Budget cards
    bgCard:   b=>({ background:pal.card, borderRadius:16, padding:14, marginBottom:10, border:`1px solid ${pal.border}`, borderLeft:`5px solid ${b.color}`, cursor:"pointer" }),
    bgHdr:    { display:"flex", alignItems:"center", gap:8, marginBottom:10 },
    bgName:   { flex:1, fontWeight:800, fontSize:14, color:pal.text, margin:0, overflow:"hidden", textOverflow:"ellipsis", fontFamily:pal.headFont },
    bgPct:    b=>({ flexShrink:0, fontWeight:900, fontSize:11, color:b.color, background:b.color+"22", padding:"2px 9px", borderRadius:20 }),
    bgMini:   { display:"flex", gap:8, marginBottom:10 },
    bgMiniC:  (c,bg)=>({ flex:1, background:bg||c+"18", borderRadius:10, padding:"7px 10px", border:`1px solid ${c}25` }),
    bgMiniL:  c=>({ fontSize:10, fontWeight:800, color:c, textTransform:"uppercase", letterSpacing:.5, margin:0 }),
    bgMiniV:  c=>({ fontSize:13, fontWeight:900, color:c, margin:"3px 0 0", fontFamily:pal.headFont }),
    bgActs:   { display:"flex", justifyContent:"space-between", alignItems:"center" },
    bgBtns:   { display:"flex", gap:6 },
    smBtn:    c=>({ padding:"4px 10px", fontSize:11, fontWeight:600, color:c||pal.textMuted, border:`1px solid ${c||pal.border}`, borderRadius:20, background:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }),
    gastBtn:  b=>({ padding:"5px 12px", fontSize:11, fontWeight:800, color:b.color, border:`1.5px solid ${b.color}`, borderRadius:20, background:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }),
    addDash:  { display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:12, borderRadius:13, border:`1.5px dashed ${pal.accent}`, background:"transparent", color:pal.accent, fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:13, cursor:"pointer", marginTop:4, boxSizing:"border-box" },
    pctInfo:  ok=>({ textAlign:"center", padding:"7px 12px", borderRadius:10, background:ok?"#003300":"#331a00", color:ok?pal.accent:"#FF8800", fontSize:12, fontWeight:700, marginBottom:12, border:`1px solid ${ok?pal.accent+"33":"#FF880033"}` }),
    prBg:     { height:7, background:pal.border, borderRadius:7, overflow:"hidden", marginBottom:5 },
    prFill:   (c,p)=>({ height:"100%", width:`${Math.min(p,100)}%`, background:c, borderRadius:7, transition:"width .5s" }),
    // Modal
    overlay:  { position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:200, display:"flex", alignItems:"flex-end" },
    drawer:   { background:"#0D0D0D", borderRadius:"22px 22px 0 0", padding:"22px 18px 36px", width:"100%", boxSizing:"border-box", maxHeight:"93vh", overflowY:"auto", border:`1px solid ${pal.border}` },
    dTitle:   { fontWeight:900, fontSize:17, color:pal.text, margin:"0 0 14px", fontFamily:pal.headFont },
    typeTog:  { display:"flex", background:pal.border, borderRadius:11, padding:3, gap:3, marginBottom:12 },
    typeBtn:  (a,t)=>({ flex:1, padding:"8px 0", borderRadius:9, border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:13, background:a?(t==="ingreso"?"#003300":t==="neutral"?pal.card:"#330000"):"transparent", color:a?(t==="ingreso"?pal.accent:t==="neutral"?pal.text:pal.red):pal.textDim }),
    lbl:      { fontSize:11, fontWeight:800, color:pal.textMuted, letterSpacing:.5, display:"block", marginBottom:5, textTransform:"uppercase" },
    inp:      { width:"100%", padding:"10px 13px", borderRadius:11, border:`1px solid ${pal.border2}`, fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:15, color:pal.text, background:pal.card, boxSizing:"border-box", outline:"none", marginBottom:11 },
    inp2:     { width:"100%", padding:"8px 10px", borderRadius:9, border:`1px solid ${pal.border2}`, fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:14, color:pal.text, background:pal.card, boxSizing:"border-box", outline:"none" },
    sel:      { width:"100%", padding:"10px 13px", borderRadius:11, border:`1px solid ${pal.border2}`, fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:14, color:pal.text, background:pal.card, boxSizing:"border-box", outline:"none", marginBottom:11 },
    catGrid:  { display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6, marginBottom:12 },
    catBtn:   a=>({ padding:"8px 6px", borderRadius:10, border:`1px solid ${a?pal.accent:pal.border2}`, background:a?pal.accentDim:pal.card, color:a?pal.accent:pal.textDim, fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:11, cursor:"pointer", textAlign:"center" }),
    egGrid:   { display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 },
    egBtn:    a=>({ width:38, height:38, borderRadius:9, border:`1px solid ${a?pal.accent:pal.border2}`, background:a?pal.accentDim:pal.card, fontSize:17, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }),
    colGrid:  { display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 },
    colDot:   (c,a)=>({ width:28, height:28, borderRadius:"50%", background:c, border:a?`3px solid ${pal.accent}`:"3px solid transparent", cursor:"pointer" }),
    saveBtn:  { width:"100%", padding:14, borderRadius:13, border:"none", background:pal.accent, color:"#000", fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:15, cursor:"pointer", marginTop:4 },
    bPick:    a=>({ display:"flex", alignItems:"center", gap:10, background:pal.card, borderRadius:12, padding:"9px 12px", border:`1px solid ${a?"currentColor":pal.border2}`, marginBottom:7, cursor:"pointer" }),
    fab:      { position:"fixed", bottom:26, right:22, width:52, height:52, borderRadius:"50%", background:pal.accent, border:"none", color:"#000", fontSize:25, cursor:"pointer", boxShadow:`0 0 24px ${pal.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 },
    empty:    { textAlign:"center", padding:"30px 20px", opacity:.32 },
    toast_:   { position:"fixed", bottom:92, left:"50%", transform:"translateX(-50%)", background:pal.accent, color:"#000", padding:"9px 20px", borderRadius:20, fontWeight:800, fontSize:13, zIndex:500, whiteSpace:"nowrap", pointerEvents:"none", fontFamily:pal.headFont },
    // Charts
    chTabs:   { display:"flex", gap:6, padding:"0 18px", marginBottom:12, overflowX:"auto" },
    chTab:    a=>({ flexShrink:0, padding:"5px 12px", borderRadius:20, border:`1px solid ${a?pal.accent:pal.border}`, background:a?pal.accentDim:"transparent", color:a?pal.accent:pal.textDim, fontFamily:pal.headFont, fontWeight:700, fontSize:11, cursor:"pointer" }),
    chCard:   { background:pal.card, borderRadius:16, padding:16, marginBottom:12, border:`1px solid ${pal.border}` },
    chTitle:  { fontWeight:800, fontSize:13, color:pal.text, margin:"0 0 12px", fontFamily:pal.headFont },
    legRow:   { display:"flex", alignItems:"center", gap:8, padding:"3px 0" },
    legDot:   c=>({ width:10, height:10, borderRadius:"50%", background:c, flexShrink:0 }),
    legName:  { flex:1, fontSize:12, fontWeight:700, color:pal.text },
    legVal:   { fontSize:12, fontWeight:800, color:pal.text, fontFamily:pal.headFont },
    // Export button
    exportBtn:{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, width:"100%", padding:13, borderRadius:13, border:`1.5px solid #4499FF`, background:"#4499FF18", color:"#4499FF", fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:13, cursor:"pointer", marginTop:4, boxSizing:"border-box" },
  };

  const CTip = ({active,payload,label})=>{
    if(!active||!payload?.length) return null;
    return <div style={{background:"#111",border:"1px solid #1A1A1A",borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:700,color:"#F0F0F0"}}>
      {label&&<p style={{margin:"0 0 4px",color:"#333"}}>{label}</p>}
      {payload.map((p,i)=><p key={i} style={{margin:"2px 0",color:p.color||p.fill}}>{p.name}: {fCOP(p)}</p>)}
    </div>;
  };

  // ── TX Row ───────────────────────────────────────────────────────────────────
  function TxRow({t,onDel}) {
    const [showImg,setShowImg]=useState(false);
    const bud=t.budgetId&&t.budgetId!==GENERAL_ID?bgs.find(b=>sid(b.id)===sid(t.budgetId)):null;
    const wal=t.walletId?allWls.find(w=>sid(w.id)===sid(t.walletId)):null;
    const ic=t.type==="ingreso"?"#39FF14":t.type==="transfer"||t.type==="wtransfer"?"#4499FF":"#FF4444";
    const mwLabels=t.multiWallet&&t.walletAmounts?Object.entries(t.walletAmounts).map(([wid,v])=>{ const w=allWls.find(x=>sid(x.id)===sid(wid)); return w?`${w.emoji} ${fCOP(parseFloat(v)||0)}`:null; }).filter(Boolean):[];
    return <>
      <div style={g.txItem}>
        <div style={g.txIcon(ic)}>{(t.category||"💸").split(" ")[0]}</div>
        <div style={g.txInfo}>
          <p style={g.txCat}>{(t.category||"").split(" ").slice(1).join(" ")||t.category}</p>
          {t.desc&&<p style={g.txSub}>{t.desc}</p>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:1}}>
            {mwLabels.map((l,i)=><span key={i} style={{fontSize:10,color:ic,fontWeight:700}}>{l}</span>)}
            {wal&&!t.multiWallet&&<span style={{fontSize:10,color:wal.color,fontWeight:700}}>{wal.emoji} {wal.name}{wal.currency==="USD"?" · USD":""}</span>}
            {bud&&<span style={{fontSize:10,color:bud.color,fontWeight:700}}>→ {bud.emoji} {bud.name}</span>}
            {t.budgetId===GENERAL_ID&&t.type==="gasto"&&<span style={{fontSize:10,color:"#888780",fontWeight:700}}>→ 👝 General</span>}
          </div>
          <p style={g.txMeta}>{fDate(t.datetime)} · {fTime(t.datetime)}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
          <p style={g.txAmt(t.type)}>{t.type==="ingreso"?"+":t.type==="transfer"||t.type==="wtransfer"?"↔":"-"}{fCOP(t.amount)}</p>
          {t.evidence&&<span onClick={()=>setShowImg(v=>!v)} style={{fontSize:11,cursor:"pointer",color:"#1565C0",fontWeight:700}}>📎 ver</span>}
        </div>
        <button style={g.delBtn} onClick={()=>onDel(t.id)}>✕</button>
      </div>
      {showImg&&t.evidence&&<div style={{background:"#111",borderRadius:13,padding:10,marginTop:-4,border:"1px solid #1A1A1A"}}><img src={t.evidence} alt="evidencia" style={{width:"100%",borderRadius:8,maxHeight:200,objectFit:"cover"}}/></div>}
    </>;
  }


  // ── Auth ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if(!authEmail||!authPass){setAuthError('Completa email y contraseña');return;}
    setAuthLoading(true);setAuthError('');
    try {
      const d = authTab==='register' ? await supaSignUp(authEmail,authPass) : await supaSignIn(authEmail,authPass);
      if(d.error||d.msg){setAuthError(d.error?.message||d.msg||'Error');setAuthLoading(false);return;}
      const token=d.access_token, userId=d.user?.id;
      if(!token){setAuthError('No se pudo obtener sesión');setAuthLoading(false);return;}
      window._supaToken=token; window._supaUserId=userId;
      setUser({token,userId,email:authEmail});
      const cloud=await supaLoad(token,userId);
      if(cloud&&cloud.accounts){setAppData(cloud);}
      else{try{const r=localStorage.getItem("finanzas_v7");if(r){const d2=JSON.parse(r);setAppData(d2);await supaSave(token,userId,d2);}}catch(_){}}
    } catch(e){setAuthError('Error de conexión');}
    setAuthLoading(false);
  }
  async function handleLogout(){
    if(user?.token)await supaSignOut(user.token);
    window._supaToken=null;window._supaUserId=null;
    setUser(null);setAuthEmail('');setAuthPass('');
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  if(!user) return <div style={{minHeight:'100vh',background:'#0A0A0A',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Nunito',sans-serif"}}>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;700;800;900&display=swap" rel="stylesheet"/>
    <div style={{background:'#111',borderRadius:20,padding:'32px 28px',width:'100%',maxWidth:360,border:'1px solid #1A1A1A'}}>
      <div style={{textAlign:'center',marginBottom:24}}>
        <div style={{fontSize:40}}>💸</div>
        <h1 style={{color:'#39FF14',fontFamily:"'Space Grotesk',sans-serif",fontWeight:900,fontSize:24,margin:0}}>Cash Flow App</h1>
        <p style={{color:'#555',fontSize:13,margin:'6px 0 0'}}>Controla tu dinero</p>
      </div>
      <div style={{display:'flex',background:'#1A1A1A',borderRadius:10,padding:3,marginBottom:20,gap:3}}>
        {['login','register'].map(t=><button key={t} onClick={()=>{setAuthTab(t);setAuthError('');}} style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',cursor:'pointer',fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:13,background:authTab===t?'#39FF14':'transparent',color:authTab===t?'#000':'#555'}}>{t==='login'?'Ingresar':'Registrarse'}</button>)}
      </div>
      <div style={{marginBottom:12}}>
        <label style={{fontSize:11,fontWeight:800,color:'#666',display:'block',marginBottom:5}}>Email</label>
        <input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="tu@email.com" style={{width:'100%',padding:'10px 13px',borderRadius:10,border:'1px solid #222',background:'#0D0D0D',color:'#F0F0F0',fontSize:14,boxSizing:'border-box',outline:'none'}}/>
      </div>
      <div style={{marginBottom:20}}>
        <label style={{fontSize:11,fontWeight:800,color:'#666',display:'block',marginBottom:5}}>Contraseña</label>
        <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="mínimo 6 caracteres" style={{width:'100%',padding:'10px 13px',borderRadius:10,border:'1px solid #222',background:'#0D0D0D',color:'#F0F0F0',fontSize:14,boxSizing:'border-box',outline:'none'}}/>
      </div>
      {authError&&<div style={{background:'#FF444415',borderRadius:8,padding:'8px 12px',color:'#FF4444',fontSize:13,fontWeight:700,marginBottom:12,textAlign:'center'}}>{authError}</div>}
      <button onClick={handleLogin} disabled={authLoading} style={{width:'100%',padding:13,borderRadius:12,border:'none',background:authLoading?'#39FF1440':'#39FF14',color:'#000',fontFamily:"'Nunito',sans-serif",fontWeight:900,fontSize:15,cursor:'pointer'}}>{authLoading?'Cargando...':(authTab==='login'?'Ingresar':'Crear cuenta')}</button>
    </div>
  </div>;

  return <>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@400;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
    <style>{`
      ::-webkit-scrollbar { width: 3px; height: 3px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #39FF1433; border-radius: 99px; }
      ::-webkit-scrollbar-thumb:hover { background: #39FF1466; }
      * { scrollbar-width: thin; scrollbar-color: #39FF1433 transparent; }
    `}</style>
    <div style={g.app}>

      {/* HEADER — account switcher */}
      <div style={g.hdr}>
        <div style={g.accRow}>
          <div style={g.accBadge} onClick={()=>setModal({type:"accounts"})}>
            <span style={g.accEmoji}>{account?.emoji||"💛"}</span>
            <div style={{flex:1}}>
              <p style={g.accName}>{account?.name||"Mis finanzas"}</p>
              <p style={g.accSub}>{appData.accounts.length} cuenta{appData.accounts.length>1?"s":""} · toca para cambiar</p>
            </div>
            <span style={{fontSize:12,opacity:.4}}>⌄</span>
          </div>
          <button onClick={handleLogout} title="Cerrar sesión" style={{background:'#1A1A1A',border:'1px solid #333',borderRadius:10,padding:'6px 10px',color:'#666',cursor:'pointer',fontSize:13}}>⏏</button>
        </div>
        <div style={g.mainTabs}>
          <button style={g.mTab(mainTab===0)} onClick={()=>setMainTab(0)}>📊 Dashboard</button>
          <button style={g.mTab(mainTab===1)} onClick={()=>setMainTab(1)}>💛 {account?.name||"Mi cuenta"}</button>
        </div>
      </div>

      {/* ══ DASHBOARD ══ */}
      {mainTab===0&&<div style={{padding:"0 18px"}}>
        <p style={{fontWeight:900,fontSize:18,color:pal.text,margin:"0 0 4px",fontFamily:pal.headFont}}>Balance consolidado</p>
        <p style={{fontSize:11,color:pal.textDim,margin:"0 0 14px",fontFamily:pal.monoFont}}>$ todas las cuentas · tiempo real</p>

        {/* Totals */}
        <div style={g.dashTot}>
          <div style={g.totCard(pal.accent)}>
            <p style={g.totLbl(pal.accent)}>Total COP</p>
            <p style={g.totVal(pal.accent)}>{fCOP(dashTotalCOP)}</p>
          </div>
          {dashTotalUSD!==0&&<div style={g.totCard("#4499FF")}>
            <p style={g.totLbl("#4499FF")}>Total USD</p>
            <p style={g.totVal("#4499FF")}>{fUSD(dashTotalUSD)}</p>
          </div>}
        </div>

        {/* Wallets grouped by name across all accounts */}
        {(()=>{
          // Group wallets by name+currency
          const groups = {};
          appData.accounts.forEach(acc=>{
            acc.wallets.forEach(w=>{
              const key = w.name.trim()+"_"+(w.currency||"COP");
              if(!groups[key]) groups[key]={name:w.name,emoji:w.emoji,color:w.color,currency:w.currency||"COP",items:[]};
              groups[key].items.push({acc,w,bal:getWalletBal(w.id)});
            });
          });
          return Object.values(groups).map((grp,gi)=>{
            const total=grp.items.reduce((s,x)=>s+x.bal,0);
            const multiAcc=grp.items.length>1;
            return <div key={gi} style={g.dashCard}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={g.walletIcon(grp.color)}>{grp.emoji}</div>
                <div style={g.walletInfo}>
                  <p style={g.walletName}>{grp.name}{grp.currency==="USD"&&<span style={{fontSize:10,opacity:.5,marginLeft:4}}>USD</span>}</p>
                  {multiAcc&&grp.items.map((x,i)=>(
                    <div key={i} style={g.breakRow}>
                      <span>{x.acc.emoji} {x.acc.name}</span>
                      <span style={{fontWeight:700,color:x.bal>=0?grp.color:pal.red}}>{fAmt(x.bal,grp.currency)}</span>
                    </div>
                  ))}
                  {!multiAcc&&<p style={g.walletSub}>{grp.items[0]?.acc.emoji} {grp.items[0]?.acc.name}</p>}
                </div>
                <p style={g.walletAmt(total>=0?grp.color:pal.red)}>{fAmt(total,grp.currency)}</p>
              </div>
            </div>;
          });
        })()}

        <div style={{height:12}}/>
      </div>}

      {/* ══ CUENTA ACTIVA ══ */}
      {mainTab===1&&<>
        {/* Date range */}
        <div style={g.drBar}>
          {PRESETS.map(p=><button key={p.key} style={g.drBtn(dateRange.preset===p.key)} onClick={()=>{ setDateRange({preset:p.key}); setShowDR(p.key==="custom"); }}>{p.label}</button>)}
        </div>
        {(dateRange.preset==="custom"||showDR)&&<div style={{display:"flex",gap:8,padding:"0 18px 10px",alignItems:"center"}}>
          <input type="date" value={dateRange.from||today()} onChange={e=>setDateRange(d=>({...d,preset:"custom",from:e.target.value}))} style={{flex:1,padding:"7px 10px",borderRadius:10,border:"2px solid #0001",fontFamily:"'Nunito',sans-serif",fontSize:13,color:pal.text,background:"#111",color:"#F0F0F0"}}/>
          <span style={{fontSize:12,color:pal.text,opacity:.5}}>→</span>
          <input type="date" value={dateRange.to||today()} onChange={e=>setDateRange(d=>({...d,preset:"custom",to:e.target.value}))} style={{flex:1,padding:"7px 10px",borderRadius:10,border:"2px solid #0001",fontFamily:"'Nunito',sans-serif",fontSize:13,color:pal.text,background:"#111",color:"#F0F0F0"}}/>
        </div>}

        {/* Wallets */}
        <div style={g.eyeRow}>
          <p style={g.eyeLbl}>Billeteras</p>
          <button style={g.eyeBtn} onClick={()=>setHideWallets(v=>!v)}>{hideWallets?"🙈":"👁️"}</button>
        </div>
        {!hideWallets&&<div style={g.wRow}>
          {allWls.map(w=>{
            const bal=getWalletBal(w.id);
            return <div key={w.id} style={g.wCard(w)} onClick={()=>openWallet(w)}>
              <p style={g.wLbl(w.color)}>{w.emoji} {w.name}</p>
              <p style={g.wVal(bal>=0?w.color:pal.red)}>{fAmt(bal,w.currency)}</p>
            </div>;
          })}
          <div style={{...g.wCard({color:pal.accent}),display:"flex",alignItems:"center",justifyContent:"center",minWidth:54}} onClick={()=>openWallet()}>
            <span style={{fontSize:22,color:pal.accent}}>+</span>
          </div>
        </div>}

        {/* COP summary */}
        <div style={g.eyeRow}>
          <p style={g.eyeLbl}>Balance COP</p>
          <button style={g.eyeBtn} onClick={()=>setHideCOP(v=>!v)}>{hideCOP?"🙈":"👁️"}</button>
        </div>
        {!hideCOP&&<>
          <div style={{padding:"0 18px 10px"}}>
            <div style={g.heroCard}>
              <p style={g.heroLbl}>Balance · {periodLabel()}</p>
              <p style={g.heroAmt}>{fCOP(balanceCOP)}</p>
              <p style={g.heroCur}>COP</p>
            </div>
          </div>
          <div style={g.sumRow}>
            <div style={g.sCard(pal.accent)}><p style={g.sLbl(pal.accent)}>Ingresos</p><p style={g.sVal(pal.accent)}>{fCOP(totalInCOP)}</p><p style={g.sPer}>{periodLabel()}</p></div>
            <div style={g.sCard(pal.red)}><p style={g.sLbl(pal.red)}>Gastos</p><p style={g.sVal(pal.red)}>{fCOP(totalOutCOP)}</p><p style={g.sPer}>{periodLabel()}</p></div>
          </div>
        </>}

        {/* USD summary */}
        {hasUSD&&<><div style={g.eyeRow}>
          <p style={g.eyeLbl}>Balance USD</p>
          <button style={g.eyeBtn} onClick={()=>setHideUSD(v=>!v)}>{hideUSD?"🙈":"👁️"}</button>
        </div>
        {!hideUSD&&<>
          <div style={{padding:"0 18px 10px"}}>
            <div style={{...g.heroCard,background:"#001a33",borderColor:"#4499FF33"}}>
              <p style={{...g.heroLbl,color:"#4499FF"}}>Balance USD · {periodLabel()}</p>
              <p style={{...g.heroAmt,color:"#4499FF"}}>{fUSD(balanceUSD)}</p>
              <p style={{...g.heroCur,color:"#4499FF"}}>USD</p>
            </div>
          </div>
          <div style={g.sumRow}>
            <div style={g.sCard("#4499FF")}><p style={g.sLbl("#4499FF")}>Ingresos</p><p style={g.sVal("#4499FF")}>{fUSD(totalInUSD)}</p><p style={g.sPer}>{periodLabel()}</p></div>
            <div style={g.sCard(pal.red)}><p style={g.sLbl(pal.red)}>Gastos</p><p style={g.sVal(pal.red)}>{fUSD(totalOutUSD)}</p><p style={g.sPer}>{periodLabel()}</p></div>
          </div>
        </>}</>}

        {/* Bolsillo general */}
        <div style={{padding:"0 18px 12px"}}>
          <div style={{...g.genCard,cursor:"pointer"}} onClick={()=>openTransfer({from:GENERAL_ID,trType:"budget"})}>
            <div style={g.genRow}>
              <div style={g.genIcon}>👝</div>
              <div style={{flex:1}}><p style={{fontWeight:800,fontSize:14,color:pal.text,margin:0,fontFamily:pal.headFont}}>Bolsillo general</p><p style={{fontSize:11,color:pal.textDim,margin:"2px 0 0",fontFamily:pal.monoFont}}>libre · toca para transferir</p></div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:15,fontWeight:900,color:generalBalCOP>=0?pal.accent:pal.red,margin:0,fontFamily:pal.headFont}}>{fCOP(generalBalCOP)} <span style={{fontSize:10,opacity:.5}}>COP</span></p>
                {generalBalUSD!==0&&<p style={{fontSize:13,fontWeight:800,color:generalBalUSD>=0?pal.accent:pal.red,margin:"3px 0 0",fontFamily:pal.headFont}}>{fUSD(generalBalUSD)} <span style={{fontSize:10,opacity:.5}}>USD</span></p>}
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tabs — dark neon pills */}
        <div style={{display:"flex",gap:6,padding:"0 18px",marginBottom:14}}>
          {/* Movimientos: flechas opuestas alineadas verticalmente */}
          <button style={g.tab(tab===0)} onClick={()=>setTab(0)}>
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
              <path d="M3 4h12" stroke={tab===0?"#000":pal.textDim} strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 1l3 3-3 3" stroke={tab===0?"#000":pal.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 12H7" stroke={tab===0?"#000":pal.textDim} strokeWidth="2" strokeLinecap="round"/>
              <path d="M10 9l-3 3 3 3" stroke={tab===0?"#000":pal.textDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={g.tabLbl(tab===0)}>Movim.</span>
          </button>
          {/* Budget: wallet */}
          <button style={g.tab(tab===1)} onClick={()=>setTab(1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="7" width="20" height="14" rx="3" stroke={tab===1?"#000":pal.textDim} strokeWidth="1.8"/>
              <path d="M16 14a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" fill={tab===1?"#000":pal.textDim}/>
              <path d="M2 11h20" stroke={tab===1?"#000":pal.textDim} strokeWidth="1.8"/>
              <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" stroke={tab===1?"#000":pal.textDim} strokeWidth="1.8"/>
            </svg>
            <span style={g.tabLbl(tab===1)}>Budget</span>
          </button>
          {/* Gráficas: barras */}
          <button style={g.tab(tab===2)} onClick={()=>setTab(2)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 20V14M8 20V9M12 20V5M16 20V11M20 20V7" stroke={tab===2?"#000":pal.textDim} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={g.tabLbl(tab===2)}>Gráficas</span>
          </button>
        </div>

        {/* MOVIMIENTOS */}
        {tab===0&&<div style={g.sec}>
          <div style={g.srchWrap}><span style={g.srchIcon}>🔍</span><input style={g.srchInp} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target)}/></div>
          <div style={g.fRow}>{["Todos","💰 Ingresos","💸 Egresos"].map((f,i)=><button key={i} style={g.fBtn(txFilter===i)} onClick={()=>setTxFilter(i)}>{f}</button>)}</div>
          {listTxs.length===0?<div style={g.empty}><div style={{fontSize:40,marginBottom:8}}>🫙</div><p style={{fontWeight:700,fontSize:14,color:pal.text}}>Sin movimientos{search?" para esa búsqueda":""}</p></div>
          :<div style={g.txList}>{listTxs.map(t=><TxRow key={t.id} t={t} onDel={delTx}/>)}</div>}
        </div>}

        {/* PRESUPUESTOS */}
        {tab===1&&<div style={g.sec}>
          {bgs.length>0&&<div style={g.pctInfo(totalPct<=100)}>{totalPct>100?`⚠️ Suma ${totalPct}% — excede el 100%`:`✅ ${totalPct}% asignado · ${100-totalPct}% libre → bolsillo general`}</div>}
          {bgs.length===0&&<div style={g.empty}><div style={{fontSize:40,marginBottom:8}}>🎯</div><p style={{fontWeight:700,fontSize:14,color:pal.text}}>Sin presupuestos</p></div>}
          {bgs.map(b=>{
            const spent=getSpent(sid(b.id),bounds), avail=getAvail(sid(b.id));
            const alloc=getAllocated(sid(b.id));
            const pctS=alloc>0?Math.min((spent/alloc)*100,100):0;
            const warn=avail>0&&avail<(alloc*0.2), over=avail<0;
            const goalPct=b.goal?Math.min((alloc/b.goal)*100,100):null;
            return <div key={b.id} style={{...g.bgCard(b),borderColor:over?pal.red:warn?"#F9A825":b.color}} onClick={()=>openBudgetDetail(b)}>
              <div style={g.bgHdr}>
                <span style={{fontSize:20}}>{b.emoji}</span>
                <p style={g.bgName}>{b.name}</p>
                {over&&<span style={{fontSize:11,background:"#330000",color:pal.red,padding:"2px 8px",borderRadius:20,flexShrink:0}}>⛔ Excedido</span>}
                {warn&&!over&&<span style={{fontSize:11,background:"#332200",color:"#FF8800",padding:"2px 8px",borderRadius:20,flexShrink:0}}>⚠️ Poco saldo</span>}
                {!warn&&!over&&<span style={g.bgPct(b)}>{b.pct}%</span>}
              </div>
              <div style={g.bgMini}>
                <div style={g.bgMiniC(pal.red,"#330000")}><p style={g.bgMiniL(pal.red)}>Gastado</p><p style={g.bgMiniV(pal.red)}>{fCOP(spent)}</p></div>
                <div style={g.bgMiniC(avail>=0?pal.accent:pal.red,avail>=0?"#003300":"#330000")}><p style={g.bgMiniL(avail>=0?pal.accent:pal.red)}>Disponible</p><p style={g.bgMiniV(avail>=0?pal.accent:pal.red)}>{fCOP(avail)}</p></div>
              </div>
              {goalPct!==null&&<><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:pal.text,opacity:.42,marginBottom:3}}><span>Meta</span><span>{fCOP(alloc)} / {fCOP(b.goal)}</span></div><div style={g.prBg}><div style={g.prFill(b.color+"99",goalPct)}/></div></>}
              <p style={{fontSize:10,color:pal.text,opacity:.32,margin:"0 0 10px",fontWeight:600}}>Toca para ver movimientos y acumulado</p>
              <div style={g.bgActs} onClick={e=>e.stopPropagation()}>
                <div style={g.bgBtns}>
                  <button style={g.smBtn()} onClick={()=>openBudget(b)}>✏️</button>
                  <button style={g.smBtn()} onClick={()=>openTransfer({from:sid(b.id),trType:"budget"})}>↔️</button>
                  <button style={g.smBtn(pal.red)} onClick={()=>delBudget(b.id)}>🗑️</button>
                </div>
                <button style={g.gastBtn(b)} onClick={()=>openTx({txType:"gasto",budgetId:b.id})}>+ Gasto</button>
              </div>
            </div>;
          })}
          {/* Bolsillo general */}
          <div style={g.genCard}>
            <div style={g.genRow}>
              <div style={g.genIcon}>👝</div>
              <div style={{flex:1}}><p style={{fontWeight:800,fontSize:14,color:pal.text,margin:0}}>Bolsillo general</p><p style={{fontSize:11,color:pal.text,opacity:.4,margin:"2px 0 0"}}>Sin presupuesto asignado</p></div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:14,fontWeight:900,color:generalBalCOP>=0?pal.accent:pal.red,margin:0}}>{fCOP(generalBalCOP)} <span style={{fontSize:10,opacity:.5}}>COP</span></p>
                {generalBalUSD!==0&&<p style={{fontSize:12,fontWeight:800,color:generalBalUSD>=0?pal.accent:pal.red,margin:"3px 0 0"}}>{fUSD(generalBalUSD)} <span style={{fontSize:10,opacity:.5}}>USD</span></p>}
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}>
              <button style={g.smBtn()} onClick={()=>openTransfer({from:GENERAL_ID,trType:"budget"})}>↔️ Transferir</button>
              <button style={{...g.gastBtn({color:"#888780"})}} onClick={()=>openTx({txType:"gasto",budgetId:GENERAL_ID})}>+ Gasto</button>
            </div>
          </div>
          <button style={g.addDash} onClick={()=>openBudget()}>+ Crear presupuesto</button>
          <div style={{height:1,background:"#0001",margin:"12px 0"}}/>
          <button style={{...g.addDash,color:"#1565C0",borderColor:"#1565C0"}} onClick={()=>openTransfer({trType:"wallet"})}>↔️ Transferir entre billeteras</button>
        <div style={{height:1,background:pal.border,margin:"12px 0"}}/>
        <button style={g.exportBtn} onClick={()=>setShowExport(true)}>📥 Exportar reportes a Excel</button>
        </div>}

        {/* GRÁFICAS */}
        {tab===2&&<>
          <div style={g.chTabs}>
            {["📥 Ingresos","📤 Gastos","🎯 Presupuestos","📈 Tendencia","💳 Billeteras","↔️ Transferencias"].map((t,i)=><button key={i} style={g.chTab(chTab===i)} onClick={()=>setChTab(i)}>{t}</button>)}
          </div>
          <div style={g.sec}>
            {[0,1].includes(chTab)&&(()=>{ const d=catData(chTab===0?"ingreso":"gasto"); return <div style={g.chCard}><p style={g.chTitle}>{chTab===0?"Ingresos":"Gastos"} por categoría <span style={{fontSize:10,opacity:.5,fontWeight:600}}>· {periodLabel()}</span></p>{d.length===0?<p style={{color:pal.text,opacity:.35,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin datos</p>:<><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={d} dataKey="value" cx="50%" cy="50%" outerRadius={75} innerRadius={38}>{d.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip formatter={v=>fCOP(v)} contentStyle={{borderRadius:10,fontFamily:"Nunito"}}/></PieChart></ResponsiveContainer><div style={{marginTop:8}}>{d.map((e,i)=><div key={i} style={g.legRow}><div style={g.legDot(e.color)}/><span style={g.legName}>{e.full}</span><span style={g.legVal}>{fCOP(e)}</span></div>)}</div></>}</div>; })()}
            {chTab===2&&(()=>{ const d=budgetChartData(); return <div style={g.chCard}><p style={g.chTitle}>Presupuestos · {periodLabel()}</p>{d.length===0?<p style={{color:pal.text,opacity:.35,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin presupuestos</p>:<><ResponsiveContainer width="100%" height={d.length*50+30}><BarChart data={d} layout="vertical" margin={{left:4,right:16,top:4,bottom:4}}><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={75} tick={{fontSize:11,fontFamily:"Nunito",fontWeight:700,fill:"#888"}}/><Tooltip content={<CTip/>}/><Bar dataKey="acumulado" name="Acumulado" radius={[0,6,6,0]}>{d.map((e,i)=><Cell key={i} fill={e.color+"44"}/>)}</Bar><Bar dataKey="gastado" name="Gastado" radius={[0,6,6,0]}>{d.map((e,i)=><Cell key={i} fill={e.color}/>)}</Bar></BarChart></ResponsiveContainer><div style={{marginTop:10}}>{d.map((b,i)=>{ const rem=b.acumulado-b.gastado; return <div key={i} style={{...g.legRow,marginBottom:5}}><div style={g.legDot(b.color)}/><span style={g.legName}>{b.name}</span><span style={{fontSize:11,fontWeight:700,color:rem>=0?pal.accent:pal.red}}>{rem>=0?`✅ ${fCOP(rem)}`:`⚠️ ${fCOP(-rem)}`}</span></div>; })}</div></>}</div>; })()}
            {chTab===3&&(()=>{ const d=monthlyData(); return <div style={g.chCard}><p style={g.chTitle}>Tendencia mensual</p>{d.length===0?<p style={{color:pal.text,opacity:.35,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin datos</p>:<ResponsiveContainer width="100%" height={220}><LineChart data={d} margin={{left:0,right:10,top:4,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A"/><XAxis dataKey="month" tick={{fontSize:11,fontFamily:"Nunito",fontWeight:700,fill:"#888"}}/><YAxis hide/><Tooltip content={<CTip/>}/><Legend wrapperStyle={{fontSize:12,fontFamily:"Nunito",fontWeight:700,color:"#888"}}/><Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="#39FF14" strokeWidth={3} dot={{r:4,fill:"#39FF14"}}/><Line type="monotone" dataKey="gastos" name="Gastos" stroke="#FF4444" strokeWidth={3} dot={{r:4,fill:"#FF4444"}}/><Line type="monotone" dataKey="transferencias" name="Transferencias" stroke="#1565C0" strokeWidth={2} strokeDasharray="5 5" dot={{r:3,fill:"#1565C0"}}/></LineChart></ResponsiveContainer>}</div>; })()}
            {chTab===4&&(()=>{ const d=allWls.map(w=>({name:`${w.emoji} ${w.name}`,value:Math.max(getWalletBal(w.id),0),color:w.color,currency:w.currency})); return <div style={g.chCard}><p style={g.chTitle}>Saldo por billetera</p>{d.every(x=>x.value===0)?<p style={{color:pal.text,opacity:.35,fontSize:13,textAlign:"center",padding:"20px 0"}}>Sin saldo</p>:<><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={d} dataKey="value" cx="50%" cy="50%" outerRadius={75} innerRadius={38}>{d.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip formatter={v=>fCOP(v)} contentStyle={{borderRadius:10,fontFamily:"Nunito"}}/></PieChart></ResponsiveContainer><div style={{marginTop:8}}>{d.map((e,i)=><div key={i} style={g.legRow}><div style={g.legDot(e.color)}/><span style={g.legName}>{e.name}</span><span style={g.legVal}>{fAmt(getWalletBal(allWls[i]?.id),allWls[i]?.currency)}</span></div>)}</div></>}</div>; })()}
            {chTab===5&&(()=>{ const bTr=txs.filter(t=>t.type==="transfer"&&inRange(t,bounds)); const wTr=txs.filter(t=>t.type==="wtransfer"&&inRange(t,bounds)); const all=[...bTr,...wTr].sort((a,b)=>new Date(b.datetime)-new Date(a.datetime)); return <div style={g.chCard}><p style={g.chTitle}>Transferencias · {periodLabel()}</p><div style={{display:"flex",gap:8,marginBottom:14}}><div style={{flex:1,background:"#E3F2FD",borderRadius:10,padding:"8px 12px"}}><p style={{fontSize:10,fontWeight:800,color:"#1565C0",margin:0,textTransform:"uppercase",letterSpacing:.5}}>Presupuestos</p><p style={{fontSize:14,fontWeight:900,color:"#1565C0",margin:"4px 0 0"}}>{fCOP(bTr.reduce((s,t)=>s+t.amount,0))}</p></div><div style={{flex:1,background:"#003300",borderRadius:10,padding:"8px 12px"}}><p style={{fontSize:10,fontWeight:800,color:pal.accent,margin:0,textTransform:"uppercase",letterSpacing:.5}}>Billeteras</p><p style={{fontSize:14,fontWeight:900,color:pal.accent,margin:"4px 0 0"}}>{fCOP(wTr.reduce((s,t)=>s+t.amount,0))}</p></div></div>{all.length===0?<p style={{color:pal.text,opacity:.35,fontSize:13,textAlign:"center"}}>Sin transferencias</p>:<div style={g.txList}>{all.map(t=><TxRow key={t.id} t={t} onDel={delTx}/>)}</div>}</div>; })()}
          </div>
        </>}
      </>}
    </div>

    {mainTab===1&&<button style={g.fab} onClick={()=>openTx()}>+</button>}

    {/* ══ MODAL CUENTAS ══ */}
    {modal?.type==="accounts"&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>Mis cuentas</p>
        {appData.accounts.map(a=>(
          <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,background:"#111",borderRadius:13,padding:"12px 14px",marginBottom:8,border:`2px solid ${a.id===activeId?a.color||pal.accent:"#0001"}`,cursor:"pointer"}} onClick={()=>{ switchAccount(a.id); closeM(); }}>
            <div style={{width:40,height:40,borderRadius:12,background:(a.color||pal.accent)+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{a.emoji}</div>
            <div style={{flex:1}}>
              <p style={{fontWeight:800,fontSize:14,color:pal.text,margin:0}}>{a.name}</p>
              <p style={{fontSize:11,color:pal.text,opacity:.4,margin:"2px 0 0"}}>{a.transactions.length} movimientos · {a.budgets.length} presupuestos</p>
            </div>
            {a.id===activeId&&<span style={{fontSize:11,background:(a.color||pal.accent)+"22",color:a.color||pal.accent,padding:"2px 9px",borderRadius:20,fontWeight:700}}>Activa</span>}
            <button style={{...g.smBtn(),padding:"4px 8px"}} onClick={e=>{e.stopPropagation();openAccModal(a);}}>✏️</button>
          </div>
        ))}
        <button style={{...g.addDash,marginTop:8}} onClick={()=>{ closeM(); openAccModal(); }}>+ Nueva cuenta</button>
      </div>
    </div>}

    {/* ══ MODAL CUENTA FORM ══ */}
    {modal?.type==="account"&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>{editingAcc?"Editar cuenta":"Nueva cuenta"}</p>
        <label style={g.lbl}>Nombre</label>
        <input style={g.inp} type="text" placeholder="ej: Vida personal, Negocio 1..." value={accF.name} onChange={e=>setAccF(f=>({...f,name:e.target.value}))}/>
        <label style={g.lbl}>Ícono</label>
        <div style={g.egGrid}>{ACC_EMOJIS.map(e=><button key={e} style={g.egBtn(accF.emoji===e)} onClick={()=>setAccF(f=>({...f,emoji:e}))}>{e}</button>)}</div>
        <label style={g.lbl}>Color</label>
        <div style={g.colGrid}>{B_COLORS.map(c=><button key={c} style={g.colDot(c,accF.color===c)} onClick={()=>setAccF(f=>({...f,color:c}))}/>)}</div>
        <button style={g.saveBtn} onClick={saveAccount}>{editingAcc?"Actualizar ✓":"Crear cuenta ✓"}</button>
        {editingAcc&&appData.accounts.length>1&&<button onClick={()=>delAccount(editingAcc.id)} style={{width:"100%",padding:12,borderRadius:13,border:"none",background:"#330000",color:pal.red,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:8}}>Eliminar cuenta</button>}
      </div>
    </div>}

    {/* ══ MODAL TX ══ */}
    {modal?.type==="tx"&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>{modal.budgetId&&modal.budgetId!==GENERAL_ID?`💸 Gasto — ${bgs.find(b=>sid(b.id)===modal.budgetId)?.emoji} ${bgs.find(b=>sid(b.id)===modal.budgetId)?.name}`:modal.budgetId===GENERAL_ID?"💸 Gasto — 👝 Bolsillo general":"Nuevo movimiento"}</p>
        {!modal.budgetId&&<div style={g.typeTog}><button style={g.typeBtn(txF.type==="gasto","gasto")} onClick={()=>setTxF(f=>({...f,type:"gasto",category:"",selectedBudgets:{},budgetId:GENERAL_ID}))}>💸 Egreso</button><button style={g.typeBtn(txF.type==="ingreso","ingreso")} onClick={()=>setTxF(f=>({...f,type:"ingreso",category:"",selectedBudgets:{},budgetId:""}))}>💰 Ingreso</button></div>}

        <label style={g.lbl}>Monto total</label>
        <input ref={amtRef} style={g.inp} type="number" placeholder="ej: 500.000" value={txF.amount} onChange={e=>setTxF(f=>({...f,amount:e.target.value}))} inputMode="numeric"/>

        {/* Billetera — multi o simple para ambos tipos */}
        <label style={g.lbl}>{txF.type==="ingreso"?"¿Entra a qué billetera(s)?":"¿Sale de qué billetera(s)?"}</label>
        <div style={g.typeTog}>
          <button style={g.typeBtn(!txF.multiWallet,"ingreso")} onClick={()=>setTxF(f=>({...f,multiWallet:false,walletAmounts:{}}))}>Una billetera</button>
          <button style={g.typeBtn(txF.multiWallet,"neutral")} onClick={()=>setTxF(f=>({...f,multiWallet:true,walletId:""}))}>Múltiples</button>
        </div>

        {!txF.multiWallet&&<select style={g.sel} value={txF.walletId} onChange={e=>setTxF(f=>({...f,walletId:e.target.value}))}>
          <option value="">Selecciona billetera</option>
          {allWls.map(w=><option key={w.id} value={w.id}>{w.emoji} {w.name}{w.currency==="USD"?" · USD":""} — {fAmt(getWalletBal(w.id),w.currency)}</option>)}
        </select>}

        {txF.multiWallet&&<>
          {allWls.map(w=>{
            const bal=getWalletBal(w.id);
            const val=parseFloat(txF.walletAmounts[sid(w.id)])||0;
            const insufficient=txF.type==="gasto"&&val>0&&val>bal+0.01;
            return <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9,padding:"10px 12px",background:"#111",borderRadius:12,border:`1.5px solid ${insufficient?pal.red:"#0001"}`}}>
              <div style={{width:32,height:32,borderRadius:9,background:w.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{w.emoji}</div>
              <div style={{flex:1}}>
                <p style={{fontSize:12,fontWeight:700,color:pal.text,margin:"0 0 1px"}}>{w.name}</p>
                <p style={{fontSize:11,color:insufficient?pal.red:pal.accent,margin:0,fontWeight:700}}>Disponible: {fAmt(bal,w.currency)}{insufficient?" · insuficiente":""}</p>
              </div>
              <div style={{width:100}}><input style={{...g.inp2,border:`1.5px solid ${insufficient?pal.red:"#0001"}`}} type="number" placeholder="0" value={txF.walletAmounts[sid(w.id)]||""} onChange={e=>setTxF(f=>({...f,walletAmounts:{...f.walletAmounts,[sid(w.id)]:e.target.value}}))} inputMode="numeric"/></div>
            </div>;
          })}
          {txF.amount&&(()=>{
            const total=parseFloat(String(txF.amount).replace(/[^0-9,.]/g,"").replace(",","."))||0;
            const distrib=Object.values(txF.walletAmounts).reduce((s,v)=>s+(parseFloat(v)||0),0);
            const diff=total-distrib;
            return <div style={{background:Math.abs(diff)<1?"#003300":"#FFF3E0",borderRadius:10,padding:"8px 12px",marginBottom:11,fontSize:12,fontWeight:700,color:Math.abs(diff)<1?pal.accent:"#E65100"}}>{Math.abs(diff)<1?"✅ Distribución completa":`Faltan ${fCOP(diff)} por distribuir`}</div>;
          })()}
        </>}

        {/* Ingreso: presupuestos */}
        {txF.type==="ingreso"&&bgs.length>0&&<>
          <label style={g.lbl}>¿A cuáles presupuestos? <span style={{fontWeight:400,textTransform:"none",opacity:.7}}>(opcional)</span></label>
          {bgs.map(b=>{ const sel=!!txF.selectedBudgets[sid(b.id)]; const amt=parseFloat(String(txF.amount).replace(/[^0-9,.]/g,"").replace(",","."))||0; return <div key={b.id} onClick={()=>setTxF(f=>({...f,selectedBudgets:{...f.selectedBudgets,[sid(b.id)]:!sel}}))} style={{...g.bPick(sel),color:b.color,borderColor:sel?b.color:"#0001"}}><div style={{width:10,height:10,borderRadius:"50%",background:sel?b.color:"#ccc",flexShrink:0}}/><span style={{fontSize:16}}>{b.emoji}</span><span style={{flex:1,fontWeight:700,fontSize:13,color:pal.text}}>{b.name} ({b.pct}%)</span>{sel&&amt>0&&<span style={{fontSize:12,fontWeight:800,color:b.color}}>+{fCOP(Math.round(amt*b.pct/100))}</span>}</div>; })}
          {txF.amount&&(()=>{ const amt=parseFloat(String(txF.amount).replace(/[^0-9,.]/g,"").replace(",","."))||0; const asgn=bgs.filter(b=>txF.selectedBudgets[sid(b.id)]).reduce((s,b)=>s+Math.round(amt*b.pct/100),0); return <div style={{background:"#f5f5f5",borderRadius:10,padding:"8px 12px",marginBottom:11,fontSize:12,fontWeight:700,color:"#555"}}><div style={{display:"flex",justifyContent:"space-between"}}><span>Va a presupuestos</span><span>{fCOP(asgn)}</span></div><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span>👝 Al bolsillo general</span><span>{fCOP(amt-asgn)}</span></div></div>; })()}
        </>}

        {/* Gasto: presupuesto origen */}
        {txF.type==="gasto"&&!txF.multiWallet&&!modal.budgetId&&<>
          <label style={g.lbl}>Pagar desde presupuesto</label>
          <select style={g.sel} value={txF.budgetId} onChange={e=>setTxF(f=>({...f,budgetId:e.target.value}))}>
            <option value={GENERAL_ID}>👝 Bolsillo general — COP: {fCOP(generalBalCOP)}</option>
            {bgs.map(b=><option key={b.id} value={sid(b.id)}>{b.emoji} {b.name} — {fCOP(getAvail(sid(b.id)))}</option>)}
          </select>
        </>}
        {txF.type==="gasto"&&modal.budgetId&&<div style={{background:"#003300",borderRadius:10,padding:"8px 12px",marginBottom:11,fontSize:12,fontWeight:700,color:pal.accent}}>Disponible: {fCOP(getAvail(modal.budgetId))}</div>}

        <label style={g.lbl}>Categoría</label>
        <div style={g.catGrid}>{CATS[txF.type].map(c=><button key={c} style={g.catBtn(txF.category===c)} onClick={()=>setTxF(f=>({...f,category:c}))}>{c}</button>)}</div>
        <label style={g.lbl}>Descripción (opcional)</label>
        <input style={g.inp} type="text" placeholder="ej: Almuerzo" value={txF.desc} onChange={e=>setTxF(f=>({...f,desc:e.target.value}))}/>
        {txF.type==="gasto"&&<>
          <label style={g.lbl}>Evidencia <span style={{fontWeight:400,textTransform:"none",opacity:.7}}>(opcional)</span></label>
          <input ref={evidRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{ const f=e.target.files[0]; if(f) setTxF(p=>({...p,evidenceFile:f,evidenceName:f.name})); }}/>
          <button onClick={()=>evidRef.current?.click()} style={{padding:"8px 16px",borderRadius:10,border:`2px dashed ${pal.accent}`,background:"transparent",color:pal.accent,fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",width:"100%",textAlign:"center",marginBottom:11,boxSizing:"border-box"}}>{txF.evidenceName?`📎 ${txF.evidenceName}`:"📎 Adjuntar foto o recibo"}</button>
        </>}
        <p style={{fontSize:11,color:pal.text,opacity:.35,margin:"0 0 12px",fontWeight:600}}>📅 Fecha y hora automáticas</p>
        <button style={g.saveBtn} onClick={addTx}>Guardar ✓</button>
      </div>
    </div>}

    {/* ══ MODAL PRESUPUESTO ══ */}
    {modal?.type==="budget"&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>{editingB?"Editar":"Nuevo"} presupuesto</p>
        <label style={g.lbl}>Nombre</label><input style={g.inp} type="text" placeholder="ej: Ahorro, Nómina..." value={bF.name} onChange={e=>setBF(f=>({...f,name:e.target.value}))}/>
        <label style={g.lbl}>% de cada ingreso (cuando lo incluyas)</label><input style={g.inp} type="number" placeholder="ej: 20" value={bF.pct} onChange={e=>setBF(f=>({...f,pct:e.target.value}))} inputMode="numeric" min="1" max="100"/>
        {bF.pct&&!isNaN(parseFloat(bF.pct))&&<div style={{fontSize:12,fontWeight:700,color:"#1565C0",background:"#E3F2FD",borderRadius:8,padding:"6px 12px",marginBottom:11}}>💡 De $1.000.000 → {fCOP(parseFloat(bF.pct||0)*10000)} van aquí</div>}
        <label style={g.lbl}>Meta <span style={{fontWeight:400,textTransform:"none",opacity:.6}}>(opcional)</span></label><input style={g.inp} type="number" placeholder="Sin meta — dejar vacío" value={bF.goal} onChange={e=>setBF(f=>({...f,goal:e.target.value}))} inputMode="numeric"/>
        <label style={g.lbl}>Ícono</label><div style={g.egGrid}>{EMOJIS.map(e=><button key={e} style={g.egBtn(bF.emoji===e)} onClick={()=>setBF(f=>({...f,emoji:e}))}>{e}</button>)}</div>
        <label style={g.lbl}>Color</label><div style={g.colGrid}>{B_COLORS.map(c=><button key={c} style={g.colDot(c,bF.color===c)} onClick={()=>setBF(f=>({...f,color:c}))}/>)}</div>
        <button style={g.saveBtn} onClick={saveBudget}>{editingB?"Actualizar ✓":"Crear ✓"}</button>
      </div>
    </div>}

    {/* ══ MODAL BILLETERA ══ */}
    {modal?.type==="wallet"&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>{editingW?"Editar":"Nueva"} billetera</p>
        {editingW&&<div style={{background:"#E3F2FD",borderRadius:10,padding:"8px 12px",marginBottom:12,fontSize:12,fontWeight:700,color:"#1565C0"}}>💳 Saldo actual: {fAmt(getWalletBal(editingW.id),editingW.currency)}</div>}

        <label style={g.lbl}>Nombre</label><input style={g.inp} type="text" placeholder="ej: Efectivo, Nequi, Bancolombia..." value={wF.name} onChange={e=>setWF(f=>({...f,name:e.target.value}))}/>
        <label style={g.lbl}>Moneda</label>
        <select style={g.sel} value={["COP","USD"].includes(wF.currency)||wF.currency===""?"COP_USD_SEL":wF.currency==="CUSTOM"?"CUSTOM":wF.currency}
          onChange={e=>{
            if(e.target.value==="CUSTOM") setWF(f=>({...f,currency:"CUSTOM",_customCur:""}));
            else setWF(f=>({...f,currency:e.target.value,_customCur:undefined}));
          }}>
          <option value="COP">🇨🇴 COP — Peso colombiano</option>
          <option value="USD">🇺🇸 USD — Dólar americano</option>
          <option value="EUR">🇪🇺 EUR — Euro</option>
          <option value="GBP">🇬🇧 GBP — Libra esterlina</option>
          <option value="BTC">₿ BTC — Bitcoin</option>
          <option value="ETH">Ξ ETH — Ethereum</option>
          <option value="USDT">💲 USDT — Tether</option>
          <option value="ARS">🇦🇷 ARS — Peso argentino</option>
          <option value="MXN">🇲🇽 MXN — Peso mexicano</option>
          <option value="BRL">🇧🇷 BRL — Real brasileño</option>
          <option value="CUSTOM">✏️ Otra moneda (personalizada)</option>
        </select>
        {(wF.currency==="CUSTOM"||(!["COP","USD","EUR","GBP","BTC","ETH","USDT","ARS","MXN","BRL"].includes(wF.currency)&&wF.currency))&&(
          <input style={{...g.inp,marginTop:-5}} type="text" placeholder="Escribe las siglas ej: CAD, CHF, SOL..."
            value={["CUSTOM"].includes(wF.currency)?wF._customCur||"":wF.currency}
            onChange={e=>setWF(f=>({...f,currency:e.target.value.toUpperCase().slice(0,10),_customCur:e.target.value.toUpperCase().slice(0,10)}))}
            maxLength={10}/>
        )}
        <label style={g.lbl}>Ícono</label><div style={g.egGrid}>{W_EMOJIS.map(e=><button key={e} style={g.egBtn(wF.emoji===e)} onClick={()=>setWF(f=>({...f,emoji:e}))}>{e}</button>)}</div>
        <label style={g.lbl}>Color</label><div style={g.colGrid}>{B_COLORS.map(c=><button key={c} style={g.colDot(c,wF.color===c)} onClick={()=>setWF(f=>({...f,color:c}))}/>)}</div>
        <button style={g.saveBtn} onClick={saveWallet}>{editingW?"Actualizar ✓":"Crear ✓"}</button>
        {editingW&&<button onClick={()=>{delWallet(editingW);closeM();}} style={{width:"100%",padding:12,borderRadius:13,border:"none",background:"#330000",color:pal.red,fontFamily:"'Nunito',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",marginTop:8}}>Eliminar billetera</button>}
      </div>
    </div>}

    {/* ══ MODAL TRANSFERENCIA ══ */}
    {modal?.type==="transfer"&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>↔️ Transferir</p>
        <div style={g.typeTog}><button style={g.typeBtn(trF.trType==="budget","ingreso")} onClick={()=>setTrF(f=>({...f,trType:"budget",from:"",to:"",currency:"COP"}))}>🎯 Presupuestos</button><button style={g.typeBtn(trF.trType==="wallet","neutral")} onClick={()=>setTrF(f=>({...f,trType:"wallet",from:"",to:"",currency:"COP"}))}>💳 Billeteras</button></div>
        <label style={g.lbl}>Desde</label>
        <select style={g.sel} value={trF.from} onChange={e=>setTrF(f=>({...f,from:e.target.value,currency:"COP"}))}>
          <option value="">Selecciona origen</option>
          {trF.trType==="budget"?<>[<option value={GENERAL_ID}>{`👝 Bolsillo general — COP: ${fCOP(generalBalCOP)}${generalBalUSD!==0?" · USD: "+fUSD(generalBalUSD):""}`}</option>,{bgs.map(b=><option key={b.id} value={sid(b.id)}>{b.emoji} {b.name} — {fCOP(getAvail(sid(b.id)))}</option>)}]</>:allWls.map(w=><option key={w.id} value={sid(w.id)}>{w.emoji} {w.name} — {fAmt(getWalletBal(w.id),w.currency)}</option>)}
        </select>
        {trF.trType==="budget"&&sid(trF.from)===GENERAL_ID&&generalHasBoth&&<>
          <label style={g.lbl}>¿Qué moneda mover?</label>
          <div style={g.typeTog}><button style={g.typeBtn(trF.currency==="COP","ingreso")} onClick={()=>setTrF(f=>({...f,currency:"COP"}))}>🇨🇴 COP — {fCOP(generalBalCOP)}</button><button style={g.typeBtn(trF.currency==="USD","gasto")} onClick={()=>setTrF(f=>({...f,currency:"USD"}))}>🇺🇸 USD — {fUSD(generalBalUSD)}</button></div>
        </>}
        <label style={g.lbl}>Hacia</label>
        <select style={g.sel} value={trF.to} onChange={e=>setTrF(f=>({...f,to:e.target.value}))}>
          <option value="">Selecciona destino</option>
          {trF.trType==="budget"?<>[<option value={GENERAL_ID}>👝 Bolsillo general</option>,{bgs.map(b=><option key={b.id} value={sid(b.id)}>{b.emoji} {b.name}</option>)}]</>:allWls.map(w=><option key={w.id} value={sid(w.id)}>{w.emoji} {w.name}</option>)}
        </select>
        <label style={g.lbl}>Monto</label>
        <input style={g.inp} type="number" placeholder="ej: 200.000" value={trF.amount} onChange={e=>setTrF(f=>({...f,amount:e.target.value}))} inputMode="numeric"/>
        <button style={{...g.saveBtn,background:"#1565C0"}} onClick={doTransfer}>Transferir ✓</button>
      </div>
    </div>}

    {/* ══ MODAL DETALLE PRESUPUESTO ══ */}
    {modal?.type==="budgetDetail"&&(()=>{
      const b=modal.budget;
      const bdBounds=getDateBounds(bdDR);
      const alloc=getAllocated(sid(b.id),bdBounds), spent=getSpent(sid(b.id),bdBounds), avail=getAvail(sid(b.id));
      const pctS=alloc>0?Math.min((spent/alloc)*100,100):0;
      const goalPct=b.goal?Math.min((alloc/b.goal)*100,100):null;
      const btxs=getBudgetTxs(sid(b.id));
      return <div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)closeM();}}>
        <div style={g.drawer}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <span style={{fontSize:24}}>{b.emoji}</span>
            <div style={{flex:1}}><p style={{fontWeight:900,fontSize:17,color:pal.text,margin:0}}>{b.name}</p><p style={{fontSize:12,color:pal.accent,fontWeight:700,margin:"2px 0 0"}}>Disponible ahora: {fCOP(avail)}</p></div>
            <button onClick={closeM} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:pal.text,opacity:.4}}>✕</button>
          </div>
          <div style={{...g.drBar,padding:"0 0 10px",overflowX:"auto"}}>
            {PRESETS.map(p=><button key={p.key} style={g.drBtn(bdDR.preset===p.key)} onClick={()=>setBdDR({preset:p.key})}>{p.label}</button>)}
          </div>
          {bdDR.preset==="custom"&&<div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
            <input type="date" value={bdDR.from||today()} onChange={e=>setBdDR(d=>({...d,from:e.target.value}))} style={{flex:1,padding:"7px 10px",borderRadius:10,border:"2px solid #0001",fontFamily:"'Nunito',sans-serif",fontSize:13,color:pal.text,background:"#111",color:"#F0F0F0"}}/>
            <span style={{fontSize:12,color:pal.text,opacity:.5}}>→</span>
            <input type="date" value={bdDR.to||today()} onChange={e=>setBdDR(d=>({...d,to:e.target.value}))} style={{flex:1,padding:"7px 10px",borderRadius:10,border:"2px solid #0001",fontFamily:"'Nunito',sans-serif",fontSize:13,color:pal.text,background:"#111",color:"#F0F0F0"}}/>
          </div>}
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <div style={{flex:1,background:b.color+"15",borderRadius:10,padding:"8px 12px",textAlign:"center"}}><p style={{fontSize:10,fontWeight:800,color:b.color,margin:0,textTransform:"uppercase",letterSpacing:.5}}>Acumulado</p><p style={{fontSize:14,fontWeight:900,color:b.color,margin:"4px 0 0"}}>{fCOP(alloc)}</p></div>
            <div style={{flex:1,background:"#330000",borderRadius:10,padding:"8px 12px",textAlign:"center"}}><p style={{fontSize:10,fontWeight:800,color:pal.red,margin:0,textTransform:"uppercase",letterSpacing:.5}}>Gastado</p><p style={{fontSize:14,fontWeight:900,color:pal.red,margin:"4px 0 0"}}>{fCOP(spent)}</p></div>
          </div>
          <div style={g.prBg}><div style={g.prFill(pctS>=100?pal.red:pctS>=80?"#FF8800":b.color,pctS)}/></div>
          <p style={{fontSize:11,color:pal.text,opacity:.4,margin:"0 0 10px",fontWeight:600,textAlign:"right"}}>{Math.round(pctS)}% usado</p>
          {b.goal&&goalPct!==null&&<><div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:pal.text,opacity:.42,marginBottom:3}}><span>Meta</span><span>{fCOP(alloc)} / {fCOP(b.goal)}</span></div><div style={{height:5,background:"#0001",borderRadius:5,overflow:"hidden",marginBottom:12}}><div style={{height:"100%",width:`${goalPct}%`,background:b.color+"99",borderRadius:5}}/></div></>}
          <p style={{fontSize:12,fontWeight:800,color:pal.text,opacity:.42,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:.5}}>Movimientos ({btxs.length})</p>
          {btxs.length===0?<div style={g.empty}><p style={{fontWeight:700,fontSize:13,color:pal.text}}>Sin movimientos</p></div>:<div style={g.txList}>{btxs.map(t=><TxRow key={t.id} t={t} onDel={delTx}/>)}</div>}
        </div>
      </div>;
    })()}

    {toast&&<div style={g.toast_}>{toast}</div>}

    {/* ══ MODAL EXPORTAR ══ */}
    {showExport&&<div style={g.overlay} onClick={e=>{if(e.target===e.currentTarget)setShowExport(false);}}>
      <div style={g.drawer}>
        <p style={g.dTitle}>📥 Exportar a Excel</p>
        <p style={{fontSize:12,color:pal.textMuted,margin:"0 0 12px"}}>Elige el reporte y el período a exportar.</p>
        {/* Period selector */}
        <div style={{display:"flex",gap:6,marginBottom:16}}>
          <button onClick={()=>setExportPeriod("current")} style={{flex:1,padding:"8px 0",borderRadius:20,border:`1px solid ${exportPeriod==="current"?pal.accent:pal.border}`,background:exportPeriod==="current"?pal.accentDim:"transparent",color:exportPeriod==="current"?pal.accent:pal.textDim,fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            {periodLabel()} (activo)
          </button>
          <button onClick={()=>setExportPeriod("all")} style={{flex:1,padding:"8px 0",borderRadius:20,border:`1px solid ${exportPeriod==="all"?pal.accent:pal.border}`,background:exportPeriod==="all"?pal.accentDim:"transparent",color:exportPeriod==="all"?pal.accent:pal.textDim,fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>
            Todo el tiempo
          </button>
        </div>
        {REPORTS.map(r=>(
          <div key={r.key} onClick={()=>{ r.fn(); setShowExport(false); }}
            style={{display:"flex",alignItems:"center",gap:12,background:pal.card,borderRadius:13,padding:"13px 14px",marginBottom:8,border:`1px solid ${pal.border}`,cursor:"pointer"}}>
            <div style={{width:40,height:40,borderRadius:11,background:"#4499FF18",border:"1px solid #4499FF33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,color:"#4499FF",fontWeight:800}}>{r.icon}</div>
            <div style={{flex:1}}>
              <p style={{fontWeight:800,fontSize:13,color:pal.text,margin:0,fontFamily:pal.headFont}}>{r.label}</p>
              <p style={{fontSize:11,color:pal.textMuted,margin:"2px 0 0"}}>{r.desc}</p>
            </div>
            <span style={{fontSize:16,color:"#4499FF",opacity:.7}}>↓</span>
          </div>
        ))}
        {/* Generated download links */}
        {downloadLinks.length>0&&<>
          <p style={{fontSize:11,color:pal.accent,fontWeight:700,margin:"14px 0 8px",textTransform:"uppercase",letterSpacing:.5}}>📥 Listos para descargar — toca el link:</p>
          {downloadLinks.map((dl,i)=>(
            <a key={dl.ts} href={dl.url} download={dl.filename}
              style={{display:"flex",alignItems:"center",gap:10,background:"#001400",borderRadius:11,padding:"10px 14px",marginBottom:6,textDecoration:"none",border:`1px solid ${pal.accentBorder}`}}>
              <span style={{fontSize:18}}>📄</span>
              <span style={{flex:1,fontSize:12,fontWeight:700,color:pal.accent,fontFamily:pal.headFont}}>{dl.filename}</span>
              <span style={{fontSize:12,color:pal.accent,fontWeight:800}}>↓</span>
            </a>
          ))}
        </>}
        <button onClick={()=>setShowExport(false)} style={{width:"100%",padding:13,borderRadius:13,border:`1px solid ${pal.border}`,background:"transparent",color:pal.textMuted,fontFamily:"'Nunito',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:8}}>Cerrar</button>
      </div>
    </div>}
  </>;
}

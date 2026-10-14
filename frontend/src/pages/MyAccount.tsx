import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth as useClerkAuth, useUser, SignInButton, UserButton } from '@clerk/react';
import { ArrowRight, CheckCircle2, Clock, FileText, RefreshCw, Plus, AlertCircle, MapPin } from 'lucide-react';
import { api, type BackendMe } from '../lib/api/client';
import { clerkEnabled } from '../lib/clerk';
import { useText } from '../hooks/useText';
import { useLanguage } from '../hooks/useLanguage';
import { Button } from '../components/common/Button';

export function getStoredChatId(): string | null {
  try { return localStorage.getItem('samadhan_chat_id'); } catch { return null; }
}
type Filter = 'all'|'open'|'resolved'|'closed';
const FILTERS: Array<[Filter,string]> = [['all','All complaints'],['open','Open'],['resolved','Resolved'],['closed','Closed']];
function ProfilePhoto({url,name}: {url?:string;name:string}) {
  const [failed,setFailed]=useState(false);
  return <div className="relative w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-[var(--brand)] text-white flex items-center justify-center text-2xl font-bold">
    {url&&!failed?<img src={url} alt={name} className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:name.slice(0,1).toUpperCase()}
  </div>;
}
export function MyAccount() {
  const tx=useText(); const {language}=useLanguage();
  const auth=clerkEnabled?useClerkAuth():null;
  const identity=clerkEnabled?useUser():null;
  const userId=auth?.userId??null; const signedIn=Boolean(auth?.isSignedIn);
  const [filter,setFilter]=useState<Filter>('all');
  const [me,setMe]=useState<BackendMe|null>(null);
  const [loadedFor,setLoadedFor]=useState<string|null>(null);
  const [loadedFilter,setLoadedFilter]=useState<Filter>('all');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [refreshed,setRefreshed]=useState<Date|null>(null);
  const owner=useRef(userId); owner.current=userId;
  const request=useRef(0);
  const getToken=auth?.getToken;
  const load=useCallback(async(offset=0)=>{
    if(!getToken||!userId)return;
    const current=++request.current;
    setLoading(true);setError(null);
    try{
      const token=await getToken();
      if(!token)throw new Error('session unavailable');
      // Request with the current session directly, independent of provider-effect timing or a staff session.
      const result=await api<BackendMe>(`/api/v1/me?limit=50&offset=${offset}${filter==='all'?'':`&status=${filter}`}`,{headers:{Authorization:`Bearer ${token}`}});
      if(current!==request.current||owner.current!==userId)return;
      setMe(previous=>offset>0&&previous?{...result,recent_complaints:[...new Map([...previous.recent_complaints,...result.recent_complaints].map(item=>[item.reference_id,item])).values()]}:result);
      setLoadedFor(userId);setLoadedFilter(filter);setRefreshed(new Date());
    }catch{
      if(current===request.current&&owner.current===userId)setError('We couldn’t load your account. Retry or sign in again.');
    }finally{if(current===request.current)setLoading(false);}
  },[getToken,userId,filter]);
  useEffect(()=>{
    if(auth?.isLoaded&&signedIn&&userId)void load();
    return()=>{request.current++;};
  },[auth?.isLoaded,signedIn,userId,load]);
  const data=loadedFor===userId?me:null;
  const complaints=loadedFilter===filter?data?.recent_complaints??[]:[];
  const profile=identity?.user;
  const name=profile?.fullName||profile?.firstName||data?.profile.display_name||tx('Passenger');
  const locale=language==='ml'?'ml-IN':'en-IN';
  const date=(value:string)=>new Date(value).toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'});

  if(clerkEnabled&&!auth?.isLoaded)return <div className="app-container py-14 animate-pulse"><div className="h-20 w-80 bg-[var(--surface-secondary)] rounded-xl"/><p className="mt-5">{tx('Loading your account…')}</p></div>;
  if(!signedIn)return <div className="app-container py-16" style={{maxWidth:680}}>
    <p className="text-sm font-semibold text-[var(--brand)]">{tx('Your passenger dashboard')}</p>
    <h1 className="text-4xl font-bold mt-3">{tx('Keep every complaint in view.')}</h1>
    <p className="mt-4 text-[var(--text-secondary)] leading-relaxed">{tx('Sign in to see your complaints, resolutions and the actions your depot has taken.')}</p>
    <div className="mt-7">{clerkEnabled?<SignInButton mode="modal" fallbackRedirectUrl="/account"><Button>{tx('Sign in with Google or Email')}</Button></SignInButton>:<p>{tx('Passenger sign-in is currently unavailable.')}</p>}</div>
    <Link to="/file-complaint" className="block mt-5 text-[var(--brand)]">{tx('You can still file a complaint without an account.')} →</Link>
  </div>;

  const stats=data?.stats;
  const metricDefinitions: Array<[Filter,string,number|undefined,typeof FileText]> = [
    ['all','Complaints filed',stats?.total_filed,FileText],['open','Awaiting resolution',stats?.open,Clock],
    ['resolved','Resolved',stats?.resolved,CheckCircle2],['closed','Closed',stats?.closed,FileText],
  ];
  const monthly=data?.monthly_activity??[];
  const maxMonthly=Math.max(1,...monthly.flatMap(month=>[month.filed,month.resolved]));
  return <div className="app-container py-10 sm:py-14" style={{maxWidth:1180}}>
    <header className="flex flex-col sm:flex-row justify-between gap-6 items-start">
      <div className="flex items-center gap-5">
        <ProfilePhoto key={profile?.imageUrl} url={profile?.imageUrl} name={name}/>
        <div>
          <p className="text-sm text-[var(--brand)] font-semibold">{tx('Your passenger dashboard')}</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-1">{name}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{profile?.primaryEmailAddress?.emailAddress||data?.profile.email}</p>
          {data?.profile.member_since&&<p className="mt-1 text-xs text-[var(--text-muted)]">{tx('Member since')} {date(data.profile.member_since)}</p>}
        </div>
      </div>
      <div className="flex gap-3 items-center"><Link to="/file-complaint" className="inline-flex items-center gap-2 bg-[var(--brand)] text-white rounded-xl px-4 py-3 font-semibold text-sm"><Plus className="w-4 h-4"/>{tx('New complaint')}</Link><UserButton/></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pb-5 border-b border-[var(--border-standard)]">
      <p className="text-[var(--text-secondary)]">{tx('What you reported. What happened next.')}</p>
      <button type="button" onClick={()=>void load()} disabled={loading} className="flex items-center gap-2 text-sm text-[var(--brand)] font-semibold disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>{tx('Refresh')}{refreshed&&<span className="font-normal text-[var(--text-muted)]">{refreshed.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</span>}</button>
    </div>
    {error&&<div role="alert" className="flex flex-wrap gap-3 items-center p-4 mt-5 rounded-xl border border-[var(--semantic-error)] text-[var(--semantic-error)]"><AlertCircle className="w-5 h-5"/><p className="flex-1">{tx(error)} {data&&tx('Showing your last loaded data.')}</p><Button variant="secondary" onClick={()=>void load()}>{tx('Try Again')}</Button></div>}
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mt-7" aria-label={tx('Complaint outcomes')}>
      {metricDefinitions.map(([key,label,value,Icon])=><button type="button" key={key} onClick={()=>setFilter(key)} aria-pressed={filter===key} className={`text-left p-5 sm:p-6 rounded-xl transition-colors ${filter===key?'bg-[var(--brand)] text-white':'bg-[var(--surface-primary)] text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'}`}>
        <div className="flex justify-between gap-3 items-center text-sm"><span>{tx(label)}</span><Icon className="w-4 h-4"/></div>
        <div className={`text-4xl sm:text-5xl font-semibold mt-4 tabular-nums ${loading&&!data?'animate-pulse':''}`}>{value??'—'}</div>
      </button>)}
    </section>
    <p className="mt-3 text-xs text-[var(--text-muted)]">{tx('Resolved counts confirmed resolutions. Closed complaints are shown separately.')}</p>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
      <section className="lg:col-span-8 space-y-5">
        <div className="flex items-center justify-between gap-4"><h2 className="font-bold text-2xl">{tx('Your complaints')}</h2>{data&&<span className="text-sm text-[var(--text-muted)]">{data.filtered_total??stats?.total_filed}</span>}</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={tx('Filter complaints')}>
          {FILTERS.map(([key,label])=><button key={key} type="button" onClick={()=>setFilter(key)} aria-pressed={filter===key} className={`px-3 py-2 rounded-lg text-sm font-semibold ${filter===key?'bg-[var(--surface-secondary)] text-[var(--brand)]':'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'}`}>{tx(label)}</button>)}
        </div>
        {loading&&(!data||loadedFilter!==filter)?<div className="space-y-3 animate-pulse" aria-label={tx('Loading complaints…')}>{[1,2,3].map(i=><div key={i} className="h-32 rounded-xl bg-[var(--surface-secondary)]"/>)}</div>:
          !data?<p className="py-8 text-[var(--text-secondary)]">{tx('Your complaint history will appear once your account loads.')}</p>:
          !complaints.length?<div className="p-8 rounded-xl bg-[var(--surface-primary)]"><FileText className="w-8 h-8 text-[var(--brand)]"/><h3 className="font-bold text-xl mt-4">{tx(stats?.total_filed===0?'No complaints yet.':'No complaints in this view.')}</h3><p className="mt-2 text-[var(--text-secondary)]">{tx('When you report a problem, you can follow every update here.')}</p><Link to="/file-complaint" className="inline-flex gap-2 items-center mt-5 text-[var(--brand)] font-semibold">{tx('File a Complaint')}<ArrowRight className="w-4 h-4"/></Link></div>:
          <div className="space-y-4">{complaints.map(complaint=><article key={complaint.reference_id} className="p-5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-standard)]">
            <div className="flex flex-wrap justify-between items-center gap-3"><Link to={`/track?ref=${encodeURIComponent(complaint.reference_id)}`} className="font-mono text-sm font-semibold text-[var(--brand)]">{complaint.reference_id}</Link><span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${complaint.status==='resolved'?'bg-emerald-100 text-emerald-800':complaint.status==='escalated'?'bg-amber-100 text-amber-900':'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`}>{tx(complaint.status)}</span></div>
            <h3 className="text-lg font-bold mt-3">{complaint.route_text||tx('Journey details unavailable')}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{tx(complaint.category)}{complaint.bus_number?` · ${complaint.bus_number}`:''} · {date(complaint.created_at)}</p>
            {complaint.description&&<p className="mt-3 text-sm leading-relaxed line-clamp-2">{complaint.description}</p>}
            <div className="flex flex-wrap gap-4 justify-between mt-4 pt-3 border-t border-[var(--border-standard)] text-xs text-[var(--text-secondary)]"><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/>{complaint.depot||tx('Awaiting depot assignment')}</span><Link to={`/track?ref=${encodeURIComponent(complaint.reference_id)}`} className="font-semibold text-[var(--brand)]">{tx('View progress')} →</Link></div>
            {complaint.latest_action&&<p className="mt-3 p-3 rounded-lg bg-[var(--bg-primary)] text-sm"><span className="font-semibold">{tx('Latest action')}: </span>{complaint.latest_action}</p>}
          </article>)}</div>}
        {data?.has_more&&<Button variant="secondary" fullWidth disabled={loading} onClick={()=>void load((data.offset??0)+(data.limit??50))}>{tx('Load more complaints')}</Button>}
      </section>
      <aside className="lg:col-span-4 space-y-8">
        <section className="space-y-4">
          <h2 className="font-bold text-xl">{tx('Your activity')}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{tx('Complaints filed and resolution updates over six months.')}</p>
          {data&&stats&&stats.total_filed>0?<>
            <div className="flex gap-4 text-xs"><span><span className="inline-block w-2 h-2 rounded-sm bg-[var(--brand)] mr-1"/>{tx('Filed')}</span><span><span className="inline-block w-2 h-2 rounded-sm bg-[#9DAF68] mr-1"/>{tx('Resolution updates')}</span></div>
            <div className="flex items-end gap-3 h-36" role="img" aria-label={tx('Six-month complaint activity')}>
              {monthly.map(month=><div key={month.month} className="flex-1 flex flex-col justify-end h-full"><div className="flex items-end justify-center gap-1 flex-1"><div className="w-3 bg-[var(--brand)] rounded-t" style={{height:`${month.filed/maxMonthly*100}%`}} title={`${tx('Filed')}: ${month.filed}`}/><div className="w-3 bg-[#9DAF68] rounded-t" style={{height:`${month.resolved/maxMonthly*100}%`}} title={`${tx('Resolution updates')}: ${month.resolved}`}/></div><span className="text-[10px] text-center mt-2 text-[var(--text-muted)]">{new Date(`${month.month}-01`).toLocaleDateString(locale,{month:'short'})}</span></div>)}
            </div>
            <details className="text-xs text-[var(--text-secondary)]"><summary className="cursor-pointer">{tx('Show activity numbers')}</summary><table className="w-full mt-2"><thead><tr><th className="text-left">{tx('Month')}</th><th>{tx('Filed')}</th><th>{tx('Resolution updates')}</th></tr></thead><tbody>{monthly.map(month=><tr key={month.month}><td>{month.month}</td><td className="text-center">{month.filed}</td><td className="text-center">{month.resolved}</td></tr>)}</tbody></table></details>
          </>:<p className="text-sm p-4 rounded-lg bg-[var(--surface-secondary)]">{tx(data?'Activity starts with your first complaint.':'Activity is unavailable until your account loads.')}</p>}
        </section>
        <section className="space-y-4"><h2 className="font-bold text-xl">{tx('What has been done')}</h2>
          {!data?.activity?.length?<p className="text-sm text-[var(--text-secondary)]">{tx('Recorded depot actions will appear here.')}</p>:<ol className="space-y-5">{data.activity.map((action,index)=><li key={`${action.reference_id}-${action.created_at}-${index}`} className="pl-4 border-l-2 border-[var(--border-standard)]"><p className="text-sm font-semibold">{tx(action.to_status)}</p><Link to={`/track?ref=${encodeURIComponent(action.reference_id)}`} className="text-xs text-[var(--brand)] font-mono">{action.reference_id}</Link>{action.note&&<p className="text-sm text-[var(--text-secondary)] mt-1">{action.note}</p>}<p className="text-xs text-[var(--text-muted)] mt-1">{date(action.created_at)}</p></li>)}</ol>}
        </section>
        {data?.by_category&&data.by_category.length>0&&<section className="space-y-3"><h2 className="font-bold text-xl">{tx('Topics you reported')}</h2>{data.by_category.map(category=><div key={category.category} className="flex justify-between gap-4 text-sm"><span>{tx(category.category)}</span><span className="font-mono">{category.count}</span></div>)}</section>}
      </aside>
    </div>
  </div>;
}

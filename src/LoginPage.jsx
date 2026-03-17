import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { P } from './data.js';
export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) setError(err.message);
    setLoading(false);
  }
  return (
    <div style={{ minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ background:P.c1,borderRadius:12,padding:40,width:380,border:`1px solid ${P.bd}` }}>
        <div style={{ textAlign:'center',marginBottom:24 }}>
          <img src="/mirror-logo.png" alt="Mirror Advisors" style={{ height:40,marginBottom:12 }} />
          <div style={{ fontSize:14,color:P.g,fontWeight:600,opacity:.7 }}>Forecast</div>
        </div>
        <div style={{ fontSize:12,color:P.tm,marginBottom:28,textAlign:'center' }}>Sign in to continue</div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@mirroradvisors.com" style={{ width:'100%',padding:'10px 12px',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontSize:13,fontFamily:"'DM Sans', sans-serif",outline:'none',boxSizing:'border-box' }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6 }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ width:'100%',padding:'10px 12px',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontSize:13,fontFamily:"'DM Sans', sans-serif",outline:'none',boxSizing:'border-box' }}/>
          </div>
          {error && <div style={{ fontSize:11,color:P.r,marginBottom:12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%',padding:'12px',background:P.g,color:P.bg,border:'none',borderRadius:6,fontSize:13,fontWeight:700,fontFamily:"'DM Sans', sans-serif",cursor:'pointer',opacity:loading?0.6:1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
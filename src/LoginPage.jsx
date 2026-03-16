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
    <div style={{ minHeight:'100vh',background:P.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'IBM Plex Mono',monospace" }}>
      <div style={{ background:P.c1,borderRadius:12,padding:40,width:380,border:`1px solid ${P.bd}` }}>
        <div style={{ fontSize:20,fontWeight:800,color:P.g,marginBottom:4 }}>MIRROR FORECAST</div>
        <div style={{ fontSize:12,color:P.tm,marginBottom:28 }}>Sign in to continue</div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@mirroradvisors.com" style={{ width:'100%',padding:'10px 12px',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box' }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6 }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ width:'100%',padding:'10px 12px',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:6,color:P.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box' }}/>
          </div>
          {error && <div style={{ fontSize:11,color:P.r,marginBottom:12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%',padding:'12px',background:P.g,color:P.bg,border:'none',borderRadius:6,fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer',opacity:loading?0.6:1 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

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
      <div style={{ background:P.c1,borderRadius:12,padding:40,width:380,border:`1px solid ${P.bd}`,boxShadow:'0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:4 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:`linear-gradient(135deg, ${P.g}, ${P.t})`,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ color:'white',fontWeight:800,fontSize:16 }}>M</span>
          </div>
          <span style={{ fontSize:20,fontWeight:700,color:P.tx,letterSpacing:'-0.02em' }}>Mirror Forecast</span>
        </div>
        <div style={{ fontSize:13,color:P.tm,marginBottom:28 }}>Sign in to continue</div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6,fontWeight:500 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@mirroradvisors.com" style={{ width:'100%',padding:'10px 12px',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:8,color:P.tx,fontSize:13,fontFamily:"'DM Sans', sans-serif",outline:'none',boxSizing:'border-box' }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:10,color:P.td,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6,fontWeight:500 }}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ width:'100%',padding:'10px 12px',background:P.c2,border:`1px solid ${P.bd}`,borderRadius:8,color:P.tx,fontSize:13,fontFamily:"'DM Sans', sans-serif",outline:'none',boxSizing:'border-box' }}/>
          </div>
          {error && <div style={{ fontSize:11,color:P.r,marginBottom:12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%',padding:'12px',background:P.g,color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,fontFamily:"'DM Sans', sans-serif",cursor:'pointer',opacity:loading?0.6:1,transition:'opacity 0.2s' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
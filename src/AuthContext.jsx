import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase.js';
const AuthContext = createContext({});
export function useAuth() { return useContext(AuthContext); }
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);
  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
    setLoading(false);
  }
  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }
  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }
  const isAdmin = profile?.role === 'admin';
  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

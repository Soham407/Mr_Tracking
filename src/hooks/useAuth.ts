import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AuthError } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        setUser(session?.user ?? null);
      } catch (err) {
        setError(err as AuthError);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      setError(null); // Clear error on auth state change
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setError(err as AuthError);
      return { success: false, error: err as AuthError };
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setError(err as AuthError);
      return { success: false, error: err as AuthError };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
      return { success: true };
    } catch (err) {
      setError(err as AuthError);
      return { success: false, error: err as AuthError };
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, loading, error, login, signup, logout };
};

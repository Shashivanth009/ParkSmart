// Using .tsx for potential future JSX in context values if needed, though not strictly necessary here.
"use client";
import type { ReactNode } from 'react';
import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (type: 'google' | 'email', credentials?: { email?: string, password?: string }) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('parksmart-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (type: 'google' | 'email', credentials?: { email?: string, password?: string }) => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    const mockUser: AuthUser = {
      id: 'usr_123',
      name: type === 'google' ? 'Google User' : credentials?.email?.split('@')[0] || 'Demo User',
      email: type === 'google' ? 'googleuser@example.com' : credentials?.email || 'demo@example.com',
      avatarUrl: 'https://placehold.co/100x100.png',
    };
    setUser(mockUser);
    localStorage.setItem('parksmart-user', JSON.stringify(mockUser));
    setLoading(false);
    router.push('/dashboard'); // Redirect to dashboard after login
  };

  const logout = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setUser(null);
    localStorage.removeItem('parksmart-user');
    setLoading(false);
    router.push('/login'); // Redirect to login after logout
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

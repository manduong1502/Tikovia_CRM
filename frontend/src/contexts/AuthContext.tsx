import React, { createContext, useContext, useState, useEffect } from 'react';

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string | null;
  permissions: string[];
  is_permanent?: boolean;
  trial_ends_at?: string | null;
};

type AuthContextType = {
  user: UserData | null;
  login: (userData: UserData) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('tikovia_auth');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData: UserData) => {
    setUser(userData);
    localStorage.setItem('tikovia_auth', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tikovia_auth');
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

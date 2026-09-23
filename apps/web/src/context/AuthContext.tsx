import React, { createContext, useContext, useState } from 'react';

export interface AuthContextType {
  userId: string;
  role: 'user' | 'admin' | 'system';
  getAuthHeaders: () => Record<string, string>;
  setUserId: (id: string) => void;
  setRole: (role: 'user' | 'admin' | 'system') => void;
}

const DEFAULT_USER_ID = '00000000-0000-4000-a000-000000000001';

const AuthContext = createContext<AuthContextType>({
  userId: DEFAULT_USER_ID,
  role: 'user',
  getAuthHeaders: () => ({ 'x-user-id': DEFAULT_USER_ID }),
  setUserId: () => {},
  setRole: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string>(DEFAULT_USER_ID);
  const [role, setRole] = useState<'user' | 'admin' | 'system'>('user');

  const getAuthHeaders = (): Record<string, string> => {
    return {
      'x-user-id': userId,
      'x-user-role': role
    };
  };

  return (
    <AuthContext.Provider value={{ userId, role, getAuthHeaders, setUserId, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => useContext(AuthContext);

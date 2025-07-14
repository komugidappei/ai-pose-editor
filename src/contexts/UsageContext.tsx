'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface UsageContextType {
  dailyUsage: number;
  limit: number;
  canGenerate: boolean;
  refreshUsage: () => void;
}

const UsageContext = createContext<UsageContextType | null>(null);

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [dailyUsage, setDailyUsage] = useState(0);
  const [limit] = useState(10);
  const [canGenerate, setCanGenerate] = useState(true);

  const refreshUsage = () => {
    // Usage refresh logic here
    setCanGenerate(dailyUsage < limit);
  };

  useEffect(() => {
    refreshUsage();
  }, [dailyUsage, limit]);

  return (
    <UsageContext.Provider value={{ dailyUsage, limit, canGenerate, refreshUsage }}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
}
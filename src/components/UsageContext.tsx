'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { 
  getGuestUsageToday, 
  incrementGuestUsage, 
  checkGuestUsageLimit,
  isGuestUser,
  DEFAULT_GUEST_LIMITS,
  type GuestUsage 
} from '@/lib/usage';

interface UsageData {
  imageGeneration: number;
  poseExtraction: number;
  commercialUse: number;
  saveSlots: number;
}

interface UsageLimits {
  imageGeneration: number;
  poseExtraction: number;
  commercialUse: number;
  saveSlots: number;
}

interface UsageContextType {
  usage: UsageData;
  limits: UsageLimits;
  incrementUsage: (type: keyof UsageData) => Promise<{ success: boolean; error?: string }>;
  checkUsage: (type: keyof UsageData) => { canUse: boolean; currentCount: number; limit: number };
  refreshUsage: () => void;
  isGuest: boolean;
}

const DEFAULT_LIMITS: UsageLimits = {
  imageGeneration: 10,
  poseExtraction: 5,
  commercialUse: 2,
  saveSlots: 3,
};

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export function UsageProvider({ children }: { children: ReactNode }) {
  const [usage, setUsage] = useState<UsageData>({
    imageGeneration: 0,
    poseExtraction: 0,
    commercialUse: 0,
    saveSlots: 2,
  });

  const [limits] = useState<UsageLimits>(DEFAULT_LIMITS);
  const [isGuest, setIsGuest] = useState(true);

  // 使用回数を更新
  const refreshUsage = () => {
    if (isGuestUser()) {
      const guestUsage = getGuestUsageToday();
      setUsage({
        imageGeneration: guestUsage.imageGeneration,
        poseExtraction: guestUsage.poseExtraction,
        commercialUse: guestUsage.commercialUse,
        saveSlots: 2, // 保存スロットは別管理
      });
      setIsGuest(true);
    } else {
      // TODO: 認証ユーザーの場合はSupabaseから取得
      setIsGuest(false);
    }
  };

  // 使用回数をインクリメント
  const incrementUsage = async (type: keyof UsageData): Promise<{ success: boolean; error?: string }> => {
    if (type === 'saveSlots') {
      // 保存スロットは別処理
      if (usage.saveSlots >= limits.saveSlots) {
        return {
          success: false,
          error: `保存スロット制限（${limits.saveSlots}個）に達しました。`
        };
      }
      
      setUsage(prev => ({
        ...prev,
        saveSlots: prev.saveSlots + 1,
      }));
      return { success: true };
    }

    if (isGuestUser()) {
      // ゲストユーザーの場合
      const result = incrementGuestUsage(type);
      if (result.success && result.currentUsage) {
        setUsage(prev => ({
          ...prev,
          [type]: result.currentUsage![type]
        }));
      }
      return result;
    } else {
      // TODO: 認証ユーザーの場合はSupabaseを使用
      // const result = await incrementSupabaseUsage(userId, type);
      return { success: false, error: '認証ユーザーは未実装です' };
    }
  };

  // 使用制限をチェック
  const checkUsage = (type: keyof UsageData): { canUse: boolean; currentCount: number; limit: number } => {
    if (type === 'saveSlots') {
      return {
        canUse: usage.saveSlots < limits.saveSlots,
        currentCount: usage.saveSlots,
        limit: limits.saveSlots
      };
    }

    if (isGuestUser()) {
      return checkGuestUsageLimit(type);
    } else {
      // TODO: 認証ユーザーの場合はSupabaseを使用
      return {
        canUse: false,
        currentCount: 0,
        limit: 0
      };
    }
  };

  useEffect(() => {
    refreshUsage();
  }, []);

  // 日付が変わったときに自動でリセット
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const lastCheck = localStorage.getItem('lastUsageCheck');
      const today = now.toDateString();
      
      if (lastCheck !== today) {
        refreshUsage();
        localStorage.setItem('lastUsageCheck', today);
      }
    }, 60000); // 1分ごとにチェック

    return () => clearInterval(interval);
  }, []);

  return (
    <UsageContext.Provider value={{ 
      usage, 
      limits, 
      incrementUsage, 
      checkUsage, 
      refreshUsage,
      isGuest 
    }}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const context = useContext(UsageContext);
  if (context === undefined) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
}
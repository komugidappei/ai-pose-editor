import { supabase } from './supabase';

// テンプレートのデータ型定義
export interface PoseTemplate {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  prompt: string;
  pose_data: any; // JSONポーズデータ
  style?: string;
  background?: string;
  tags?: string[]; // タグで分類
  is_public?: boolean; // 公開テンプレートかどうか
  usage_count?: number; // 使用回数
  created_at?: string;
  updated_at?: string;
}

// モックテンプレートデータ（localStorage用）
const MOCK_TEMPLATES: PoseTemplate[] = [
  {
    id: '1',
    user_id: 'guest',
    name: 'ダンシングポーズ',
    description: 'エネルギッシュなダンシングポーズのテンプレート',
    prompt: '美しいスタジオで情熱的に踊っているダンサー',
    pose_data: {
      keypoints: [
        { name: 'left_shoulder', x: 0.35, y: 0.3 },
        { name: 'right_shoulder', x: 0.65, y: 0.3 },
        { name: 'left_elbow', x: 0.2, y: 0.2 },
        { name: 'right_elbow', x: 0.8, y: 0.4 },
        { name: 'left_wrist', x: 0.15, y: 0.1 },
        { name: 'right_wrist', x: 0.85, y: 0.5 }
      ]
    },
    style: 'リアル',
    background: 'スタジオ',
    tags: ['ダンス', 'エネルギー', 'スタジオ'],
    is_public: false,
    usage_count: 3,
    created_at: '2024-06-30T10:00:00Z'
  },
  {
    id: '2',
    user_id: 'guest',
    name: 'ヨガポーズ',
    description: 'リラックスしたヨガのポーズ',
    prompt: '穏やかな自然の中でヨガをしている人',
    pose_data: {
      keypoints: [
        { name: 'left_shoulder', x: 0.45, y: 0.25 },
        { name: 'right_shoulder', x: 0.55, y: 0.25 },
        { name: 'left_knee', x: 0.4, y: 0.6 },
        { name: 'right_knee', x: 0.6, y: 0.6 },
        { name: 'left_ankle', x: 0.38, y: 0.9 },
        { name: 'right_ankle', x: 0.62, y: 0.9 }
      ]
    },
    style: 'イラスト',
    background: '自然',
    tags: ['ヨガ', 'リラックス', '自然'],
    is_public: false,
    usage_count: 5,
    created_at: '2024-06-28T14:30:00Z'
  },
  {
    id: '3',
    user_id: 'guest',
    name: 'ビジネスポートレート',
    description: 'プロフェッショナルなビジネスポートレート',
    prompt: 'スーツを着たビジネスパーソンのプロフェッショナルなポートレート',
    pose_data: {
      keypoints: [
        { name: 'left_shoulder', x: 0.4, y: 0.25 },
        { name: 'right_shoulder', x: 0.6, y: 0.25 },
        { name: 'left_elbow', x: 0.35, y: 0.35 },
        { name: 'right_elbow', x: 0.65, y: 0.35 },
        { name: 'left_wrist', x: 0.32, y: 0.45 },
        { name: 'right_wrist', x: 0.68, y: 0.45 }
      ]
    },
    style: 'リアル',
    background: 'スタジオ',
    tags: ['ビジネス', 'フォーマル', 'ポートレート'],
    is_public: false,
    usage_count: 8,
    created_at: '2024-06-25T09:15:00Z'
  }
];

const TEMPLATES_STORAGE_KEY = 'ai-pose-editor-templates';

// ゲストユーザーのテンプレートをlocalStorageから取得
export function getGuestTemplates(): PoseTemplate[] {
  if (typeof window === 'undefined') {
    return MOCK_TEMPLATES;
  }
  
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!stored) {
      // 初回はモックデータを設定
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(MOCK_TEMPLATES));
      return MOCK_TEMPLATES;
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading templates from localStorage:', error);
    return MOCK_TEMPLATES;
  }
}

// ゲストユーザーのテンプレートを保存
export function saveGuestTemplate(template: Omit<PoseTemplate, 'id' | 'created_at' | 'usage_count'>): PoseTemplate {
  const templates = getGuestTemplates();
  
  const newTemplate: PoseTemplate = {
    ...template,
    id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    usage_count: 0,
    created_at: new Date().toISOString()
  };
  
  templates.unshift(newTemplate); // 新しいテンプレートを先頭に追加
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  }
  
  return newTemplate;
}

// ゲストユーザーのテンプレートを削除
export function deleteGuestTemplate(templateId: string): boolean {
  const templates = getGuestTemplates();
  const updatedTemplates = templates.filter(template => template.id !== templateId);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
  }
  
  return templates.length !== updatedTemplates.length;
}

// ゲストユーザーのテンプレート使用回数をインクリメント
export function incrementGuestTemplateUsage(templateId: string): void {
  const templates = getGuestTemplates();
  const updatedTemplates = templates.map(template => {
    if (template.id === templateId) {
      return {
        ...template,
        usage_count: (template.usage_count || 0) + 1,
        updated_at: new Date().toISOString()
      };
    }
    return template;
  });
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
  }
}

// ユーザーのテンプレートを取得（Supabase版）
export async function getUserTemplates(userId: string): Promise<PoseTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('pose_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching user templates:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getUserTemplates:', error);
    return [];
  }
}

// テンプレートをデータベースに保存（Supabase版）
export async function saveTemplateToDatabase(template: Omit<PoseTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<{ success: boolean; data?: PoseTemplate; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('pose_templates')
      .insert([{
        ...template,
        usage_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
      
    if (error) {
      console.error('Error saving template to database:', error);
      return {
        success: false,
        error: 'テンプレートの保存に失敗しました'
      };
    }
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error in saveTemplateToDatabase:', error);
    return {
      success: false,
      error: '予期しないエラーが発生しました'
    };
  }
}

// テンプレートをデータベースから削除（Supabase版）
export async function deleteTemplateFromDatabase(userId: string, templateId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('pose_templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId); // セキュリティのためのuser_idチェック
      
    if (error) {
      console.error('Error deleting template from database:', error);
      return {
        success: false,
        error: 'テンプレートの削除に失敗しました'
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in deleteTemplateFromDatabase:', error);
    return {
      success: false,
      error: '予期しないエラーが発生しました'
    };
  }
}

// テンプレートの使用回数をインクリメント（Supabase版）
export async function incrementTemplateUsage(templateId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('pose_templates')
      .update({ 
        usage_count: supabase.sql`usage_count + 1`,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);
      
    if (error) {
      console.error('Error incrementing template usage:', error);
      return {
        success: false,
        error: '使用回数の更新に失敗しました'
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in incrementTemplateUsage:', error);
    return {
      success: false,
      error: '予期しないエラーが発生しました'
    };
  }
}

// テンプレートの統計情報を取得
export async function getTemplateStats(userId?: string): Promise<{
  totalTemplates: number;
  publicTemplates: number;
  totalUsage: number;
  mostUsedTemplate?: PoseTemplate;
}> {
  let templates: PoseTemplate[] = [];
  
  if (userId) {
    templates = await getUserTemplates(userId);
  } else {
    templates = getGuestTemplates();
  }
  
  const stats = templates.reduce((acc, template) => {
    acc.totalTemplates++;
    if (template.is_public) acc.publicTemplates++;
    acc.totalUsage += (template.usage_count || 0);
    
    if (!acc.mostUsedTemplate || (template.usage_count || 0) > (acc.mostUsedTemplate.usage_count || 0)) {
      acc.mostUsedTemplate = template;
    }
    
    return acc;
  }, {
    totalTemplates: 0,
    publicTemplates: 0,
    totalUsage: 0,
    mostUsedTemplate: undefined as PoseTemplate | undefined
  });
  
  return stats;
}

// タグでテンプレートをフィルタリング
export function filterTemplatesByTag(templates: PoseTemplate[], tag: string): PoseTemplate[] {
  return templates.filter(template => 
    template.tags && template.tags.includes(tag)
  );
}

// キーワードでテンプレートを検索
export function searchTemplates(templates: PoseTemplate[], keyword: string): PoseTemplate[] {
  const lowerKeyword = keyword.toLowerCase();
  
  return templates.filter(template => 
    template.name.toLowerCase().includes(lowerKeyword) ||
    template.description?.toLowerCase().includes(lowerKeyword) ||
    template.prompt.toLowerCase().includes(lowerKeyword) ||
    template.tags?.some(tag => tag.toLowerCase().includes(lowerKeyword))
  );
}
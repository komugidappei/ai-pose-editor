'use client';

import * as THREE from 'three';

// ポーズデータの型定義
export interface PoseRotation {
  x: number;
  y: number;
  z: number;
  w?: number; // Quaternionの場合
}

export interface PoseData {
  [boneName: string]: PoseRotation;
}

export interface SavedPose {
  id: string;
  name: string;
  description?: string;
  poseData: PoseData;
  thumbnail?: string;
  createdAt: string;
  tags?: string[];
}

// ポーズ補間の結果
export interface InterpolationResult {
  interpolatedPose: PoseData;
  isValid: boolean;
  warnings: string[];
}

// 補間方法の種類
export type InterpolationMethod = 'linear' | 'slerp' | 'cubic' | 'smoothstep';

// 数学ユーティリティ関数
export class MathUtils {
  // 線形補間
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // スムーズステップ補間
  static smoothstep(a: number, b: number, t: number): number {
    const smoothT = t * t * (3 - 2 * t);
    return a + (b - a) * smoothT;
  }

  // 3次補間
  static cubic(a: number, b: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return a + (b - a) * (3 * t2 - 2 * t3);
  }

  // 角度の正規化（-PI to PI）
  static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  // 2つの角度間の最短パスを計算
  static angleDifference(a: number, b: number): number {
    const diff = b - a;
    return this.normalizeAngle(diff);
  }

  // Euler角の補間（最短回転パスを考慮）
  static interpolateEuler(
    eulerA: { x: number; y: number; z: number },
    eulerB: { x: number; y: number; z: number },
    t: number,
    method: InterpolationMethod = 'linear'
  ): { x: number; y: number; z: number } {
    const interpolateValue = (a: number, b: number, t: number) => {
      const diff = this.angleDifference(a, b);
      const interpolated = a + diff * t;
      
      switch (method) {
        case 'smoothstep':
          return a + diff * this.smoothstep(0, 1, t);
        case 'cubic':
          return a + diff * this.cubic(0, 1, t);
        default:
          return interpolated;
      }
    };

    return {
      x: interpolateValue(eulerA.x, eulerB.x, t),
      y: interpolateValue(eulerA.y, eulerB.y, t),
      z: interpolateValue(eulerA.z, eulerB.z, t)
    };
  }

  // Quaternionの補間
  static interpolateQuaternion(
    quatA: { x: number; y: number; z: number; w: number },
    quatB: { x: number; y: number; z: number; w: number },
    t: number,
    method: InterpolationMethod = 'slerp'
  ): { x: number; y: number; z: number; w: number } {
    const q1 = new THREE.Quaternion(quatA.x, quatA.y, quatA.z, quatA.w);
    const q2 = new THREE.Quaternion(quatB.x, quatB.y, quatB.z, quatB.w);
    
    let result: THREE.Quaternion;
    
    switch (method) {
      case 'linear':
        // 線形補間（正規化が必要）
        result = new THREE.Quaternion().copy(q1).lerp(q2, t).normalize();
        break;
      case 'slerp':
      default:
        // 球面線形補間
        result = new THREE.Quaternion().copy(q1).slerp(q2, t);
        break;
    }
    
    return {
      x: result.x,
      y: result.y,
      z: result.z,
      w: result.w
    };
  }
}

// ポーズ補間クラス
export class PoseInterpolator {
  private method: InterpolationMethod;

  constructor(method: InterpolationMethod = 'linear') {
    this.method = method;
  }

  // 補間方法を設定
  setMethod(method: InterpolationMethod): void {
    this.method = method;
  }

  // 2つのポーズを補間
  interpolate(
    poseA: PoseData,
    poseB: PoseData,
    t: number
  ): InterpolationResult {
    const warnings: string[] = [];
    const interpolatedPose: PoseData = {};
    
    // tの値を0-1の範囲にクランプ
    t = Math.max(0, Math.min(1, t));

    // ポーズAのすべてのボーンを処理
    const bonesA = Object.keys(poseA);
    const bonesB = Object.keys(poseB);
    
    // 共通のボーンを見つける
    const commonBones = bonesA.filter(bone => bonesB.includes(bone));
    
    if (commonBones.length === 0) {
      return {
        interpolatedPose: {},
        isValid: false,
        warnings: ['共通のボーンが見つかりません']
      };
    }

    // 不足しているボーンについて警告
    const missingInB = bonesA.filter(bone => !bonesB.includes(bone));
    const missingInA = bonesB.filter(bone => !bonesA.includes(bone));
    
    if (missingInB.length > 0) {
      warnings.push(`ポーズBに存在しないボーン: ${missingInB.join(', ')}`);
    }
    
    if (missingInA.length > 0) {
      warnings.push(`ポーズAに存在しないボーン: ${missingInA.join(', ')}`);
    }

    // 共通ボーンを補間
    for (const boneName of commonBones) {
      const rotationA = poseA[boneName];
      const rotationB = poseB[boneName];
      
      try {
        interpolatedPose[boneName] = this.interpolateRotation(rotationA, rotationB, t);
      } catch (error) {
        warnings.push(`ボーン ${boneName} の補間に失敗: ${error}`);
      }
    }

    // 不足しているボーンをそのまま追加（フォールバック）
    for (const boneName of missingInB) {
      interpolatedPose[boneName] = { ...poseA[boneName] };
    }
    
    for (const boneName of missingInA) {
      if (t > 0.5) {
        interpolatedPose[boneName] = { ...poseB[boneName] };
      }
    }

    return {
      interpolatedPose,
      isValid: Object.keys(interpolatedPose).length > 0,
      warnings
    };
  }

  // 単一回転の補間
  private interpolateRotation(
    rotationA: PoseRotation,
    rotationB: PoseRotation,
    t: number
  ): PoseRotation {
    // Quaternionかどうかをチェック（wプロパティの存在で判定）
    const isQuaternion = 'w' in rotationA && 'w' in rotationB;
    
    if (isQuaternion) {
      return MathUtils.interpolateQuaternion(
        rotationA as Required<PoseRotation>,
        rotationB as Required<PoseRotation>,
        t,
        this.method
      );
    } else {
      return MathUtils.interpolateEuler(rotationA, rotationB, t, this.method);
    }
  }

  // 複数ポーズの連続補間
  interpolateSequence(
    poses: PoseData[],
    t: number
  ): InterpolationResult {
    if (poses.length < 2) {
      return {
        interpolatedPose: poses[0] || {},
        isValid: false,
        warnings: ['補間には最低2つのポーズが必要です']
      };
    }

    if (poses.length === 2) {
      return this.interpolate(poses[0], poses[1], t);
    }

    // 複数ポーズの場合、セグメントを計算
    const segmentCount = poses.length - 1;
    const segmentLength = 1.0 / segmentCount;
    const segmentIndex = Math.floor(t * segmentCount);
    const segmentT = (t * segmentCount) - segmentIndex;

    const startIndex = Math.min(segmentIndex, poses.length - 2);
    const endIndex = startIndex + 1;

    return this.interpolate(poses[startIndex], poses[endIndex], segmentT);
  }
}

// 保存済みポーズ管理
export class SavedPoseManager {
  private static readonly STORAGE_KEY = 'ai-pose-editor-saved-poses';

  // 保存済みポーズを全て取得
  static getSavedPoses(): SavedPose[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading saved poses:', error);
      return [];
    }
  }

  // ポーズを保存
  static savePose(pose: Omit<SavedPose, 'id' | 'createdAt'>): SavedPose {
    const savedPoses = this.getSavedPoses();
    
    const newPose: SavedPose = {
      ...pose,
      id: `pose_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    
    savedPoses.unshift(newPose);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(savedPoses));
    }
    
    return newPose;
  }

  // ポーズを削除
  static deletePose(poseId: string): boolean {
    const savedPoses = this.getSavedPoses();
    const updatedPoses = savedPoses.filter(pose => pose.id !== poseId);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedPoses));
    }
    
    return savedPoses.length !== updatedPoses.length;
  }

  // IDでポーズを取得
  static getPoseById(poseId: string): SavedPose | undefined {
    const savedPoses = this.getSavedPoses();
    return savedPoses.find(pose => pose.id === poseId);
  }

  // ポーズを更新
  static updatePose(poseId: string, updates: Partial<SavedPose>): boolean {
    const savedPoses = this.getSavedPoses();
    const poseIndex = savedPoses.findIndex(pose => pose.id === poseId);
    
    if (poseIndex === -1) return false;
    
    savedPoses[poseIndex] = { ...savedPoses[poseIndex], ...updates };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(savedPoses));
    }
    
    return true;
  }

  // タグで検索
  static searchByTag(tag: string): SavedPose[] {
    const savedPoses = this.getSavedPoses();
    return savedPoses.filter(pose => 
      pose.tags && pose.tags.includes(tag)
    );
  }

  // 名前で検索
  static searchByName(name: string): SavedPose[] {
    const savedPoses = this.getSavedPoses();
    const lowerName = name.toLowerCase();
    return savedPoses.filter(pose => 
      pose.name.toLowerCase().includes(lowerName) ||
      (pose.description && pose.description.toLowerCase().includes(lowerName))
    );
  }
}

// プリセットポーズ（デモ用）
export const PRESET_POSES: SavedPose[] = [
  {
    id: 'preset_tpose',
    name: 'Tポーズ',
    description: '基本的なTポーズ',
    poseData: {
      head: { x: 0, y: 0, z: 0 },
      neck: { x: 0, y: 0, z: 0 },
      spine: { x: 0, y: 0, z: 0 },
      left_shoulder: { x: 0, y: 0, z: -1.5708 },
      right_shoulder: { x: 0, y: 0, z: 1.5708 },
      left_elbow: { x: 0, y: 0, z: 0 },
      right_elbow: { x: 0, y: 0, z: 0 },
      left_wrist: { x: 0, y: 0, z: 0 },
      right_wrist: { x: 0, y: 0, z: 0 },
      left_hip: { x: 0, y: 0, z: 0 },
      right_hip: { x: 0, y: 0, z: 0 },
      left_knee: { x: 0, y: 0, z: 0 },
      right_knee: { x: 0, y: 0, z: 0 },
      left_ankle: { x: 0, y: 0, z: 0 },
      right_ankle: { x: 0, y: 0, z: 0 }
    },
    createdAt: '2024-01-01T00:00:00Z',
    tags: ['基本', 'リファレンス']
  },
  {
    id: 'preset_wave',
    name: '手を振るポーズ',
    description: '片手を上げて振るポーズ',
    poseData: {
      head: { x: 0, y: 0.2, z: 0 },
      neck: { x: 0, y: 0.1, z: 0 },
      spine: { x: 0, y: 0, z: 0 },
      left_shoulder: { x: 0, y: 0, z: -0.5 },
      right_shoulder: { x: 0, y: 0.5, z: -2.5 },
      left_elbow: { x: 0, y: 0, z: 0 },
      right_elbow: { x: 0, y: 0, z: -1.2 },
      left_wrist: { x: 0, y: 0, z: 0 },
      right_wrist: { x: 0, y: 0.3, z: 0 },
      left_hip: { x: 0, y: 0, z: 0 },
      right_hip: { x: 0, y: 0, z: 0 },
      left_knee: { x: 0, y: 0, z: 0 },
      right_knee: { x: 0, y: 0, z: 0 },
      left_ankle: { x: 0, y: 0, z: 0 },
      right_ankle: { x: 0, y: 0, z: 0 }
    },
    createdAt: '2024-01-01T00:00:00Z',
    tags: ['挨拶', '手振り']
  },
  {
    id: 'preset_thinking',
    name: '考えるポーズ',
    description: '顎に手を当てて考えるポーズ',
    poseData: {
      head: { x: 0, y: -0.3, z: 0.2 },
      neck: { x: 0, y: -0.2, z: 0 },
      spine: { x: 0, y: 0, z: 0 },
      left_shoulder: { x: 0, y: 0, z: -0.3 },
      right_shoulder: { x: 0, y: 0.8, z: 0.5 },
      left_elbow: { x: 0, y: 0, z: 0 },
      right_elbow: { x: 0, y: 0, z: -2.0 },
      left_wrist: { x: 0, y: 0, z: 0 },
      right_wrist: { x: 0, y: 0.5, z: 0 },
      left_hip: { x: 0, y: 0, z: 0 },
      right_hip: { x: 0, y: 0, z: 0 },
      left_knee: { x: 0, y: 0, z: 0 },
      right_knee: { x: 0, y: 0, z: 0 },
      left_ankle: { x: 0, y: 0, z: 0 },
      right_ankle: { x: 0, y: 0, z: 0 }
    },
    createdAt: '2024-01-01T00:00:00Z',
    tags: ['思考', '表情']
  }
];

// プリセットポーズをローカルストレージに初期化
export function initializePresetPoses(): void {
  if (typeof window === 'undefined') return;
  
  const savedPoses = SavedPoseManager.getSavedPoses();
  
  // プリセットが存在しない場合のみ追加
  const existingPresetIds = savedPoses
    .filter(pose => pose.id.startsWith('preset_'))
    .map(pose => pose.id);
  
  const newPresets = PRESET_POSES.filter(preset => 
    !existingPresetIds.includes(preset.id)
  );
  
  if (newPresets.length > 0) {
    const allPoses = [...savedPoses, ...newPresets];
    localStorage.setItem(SavedPoseManager['STORAGE_KEY'], JSON.stringify(allPoses));
  }
}

// ポーズの類似度を計算（オプション機能）
export function calculatePoseSimilarity(poseA: PoseData, poseB: PoseData): number {
  const commonBones = Object.keys(poseA).filter(bone => bone in poseB);
  
  if (commonBones.length === 0) return 0;
  
  let totalDifference = 0;
  
  for (const boneName of commonBones) {
    const rotA = poseA[boneName];
    const rotB = poseB[boneName];
    
    // Euler角の差分を計算
    const diffX = Math.abs(MathUtils.angleDifference(rotA.x, rotB.x));
    const diffY = Math.abs(MathUtils.angleDifference(rotA.y, rotB.y));
    const diffZ = Math.abs(MathUtils.angleDifference(rotA.z, rotB.z));
    
    totalDifference += (diffX + diffY + diffZ) / 3;
  }
  
  const averageDifference = totalDifference / commonBones.length;
  // 0-1の範囲に正規化（π以上の差分は完全に異なるとみなす）
  const similarity = Math.max(0, 1 - (averageDifference / Math.PI));
  
  return similarity;
}
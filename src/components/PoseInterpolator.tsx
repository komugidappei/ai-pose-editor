'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  PoseInterpolator,
  SavedPoseManager,
  initializePresetPoses,
  type SavedPose,
  type PoseData,
  type InterpolationMethod
} from '@/lib/poseInterpolation';

interface PoseInterpolatorProps {
  currentPose?: PoseData;
  onPoseChange: (pose: PoseData) => void;
  onSavePose?: (pose: PoseData, name: string, description?: string) => void;
}

export default function PoseInterpolatorComponent({ 
  currentPose, 
  onPoseChange, 
  onSavePose 
}: PoseInterpolatorProps) {
  const [savedPoses, setSavedPoses] = useState<SavedPose[]>([]);
  const [selectedPoseA, setSelectedPoseA] = useState<string>('');
  const [selectedPoseB, setSelectedPoseB] = useState<string>('');
  const [interpolationValue, setInterpolationValue] = useState<number>(0.5);
  const [interpolationMethod, setInterpolationMethod] = useState<InterpolationMethod>('linear');
  const [isRealtime, setIsRealtime] = useState<boolean>(true);
  const [interpolatedPose, setInterpolatedPose] = useState<PoseData | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [savePoseName, setSavePoseName] = useState<string>('');
  const [savePoseDescription, setSavePoseDescription] = useState<string>('');

  const interpolator = new PoseInterpolator(interpolationMethod);

  // 初期化
  useEffect(() => {
    initializePresetPoses();
    loadSavedPoses();
  }, []);

  // 補間方法が変更された時
  useEffect(() => {
    interpolator.setMethod(interpolationMethod);
    if (isRealtime && selectedPoseA && selectedPoseB) {
      performInterpolation();
    }
  }, [interpolationMethod]);

  // リアルタイム補間
  useEffect(() => {
    if (isRealtime && selectedPoseA && selectedPoseB) {
      performInterpolation();
    }
  }, [interpolationValue, selectedPoseA, selectedPoseB, isRealtime]);

  const loadSavedPoses = useCallback(() => {
    const poses = SavedPoseManager.getSavedPoses();
    setSavedPoses(poses);
  }, []);

  const performInterpolation = useCallback(() => {
    if (!selectedPoseA || !selectedPoseB) return;

    const poseA = SavedPoseManager.getPoseById(selectedPoseA);
    const poseB = SavedPoseManager.getPoseById(selectedPoseB);

    if (!poseA || !poseB) {
      setWarnings(['選択されたポーズが見つかりません']);
      return;
    }

    const result = interpolator.interpolate(
      poseA.poseData,
      poseB.poseData,
      interpolationValue
    );

    if (result.isValid) {
      setInterpolatedPose(result.interpolatedPose);
      onPoseChange(result.interpolatedPose);
      setWarnings(result.warnings);
    } else {
      setWarnings(result.warnings);
    }
  }, [selectedPoseA, selectedPoseB, interpolationValue, interpolator, onPoseChange]);

  const handleApplyInterpolation = () => {
    if (!isRealtime) {
      performInterpolation();
    }
  };

  const handleSaveCurrentPose = () => {
    if (!currentPose) {
      alert('保存するポーズがありません');
      return;
    }
    setShowSaveModal(true);
  };

  const handleSaveInterpolatedPose = () => {
    if (!interpolatedPose) {
      alert('補間されたポーズがありません');
      return;
    }
    
    const name = `補間ポーズ ${new Date().toLocaleTimeString()}`;
    const description = `${getPoseName(selectedPoseA)} × ${getPoseName(selectedPoseB)} (t=${interpolationValue.toFixed(2)})`;
    
    const savedPose = SavedPoseManager.savePose({
      name,
      description,
      poseData: interpolatedPose,
      tags: ['補間', '自動生成']
    });
    
    setSavedPoses(prev => [savedPose, ...prev]);
    alert(`補間ポーズ「${name}」を保存しました`);
  };

  const handleSavePose = () => {
    if (!currentPose || !savePoseName.trim()) return;

    const savedPose = SavedPoseManager.savePose({
      name: savePoseName,
      description: savePoseDescription,
      poseData: currentPose,
      tags: ['ユーザー作成']
    });

    setSavedPoses(prev => [savedPose, ...prev]);
    setShowSaveModal(false);
    setSavePoseName('');
    setSavePoseDescription('');
    
    if (onSavePose) {
      onSavePose(currentPose, savePoseName, savePoseDescription);
    }
    
    alert(`ポーズ「${savePoseName}」を保存しました`);
  };

  const handleDeletePose = (poseId: string) => {
    if (confirm('このポーズを削除しますか？')) {
      const success = SavedPoseManager.deletePose(poseId);
      if (success) {
        setSavedPoses(prev => prev.filter(pose => pose.id !== poseId));
        
        // 削除されたポーズが選択されていた場合はクリア
        if (selectedPoseA === poseId) setSelectedPoseA('');
        if (selectedPoseB === poseId) setSelectedPoseB('');
      }
    }
  };

  const getPoseName = (poseId: string): string => {
    const pose = savedPoses.find(p => p.id === poseId);
    return pose ? pose.name : 'Unknown';
  };

  const getInterpolationProgress = (): string => {
    if (interpolationValue === 0) return 'ポーズA (100%)';
    if (interpolationValue === 1) return 'ポーズB (100%)';
    
    const percentA = Math.round((1 - interpolationValue) * 100);
    const percentB = Math.round(interpolationValue * 100);
    return `${percentA}% A + ${percentB}% B`;
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold flex items-center space-x-2">
          <span>🔀</span>
          <span>ポーズ補間（Pose Interpolation）</span>
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          2つの保存済みポーズの中間ポーズを生成します
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* ポーズ選択 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ポーズA（開始ポーズ）
            </label>
            <select
              value={selectedPoseA}
              onChange={(e) => setSelectedPoseA(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ポーズを選択...</option>
              {savedPoses.map((pose) => (
                <option key={pose.id} value={pose.id}>
                  {pose.name} {pose.description && `(${pose.description})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ポーズB（終了ポーズ）
            </label>
            <select
              value={selectedPoseB}
              onChange={(e) => setSelectedPoseB(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ポーズを選択...</option>
              {savedPoses.map((pose) => (
                <option key={pose.id} value={pose.id}>
                  {pose.name} {pose.description && `(${pose.description})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 補間設定 */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                補間度合い（t = {interpolationValue.toFixed(3)}）
              </label>
              <span className="text-xs text-gray-500">
                {getInterpolationProgress()}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={interpolationValue}
              onChange={(e) => setInterpolationValue(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>ポーズA (0.0)</span>
              <span>中間 (0.5)</span>
              <span>ポーズB (1.0)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                補間方法
              </label>
              <select
                value={interpolationMethod}
                onChange={(e) => setInterpolationMethod(e.target.value as InterpolationMethod)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="linear">線形補間（Linear）</option>
                <option value="slerp">球面線形補間（Slerp）</option>
                <option value="smoothstep">スムーズステップ</option>
                <option value="cubic">3次補間（Cubic）</option>
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isRealtime}
                  onChange={(e) => setIsRealtime(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">リアルタイム補間</span>
              </label>
            </div>
          </div>
        </div>

        {/* 警告表示 */}
        {warnings.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800 mb-1">⚠️ 警告</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-wrap gap-3">
          {!isRealtime && (
            <button
              onClick={handleApplyInterpolation}
              disabled={!selectedPoseA || !selectedPoseB}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              補間を適用
            </button>
          )}

          <button
            onClick={handleSaveInterpolatedPose}
            disabled={!interpolatedPose}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            補間ポーズを保存
          </button>

          <button
            onClick={handleSaveCurrentPose}
            disabled={!currentPose}
            className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            現在のポーズを保存
          </button>

          <button
            onClick={() => {
              setSelectedPoseA('');
              setSelectedPoseB('');
              setInterpolationValue(0.5);
              setWarnings([]);
              setInterpolatedPose(null);
            }}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            リセット
          </button>
        </div>

        {/* 現在の補間状態 */}
        {selectedPoseA && selectedPoseB && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">🎯 現在の補間</h4>
            <div className="text-sm text-blue-800">
              <p>
                <strong>{getPoseName(selectedPoseA)}</strong> → <strong>{getPoseName(selectedPoseB)}</strong>
              </p>
              <p className="mt-1">
                補間度合い: {getInterpolationProgress()} ({interpolationMethod})
              </p>
              {interpolatedPose && (
                <p className="mt-1 text-blue-600">
                  ✅ 補間ポーズ生成完了（{Object.keys(interpolatedPose).length}個のボーン）
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 保存済みポーズ一覧 */}
      <div className="border-t p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">保存済みポーズ一覧</h3>
          <span className="text-sm text-gray-500">{savedPoses.length}個のポーズ</span>
        </div>

        {savedPoses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎭</div>
            <p>保存されたポーズがありません</p>
            <p className="text-sm">現在のポーズを保存して補間を試してみましょう</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {savedPoses.map((pose) => (
              <div
                key={pose.id}
                className={`p-3 border rounded-lg transition-all cursor-pointer ${
                  selectedPoseA === pose.id || selectedPoseB === pose.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm text-gray-900 line-clamp-1">
                    {pose.name}
                  </h4>
                  <div className="flex items-center space-x-1">
                    {selectedPoseA === pose.id && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">A</span>
                    )}
                    {selectedPoseB === pose.id && (
                      <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">B</span>
                    )}
                  </div>
                </div>

                {pose.description && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">{pose.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{Object.keys(pose.poseData).length}ボーン</span>
                  <span>{new Date(pose.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex space-x-1 mt-2">
                  <button
                    onClick={() => setSelectedPoseA(pose.id)}
                    className="flex-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                  >
                    ポーズA
                  </button>
                  <button
                    onClick={() => setSelectedPoseB(pose.id)}
                    className="flex-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                  >
                    ポーズB
                  </button>
                  {!pose.id.startsWith('preset_') && (
                    <button
                      onClick={() => handleDeletePose(pose.id)}
                      className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ポーズ保存モーダル */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">ポーズを保存</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ポーズ名 *
                  </label>
                  <input
                    type="text"
                    value={savePoseName}
                    onChange={(e) => setSavePoseName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: ダンシングポーズ"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <textarea
                    value={savePoseDescription}
                    onChange={(e) => setSavePoseDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                    placeholder="ポーズの説明を入力..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSavePose}
                  disabled={!savePoseName.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
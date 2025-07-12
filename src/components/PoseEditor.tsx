'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { SafePrompt, SafeError } from './SafeText';

interface PoseData {
  [boneName: string]: {
    rotation: [number, number, number];
    position?: [number, number, number];
  };
}

interface PoseEditorProps {
  onPoseChange?: (pose: PoseData) => void;
  initialPose?: PoseData;
}

const MOCK_POSE_DATA: PoseData = {
  'Root': {
    rotation: [0, 0, 0],
    position: [0, 0, 0]
  },
  'Hips': {
    rotation: [0, 0, 0]
  },
  'Spine': {
    rotation: [0, 0, 0]
  },
  'Chest': {
    rotation: [0, 0, 0]
  },
  'Neck': {
    rotation: [0, 0, 0]
  },
  'Head': {
    rotation: [0, 0, 0]
  },
  'LeftShoulder': {
    rotation: [0, 0, 0]
  },
  'LeftArm': {
    rotation: [0, 0, 0]
  },
  'LeftForeArm': {
    rotation: [0, 0, 0]
  },
  'LeftHand': {
    rotation: [0, 0, 0]
  },
  'RightShoulder': {
    rotation: [0, 0, 0]
  },
  'RightArm': {
    rotation: [0, 0, 0]
  },
  'RightForeArm': {
    rotation: [0, 0, 0]
  },
  'RightHand': {
    rotation: [0, 0, 0]
  },
  'LeftUpLeg': {
    rotation: [0, 0, 0]
  },
  'LeftLeg': {
    rotation: [0, 0, 0]
  },
  'LeftFoot': {
    rotation: [0, 0, 0]
  },
  'RightUpLeg': {
    rotation: [0, 0, 0]
  },
  'RightLeg': {
    rotation: [0, 0, 0]
  },
  'RightFoot': {
    rotation: [0, 0, 0]
  }
};

export default function PoseEditor({ onPoseChange, initialPose }: PoseEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const bonesRef = useRef<THREE.Bone[]>([]);
  const boneHelpersRef = useRef<THREE.Object3D[]>([]);
  const controlsRef = useRef<any>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [selectedBone, setSelectedBone] = useState<THREE.Bone | null>(null);
  const [currentPose, setCurrentPose] = useState<PoseData>(initialPose || MOCK_POSE_DATA);
  const [isDragging, setIsDragging] = useState(false);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!mountRef.current) return;

    // シーンの初期化
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // カメラの設定
    const camera = new THREE.PerspectiveCamera(
      50,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 3);
    cameraRef.current = camera;

    // レンダラーの設定
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // ライティング
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // グリッドの追加
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
    scene.add(gridHelper);

    // 簡易的な人体モデルの作成（glTFが無い場合のフォールバック）
    createSimpleHumanModel(scene);

    // マウスイベントの設定
    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);

    // レンダリングループ
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      
      if (mixerRef.current) {
        mixerRef.current.update(0.016);
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // リサイズ処理
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, []);

  const createSimpleHumanModel = (scene: THREE.Scene) => {
    const group = new THREE.Group();
    group.name = 'HumanModel';
    
    // 基本的な人体パーツを作成
    const parts = {
      torso: { size: [0.4, 0.8, 0.2], position: [0, 1.2, 0] },
      head: { size: [0.25, 0.25, 0.25], position: [0, 1.8, 0] },
      leftArm: { size: [0.1, 0.6, 0.1], position: [-0.3, 1.4, 0] },
      rightArm: { size: [0.1, 0.6, 0.1], position: [0.3, 1.4, 0] },
      leftLeg: { size: [0.15, 0.8, 0.15], position: [-0.15, 0.4, 0] },
      rightLeg: { size: [0.15, 0.8, 0.15], position: [0.15, 0.4, 0] }
    };

    Object.entries(parts).forEach(([name, config]) => {
      const geometry = new THREE.BoxGeometry(...config.size);
      const material = new THREE.MeshLambertMaterial({ 
        color: name === 'head' ? 0xffdbac : 0x4a90e2,
        transparent: true,
        opacity: 0.8
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...config.position);
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // ボーンヘルパーの作成
      const boneHelper = new THREE.SphereGeometry(0.05, 8, 8);
      const boneMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.7
      });
      const boneMesh = new THREE.Mesh(boneHelper, boneMaterial);
      boneMesh.position.copy(mesh.position);
      boneMesh.name = `${name}_bone`;
      boneMesh.userData = { boneName: name, originalMesh: mesh };
      group.add(boneMesh);
      boneHelpersRef.current.push(boneMesh);
    });

    modelRef.current = group;
    scene.add(group);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
    
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(boneHelpersRef.current);

    if (intersects.length > 0) {
      const selectedObject = intersects[0].object;
      setSelectedBone(selectedObject as any);
      setIsDragging(true);
      
      // 選択されたボーンをハイライト
      boneHelpersRef.current.forEach(helper => {
        const material = helper.material as THREE.MeshBasicMaterial;
        material.color.setHex(helper === selectedObject ? 0x00ff00 : 0xff0000);
      });
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging || !selectedBone || !mountRef.current || !cameraRef.current) return;
    
    const rect = mountRef.current.getBoundingClientRect();
    const deltaX = (event.movementX / rect.width) * 4;
    const deltaY = (event.movementY / rect.height) * 4;

    // 簡単な回転制御
    const boneName = selectedBone.userData.boneName;
    const originalMesh = selectedBone.userData.originalMesh;
    
    if (originalMesh) {
      originalMesh.rotation.y += deltaX;
      originalMesh.rotation.x -= deltaY;
      
      // ポーズデータの更新
      const newPose = { ...currentPose };
      newPose[boneName] = {
        rotation: [originalMesh.rotation.x, originalMesh.rotation.y, originalMesh.rotation.z]
      };
      setCurrentPose(newPose);
      
      if (onPoseChange) {
        onPoseChange(newPose);
      }
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
    setSelectedBone(null);
    
    // すべてのボーンヘルパーの色をリセット
    boneHelpersRef.current.forEach(helper => {
      const material = helper.material as THREE.MeshBasicMaterial;
      material.color.setHex(0xff0000);
    });
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (!cameraRef.current) return;
    
    const delta = event.deltaY * 0.001;
    cameraRef.current.position.multiplyScalar(1 + delta);
  };

  const exportPose = () => {
    const dataStr = JSON.stringify(currentPose, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'pose.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importPose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const poseData = JSON.parse(e.target?.result as string);
        setCurrentPose(poseData);
        applyPoseToModel(poseData);
        if (onPoseChange) {
          onPoseChange(poseData);
        }
      } catch (error) {
        console.error('Error parsing pose file:', error);
        alert('無効なポーズファイルです');
      }
    };
    reader.readAsText(file);
  };

  const applyPoseToModel = (poseData: PoseData) => {
    if (!modelRef.current) return;
    
    Object.entries(poseData).forEach(([boneName, data]) => {
      const mesh = modelRef.current?.getObjectByName(boneName);
      if (mesh && data.rotation) {
        mesh.rotation.set(data.rotation[0], data.rotation[1], data.rotation[2]);
      }
      if (mesh && data.position) {
        mesh.position.set(data.position[0], data.position[1], data.position[2]);
      }
    });
  };

  const resetPose = () => {
    setCurrentPose(MOCK_POSE_DATA);
    applyPoseToModel(MOCK_POSE_DATA);
    if (onPoseChange) {
      onPoseChange(MOCK_POSE_DATA);
    }
  };

  return (
    <div className="w-full h-full">
      <div 
        ref={mountRef} 
        className="w-full h-96 border rounded-lg bg-gray-100 cursor-grab active:cursor-grabbing"
        style={{ minHeight: '400px' }}
      />
      
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={resetPose}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          ポーズリセット
        </button>
        
        <button
          onClick={exportPose}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          ポーズエクスポート
        </button>
        
        <label className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors cursor-pointer">
          ポーズインポート
          <input
            type="file"
            accept=".json"
            onChange={importPose}
            className="hidden"
          />
        </label>
      </div>
      
      {selectedBone && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">
            選択中: <SafePrompt>{selectedBone.userData.boneName}</SafePrompt>
          </h3>
          <p className="text-sm text-blue-700">
            マウスドラッグで回転できます
          </p>
        </div>
      )}
    </div>
  );
}
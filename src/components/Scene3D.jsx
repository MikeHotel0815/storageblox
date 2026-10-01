import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../context/AppContext';
import { createHollowBoxGeometry, createSpacerGeometry, getBoxDimensions } from '../lib/boxGeometry';

const BOX_COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
];

function getColor(box) {
  if (box.spanCols === 1 && box.spanRows === 1) return '#64748b';
  return BOX_COLORS[(box.spanCols * 7 + box.spanRows * 13) % BOX_COLORS.length];
}

function DrawerOutline({ drawerWidth, drawerDepth, boxHeight }) {
  const geo = useMemo(() => {
    const g = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(drawerWidth, boxHeight, drawerDepth)
    );
    return g;
  }, [drawerWidth, drawerDepth, boxHeight]);

  return (
    <lineSegments geometry={geo} position={[0, boxHeight / 2, 0]}>
      <lineBasicMaterial color="#475569" linewidth={1} />
    </lineSegments>
  );
}

function BoxMesh({ box, params, isHovered }) {
  const meshRef = useRef();
  const { gridSize, tolerance, boxHeight, wallThickness, cornerRadius, cornerMode } = params;
  const { width, depth } = getBoxDimensions(box.spanCols, box.spanRows, gridSize, tolerance);

  const geometry = useMemo(() => {
    return createHollowBoxGeometry(width, depth, boxHeight, wallThickness, cornerRadius, cornerMode);
  }, [width, depth, boxHeight, wallThickness, cornerRadius, cornerMode]);

  // Position: grid starts at drawer's left-front corner, dead space on right/back
  const posX = -params.drawerWidth / 2 + box.col * gridSize + (box.spanCols * gridSize) / 2;
  const posZ = -params.drawerDepth / 2 + box.row * gridSize + (box.spanRows * gridSize) / 2;

  const color = getColor(box);

  useFrame(() => {
    if (meshRef.current) {
      const target = isHovered ? 1.15 : 1;
      const emissive = isHovered ? 0.3 : 0;
      meshRef.current.material.emissiveIntensity +=
        (emissive - meshRef.current.material.emissiveIntensity) * 0.15;
      meshRef.current.scale.y += (target - meshRef.current.scale.y) * 0.15;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[posX, 0, posZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0}
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function SpacerMeshX({ params, grid }) {
  const { drawerDepth, boxHeight, wallThickness } = params;
  const { deadSpaceX } = grid;
  const spacerHeight = boxHeight / 2;

  const geometry = useMemo(() => {
    return createSpacerGeometry(deadSpaceX, drawerDepth, spacerHeight, wallThickness, 0);
  }, [deadSpaceX, drawerDepth, spacerHeight, wallThickness]);

  // Right edge of drawer
  const posX = params.drawerWidth / 2 - deadSpaceX / 2;

  return (
    <mesh geometry={geometry} position={[posX, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#22c55e" roughness={0.6} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SpacerMeshY({ params, grid }) {
  const { drawerWidth, boxHeight, wallThickness } = params;
  const { deadSpaceX, deadSpaceY } = grid;
  const spacerHeight = boxHeight / 2;

  const spacerWidth = drawerWidth - (deadSpaceX > 0.1 ? deadSpaceX : 0);
  const geometry = useMemo(() => {
    return createSpacerGeometry(spacerWidth, deadSpaceY, spacerHeight, wallThickness, 0);
  }, [spacerWidth, deadSpaceY, spacerHeight, wallThickness]);

  // Back edge of drawer, shifted left to avoid X spacer
  const posX = deadSpaceX > 0.1 ? -deadSpaceX / 2 : 0;
  const posZ = params.drawerDepth / 2 - deadSpaceY / 2;

  return (
    <mesh geometry={geometry} position={[posX, 0, posZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#22c55e" roughness={0.6} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FloorGrid({ drawerWidth, drawerDepth }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[drawerWidth * 2, drawerDepth * 2]} />
      <meshStandardMaterial color="#0f172a" />
    </mesh>
  );
}

function SceneContent() {
  const { state } = useApp();
  const { params, grid, boxes, hoveredBox } = state;

  const camDistance = Math.max(params.drawerWidth, params.drawerDepth) * 1.2;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[camDistance, camDistance * 0.8, camDistance * 0.6]} intensity={0.8} />
      <directionalLight position={[-camDistance * 0.5, camDistance * 0.5, -camDistance * 0.3]} intensity={0.3} />

      <OrbitControls
        makeDefault
        minDistance={50}
        maxDistance={camDistance * 3}
        target={[0, params.boxHeight * 0.3, 0]}
      />

      <FloorGrid drawerWidth={params.drawerWidth} drawerDepth={params.drawerDepth} />
      <DrawerOutline {...params} />

      {boxes.map(box => (
        <BoxMesh
          key={box.id}
          box={box}
          params={params}
          isHovered={hoveredBox === box.id}
        />
      ))}

      {params.generateSpacers && grid.deadSpaceX > 0.1 && (
        <SpacerMeshX params={params} grid={grid} />
      )}
      {params.generateSpacers && grid.deadSpaceY > 0.1 && (
        <SpacerMeshY params={params} grid={grid} />
      )}
    </>
  );
}

export default function Scene3D() {
  const { state } = useApp();
  const camDist = Math.max(state.params.drawerWidth, state.params.drawerDepth) * 1.1;

  return (
    <Canvas
      camera={{
        position: [camDist * 0.7, camDist * 0.6, camDist * 0.7],
        fov: 45,
        near: 1,
        far: camDist * 10,
      }}
      gl={{ preserveDrawingBuffer: true }}
      className="bg-slate-950"
    >
      <SceneContent />
    </Canvas>
  );
}

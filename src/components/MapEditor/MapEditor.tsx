import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  useLayoutEffect
} from 'react';

// Third-party Libraries
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import { toPng } from 'html-to-image';

// Icons
import {
  Copy, Plus, Trash2, Settings, Home, Palette,
  Edit3, Grid, Square, Hash, Link2,
  ChevronLeft, ChevronRight, Upload, XCircle, HelpCircle
} from 'lucide-react';

// Types
import type { Tile, TileTypeConfig, TilePosition, Viewport } from './types';

// --- Assets & Constants ---

// Dynamic Asset Mapping
const images = import.meta.glob('../../assets/images/astralparty/mapicons/*.png', {
  eager: true,
  import: 'default'
});

const TILE_ASSETS: Record<string, string> = {};
Object.entries(images).forEach(([path, value]) => {
  const name = path.split('/').pop()?.replace('.png', '') || 'Unknown';
  // Vite/Astro returns an object for assets; extract the string URL.
  const url = typeof value === 'string' ? value : (value as any).src || (value as any).default || value;
  TILE_ASSETS[name] = typeof url === 'string' ? url : String(url);
});

const SPAWN_LABELS = ['1st', '2nd', '3rd', '4th'];
const MINOR_LABELS = [
  '宝くじ', 'ギフト', 'クイズ', 'ジャンプ', 'パネルコントロールボタン',
  '占い', '奇怪飴のガチャガチャ', '病院', '砲台', '運命'
];

const INITIAL_TILE_TYPES: TileTypeConfig[] = (Object.keys(TILE_ASSETS).length > 0
  ? Object.keys(TILE_ASSETS).map(name => ({
    id: name,
    label: name,
    symbol: name.charAt(0),
    color: '#444444',
    defaultScale: ['1st', '2nd', '3rd', '4th', 'セーフティポイント', '病院'].includes(name) ? 1.5 : 1.0
  }))
  : [
    { id: 'start', color: '#40E0D0', symbol: '★', label: 'Start', defaultScale: 1.5 },
    { id: 'event', color: '#FF00A2', symbol: '?', label: 'Event', defaultScale: 1.0 },
    { id: 'thunder', color: '#FFD700', symbol: '⚡', label: 'Thunder', defaultScale: 1.0 },
    { id: 'coin', color: '#FFA500', symbol: '●', label: 'Coin', defaultScale: 1.0 },
    { id: 'enemy', color: '#FF4444', symbol: '☠', label: 'Enemy', defaultScale: 1.0 },
    { id: 'Safety', color: '#8B00FF', symbol: '👑', label: 'Safety', defaultScale: 1.5 }
  ]);

const DEFAULT_TYPE = INITIAL_TILE_TYPES.find(t => t.defaultScale === 1.0)?.id || INITIAL_TILE_TYPES[0]?.id || 'start';
const ROOT_POSITION = { x: 600, y: 400 };
const BASE_TILE_DISPLAY_SIZE = 80;
const MAX_HISTORY = 30;

export default function MapEditor() {
  // --- 1. Hooks (State & Refs) ---

  const [tiles, setTiles] = useState<Tile[]>([
    {
      id: '1',
      type: DEFAULT_TYPE,
      parentId: null,
      distance: 0,
      angle: 0,
      scale: INITIAL_TILE_TYPES.find(t => t.id === DEFAULT_TYPE)?.defaultScale || 1.0,
      showSpawnRotation: SPAWN_LABELS.includes(DEFAULT_TYPE)
    }
  ]);

  const [tileTypes, setTileTypes] = useState<TileTypeConfig[]>(INITIAL_TILE_TYPES);
  const [selectedTile, setSelectedTile] = useState<string | null>('1');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'properties' | 'types'>('properties');
  const [viewport, setViewport] = useState<Viewport>({ offsetX: 0, offsetY: 0, zoom: 1.0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showIds, setShowIds] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [controlsWidth, setControlsWidth] = useState(0);
  const [lastAddedTypeId, setLastAddedTypeId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // History State
  const [, setPast] = useState<Tile[][]>([]);
  const [, setFuture] = useState<Tile[][]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedTileData = useMemo(() => tiles.find(t => t.id === selectedTile), [tiles, selectedTile]);

  // --- 2. Hooks (Effects & Memoized Values) ---

  // Check for mobile layout
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync controls width for animation
  useEffect(() => {
    if (controlsRef.current) {
      setControlsWidth(controlsRef.current.offsetWidth);
    }
  }, [isPanelOpen, showGrid, showIds, showConnections, viewport.zoom]);

  // Auto-open sidebar when a tile is selected
  useEffect(() => {
    if (selectedTile) {
      setSidebarOpen(true);
    }
  }, [selectedTile]);

  // Handle global scroll/touch behavior
  useEffect(() => {
    const handleWheelGlobal = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const handleTouchMove = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    window.addEventListener('wheel', handleWheelGlobal, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheelGlobal);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Sort tile types for sidebar display
  const sortedTileTypes = useMemo(() => {
    const initialIds = new Set(INITIAL_TILE_TYPES.map(t => t.id));
    const standard = tileTypes.filter(t => initialIds.has(t.id) && !SPAWN_LABELS.includes(t.label) && !MINOR_LABELS.includes(t.label));
    const spawns = tileTypes.filter(t => SPAWN_LABELS.includes(t.label));
    const custom = tileTypes.filter(t => !initialIds.has(t.id));
    const minor = tileTypes.filter(t => MINOR_LABELS.includes(t.label));
    return [...standard, ...spawns, ...custom, ...minor];
  }, [tileTypes]);

  // Scroll to newly added tile type
  useLayoutEffect(() => {
    if (lastAddedTypeId) {
      const element = document.getElementById(`type-item-${lastAddedTypeId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setLastAddedTypeId(null);
      }
    }
  }, [lastAddedTypeId, sortedTileTypes]);

  /**
   * Core coordinate calculation logic.
   * Recursively calculates tile positions based on their parent, distance, and angle.
   */
  const tilePositions = useMemo<Map<string, { pos: TilePosition, worldAngle: number }>>(() => {
    const cache = new Map<string, { pos: TilePosition, worldAngle: number }>();

    const calculate = (tile: Tile): { pos: TilePosition, worldAngle: number } => {
      if (cache.has(tile.id)) return cache.get(tile.id)!;

      if (!tile.parentId) {
        const result = { pos: { ...ROOT_POSITION }, worldAngle: tile.angle };
        cache.set(tile.id, result);
        return result;
      }

      const parent = tiles.find(t => t.id === tile.parentId);
      if (!parent) {
        const result = { pos: { ...ROOT_POSITION }, worldAngle: tile.angle };
        cache.set(tile.id, result);
        return result;
      }

      const parentResult = calculate(parent);
      const worldAngle = parentResult.worldAngle + tile.angle;
      const radians = (worldAngle * Math.PI) / 180;

      const result = {
        pos: {
          x: parentResult.pos.x + tile.distance * Math.cos(radians),
          y: parentResult.pos.y - tile.distance * Math.sin(radians)
        },
        worldAngle
      };

      cache.set(tile.id, result);
      return result;
    };

    tiles.forEach(tile => calculate(tile));
    return cache;
  }, [tiles]);

  // --- 3. Handlers (History & Utility) ---

  const saveHistory = useCallback(() => {
    setTiles(currentTiles => {
      setPast(prev => {
        const newPast = [...prev, currentTiles.map(t => ({ ...t }))];
        if (newPast.length > MAX_HISTORY) newPast.shift();
        return newPast;
      });
      setFuture([]);
      return currentTiles;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(currentPast => {
      if (currentPast.length === 0) return currentPast;
      const newPast = [...currentPast];
      const previous = newPast.pop()!;
      setTiles(currentTiles => {
        setFuture(currentFuture => [currentTiles.map(t => ({ ...t })), ...currentFuture]);
        return previous;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(currentFuture => {
      if (currentFuture.length === 0) return currentFuture;
      const newFuture = [...currentFuture];
      const next = newFuture.shift()!;
      setTiles(currentTiles => {
        setPast(currentPast => [...currentPast, currentTiles.map(t => ({ ...t }))]);
        return next;
      });
      return newFuture;
    });
  }, []);

  const getTileConfig = (typeId: string): TileTypeConfig => {
    return tileTypes.find(t => t.id === typeId) || tileTypes[0];
  };

  const getDescendants = (tileId: string): string[] => {
    const descendants: string[] = [];
    const children = tiles.filter(t => t.parentId === tileId);
    children.forEach(child => {
      descendants.push(child.id);
      descendants.push(...getDescendants(child.id));
    });
    return descendants;
  };

  /**
   * Prevents circular references in tile hierarchy.
   * Ensures that a tile cannot be its own ancestor.
   */
  const canSetParent = (childId: string, potentialParentId: string | null): boolean => {
    if (!potentialParentId) return true;
    if (childId === potentialParentId) return false;

    let currentId: string | null = potentialParentId;
    while (currentId) {
      if (currentId === childId) return false;
      const parent = tiles.find(t => t.id === currentId);
      currentId = parent ? parent.parentId : null;
    }
    return true;
  };

  // --- 4. Handlers (Viewport & Mouse Events) ---

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport(prev => {
      const zoom_new = Math.max(0.2, Math.min(2.0, prev.zoom * delta));
      const offsetX_new = prev.offsetX + mouseX * (1 / zoom_new - 1 / prev.zoom);
      const offsetY_new = prev.offsetY + mouseY * (1 / zoom_new - 1 / prev.zoom);
      return { offsetX: offsetX_new, offsetY: offsetY_new, zoom: zoom_new };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 2 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setMouseDownPos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setViewport(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx / prev.zoom,
        offsetY: prev.offsetY + dy / prev.zoom
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);
    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5 && e.button === 0) setSelectedTile(null);
  };

  const resetView = () => {
    setViewport({ offsetX: 0, offsetY: 0, zoom: 1.0 });
    window.scrollTo(0, 0);
  };

  const handleSliderChange = (newZoom: number) => {
    if (!canvasRef.current) return;
    setViewport(prev => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      const offsetX_new = prev.offsetX + (W / 2) * (1 / newZoom - 1 / prev.zoom);
      const offsetY_new = prev.offsetY + (H / 2) * (1 / newZoom - 1 / prev.zoom);
      return { offsetX: offsetX_new, offsetY: offsetY_new, zoom: newZoom };
    });
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      const isRange = isInput && (activeElement as HTMLInputElement).type === 'range';
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo / Redo
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (!isInput || isRange) {
          e.preventDefault();
          if (e.shiftKey) redo(); else undo();
          return;
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        if (!isInput || isRange) {
          e.preventDefault(); redo(); return;
        }
      }

      if (isInput) return;

      const step = e.shiftKey ? 10 : 1;
      const tile = tiles.find(t => t.id === selectedTile);

      if (e.key === 'Tab' || e.key.toLowerCase() === 'h') {
        e.preventDefault(); setIsPanelOpen(prev => !prev); return;
      }

      if (!tile) return;

      // Arrow keys for tile manipulation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (!e.repeat) saveHistory();
          setTiles(prev => prev.map(t => t.id === selectedTile ? { ...t, angle: (t.angle + step) % 360 } : t));
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!e.repeat) saveHistory();
          setTiles(prev => prev.map(t => t.id === selectedTile ? { ...t, angle: (t.angle - step + 360) % 360 } : t));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!e.repeat) saveHistory();
          setTiles(prev => prev.map(t => t.id === selectedTile ? { ...t, distance: Math.max(0, t.distance - step) } : t));
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!e.repeat) saveHistory();
          setTiles(prev => prev.map(t => t.id === selectedTile ? { ...t, distance: t.distance + step } : t));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTile, tiles, undo, redo, saveHistory]);

  // --- 5. Handlers (Tile & Type CRUD) ---

  const addTileType = () => {
    const newId = `custom_${Date.now()}`;
    const newType: TileTypeConfig = {
      id: newId,
      label: 'New Type',
      color: '#00FF00',
      symbol: '◆',
      defaultScale: 1.0
    };
    setTileTypes(prev => [...prev, newType]);
    setEditingTypeId(newId);
    setLastAddedTypeId(newId);
  };

  const updateTileType = (id: string, updates: Partial<TileTypeConfig>) => {
    setTileTypes(prev => {
      const typeToUpdate = prev.find(t => t.id === id);
      if (!typeToUpdate) return prev;

      if (updates.defaultScale !== undefined && updates.defaultScale !== typeToUpdate.defaultScale) {
        const oldDS = typeToUpdate.defaultScale;
        const newDS = updates.defaultScale;
        setTiles(prevTiles => prevTiles.map(tile => {
          if (tile.type === id && Math.abs(tile.scale - oldDS) < 0.01) return { ...tile, scale: newDS };
          return tile;
        }));
      }
      return prev.map(t => t.id === id ? { ...t, ...updates } : t);
    });
  };

  const deleteTileType = (id: string) => {
    if (tiles.some(t => t.type === id)) {
      toast.error('既に使用されているため、削除できません');
      return;
    }
    const typeToDelete = tileTypes.find(t => t.id === id);
    if (typeToDelete?.customImageUrl) URL.revokeObjectURL(typeToDelete.customImageUrl);
    setTileTypes(prev => prev.filter(t => t.id !== id));
    setEditingTypeId(null);
  };

  const handleCustomImageUpload = (id: string, file: File) => {
    const type = tileTypes.find(t => t.id === id);
    if (!type) return;
    if (type.customImageUrl) URL.revokeObjectURL(type.customImageUrl);
    const url = URL.createObjectURL(file);
    updateTileType(id, { customImageUrl: url });
  };

  const removeCustomImage = (id: string) => {
    const type = tileTypes.find(t => t.id === id);
    if (type?.customImageUrl) {
      URL.revokeObjectURL(type.customImageUrl);
      updateTileType(id, { customImageUrl: null });
    }
  };

  const addTile = () => {
    saveHistory();
    const currentMaxId = Math.max(0, ...tiles.map(t => parseInt(t.id)));
    const nextId = (currentMaxId + 1).toString();
    const lastTile = tiles.find(t => parseInt(t.id) === currentMaxId);

    const defaultType = INITIAL_TILE_TYPES.find(t => t.defaultScale === 1.0)?.id || INITIAL_TILE_TYPES[0]?.id || 'イベント';
    const defaultConfig = getTileConfig(defaultType);

    const newTile: Tile = {
      id: nextId,
      type: defaultType,
      parentId: lastTile ? lastTile.id : null,
      distance: (lastTile && lastTile.distance > 0) ? lastTile.distance : 100,
      angle: 0,
      scale: defaultConfig.defaultScale,
      showSpawnRotation: SPAWN_LABELS.includes(defaultType)
    };
    setTiles([...tiles, newTile]);
    setSelectedTile(nextId);
  };

  const deleteTile = () => {
    if (!selectedTile || selectedTile === '1') {
      toast.error('#1のタイルは削除できません');
      return;
    }
    saveHistory();
    const descendants = getDescendants(selectedTile);
    const tilesToRemove = [selectedTile, ...descendants];
    setTiles(prevTiles => prevTiles.filter(t => !tilesToRemove.includes(t.id)));
    setSelectedTile('1');
  };

  const updateTileProperty = <K extends keyof Tile>(key: K, value: Tile[K]) => {
    if (!selectedTile) return;
    setTiles(prevTiles => prevTiles.map(t => t.id === selectedTile ? { ...t, [key]: value } : t));
  };

  // --- 6. Handlers (Export / Import) ---

  const exportRelativeJSON = () => {
    const exportData = {
      tiles: tiles.map(t => ({
        id: t.id,
        type: t.type,
        parentId: t.parentId,
        distance: t.distance,
        angle: t.angle,
        scale: t.scale,
        spawnRotation: t.spawnRotation,
        showSpawnRotation: t.showSpawnRotation
      })),
      types: tileTypes
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aspa_map_relative_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAbsoluteJSON = () => {
    const exportData = tiles.map(t => {
      const posData = tilePositions.get(t.id)!;
      return {
        id: t.id,
        type: t.type,
        x: Math.round(posData.pos.x),
        y: Math.round(posData.pos.y),
        rotation: Math.round(-posData.worldAngle + (t.spawnRotation || 0)),
        scale: Math.round(t.scale * 10) / 10
      };
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aspa_map_absolute_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPNG = async () => {
    if (!mapRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

      tiles.forEach(t => {
        const p = tilePositions.get(t.id)!.pos;
        const size = (BASE_TILE_DISPLAY_SIZE * t.scale) / 2;
        bounds.minX = Math.min(bounds.minX, p.x - size);
        bounds.maxX = Math.max(bounds.maxX, p.x + size);
        bounds.minY = Math.min(bounds.minY, p.y - size);
        bounds.maxY = Math.max(bounds.maxY, p.y + size);
      });

      const padding = 100;
      const width = (bounds.maxX - bounds.minX) + padding * 2;
      const height = (bounds.maxY - bounds.minY) + padding * 2;

      const dataUrl = await toPng(mapRef.current, {
        width,
        height,
        style: {
          transform: `translate(${-bounds.minX + padding}px, ${-bounds.minY + padding}px) scale(1)`,
          transformOrigin: '0 0'
        },
        pixelRatio: 2,
        backgroundColor: undefined
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `aspa_map_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.png`;
      a.click();
    } catch (err) {
      toast.error('PNGの生成に失敗しました');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        const importedTiles = data.tiles || (Array.isArray(data) ? data : null);

        if (!importedTiles || !Array.isArray(importedTiles)) {
          throw new Error('Invalid format: Missing tiles list.');
        }

        saveHistory();
        setTiles(importedTiles);

        if (data.types && Array.isArray(data.types)) {
          setTileTypes(data.types);
        }

        resetView();
        setSelectedTile(importedTiles[0]?.id || null);
      } catch (err: any) {
        toast.error(`Import Error: ${err.message}`);
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- 7. Rendering (UI Sections) ---

  const headerButtonsClass = `
    flex gap-2 ml-auto overflow-x-auto pb-1 lg:pb-0 no-scrollbar
  `.trim();

  const sidebarMotionConfig = {
    animate: {
      // Mobile: bottom-sheet (y-axis), PC: width animation
      y: isMobile ? (sidebarOpen ? 0 : 'calc(100% - 48px)') : 0,
      width: !isMobile ? (sidebarOpen ? 384 : 0) : '100%',
      opacity: 1,
      x: 0
    },
    transition: { type: "spring" as const, stiffness: 300, damping: 30 }
  };

  return (
    <div className="w-full h-screen flex flex-col lg:flex-row bg-gray-900 overflow-hidden select-none relative">
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            closeButton: "!left-auto !right-0 !top-0 !translate-x-1/2 !translate-y-1/4"
          }
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 h-full flex flex-col min-w-0">

        {/* Toolbar / Header */}
        <div className="h-20 bg-gray-800 border-b border-gray-700 p-4 flex items-center gap-4 shrink-0 z-10 relative">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-white font-semibold text-lg lg:text-xl">Aspa Map Maker</h1>
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
              title="Help & Info"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>

          <div className={headerButtonsClass} onMouseDown={(e) => e.stopPropagation()}>
            <button
              onClick={addTile}
              className="px-3 lg:px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 whitespace-nowrap text-sm lg:text-base"
            >
              <Plus className="w-4 h-4" />Add Tile
            </button>
            <button
              onClick={deleteTile}
              disabled={!selectedTile || selectedTile === '1'}
              className="px-3 lg:px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap text-sm lg:text-base"
            >
              <Trash2 className="w-4 h-4" />Delete
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 lg:px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-2 whitespace-nowrap text-sm lg:text-base"
            >
              <Upload className="w-4 h-4" />Import
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 lg:px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap text-sm lg:text-base"
            >
              <Copy className="w-4 h-4" />Export
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="px-3 lg:px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center gap-2 whitespace-nowrap text-sm lg:text-base"
            >
              <Settings className="w-4 h-4" />{sidebarOpen ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className={`
            flex-1 relative overflow-hidden transition-colors duration-300
            ${showGrid ? 'bg-linear-to-br from-gray-800 to-gray-900' : 'bg-white'} 
            ${isPanning ? 'cursor-grabbing' : 'cursor-default'}
          `.trim()}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Floating Viewport Controls */}
          <div className="absolute top-4 left-4 z-50 pointer-events-none overflow-visible">
            <motion.div
              initial={false}
              animate={{ x: isPanelOpen ? 0 : -controlsWidth }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex items-start pointer-events-auto"
            >
              <div
                ref={controlsRef}
                className="bg-black/70 backdrop-blur-md text-white px-3 py-2 rounded-l-lg text-sm flex items-center gap-4 shadow-2xl border-y border-l border-white/10"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className="flex items-center gap-2 hover:text-blue-400 transition-colors border-r border-gray-600 pr-4"
                  title={showGrid ? "Hide Grid" : "Show Grid"}
                >
                  {showGrid ? <Grid className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  <span className="font-medium whitespace-nowrap">Grid: {showGrid ? 'On' : 'Off'}</span>
                </button>
                <button
                  onClick={() => setShowIds(!showIds)}
                  className={`p-1.5 rounded transition-colors ${showIds ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title="Toggle ID Labels"
                >
                  <Hash className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowConnections(!showConnections)}
                  className={`p-1.5 rounded transition-colors ${showConnections ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                  title="Toggle Connection Lines"
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 border-l border-gray-600 pl-4">
                  <span className="text-gray-400">Zoom:</span>
                  <span className="w-10 font-mono">{(viewport.zoom * 100).toFixed(0)}%</span>
                  <input
                    type="range" min="0.2" max="2.0" step="0.1"
                    value={viewport.zoom}
                    onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                    className="w-24 cursor-pointer accent-blue-500"
                  />
                </div>
                <button
                  onClick={resetView}
                  className="ml-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title="Reset View"
                >
                  <Home className="w-3.5 h-3.5" />Reset
                </button>
              </div>
              <button
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="p-2 bg-black/70 backdrop-blur-md text-white rounded-r-lg hover:bg-black/90 transition-all border border-white/10 shadow-xl border-l-gray-600"
                title={isPanelOpen ? "Collapse Panel" : "Expand Panel"}
              >
                {isPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </motion.div>
          </div>

          {/* Map Surface */}
          <div style={{
            transform: `translate(${viewport.offsetX * viewport.zoom}px, ${viewport.offsetY * viewport.zoom}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0, top: 0, width: '100%', height: '100%'
          }}>
            <div ref={mapRef} className="w-full h-full relative">
              {/* Isometric Grid Background */}
              {showGrid && !isExporting && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none opacity-10"
                  style={{ width: '200%', height: '200%', left: '-50%', top: '-50%' }}
                >
                  <defs>
                    <pattern id="isometricGrid" width="100" height="57.735" patternUnits="userSpaceOnUse">
                      <path d="M 0 28.8675 L 50 0 L 100 28.8675 L 50 57.735 Z" stroke="#CCCCCC" strokeWidth="1" fill="none" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#isometricGrid)" />
                </svg>
              )}

              {/* Parent-Child Connection Lines */}
              {showConnections && !isExporting && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <defs>
                    <style>{`
                      @keyframes dash-flow { to { stroke-dashoffset: -20; } } 
                      .connection-line { animation: dash-flow 1s linear infinite; }
                    `}</style>
                  </defs>
                  {tiles.map((tile) => {
                    if (!tile.parentId) return null;
                    const parent = tiles.find(t => t.id === tile.parentId);
                    if (!parent) return null;
                    const pr = tilePositions.get(parent.id)!;
                    const tr = tilePositions.get(tile.id)!;
                    return (
                      <line
                        key={`line-${tile.id}`}
                        x1={pr.pos.x} y1={pr.pos.y}
                        x2={tr.pos.x} y2={tr.pos.y}
                        className="connection-line"
                        stroke={showGrid ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.3)"}
                        strokeWidth="2" strokeDasharray="10 5" strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
              )}

              {/* Render Tiles */}
              {tiles.map((tile) => {
                const config = getTileConfig(tile.type);
                const isSelected = selectedTile === tile.id;
                const r = tilePositions.get(tile.id)!;
                const size = BASE_TILE_DISPLAY_SIZE * tile.scale;
                const numericId = parseInt(tile.id, 10) || 0;

                // Z-Index calculation: selected > numeric ID, and labels > all tiles
                const tileZIndex = isSelected ? 9999 : numericId;
                const labelZIndex = 10000 + numericId;

                return (
                  <div
                    key={tile.id}
                    className={`absolute cursor-pointer transition-all z-[${tileZIndex}]`}
                    style={{ left: r.pos.x, top: r.pos.y, transform: 'translate(-50%, -50%)' }}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedTile(tile.id); }}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <div className="relative transition-all" style={{ width: size, height: size }}>
                      <div
                        className={`
                          w-full h-full flex items-center justify-center transition-all 
                          ${isSelected && !isExporting ? 'ring-4 ring-yellow-400 animate-pulse shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''} 
                          ${config.customImageUrl || TILE_ASSETS[tile.type] ? 'rounded-lg' : 'rounded-full'}
                        `.trim()}
                        style={{ transformOrigin: 'center center' }}
                      >
                        {config.customImageUrl || TILE_ASSETS[tile.type] ? (
                          <img
                            src={config.customImageUrl || TILE_ASSETS[tile.type]}
                            alt={tile.type}
                            className="w-full h-full object-contain drop-shadow-2xl"
                            style={{
                              filter: isSelected && !isExporting ? 'brightness(1.1)' : 'none',
                              transformOrigin: 'center center',
                              imageRendering: 'auto'
                            } as React.CSSProperties}
                          />
                        ) : (
                          <div
                            className="rounded-full w-full h-full flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: config.color, boxShadow: `0 4px 12px ${config.color}80` }}
                          >
                            <span className="text-white font-bold drop-shadow-lg" style={{ fontSize: size * 0.4 }}>
                              {config.symbol}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Spawn Rotation Indicator */}
                      {['1st', '2nd', '3rd', '4th'].includes(tile.type) && tile.showSpawnRotation && (
                        <div
                          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform"
                          style={{ transform: `rotate(${-r.worldAngle + (tile.spawnRotation || 0)}deg)`, zIndex: 10 }}
                        >
                          <div
                            className="absolute"
                            style={{
                              top: '5%',
                              color: ['1st', '3rd'].includes(tile.type) ? '#FFFFFF' : '#28330E',
                              fontSize: size * 0.25,
                              textShadow: ['1st', '3rd'].includes(tile.type) ? '0 0 4px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.8)',
                              lineHeight: 1
                            }}
                          >▲</div>
                        </div>
                      )}

                      {/* ID Label */}
                      {showIds && !isExporting && (
                        <div
                          className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-[${labelZIndex}]`}
                          style={{ top: '100%', marginTop: size * 0.1 }}
                        >
                          <span
                            className={`
                              font-bold px-1.5 py-0.5 rounded shadow-sm 
                              ${showGrid ? 'text-white bg-black/40' : 'text-gray-900 bg-white/80'}
                            `.trim()}
                            style={{ fontSize: Math.max(10, size * 0.22) }}
                          >
                            #{tile.id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="h-10 bg-gray-800 border-t border-gray-700 px-4 py-2 text-gray-400 text-[10px] lg:text-sm flex items-center gap-4 shrink-0 overflow-x-auto no-scrollbar">
          <span className="whitespace-nowrap">Tiles: {tiles.length}</span>
          {selectedTile && selectedTileData && (
            <span className="text-white whitespace-nowrap">
              Selected: #{selectedTile} • {getTileConfig(selectedTileData.type).label} • Angle: {selectedTileData.angle}° • Distance: {selectedTileData.distance}px
            </span>
          )}
          <span className="ml-auto text-gray-500 whitespace-nowrap hidden lg:inline">
            Drag to pan • Scroll to zoom • Click to Select • Arrows to Adjust
          </span>
        </div>
      </div>

      {/* Sidebar Panel (Motion-controlled Bottom Sheet on mobile) */}
      <motion.div
        initial={false}
        {...sidebarMotionConfig}
        className="w-full lg:w-96 bg-gray-800 border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col fixed lg:relative bottom-0 lg:bottom-auto h-[50vh] lg:h-screen shrink-0 z-50 lg:z-10 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)] lg:shadow-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex border-b border-gray-700 shrink-0 h-12">
          <button
            onClick={() => setSidebarTab('properties')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${sidebarTab === 'properties' ? 'bg-gray-700 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Edit3 className="w-4 h-4" />Properties
          </button>
          <button
            onClick={() => setSidebarTab('types')}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${sidebarTab === 'types' ? 'bg-gray-700 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Palette className="w-4 h-4" />Types
          </button>
          {!sidebarOpen && isMobile && (
            <div className="absolute inset-0 cursor-pointer" onClick={() => setSidebarOpen(true)} />
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Properties Tab */}
          {sidebarTab === 'properties' && selectedTileData && (
            <div className="p-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg">Tile #{selectedTile}</h3>
                <button
                  onClick={() => { if (isMobile) setSidebarOpen(false); else setSelectedTile(null); }}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  {isMobile ? 'Minimize' : 'Close Panel'}
                </button>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Parent Tile</label>
                <select
                  value={selectedTileData.parentId || ''}
                  onFocus={saveHistory}
                  onChange={(e) => {
                    const newP = e.target.value || null;
                    if (selectedTile && canSetParent(selectedTile, newP)) {
                      updateTileProperty('parentId', newP);
                    } else {
                      toast.error('循環参照になるため設定できません');
                    }
                  }}
                  disabled={selectedTile === '1'}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">None (Root)</option>
                  {tiles.filter(t => t.id !== selectedTile).map(t => (
                    <option key={t.id} value={t.id}>#{t.id} - {getTileConfig(t.type).label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Distance: {selectedTileData.distance}px
                </label>
                <input
                  type="range" min="0" max="300" step="5"
                  value={selectedTileData.distance}
                  onMouseDown={saveHistory}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  onChange={(e) => updateTileProperty('distance', parseInt(e.target.value))}
                  className="w-full"
                />
                <input
                  type="number" min="0" max="500"
                  value={selectedTileData.distance}
                  onFocus={saveHistory}
                  onChange={(e) => updateTileProperty('distance', parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mt-2"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Angle: {selectedTileData.angle}°
                </label>
                <input
                  type="range" min="0" max="360" step="5"
                  value={selectedTileData.angle}
                  onMouseDown={saveHistory}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  onChange={(e) => updateTileProperty('angle', parseInt(e.target.value))}
                  className="w-full"
                />
                <input
                  type="number" min="0" max="360"
                  value={selectedTileData.angle}
                  onFocus={saveHistory}
                  onChange={(e) => updateTileProperty('angle', parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mt-2"
                />
              </div>

              {/* Specific for Spawn points */}
              {['1st', '2nd', '3rd', '4th'].includes(selectedTileData.type) && (
                <div className="pt-2 border-t border-gray-600 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-300 text-sm font-medium">
                      Spawn Rotation: {selectedTileData.spawnRotation || 0}°
                    </label>
                    <button
                      onClick={() => {
                        saveHistory();
                        updateTileProperty('showSpawnRotation', !selectedTileData.showSpawnRotation);
                      }}
                      className={`
                        px-3 py-1 text-xs rounded transition-colors font-medium 
                        ${selectedTileData.showSpawnRotation ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
                      `.trim()}
                    >
                      {selectedTileData.showSpawnRotation ? 'Hide ▲' : 'Show ▲'}
                    </button>
                  </div>
                  <input
                    type="range" min="0" max="360" step="5"
                    value={selectedTileData.spawnRotation || 0}
                    onMouseDown={saveHistory}
                    onMouseUp={(e) => e.currentTarget.blur()}
                    onChange={(e) => updateTileProperty('spawnRotation', parseInt(e.target.value))}
                    className="w-full"
                  />
                  <input
                    type="number" min="0" max="360"
                    value={selectedTileData.spawnRotation || 0}
                    onFocus={saveHistory}
                    onChange={(e) => updateTileProperty('spawnRotation', parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none mt-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Tile Type</label>
                <select
                  value={selectedTileData.type}
                  onFocus={saveHistory}
                  onChange={(e) => {
                    const newType = e.target.value;
                    const oldConfig = getTileConfig(selectedTileData.type);
                    const newConfig = getTileConfig(newType);
                    const isSpawnType = SPAWN_LABELS.includes(newType);

                    // Auto-adjust scale if it was default
                    if (Math.abs(selectedTileData.scale - oldConfig.defaultScale) < 0.01) {
                      setTiles(prev => prev.map(t => t.id === selectedTile ? { ...t, type: newType, scale: newConfig.defaultScale, showSpawnRotation: isSpawnType } : t));
                    } else {
                      setTiles(prev => prev.map(t => t.id === selectedTile ? { ...t, type: newType, showSpawnRotation: isSpawnType } : t));
                    }
                  }}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  {sortedTileTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Scale: {selectedTileData.scale.toFixed(1)}x
                </label>
                <input
                  type="range" min="0.5" max="3.0" step="0.1"
                  value={selectedTileData.scale}
                  onMouseDown={saveHistory}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  onChange={(e) => updateTileProperty('scale', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex gap-2 mt-2">
                  {[0.8, 1.0, 1.2, 1.5].map(v => (
                    <button
                      key={v}
                      onClick={() => { saveHistory(); updateTileProperty('scale', v); }}
                      className="flex-1 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 text-sm"
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Preview</label>
                <div className="w-full h-32 rounded-lg flex items-center justify-center shadow-lg bg-gray-900/50 relative overflow-hidden">
                  {TILE_ASSETS[selectedTileData.type] ? (
                    <img src={TILE_ASSETS[selectedTileData.type]} className="h-24 w-24 object-contain drop-shadow-xl" alt="Preview" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: getTileConfig(selectedTileData.type).color }}>
                      <span className="text-white font-bold">
                        {getTileConfig(selectedTileData.type).symbol}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Type Manager Tab */}
          {sidebarTab === 'types' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Tile Type Manager</h3>
                <button
                  onClick={addTileType}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />New Type
                </button>
              </div>

              {sortedTileTypes.map(type => (
                <div
                  key={type.id} id={`type-item-${type.id}`}
                  className={`p-3 rounded border ${editingTypeId === type.id ? 'border-blue-500 bg-gray-700' : 'border-gray-600 bg-gray-800'}`}
                >
                  {editingTypeId === type.id ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs px-1">Display Name</label>
                        <input
                          type="text" value={type.label}
                          onChange={(e) => updateTileType(type.id, { label: e.target.value })}
                          className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      {!TILE_ASSETS[type.id] && (
                        <>
                          <div className="space-y-1">
                            <label className="text-gray-400 text-xs px-1">Fallback Symbol</label>
                            <input
                              type="text" value={type.symbol}
                              onChange={(e) => updateTileType(type.id, { symbol: e.target.value })}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                              maxLength={2}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-gray-400 text-xs px-1">Fallback Color</label>
                            <input
                              type="color" value={type.color}
                              onChange={(e) => updateTileType(type.id, { color: e.target.value })}
                              className="w-full h-10 bg-gray-600 rounded border border-gray-500 cursor-pointer"
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-1">
                        <label className="text-gray-400 text-xs px-1">Default Scale</label>
                        <input
                          type="number" value={type.defaultScale}
                          onChange={(e) => updateTileType(type.id, { defaultScale: parseFloat(e.target.value) || 1.0 })}
                          className="w-full bg-gray-600 text-white px-3 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                          step="0.1"
                        />
                      </div>

                      <div className="space-y-2 pt-1 border-t border-gray-600 mt-2">
                        <label className="text-gray-400 text-xs px-1">Custom Image</label>
                        {type.customImageUrl ? (
                          <div className="flex items-center gap-3 bg-gray-800 p-2 rounded border border-gray-500">
                            <div className="w-12 h-12 bg-black rounded overflow-hidden border border-gray-600">
                              <img src={type.customImageUrl} className="w-full h-full object-contain" />
                            </div>
                            <button
                              onClick={() => removeCustomImage(type.id)}
                              className="text-red-400 text-[10px] flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" />Remove
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="file" accept="image/*" id={`upload-${type.id}`} className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCustomImageUpload(type.id, f); }}
                            />
                            <label
                              htmlFor={`upload-${type.id}`}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm cursor-pointer border border-gray-500 transition-colors"
                            >
                              <Upload className="w-4 h-4" />Upload Image
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-gray-600">
                        <button
                          onClick={() => setEditingTypeId(null)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                        >
                          Done
                        </button>
                        <button
                          onClick={() => deleteTileType(type.id)}
                          className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingTypeId(type.id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      {type.customImageUrl || TILE_ASSETS[type.id] ? (
                        <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center p-1 overflow-hidden">
                          <img src={type.customImageUrl || TILE_ASSETS[type.id]} alt={type.label} className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: type.color }}>
                          {type.symbol}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{type.label}</div>
                        <div className="text-gray-400 text-xs italic">
                          {TILE_ASSETS[type.id] ? 'Asset Resource' : type.color} • {type.defaultScale}x
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* --- Modals (Help & Export) --- */}
      <AnimatePresence>
        {/* Help Modal */}
        {showHelpModal && (
          <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHelpModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Help & Information</h2>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                <section>
                  <h3 className="flex items-center gap-2 text-blue-400 font-bold text-lg mb-4">
                    <Edit3 className="w-5 h-5" />使い方 (Usage)
                  </h3>
                  <div className="grid gap-4 text-gray-300">
                    <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600">
                      <p className="font-semibold text-white mb-1">■ マスの追加や調整</p>
                      <p className="text-sm">「+Add Tile」ボタンからマスを追加し、右側のサイドバーの「Tile Properties」で基準とするマスや距離や角度、マスの種類などを調整できます。全体の角度を変えたい場合は#1の角度を変えてみてください。</p>
                    </div>
                    <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600">
                      <p className="font-semibold text-white mb-1">■ 新しいマスの追加や画像、名前の変更</p>
                      <p className="text-sm">右側のサイドバーの「Tile Types」で新しいマスの追加や画像、名前の変更ができます。</p>
                    </div>
                    <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600">
                      <p className="font-semibold text-white mb-1">■ 保存と再開</p>
                      <p className="text-sm">「Export」ボタンからデータを JSON 形式で保存できます。保存したファイルは「Import」ボタンからいつでも読み込んで続きを作成できます。</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="flex items-center gap-2 text-purple-400 font-bold text-lg mb-4">
                    <Grid className="w-5 h-5" />エクスポート形式について
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      <div>
                        <span className="text-white font-medium">Relative JSON:</span>
                        <span className="text-gray-400 text-sm ml-2">本ツールで再編集するための標準形式です。</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      <div>
                        <span className="text-white font-medium">Absolute JSON:</span>
                        <span className="text-gray-400 text-sm ml-2">座標計算済みのデータです（外部ツール等での利用向け）。</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      <div>
                        <span className="text-white font-medium">PNG:</span>
                        <span className="text-gray-400 text-sm ml-2">背景透過済みのマップ画像として書き出します。</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="pt-4 border-t border-gray-700">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
                    <h3 className="text-amber-400 font-bold text-sm mb-2 uppercase tracking-wider">
                      権利表記・ガイドラインについて (Disclaimer)
                    </h3>
                    <ul className="text-xs text-amber-200/70 space-y-2 list-disc pl-4">
                      <li>本ツールは「アストラルパーティー」のファンによる非公式の二次創作ツールであり、開発元である Shanghai Feimo Technology Co., LTD とは一切関係ありません。</li>
                      <li>ツール内で使用・表示されるゲーム内画像等の知的財産権は、すべて権利者である Shanghai Feimo Technology Co., LTD に帰属します。</li>
                      <li>本ツールを利用して作成された画像やデータの公開・配布にあたっては、公式の「<a href="https://www.astralparty.jp/guidelines" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">二次創作・ゲーム実況配信及び動画投稿に関するガイドライン</a>」を遵守した上で、利用者自身の責任において行ってください。</li>
                      <li>本ツールの利用により生じたいかなる損害についても、制作者は一切の責任を負いません。</li>
                    </ul>
                  </div>
                </section>
              </div>

              <div className="p-4 bg-gray-900/50 flex justify-end shrink-0">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">Export Map</h2>
                <p className="text-gray-400 text-sm mt-1">Select your preferred export format.</p>
              </div>
              <div className="p-6 space-y-4">
                <button
                  onClick={() => { exportRelativeJSON(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors group text-left"
                >
                  <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                    <Edit3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Relative JSON</h3>
                    <p className="text-gray-400 text-xs mt-0.5">Recommended format for re-editing in this tool.</p>
                  </div>
                </button>
                <button
                  onClick={() => { exportAbsoluteJSON(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors group text-left"
                >
                  <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                    <Grid className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Absolute JSON</h3>
                    <p className="text-gray-400 text-xs mt-0.5">Calculated coordinates for other tools.</p>
                  </div>
                </button>
                <button
                  onClick={() => { exportPNG(); setShowExportModal(false); }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-colors group text-left"
                >
                  <div className="p-3 rounded-lg bg-green-500/20 text-green-400 group-hover:bg-green-500/30 transition-colors">
                    <Square className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Map Image (PNG)</h3>
                    <p className="text-gray-400 text-xs mt-0.5">Export map as an image.</p>
                  </div>
                </button>
              </div>
              <div className="p-4 bg-gray-900/50 flex justify-end">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

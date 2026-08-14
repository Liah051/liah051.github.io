export interface TileTypeConfig {
  id: string;
  color: string;
  symbol: string;
  label: string;
  defaultScale: number;
  customImageUrl?: string | null;
}

export interface Tile {
  id: string;
  type: string; // references TileTypeConfig.id
  parentId: string | null;
  distance: number;
  angle: number;
  scale: number;
  spawnRotation?: number;
  showSpawnRotation?: boolean;
}

export interface TilePosition {
  x: number;
  y: number;
}

export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

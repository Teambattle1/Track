// Global type declarations for modules without types

// Leaflet image imports
declare module 'leaflet/dist/images/marker-icon.png' {
  const value: string;
  export default value;
}

declare module 'leaflet/dist/images/marker-icon-2x.png' {
  const value: string;
  export default value;
}

declare module 'leaflet/dist/images/marker-shadow.png' {
  const value: string;
  export default value;
}

// Override react-leaflet types to be more permissive
declare module 'react-leaflet' {
  import * as L from 'leaflet';
  import { FC, ReactNode, RefAttributes } from 'react';

  export interface MarkerProps extends RefAttributes<L.Marker> {
    position: L.LatLngExpression | number[];
    icon?: L.Icon | L.DivIcon | any;
    draggable?: boolean;
    eventHandlers?: Record<string, (e: any) => void>;
    zIndexOffset?: number;
    children?: ReactNode;
    key?: string;
    [key: string]: any;
  }

  export interface CircleProps extends RefAttributes<L.Circle> {
    center: L.LatLngExpression | number[];
    radius: number;
    pathOptions?: L.PathOptions | any;
    interactive?: boolean;
    className?: string;
    eventHandlers?: Record<string, (e: any) => void>;
    [key: string]: any;
  }

  export interface TooltipProps extends RefAttributes<L.Tooltip> {
    permanent?: boolean;
    direction?: string;
    offset?: [number, number] | number[];
    opacity?: number;
    className?: string;
    children?: ReactNode;
    [key: string]: any;
  }

  export interface MapContainerProps extends RefAttributes<L.Map> {
    center: L.LatLngExpression | number[];
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    style?: React.CSSProperties;
    zoomControl?: boolean;
    className?: string;
    children?: ReactNode;
    [key: string]: any;
  }

  export interface TileLayerProps extends RefAttributes<L.TileLayer> {
    url: string;
    attribution?: string;
    className?: string;
    errorTileUrl?: string;
    detectRetina?: boolean;
    maxZoom?: number;
    [key: string]: any;
  }

  export interface CircleMarkerProps extends RefAttributes<L.CircleMarker> {
    center: L.LatLngExpression | number[];
    radius: number;
    pathOptions?: L.PathOptions | any;
    interactive?: boolean;
    className?: string;
    eventHandlers?: Record<string, (e: any) => void>;
    children?: ReactNode;
    [key: string]: any;
  }

  export const Marker: FC<MarkerProps>;
  export const Circle: FC<CircleProps>;
  export const CircleMarker: FC<CircleMarkerProps>;
  export const Tooltip: FC<TooltipProps>;
  export const MapContainer: FC<MapContainerProps>;
  export const TileLayer: FC<TileLayerProps>;
  export const Popup: FC<any>;
  export const Polygon: FC<any>;
  export const Polyline: FC<any>;
  export const useMap: () => L.Map;
  export const useMapEvents: (handlers: any) => L.Map;
}

// JSX namespace for React 18+
declare global {
  // Vite ImportMeta type declarations
  interface ImportMetaEnv {
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly MODE: string;
    readonly BASE_URL: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    [key: string]: any;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};

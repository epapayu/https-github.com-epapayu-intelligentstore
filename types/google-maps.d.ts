// types/google-maps.d.ts
// Custom type definitions for Google Maps API to resolve compilation errors
// if @types/google.maps is not correctly picked up by the environment.

// Define the core instance types within the google.maps namespace
declare namespace google {
  namespace maps {
    // Instance types (classes)
    class Map {
      constructor(mapDiv: HTMLElement, opts?: MapOptions);
      setCenter(latlng: LatLngLiteral | LatLng): void;
      setZoom(zoom: number): void;
      fitBounds(bounds: LatLngBounds): void;
      panTo(latlng: LatLngLiteral | LatLng): void;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: Function): MapsEventListener;
      getTitle(): string;
      getPosition(): LatLng | null;
      setIcon(icon: string | MarkerIcon | Symbol): void;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      setContent(content: string | HTMLElement): void;
      open(map?: Map | null, anchor?: Marker): void;
      close(): void;
    }

    class LatLng {
      constructor(lat: number, lng: number, noWrap?: boolean);
      lat(): number;
      lng(): number;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLngBounds {
      constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
      extend(latLng: LatLng | LatLngLiteral): void;
    }

    // Event listener interface
    interface MapsEventListener {
      remove(): void;
    }

    interface MapOptions {
      center?: LatLngLiteral;
      zoom?: number;
      streetViewControl?: boolean;
      mapTypeControl?: boolean;
      fullscreenControl?: boolean;
    }

    interface MarkerOptions {
      position: LatLngLiteral;
      map?: Map | null;
      title?: string;
      icon?: string | MarkerIcon | Symbol;
    }

    interface MarkerIcon {
      path?: SymbolPath | string;
      fillColor?: string;
      fillOpacity?: number;
      strokeWeight?: number;
      scale?: number;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
      disableAutoPan?: boolean;
      maxWidth?: number;
      pixelOffset?: Size;
      position?: LatLng | LatLngLiteral;
      zIndex?: number;
    }

    enum SymbolPath {
      CIRCLE = 0, // Explicitly assign values to prevent issues if transpiled without const enum
      FORWARD_CLOSED_ARROW = 1,
      FORWARD_OPEN_ARROW = 2,
      BACKWARD_CLOSED_ARROW = 3,
      BACKWARD_OPEN_ARROW = 4,
    }

    // Other missing types that might be implicitly used
    class MVCObject {}
    class Size {} // For InfoWindowOptions
    class Symbol {} // For MarkerOptions icon - note: this conflicts with global `Symbol` if not careful, but assumed to be `google.maps.Symbol`
  }
}

// Augment the Window interface to declare the global 'google' object
// This ensures `window.google.maps.Map` refers to the constructor,
// while `google.maps.Map` (from the namespace) refers to the instance type.
declare global {
  interface Window {
    google: {
      maps: {
        // Explicitly define constructor signatures for the global objects
        Map: new (mapDiv: HTMLElement, opts?: google.maps.MapOptions) => google.maps.Map;
        Marker: new (opts?: google.maps.MarkerOptions) => google.maps.Marker;
        InfoWindow: new (opts?: google.maps.InfoWindowOptions) => google.maps.InfoWindow;
        LatLng: new (lat: number, lng: number, noWrap?: boolean) => google.maps.LatLng;
        LatLngBounds: new (sw?: google.maps.LatLng | google.maps.LatLngLiteral, ne?: google.maps.LatLng | google.maps.LatLngLiteral) => google.maps.LatLngBounds;
        
        // Expose other types as they would be globally available through window.google.maps
        MapOptions: google.maps.MapOptions;
        MarkerOptions: google.maps.MarkerOptions;
        MarkerIcon: google.maps.MarkerIcon;
        InfoWindowOptions: google.maps.InfoWindowOptions;
        LatLngLiteral: google.maps.LatLngLiteral;
        MapsEventListener: google.maps.MapsEventListener;
        SymbolPath: typeof google.maps.SymbolPath; // Enum is available directly at runtime
        MVCObject: typeof google.maps.MVCObject; // Class constructor
        Size: typeof google.maps.Size; // Class constructor
        Symbol: typeof google.maps.Symbol; // Class constructor
      };
    };
    gm_authFailure?: () => void; // Added for Google Maps API authentication failure callback
    _original_gm_authFailure?: () => void; // Added to store original gm_authFailure handler
  }
}

export {}; // Make this file an external module

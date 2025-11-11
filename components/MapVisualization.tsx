import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StoreData } from '../types';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../constants';
import type {} from '../types/google-maps';

interface MapVisualizationProps {
  stores: StoreData[];
  selectedStore: StoreData | null;
  onStoreSelect: (store: StoreData | null) => void;
}

// Global variable to hold the single promise for Google Maps script loading
let globalGoogleMapsLoadingPromise: Promise<void> | null = null;
// Global variable to store the original gm_authFailure handler
let originalGmAuthFailure: (() => void) | undefined = undefined;

const MapVisualization: React.FC<MapVisualizationProps> = ({ stores, selectedStore, onStoreSelect }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  // FIX: Type useRef with the Google Maps instance types (e.g., google.maps.Map)
  // This ensures that googleMap.current holds an instance, not the constructor type.
  const googleMap = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  const loadGoogleMapsScript = useCallback(() => {
    // If google.maps is already available and mapRef is current, assume successful load and initialization
    if (window.google?.maps && mapRef.current && googleMap.current) {
      return Promise.resolve();
    }

    // If a load is already in progress, return the existing promise
    if (globalGoogleMapsLoadingPromise) {
      return globalGoogleMapsLoadingPromise;
    }

    const googleMapsApiKey = process.env.API_KEY;

    // --- Enhanced API Key Validation ---
    if (!googleMapsApiKey || googleMapsApiKey === "process.env.API_KEY") {
      const errMsg = "Google Maps API Key is missing or incorrectly configured. Please ensure `process.env.API_KEY` is set in your environment variables and correctly bundled for client-side use. Map cannot be loaded.";
      console.error(errMsg);
      setMapLoadError(errMsg);
      return Promise.reject(new Error(errMsg));
    }

    // Remove any existing script tag to prevent conflicts on re-attempts
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.remove();
      console.warn("Removed existing Google Maps script tag to ensure a fresh load.");
    }

    globalGoogleMapsLoadingPromise = new Promise<void>((resolve, reject) => {
      let isAuthFailureTriggered = false;

      // Save and override window.gm_authFailure BEFORE appending the script
      originalGmAuthFailure = window.gm_authFailure;
      window.gm_authFailure = () => {
        if (isAuthFailureTriggered) return; // Prevent multiple triggers
        isAuthFailureTriggered = true;

        const errorMsg = "Google Maps API Authentication Failed: Invalid API Key or configuration. Please check your API key, ensure Maps JavaScript API is enabled for your project, and billing is active (ai.google.dev/gemini-api/docs/billing).";
        console.error(errorMsg);
        setMapLoadError(errorMsg);
        // Immediately restore original gm_authFailure to prevent interfering with other components
        if (originalGmAuthFailure) {
          window.gm_authFailure = originalGmAuthFailure;
        } else {
          delete window.gm_authFailure;
        }
        originalGmAuthFailure = undefined; // Clear global ref
        reject(new Error(errorMsg));
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      script.id = 'google-maps-script';

      script.onload = () => {
        // If auth failure already triggered, do nothing more here
        if (isAuthFailureTriggered) return;

        if (window.google?.maps) {
          resolve();
        } else {
          const errorMsg = "Google Maps script loaded, but 'google.maps' object not found or not fully initialized.";
          console.error(errorMsg);
          setMapLoadError(errorMsg);
          reject(new Error(errorMsg));
        }
        // Restore original gm_authFailure after script loaded successfully
        if (window.google?.maps && originalGmAuthFailure) {
            window.gm_authFailure = originalGmAuthFailure;
        } else if (window.google?.maps) { // If there was no original, just delete.
            delete window.gm_authFailure;
        }
        originalGmAuthFailure = undefined;
      };

      script.onerror = (e: Event | string) => {
        if (isAuthFailureTriggered) return; // Don't trigger if auth failure already handled

        const detailedErrorMessage = (typeof e === 'string') ? e : (e instanceof ErrorEvent ? e.message : 'Unknown network or script error');
        const errorMsg = `Failed to load Google Maps script: ${detailedErrorMessage}. This could be due to network issues or an incorrect script URL.`;
        console.error(errorMsg);
        setMapLoadError(errorMsg);
        // Restore gm_authFailure on script error as well
        if (originalGmAuthFailure) {
            window.gm_authFailure = originalGmAuthFailure;
        } else {
            delete window.gm_authFailure;
        }
        originalGmAuthFailure = undefined;
        reject(new Error(errorMsg));
      };

      document.head.appendChild(script);
    }).finally(() => {
      globalGoogleMapsLoadingPromise = null; // Clear the global promise reference
      // The cleanup of gm_authFailure is now handled within onload/onerror/gm_authFailure itself.
    });

    return globalGoogleMapsLoadingPromise;
  }, []); // No dependencies for useCallback as it uses global state for promise/authFailure

  const initMap = useCallback(() => {
    if (mapRef.current && window.google?.maps && !googleMap.current) {
      // FIX: Use the constructor from window.google.maps and assign the instance to googleMap.current
      googleMap.current = new window.google.maps.Map(mapRef.current, {
        center: DEFAULT_MAP_CENTER,
        zoom: DEFAULT_MAP_ZOOM,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      // FIX: Use the constructor from window.google.maps and assign the instance to infoWindowRef.current
      infoWindowRef.current = new window.google.maps.InfoWindow();
      setMapLoadError(null); // Clear any previous errors if map successfully initializes
    }
  }, []);

  useEffect(() => {
    setMapLoadError(null); // Clear error on mount or re-render before attempting load
    loadGoogleMapsScript()
      .then(initMap)
      .catch(error => {
        // Error state should already be set by loadGoogleMapsScript
        console.error("Map initialization process failed:", error);
      });

    // Cleanup for unmount
    return () => {
      googleMap.current = null; // Clear map instance
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      // Ensure global promise is cleared on unmount if it was still pending
      if (globalGoogleMapsLoadingPromise) {
        globalGoogleMapsLoadingPromise = null;
      }
      // Explicitly restore gm_authFailure on unmount if it was still overridden
      // This is crucial to not leave a modified global state if component unmounts prematurely
      if (window.gm_authFailure !== originalGmAuthFailure) {
        if (originalGmAuthFailure) {
            window.gm_authFailure = originalGmAuthFailure;
        } else {
            delete window.gm_authFailure;
        }
        originalGmAuthFailure = undefined;
      }
    };
  }, [loadGoogleMapsScript, initMap]);

  useEffect(() => {
    if (!googleMap.current || !window.google?.maps) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    stores.forEach(store => {
      // FIX: Use the constructor from window.google.maps
      const marker = new window.google.maps.Marker({
        position: { lat: store.latitude, lng: store.longitude },
        map: googleMap.current,
        title: store.city,
        icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: selectedStore?.id === store.id ? '#FF0000' : '#0000FF', // Red if selected, Blue otherwise
            fillOpacity: 0.8,
            strokeWeight: 0,
            scale: 8,
        },
      });

      marker.addListener('click', () => {
        onStoreSelect(store);
        if (infoWindowRef.current) {
          // FIX: Call method on the instance
          infoWindowRef.current.setContent(`
            <div class="p-2">
              <h3 class="font-bold text-lg mb-1">${store.city}</h3>
              <p>Sales: $${store.sales.toLocaleString()}</p>
              <p>Profit: $${store.profit.toLocaleString()}</p>
              <p>Employees: ${store.employees.toLocaleString()}</p>
            </div>
          `);
          // FIX: Call method on the instance
          infoWindowRef.current.open(googleMap.current, marker);
        }
      });
      markersRef.current.push(marker);
    });

    // Recenter map if stores are loaded and no specific store selected
    if (stores.length > 0 && !selectedStore) {
      // FIX: Use the constructor from window.google.maps
      const bounds = new window.google.maps.LatLngBounds();
      stores.forEach(store => bounds.extend({ lat: store.latitude, lng: store.longitude }));
      // FIX: Call method on the instance
      googleMap.current.fitBounds(bounds);
    }

    // Update selected marker's icon and info window
    markersRef.current.forEach(marker => {
        if (selectedStore && marker.getTitle() === selectedStore.city &&
            marker.getPosition()?.lat() === selectedStore.latitude &&
            marker.getPosition()?.lng() === selectedStore.longitude) {
            // FIX: Call method on the instance
            marker.setIcon({
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#FF0000', // Red for selected
                fillOpacity: 0.9,
                strokeWeight: 0,
                scale: 10, // Slightly larger for selected
            });
            if (infoWindowRef.current) {
                // FIX: Call method on the instance
                infoWindowRef.current.setContent(`
                  <div class="p-2">
                    <h3 class="font-bold text-lg mb-1">${selectedStore.city}</h3>
                    <p>Sales: $${selectedStore.sales.toLocaleString()}</p>
                    <p>Profit: $${selectedStore.profit.toLocaleString()}</p>
                    <p>Employees: ${selectedStore.employees.toLocaleString()}</p>
                  </div>
                `);
                // FIX: Call method on the instance
                infoWindowRef.current.open(googleMap.current, marker);
            }
        } else {
            // FIX: Call method on the instance
            marker.setIcon({
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#0000FF', // Blue for unselected
                fillOpacity: 0.8,
                strokeWeight: 0,
                scale: 8,
            });
        }
    });

  }, [stores, selectedStore, onStoreSelect]);

  useEffect(() => {
    // If a store is selected, center the map on it
    if (googleMap.current && selectedStore) {
      // FIX: Call method on the instance
      googleMap.current.panTo({ lat: selectedStore.latitude, lng: selectedStore.longitude });
    }
  }, [selectedStore]);


  return (
    <div
      ref={mapRef}
      className="w-full h-96 md:h-[600px] rounded-lg shadow-md overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500"
    >
      {mapLoadError ? (
        <div className="text-red-600 p-4 text-center font-semibold text-lg">
          Error loading map: <br />{mapLoadError}
          <p className="text-sm mt-2 text-gray-700">Please verify your API key and billing settings in Google Cloud Console.</p>
          <p className="text-sm mt-1 text-gray-700">Check browser console for more details.</p>
        </div>
      ) : (
        !googleMap.current && (
          <span className="text-center p-4">
            Loading Map... <br /> If the map doesn't load, please ensure your Google Maps API key is correct and enabled for Maps JavaScript API.
            <p className="text-sm mt-2 text-gray-700">Check browser console for details.</p>
          </span>
        )
      )}
    </div>
  );
};

export default MapVisualization;
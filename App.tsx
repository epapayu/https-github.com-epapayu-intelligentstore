import React, { useState, useEffect, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import MapVisualization from './components/MapVisualization';
import Chatbot from './components/Chatbot';
import { StoreData, LatLng } from './types';
import { APP_NAME } from './constants';

function App() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [showGeolocationPrompt, setShowGeolocationPrompt] = useState<boolean>(true); // State to control prompt visibility

  // Fetch user's current location for Maps grounding
  useEffect(() => {
    if (navigator.geolocation && showGeolocationPrompt) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setShowGeolocationPrompt(false); // Hide after successful acquisition
        },
        (error) => {
          console.error("Error getting geolocation:", error.message); // Changed to error.message
          setShowGeolocationPrompt(false); // Hide prompt if access is denied or error occurs
          // Optionally, inform the user that location services are needed for optimal Maps grounding
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, [showGeolocationPrompt]);

  const handleDataUpload = useCallback((data: StoreData[]) => {
    setStores(data);
    setSelectedStore(null); // Clear selection on new data upload
  }, []);

  const handleStoreSelect = useCallback((store: StoreData | null) => {
    setSelectedStore(store);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedStore(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="w-full text-center mb-8">
        <h1 className="text-4xl font-extrabold text-blue-800 mb-2">{APP_NAME}</h1>
        <p className="text-lg text-gray-600">Track and analyze your store performance across Indonesia.</p>
      </header>

      <main className="w-full max-w-6xl space-y-8">
        <section className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/3">
            <FileUpload onDataUpload={handleDataUpload} />
          </div>
          <div className="lg:w-2/3">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Store Performance Map</h2>
            {stores.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-6 h-96 flex items-center justify-center text-gray-500">
                Upload an Excel file to see store data on the map.
              </div>
            ) : (
              <div className="relative">
                <MapVisualization stores={stores} selectedStore={selectedStore} onStoreSelect={handleStoreSelect} />
                {selectedStore && (
                  <button
                    onClick={clearSelection}
                    className="absolute top-4 right-4 bg-white text-gray-700 p-2 rounded-full shadow-lg hover:bg-gray-100 transition duration-200"
                    title="Clear selected store"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <Chatbot stores={stores} selectedStore={selectedStore} userLocation={userLocation} />
        </section>
      </main>
    </div>
  );
}

export default App;
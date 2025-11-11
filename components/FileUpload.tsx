import React, { useState } from 'react';
import { StoreData } from '../types';

interface FileUploadProps {
  onDataUpload: (data: StoreData[]) => void;
}

// Declare XLSX globally since it's loaded via CDN script in index.html
declare const XLSX: any;

const FileUpload: React.FC<FileUploadProps> = ({ onDataUpload }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setError(null);
    } else {
      setFileName(null);
    }
  };

  const parseExcelFile = (file: File) => {
    return new Promise<StoreData[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet);

          // Assuming the Excel file has columns: City, Latitude, Longitude, Sales, Profit, Employees
          const parsedData: StoreData[] = json.map((row, index) => ({
            id: `store-${index}`,
            city: row.City,
            latitude: parseFloat(row.Latitude),
            longitude: parseFloat(row.Longitude),
            sales: parseFloat(row.Sales),
            profit: parseFloat(row.Profit),
            employees: parseFloat(row.Employees),
            // Map other metrics here
          }));
          resolve(parsedData);
        } catch (err) {
          console.error("Error parsing Excel file:", err);
          reject("Error parsing Excel file. Please ensure it's a valid Excel file with expected columns (City, Latitude, Longitude, Sales, Profit, Employees).");
        }
      };
      reader.onerror = (err) => {
        console.error("File reader error:", err);
        reject("Error reading file.");
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleUpload = async () => {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      setError("Please select an Excel file to upload.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await parseExcelFile(file);
      onDataUpload(data);
      alert("File uploaded and data processed successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md mb-6 w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Store Data</h2>
      <div className="flex items-center space-x-2">
        <label
          htmlFor="file-upload"
          className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 ease-in-out"
        >
          Select Excel File
          <input
            id="file-upload"
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        {fileName && (
          <span className="text-gray-700 text-sm truncate">{fileName}</span>
        )}
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <button
        onClick={handleUpload}
        disabled={!fileName || loading}
        className={`mt-4 w-full py-2 px-4 rounded-lg font-bold transition duration-200 ease-in-out
          ${!fileName || loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
      >
        {loading ? 'Processing...' : 'Upload Data'}
      </button>
    </div>
  );
};

export default FileUpload;
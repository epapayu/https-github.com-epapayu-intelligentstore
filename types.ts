import { FunctionCall, Part } from '@google/genai';

export interface StoreData {
    id: string;
    city: string;
    latitude: number;
    longitude: number;
    sales: number;
    profit: number;
    employees: number;
    // Add other metrics as needed from the Excel file
}

export interface ChatMessage {
    role: 'user' | 'model' | 'system';
    parts: Part[] | string;
    timestamp: Date;
    groundingUris?: string[];
    functionCalls?: FunctionCall[];
}

export interface LatLng {
    latitude: number;
    longitude: number;
}
export interface ServicePrice {
  id: string;
  name: string;
  price: number;
  category: "printing" | "copying" | "scanning" | "enlargement" | "other";
}

export interface ImageFilters {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  grayscale: boolean;
  binarize: boolean;
  binarizeThreshold: number; // 0-255
  rotate: number; // 0, 90, 180, 270
  shiftY?: number; // -100 to 100, manual vertical scroll
  shiftX?: number; // -100 to 100, manual horizontal scroll
  cropTop?: number;
  cropLeft?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface ExtractedDocInfo {
  duiNumber?: string;
  fullName?: string;
  dob?: string;
  expiryDate?: string;
  department?: string;
  documentType?: string;
  visualAnalysis?: string;
}

export interface DocumentUpload {
  id: string; // 'front' | 'back' | etc
  name: string;
  src: string; // base64 data url
  filters: ImageFilters;
  extractedInfo?: ExtractedDocInfo;
  transcription?: string;
}

export interface PhotoTemplate {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
  cols: number;
  rows: number;
  description: string;
  isCustom?: boolean;
}

export interface SmartPhotoItem {
  id: string;
  src: string;
  widthCm: number;
  heightCm: number;
  copies: number;
}

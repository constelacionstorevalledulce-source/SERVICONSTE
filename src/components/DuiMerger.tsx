import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, Sliders, RotateCw, Sparkles, Printer, Loader2, Check, 
  AlertCircle, Trash2, Layout, Grid, FileText, Copy, Info, CheckCircle2, Settings 
} from "lucide-react";
import { jsPDF } from "jspdf";
import { DocumentUpload, ImageFilters, ExtractedDocInfo } from "../types";
import { processImageFilters } from "../utils/imageProcessor";
import CameraCapture from "./CameraCapture";
import { Camera } from "lucide-react";

const DEFAULT_FILTERS: ImageFilters = {
  brightness: 0,
  contrast: 0,
  grayscale: false,
  binarize: false,
  binarizeThreshold: 128,
  rotate: 0
};

// Official ID-1 (DUI/credit card) proportions: 85.6mm x 53.98mm
const BASE_DUI_WIDTH_MM = 85.6;
const BASE_DUI_HEIGHT_MM = 53.98;

export default function DuiMerger() {
  // Mode: 'single' (1 DUI Frente y Reverso) or 'double' (2 DUIs: Doc A y Doc B, Frente y Reverso)
  const [layoutMode, setLayoutMode] = useState<"single" | "double">("single");
  const [scalePercent, setScalePercent] = useState<number>(150); // Default 150%
  const [alignment, setAlignment] = useState<"vertical" | "horizontal">("vertical");

  // Page configuration states
  const [pageSize, setPageSize] = useState<"letter" | "legal" | "a4">("letter");
  const [pageOrientation, setPageOrientation] = useState<"portrait" | "landscape">("portrait");
  const [marginMm, setMarginMm] = useState<number>(15); // in mm, default 15mm

  const getPageDimensions = () => {
    let baseWidth = 215.9;
    let baseHeight = 279.4;

    if (pageSize === "legal") {
      baseWidth = 215.9;
      baseHeight = 355.6;
    } else if (pageSize === "a4") {
      baseWidth = 210.0;
      baseHeight = 297.0;
    }

    if (pageOrientation === "landscape") {
      return { width: baseHeight, height: baseWidth };
    }
    return { width: baseWidth, height: baseHeight };
  };

  // Single DUI Uploads
  const [frontDoc, setFrontDoc] = useState<DocumentUpload | null>(null);
  const [backDoc, setBackDoc] = useState<DocumentUpload | null>(null);

  // Double DUI Uploads
  const [docAFront, setDocAFront] = useState<DocumentUpload | null>(null);
  const [docABack, setDocABack] = useState<DocumentUpload | null>(null);
  const [docBFront, setDocBFront] = useState<DocumentUpload | null>(null);
  const [docBBack, setDocBBack] = useState<DocumentUpload | null>(null);

  // Processed preview URLs for React rendering (after filters are applied)
  const [frontPreview, setFrontPreview] = useState<string>("");
  const [backPreview, setBackPreview] = useState<string>("");
  const [docAFrontPreview, setDocAFrontPreview] = useState<string>("");
  const [docABackPreview, setDocABackPreview] = useState<string>("");
  const [docBFrontPreview, setDocBFrontPreview] = useState<string>("");
  const [docBBackPreview, setDocBBackPreview] = useState<string>("");

  // Loading and AI enhancement states
  const [activeEnhancing, setActiveEnhancing] = useState<string | null>(null); // Id of doc being enhanced
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null); // For showing detail/filters panel
  const [cameraTargetId, setCameraTargetId] = useState<string | null>(null); // For camera capturing modal target

  // Refs for interactive click-and-drag alignment (Shift X and Y)
  const dragStartYRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartShiftYRef = useRef<number>(0);
  const dragStartShiftXRef = useRef<number>(0);
  const activeDragIdRef = useRef<string | null>(null);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    setSelectedDocId(id);
    const doc = getDocById(id);
    if (!doc) return;

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragStartYRef.current = clientY;
    dragStartXRef.current = clientX;
    dragStartShiftYRef.current = doc.filters.shiftY || 0;
    dragStartShiftXRef.current = doc.filters.shiftX || 0;
    activeDragIdRef.current = id;

    // Prevent default dragging ghost image behavior
    if (!("touches" in e)) {
      e.preventDefault();
    }
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (dragStartYRef.current === null || dragStartXRef.current === null || activeDragIdRef.current === null) return;

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const deltaY = clientY - dragStartYRef.current;
    const deltaX = clientX - dragStartXRef.current;

    const sensitivity = 0.8;
    let newShiftY = Math.round(dragStartShiftYRef.current + deltaY * sensitivity);
    newShiftY = Math.max(-100, Math.min(100, newShiftY));

    let newShiftX = Math.round(dragStartShiftXRef.current + deltaX * sensitivity);
    newShiftX = Math.max(-100, Math.min(100, newShiftX));

    updateDocFilters(activeDragIdRef.current, { 
      shiftY: newShiftY, 
      shiftX: newShiftX 
    });
  };

  const handleDragEnd = () => {
    dragStartYRef.current = null;
    dragStartXRef.current = null;
    activeDragIdRef.current = null;
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e);
    const onTouchMove = (e: TouchEvent) => handleDragMove(e);
    const onMouseUp = () => handleDragEnd();
    const onTouchEnd = () => handleDragEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Handle local previews with filter changes
  useEffect(() => {
    if (frontDoc) {
      processImageFilters(frontDoc.src, frontDoc.filters)
        .then(setFrontPreview)
        .catch(console.error);
    } else {
      setFrontPreview("");
    }
  }, [frontDoc, frontDoc?.filters]);

  useEffect(() => {
    if (backDoc) {
      processImageFilters(backDoc.src, backDoc.filters)
        .then(setBackPreview)
        .catch(console.error);
    } else {
      setBackPreview("");
    }
  }, [backDoc, backDoc?.filters]);

  useEffect(() => {
    if (docAFront) {
      processImageFilters(docAFront.src, docAFront.filters).then(setDocAFrontPreview).catch(console.error);
    } else {
      setDocAFrontPreview("");
    }
  }, [docAFront, docAFront?.filters]);

  useEffect(() => {
    if (docABack) {
      processImageFilters(docABack.src, docABack.filters).then(setDocABackPreview).catch(console.error);
    } else {
      setDocABackPreview("");
    }
  }, [docABack, docABack?.filters]);

  useEffect(() => {
    if (docBFront) {
      processImageFilters(docBFront.src, docBFront.filters).then(setDocBFrontPreview).catch(console.error);
    } else {
      setDocBFrontPreview("");
    }
  }, [docBFront, docBFront?.filters]);

  useEffect(() => {
    if (docBBack) {
      processImageFilters(docBBack.src, docBBack.filters).then(setDocBBackPreview).catch(console.error);
    } else {
      setDocBBackPreview("");
    }
  }, [docBBack, docBBack?.filters]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, position: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newDoc: DocumentUpload = {
        id: position,
        name: file.name,
        src: base64,
        filters: { ...DEFAULT_FILTERS }
      };

      if (layoutMode === "single") {
        if (position === "front") {
          setFrontDoc(newDoc);
          setSelectedDocId("front");
        } else {
          setBackDoc(newDoc);
          setSelectedDocId("back");
        }
      } else {
        if (position === "docAFront") {
          setDocAFront(newDoc);
          setSelectedDocId("docAFront");
        } else if (position === "docABack") {
          setDocABack(newDoc);
          setSelectedDocId("docABack");
        } else if (position === "docBFront") {
          setDocBFront(newDoc);
          setSelectedDocId("docBFront");
        } else if (position === "docBBack") {
          setDocBBack(newDoc);
          setSelectedDocId("docBBack");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (base64: string) => {
    if (!cameraTargetId) return;

    const newDoc: DocumentUpload = {
      id: cameraTargetId,
      name: `Foto_Camara_${new Date().getTime()}.jpg`,
      src: base64,
      filters: { ...DEFAULT_FILTERS }
    };

    if (layoutMode === "single") {
      if (cameraTargetId === "front") {
        setFrontDoc(newDoc);
        setSelectedDocId("front");
      } else {
        setBackDoc(newDoc);
        setSelectedDocId("back");
      }
    } else {
      if (cameraTargetId === "docAFront") {
        setDocAFront(newDoc);
        setSelectedDocId("docAFront");
      } else if (cameraTargetId === "docABack") {
        setDocABack(newDoc);
        setSelectedDocId("docABack");
      } else if (cameraTargetId === "docBFront") {
        setDocBFront(newDoc);
        setSelectedDocId("docBFront");
      } else if (cameraTargetId === "docBBack") {
        setDocBBack(newDoc);
        setSelectedDocId("docBBack");
      }
    }
    setCameraTargetId(null);
  };

  const getDocById = (id: string | null): DocumentUpload | null => {
    if (!id) return null;
    if (layoutMode === "single") {
      if (id === "front") return frontDoc;
      if (id === "back") return backDoc;
    } else {
      if (id === "docAFront") return docAFront;
      if (id === "docABack") return docABack;
      if (id === "docBFront") return docBFront;
      if (id === "docBBack") return docBBack;
    }
    return null;
  };

  const updateDocFilters = (id: string, updatedFilters: Partial<ImageFilters>) => {
    const updateFn = (prev: DocumentUpload | null) => {
      if (!prev) return null;
      return {
        ...prev,
        filters: { ...prev.filters, ...updatedFilters }
      };
    };

    if (layoutMode === "single") {
      if (id === "front") setFrontDoc(updateFn);
      if (id === "back") setBackDoc(updateFn);
    } else {
      if (id === "docAFront") setDocAFront(updateFn);
      if (id === "docABack") setDocABack(updateFn);
      if (id === "docBFront") setDocBFront(updateFn);
      if (id === "docBBack") setDocBBack(updateFn);
    }
  };

  // Bulk File Upload for 2 documents at once
  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readAndCreateDoc = (file: File, position: string): Promise<DocumentUpload> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          resolve({
            id: position,
            name: file.name,
            src: base64,
            filters: { ...DEFAULT_FILTERS }
          });
        };
        reader.readAsDataURL(file);
      });
    };

    const loadFiles = async () => {
      if (layoutMode === "single") {
        if (files[0]) {
          const doc1 = await readAndCreateDoc(files[0], "front");
          setFrontDoc(doc1);
        }
        if (files[1]) {
          const doc2 = await readAndCreateDoc(files[1], "back");
          setBackDoc(doc2);
          setSelectedDocId("back");
        } else {
          setSelectedDocId("front");
        }
      } else {
        const targets = ["docAFront", "docABack", "docBFront", "docBBack"];
        for (let i = 0; i < Math.min(files.length, 4); i++) {
          const target = targets[i];
          const doc = await readAndCreateDoc(files[i], target);
          if (target === "docAFront") setDocAFront(doc);
          else if (target === "docABack") setDocABack(doc);
          else if (target === "docBFront") setDocBFront(doc);
          else if (target === "docBBack") setDocBBack(doc);
        }
        setSelectedDocId("docAFront");
      }
    };

    loadFiles();
  };

  // Bulk AI Document Enhancement
  const handleBulkAiEnhance = async () => {
    setAiError(null);
    const docsToProcess = layoutMode === "single"
      ? [ { id: "front", doc: frontDoc }, { id: "back", doc: backDoc } ]
      : [ { id: "docAFront", doc: docAFront }, { id: "docABack", doc: docABack }, { id: "docBFront", doc: docBFront }, { id: "docBBack", doc: docBBack } ];
    
    const loadedDocs = docsToProcess.filter(item => item.doc !== null);
    if (loadedDocs.length === 0) return;

    for (const item of loadedDocs) {
      await handleAiEnhance(item.id);
    }
  };

  // Bulk AI Exact Bounds Detection and Crop
  const handleBulkAiCrop = async () => {
    setAiError(null);
    const docsToProcess = layoutMode === "single"
      ? [ { id: "front", doc: frontDoc }, { id: "back", doc: backDoc } ]
      : [ { id: "docAFront", doc: docAFront }, { id: "docABack", doc: docABack }, { id: "docBFront", doc: docBFront }, { id: "docBBack", doc: docBBack } ];
    
    const loadedDocs = docsToProcess.filter(item => item.doc !== null);
    if (loadedDocs.length === 0) return;

    for (const item of loadedDocs) {
      await handleAiCrop(item.id);
    }
  };

  // Bulk Laser Black and White Filtering
  const handleBulkApplyLaser = () => {
    if (layoutMode === "single") {
      if (frontDoc) updateDocFilters("front", { grayscale: true, binarize: true, contrast: 15 });
      if (backDoc) updateDocFilters("back", { grayscale: true, binarize: true, contrast: 15 });
    } else {
      if (docAFront) updateDocFilters("docAFront", { grayscale: true, binarize: true, contrast: 15 });
      if (docABack) updateDocFilters("docABack", { grayscale: true, binarize: true, contrast: 15 });
      if (docBFront) updateDocFilters("docBFront", { grayscale: true, binarize: true, contrast: 15 });
      if (docBBack) updateDocFilters("docBBack", { grayscale: true, binarize: true, contrast: 15 });
    }
  };

  // Bulk Reset Filters
  const handleBulkResetFilters = () => {
    if (layoutMode === "single") {
      if (frontDoc) updateDocFilters("front", { ...DEFAULT_FILTERS });
      if (backDoc) updateDocFilters("back", { ...DEFAULT_FILTERS });
    } else {
      if (docAFront) updateDocFilters("docAFront", { ...DEFAULT_FILTERS });
      if (docABack) updateDocFilters("docABack", { ...DEFAULT_FILTERS });
      if (docBFront) updateDocFilters("docBFront", { ...DEFAULT_FILTERS });
      if (docBBack) updateDocFilters("docBBack", { ...DEFAULT_FILTERS });
    }
  };

  // Call the server side API for Gemini AI document enhancement & information extraction
  const handleAiEnhance = async (id: string) => {
    const doc = getDocById(id);
    if (!doc) return;

    setActiveEnhancing(id);
    setAiError(null);

    try {
      // Clean up base64 header (e.g. "data:image/jpeg;base64,")
      const base64Clean = doc.src.split(",")[1];
      const mimeType = doc.src.split(";")[0].split(":")[1];

      const res = await fetch("/api/enhance-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: base64Clean,
          mimeType: mimeType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fallo en la comunicación con la IA");
      }

      const data = await res.json();
      
      const updateFn = (prev: DocumentUpload | null) => {
        if (!prev) return null;
        return {
          ...prev,
          extractedInfo: data.extractedInfo,
          transcription: data.textTranscription,
          // Merge recommended filters
          filters: {
            ...prev.filters,
            brightness: data.recommendedFilters.brightness || 0,
            contrast: data.recommendedFilters.contrast || 0,
            grayscale: data.recommendedFilters.grayscale || false,
            binarize: data.recommendedFilters.binarize || false,
            binarizeThreshold: data.recommendedFilters.binarizeThreshold || 128,
            // Only apply 90 degree increments if severe, otherwise preserve
            rotate: data.recommendedFilters.rotateDegrees || prev.filters.rotate
          }
        };
      };

      if (layoutMode === "single") {
        if (id === "front") setFrontDoc(updateFn);
        if (id === "back") setBackDoc(updateFn);
      } else {
        if (id === "docAFront") setDocAFront(updateFn);
        if (id === "docABack") setDocABack(updateFn);
        if (id === "docBFront") setDocBFront(updateFn);
        if (id === "docBBack") setDocBBack(updateFn);
      }

    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "No se pudo realizar el análisis con IA");
    } finally {
      setActiveEnhancing(null);
    }
  };

  // Call the server-side API to detect exact bounds of DUI and crop
  const handleAiCrop = async (id: string) => {
    const doc = getDocById(id);
    if (!doc) return;

    setActiveEnhancing(`${id}_crop`);
    setAiError(null);

    try {
      const base64Clean = doc.src.split(",")[1];
      const mimeType = doc.src.split(";")[0].split(":")[1];

      const res = await fetch("/api/detect-card-bounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: base64Clean,
          mimeType: mimeType
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fallo en la detección de bordes con IA");
      }

      const data = await res.json();
      
      updateDocFilters(id, {
        cropTop: data.top,
        cropLeft: data.left,
        cropWidth: data.width,
        cropHeight: data.height,
        shiftY: 0 // Reset manual shift when cropping
      });

    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "No se pudo realizar el recorte inteligente con IA");
    } finally {
      setActiveEnhancing(null);
    }
  };

  const removeDoc = (id: string) => {
    if (layoutMode === "single") {
      if (id === "front") {
        setFrontDoc(null);
        setFrontPreview("");
      } else {
        setBackDoc(null);
        setBackPreview("");
      }
    } else {
      if (id === "docAFront") {
        setDocAFront(null);
        setDocAFrontPreview("");
      } else if (id === "docABack") {
        setDocABack(null);
        setDocABackPreview("");
      } else if (id === "docBFront") {
        setDocBFront(null);
        setDocBFrontPreview("");
      } else if (id === "docBBack") {
        setDocBBack(null);
        setDocBBackPreview("");
      }
    }
    if (selectedDocId === id) {
      setSelectedDocId(null);
    }
  };

  const generatePdf = async () => {
    const { width: pW, height: pH } = getPageDimensions();

    const doc = new jsPDF({
      orientation: pageOrientation,
      unit: "mm",
      format: pageSize === "letter" ? "letter" : pageSize === "legal" ? "legal" : "a4"
    });

    const docWidthMm = BASE_DUI_WIDTH_MM * (scalePercent / 100);
    const docHeightMm = BASE_DUI_HEIGHT_MM * (scalePercent / 100);

    // Centered layout coordinates (Servicios Prin Constelacion Store)
    const singleSpacing = 15;
    const singleTotalHeightVert = docHeightMm * 2 + singleSpacing;
    const singleStartYVert = (pH - singleTotalHeightVert) / 2;

    const singleTotalWidthHoriz = docWidthMm * 2 + singleSpacing;
    const singleStartXHoriz = (pW - singleTotalWidthHoriz) / 2;
    const singleStartYHoriz = (pH - docHeightMm) / 2;

    const doubleSpacing = 15;
    const doubleTotalWidth = docWidthMm * 2 + doubleSpacing;
    const doubleStartX = (pW - doubleTotalWidth) / 2;
    const doubleStartY_A = (pH / 2 - docHeightMm) / 2;
    const doubleStartY_B = pH / 2 + (pH / 2 - docHeightMm) / 2;

    if (layoutMode === "single") {
      // 1 DUI layout
      if (!frontPreview && !backPreview) return;

      // Draw Front
      if (frontPreview) {
        if (alignment === "vertical") {
          const x = (pW - docWidthMm) / 2;
          const y = singleStartYVert;
          doc.addImage(frontPreview, "JPEG", x, y, docWidthMm, docHeightMm);
          
          doc.setDrawColor(220, 220, 220);
          doc.rect(x - 0.2, y - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
        } else {
          const x = singleStartXHoriz;
          const y = singleStartYHoriz;
          doc.addImage(frontPreview, "JPEG", x, y, docWidthMm, docHeightMm);
          doc.setDrawColor(220, 220, 220);
          doc.rect(x - 0.2, y - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
        }
      }

      // Draw Back
      if (backPreview) {
        if (alignment === "vertical") {
          const x = (pW - docWidthMm) / 2;
          const y = singleStartYVert + docHeightMm + singleSpacing;
          doc.addImage(backPreview, "JPEG", x, y, docWidthMm, docHeightMm);
          doc.setDrawColor(220, 220, 220);
          doc.rect(x - 0.2, y - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
        } else {
          const x = singleStartXHoriz + docWidthMm + singleSpacing;
          const y = singleStartYHoriz;
          doc.addImage(backPreview, "JPEG", x, y, docWidthMm, docHeightMm);
          doc.setDrawColor(220, 220, 220);
          doc.rect(x - 0.2, y - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
        }
      }

    } else {
      // 2 DUIs Layout (Doc A & Doc B)
      if (docAFrontPreview) {
        doc.addImage(docAFrontPreview, "JPEG", doubleStartX, doubleStartY_A, docWidthMm, docHeightMm);
        doc.setDrawColor(220, 220, 220);
        doc.rect(doubleStartX - 0.2, doubleStartY_A - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
      }
      if (docABackPreview) {
        doc.addImage(docABackPreview, "JPEG", doubleStartX + docWidthMm + doubleSpacing, doubleStartY_A, docWidthMm, docHeightMm);
        doc.setDrawColor(220, 220, 220);
        doc.rect(doubleStartX + docWidthMm + doubleSpacing - 0.2, doubleStartY_A - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
      }

      if (docBFrontPreview) {
        doc.addImage(docBFrontPreview, "JPEG", doubleStartX, doubleStartY_B, docWidthMm, docHeightMm);
        doc.setDrawColor(220, 220, 220);
        doc.rect(doubleStartX - 0.2, doubleStartY_B - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
      }
      if (docBBackPreview) {
        doc.addImage(docBBackPreview, "JPEG", doubleStartX + docWidthMm + doubleSpacing, doubleStartY_B, docWidthMm, docHeightMm);
        doc.setDrawColor(220, 220, 220);
        doc.rect(doubleStartX + docWidthMm + doubleSpacing - 0.2, doubleStartY_B - 0.2, docWidthMm + 0.4, docHeightMm + 0.4);
      }
    }

    doc.save(`Impresion_DUI_Servicios_Constelacion_${scalePercent}pc.pdf`);
  };

  const selectedDoc = getDocById(selectedDocId);

  const { width: pW, height: pH } = getPageDimensions();
  const docWidthMm = BASE_DUI_WIDTH_MM * (scalePercent / 100);
  const docHeightMm = BASE_DUI_HEIGHT_MM * (scalePercent / 100);

  // Centering Layout Calculations
  const singleSpacing = 15;
  const singleTotalHeightVert = docHeightMm * 2 + singleSpacing;
  const singleStartYVert = (pH - singleTotalHeightVert) / 2;

  const singleTotalWidthHoriz = docWidthMm * 2 + singleSpacing;
  const singleStartXHoriz = (pW - singleTotalWidthHoriz) / 2;
  const singleStartYHoriz = (pH - docHeightMm) / 2;

  const doubleSpacing = 15;
  const doubleTotalWidth = docWidthMm * 2 + doubleSpacing;
  const doubleStartX = (pW - doubleTotalWidth) / 2;
  const doubleStartY_A = (pH / 2 - docHeightMm) / 2;
  const doubleStartY_B = pH / 2 + (pH / 2 - docHeightMm) / 2;

  const wPct = (docWidthMm / pW) * 100;
  const hPct = (docHeightMm / pH) * 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dui-merger-section">
      
      {/* LEFT COLUMN: Controls and Mode selections */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Layout Modes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
          <h3 className="font-display font-semibold text-slate-850 text-base flex items-center gap-2">
            <Layout className="w-5 h-5 text-blue-600" />
            Configuración de Impresión
          </h3>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setLayoutMode("single");
                setSelectedDocId(null);
              }}
              className={`p-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-2 transition-all ${
                layoutMode === "single"
                  ? "border-blue-600 bg-blue-50/70 text-blue-700 ring-1 ring-blue-600/10"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>1 DUI (Frente/Reverso)</span>
            </button>
            <button
              onClick={() => {
                setLayoutMode("double");
                setSelectedDocId(null);
              }}
              className={`p-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-2 transition-all ${
                layoutMode === "double"
                  ? "border-blue-600 bg-blue-50/70 text-blue-700 ring-1 ring-blue-600/10"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Grid className="w-5 h-5" />
              <span>2 DUIs (2 Arriba, 2 Abajo)</span>
            </button>
          </div>

          {/* Alignment Selector (Only for Single layout) */}
          {layoutMode === "single" && (
            <div className="pt-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Alineación en Folio
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAlignment("vertical")}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    alignment === "vertical"
                      ? "border-blue-500 bg-blue-50/40 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Vertical (Arriba/Abajo)
                </button>
                <button
                  onClick={() => setAlignment("horizontal")}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    alignment === "horizontal"
                      ? "border-blue-500 bg-blue-50/40 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Horizontal (Lado a Lado)
                </button>
              </div>
            </div>
          )}

          {/* Ampliacion Porcentaje */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Ampliación del Documento
              </label>
              <span className="text-sm font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200/50">
                {scalePercent}%
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mb-3 leading-normal">
              Fórmula estándar DUI al 150% para solicitudes de El Salvador.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="100"
                max="200"
                value={scalePercent}
                onChange={(e) => setScalePercent(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>100% (Real)</span>
              <span>150% (Sugerido)</span>
              <span>200% (Máximo)</span>
            </div>
          </div>
        </div>

        {/* Acciones en Lote (Frente y Reverso) */}
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-900/60 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400 fill-indigo-400/20 animate-pulse" />
            <h3 className="font-display font-semibold text-white text-sm">
              Acciones en Lote (Frente + Reverso)
            </h3>
          </div>

          <p className="text-indigo-200/80 text-[11px] leading-normal">
            Sube ambos lados juntos con un clic y procésalos en lote para quitar fondos o binarizar de una sola vez.
          </p>

          <div className="space-y-3">
            {/* Bulk File Selector */}
            <div>
              <label className="text-[9px] font-bold text-indigo-300 uppercase block mb-1">
                1. Cargar Ambas Fotos Juntas
              </label>
              <label className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-700/40 rounded-xl text-xs font-semibold text-indigo-200 transition-all cursor-pointer shadow-inner">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>Elegir imágenes del DUI</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleBulkFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleBulkAiEnhance}
                disabled={activeEnhancing !== null || (layoutMode === "single" ? !frontDoc && !backDoc : !docAFront && !docABack && !docBFront && !docBBack)}
                className="py-2.5 px-2 bg-indigo-600 hover:bg-indigo-550 disabled:bg-slate-850 disabled:text-slate-500 text-white font-bold rounded-lg text-xs flex flex-col items-center justify-center gap-1 transition-all border border-indigo-550/40 disabled:border-slate-800 cursor-pointer"
                title="Optimiza y extrae datos de todos los lados cargados"
              >
                <Sparkles className="w-4 h-4 text-indigo-200 fill-indigo-200/20" />
                <span>Mejorar Ambos</span>
              </button>

              <button
                type="button"
                onClick={handleBulkApplyLaser}
                disabled={layoutMode === "single" ? !frontDoc && !backDoc : !docAFront && !docABack && !docBFront && !docBBack}
                className="py-2.5 px-2 bg-slate-800 hover:bg-slate-755 text-slate-100 font-bold rounded-lg text-xs flex flex-col items-center justify-center gap-1 transition-all border border-slate-700 disabled:opacity-40 cursor-pointer"
                title="Aplica binarizado de alto contraste óptimo para impresora láser"
              >
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Filtro BK Ambos</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBulkAiCrop}
                disabled={activeEnhancing !== null || (layoutMode === "single" ? !frontDoc && !backDoc : !docAFront && !docABack && !docBFront && !docBBack)}
                className="py-1.5 px-2 bg-indigo-900/40 hover:bg-indigo-900/70 disabled:bg-slate-800/30 text-indigo-200 font-medium rounded-lg text-[10px] flex items-center justify-center gap-1.5 transition-all border border-indigo-800/30 disabled:border-transparent cursor-pointer"
              >
                Recortar Ambos
              </button>

              <button
                type="button"
                onClick={handleBulkResetFilters}
                className="py-1.5 px-2 border border-indigo-850 text-indigo-300 hover:bg-indigo-950/40 rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                Limpiar Ambos
              </button>
            </div>
          </div>
        </div>

        {/* Page Setup & Margins Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
          <h3 className="font-display font-semibold text-slate-850 text-base flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Configurar Página y Márgenes
          </h3>

          {/* Tamaño de Papel */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Tamaño de Papel
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["letter", "legal", "a4"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`py-1.5 px-1 rounded-lg border text-xs font-semibold uppercase transition-all text-center cursor-pointer ${
                    pageSize === size
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {size === "letter" ? "Carta" : size === "legal" ? "Oficio" : "A4"}
                </button>
              ))}
            </div>
          </div>

          {/* Orientación */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Orientación de Papel
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["portrait", "landscape"] as const).map((orient) => (
                <button
                  key={orient}
                  type="button"
                  onClick={() => setPageOrientation(orient)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    pageOrientation === orient
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-bold"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {orient === "portrait" ? "Vertical" : "Horizontal"}
                </button>
              ))}
            </div>
          </div>

          {/* Margen */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Margen del Folio
              </label>
              <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {marginMm} mm
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              value={marginMm}
              onChange={(e) => setMarginMm(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>5 mm</span>
              <span>20 mm</span>
              <span>40 mm</span>
            </div>
          </div>
        </div>

        {/* Filters Panel for Selected Image */}
        {selectedDoc ? (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Filtros: {
                  selectedDocId === "front" ? "DUI Frente" :
                  selectedDocId === "back" ? "DUI Reverso" :
                  selectedDocId === "docAFront" ? "Doc A Frente" :
                  selectedDocId === "docABack" ? "Doc A Reverso" :
                  selectedDocId === "docBFront" ? "Doc B Frente" : "Doc B Reverso"
                }
              </h4>
              <button 
                onClick={() => setSelectedDocId(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Cerrar
              </button>
            </div>

            {/* AI Enhancement Launcher */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50/70 to-slate-50 rounded-xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 fill-blue-500 animate-pulse" />
                  Mejoramiento Nitidez IA
                </span>
                {activeEnhancing === selectedDocId ? (
                  <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Procesando...
                  </span>
                ) : selectedDoc.extractedInfo ? (
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                    <Check className="w-3 h-3" /> Optimizado
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-600 leading-normal">
                La IA analiza el contraste de la tinta del DUI, alinea la rotación y extrae datos importantes en automático.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => selectedDocId && handleAiEnhance(selectedDocId)}
                  disabled={activeEnhancing !== null}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {activeEnhancing === selectedDocId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analizando Documento...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 fill-white" />
                      Mejorar con Inteligencia Artificial
                    </>
                  )}
                </button>

                <button
                  onClick={() => selectedDocId && handleAiCrop(selectedDocId)}
                  disabled={activeEnhancing !== null}
                  className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {activeEnhancing === `${selectedDocId}_crop` ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Buscando Tarjeta...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 fill-white" />
                      Recorte Inteligente de DUI con IA
                    </>
                  )}
                </button>

                {((selectedDoc.filters.cropTop || 0) > 0 || (selectedDoc.filters.cropLeft || 0) > 0 || (selectedDoc.filters.cropWidth || 100) < 100 || (selectedDoc.filters.cropHeight || 100) < 100) && (
                  <button
                    onClick={() => updateDocFilters(selectedDocId!, {
                      cropTop: 0,
                      cropLeft: 0,
                      cropWidth: 100,
                      cropHeight: 100,
                      shiftY: 0
                    })}
                    className="w-full py-1.5 px-3 border border-slate-200 text-slate-505 hover:bg-slate-50 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Restablecer Recorte de Borde
                  </button>
                )}
              </div>

              {aiError && (
                <div className="text-[10px] text-red-600 flex items-center gap-1 bg-red-50 p-1.5 rounded">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>

            {/* Brightness filter */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Brillo</span>
                <span className="font-semibold">{selectedDoc.filters.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={selectedDoc.filters.brightness}
                onChange={(e) => updateDocFilters(selectedDocId!, { brightness: parseInt(e.target.value) })}
                className="w-full accent-slate-600"
              />
            </div>

            {/* Contrast filter */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Contraste</span>
                <span className="font-semibold">{selectedDoc.filters.contrast}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={selectedDoc.filters.contrast}
                onChange={(e) => updateDocFilters(selectedDocId!, { contrast: parseInt(e.target.value) })}
                className="w-full accent-slate-600"
              />
            </div>

            {/* Shift Y vertical alignment */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span className="font-medium text-indigo-700">Ajuste de Desplazamiento Vertical (Y)</span>
                <span className="font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">
                  {selectedDoc.filters.shiftY || 0}%
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={selectedDoc.filters.shiftY || 0}
                onChange={(e) => updateDocFilters(selectedDocId!, { shiftY: parseInt(e.target.value) })}
                className="w-full accent-indigo-600"
              />
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Desplaza la foto verticalmente para centrar el DUI en el folio, sin salirse del marco de la tarjeta.
              </p>
            </div>

            {/* Grayscale and Binarization Switches */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDoc.filters.grayscale}
                  onChange={(e) => updateDocFilters(selectedDocId!, { grayscale: e.target.checked })}
                  className="rounded text-blue-600 accent-blue-650"
                />
                <span className="text-xs text-slate-700 font-medium">Escala de Grises</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDoc.filters.binarize}
                  onChange={(e) => {
                    const binarize = e.target.checked;
                    updateDocFilters(selectedDocId!, { 
                      binarize, 
                      grayscale: binarize ? true : selectedDoc.filters.grayscale 
                    });
                  }}
                  className="rounded text-blue-600 accent-blue-650"
                />
                <span className="text-xs text-slate-700 font-bold">B&N Puro (Láser)</span>
              </label>
            </div>

            {selectedDoc.filters.binarize && (
              <div className="pt-2 animate-fadeIn">
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Umbral B&N (Eliminación de sombras)</span>
                  <span className="font-semibold">{selectedDoc.filters.binarizeThreshold}</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={selectedDoc.filters.binarizeThreshold}
                  onChange={(e) => updateDocFilters(selectedDocId!, { binarizeThreshold: parseInt(e.target.value) })}
                  className="w-full h-1.5 accent-blue-600 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Valores más bajos remueven sombras oscuras de fondo. Ideal para escaneos de celulares.
                </p>
              </div>
            )}

            {/* Rotar en 90 Grados */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-slate-500 block mb-2">Girar Documento</label>
              <div className="flex gap-2">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => updateDocFilters(selectedDocId!, { rotate: deg })}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                      selectedDoc.filters.rotate === deg
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <RotateCw className="w-3 h-3" />
                    {deg}°
                  </button>
                ))}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={() => removeDoc(selectedDocId!)}
              className="w-full py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar este Documento
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center">
            <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500">
              Sube una imagen o selecciona un documento cargado para habilitar la mejora por IA y los controles de brillo o binarización.
            </p>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Document Workspace Previews & Generated Output */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        
        {/* Workspace Canvas Header */}
        <div className="bg-[#0f172a] rounded-2xl p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-800 shadow-lg">
          <div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Lienzo de Alineación
            </span>
            <h2 className="font-display font-bold text-2xl mt-1.5">
              {layoutMode === "single" ? "1 Folio: Frente y Reverso" : "1 Folio: Multi-DUI (A y B)"}
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Papel {pageSize === "letter" ? "Carta" : pageSize === "legal" ? "Oficio" : "A4"} • {scalePercent}% de ampliación
            </p>
          </div>

          <button
            onClick={generatePdf}
            disabled={
              layoutMode === "single"
                ? !frontPreview && !backPreview
                : !docAFrontPreview && !docABackPreview && !docBFrontPreview && !docBBackPreview
            }
            className="w-full sm:w-auto py-3 px-6 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            <Printer className="w-5 h-5 stroke-[2.5]" />
            Generar PDF e Imprimir
          </button>
        </div>

        {/* Upload grids & Page simulator */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Simulation layout card */}
          <div className="md:col-span-8 bg-slate-100 rounded-2xl p-6 border border-slate-200 flex justify-center">
            
            {/* Paper Sheet Simulator with configured dimensions and orientations */}
            <div 
              className="bg-white shadow-xl rounded-sm border border-slate-350 relative overflow-hidden"
              style={{
                width: "100%",
                maxWidth: "340px",
                aspectRatio: `${pW} / ${pH}`,
              }}
            >
              {/* Paper indicator watermark */}
              <div className="absolute top-2 right-3 text-[8px] text-slate-300 font-bold select-none uppercase tracking-widest z-10">
                Papel {pageSize === "letter" ? "Carta" : pageSize === "legal" ? "Oficio" : "A4"} • {pageOrientation === "portrait" ? "Vertical" : "Horizontal"}
              </div>

              {/* Margin Guide */}
              <div 
                className="absolute border border-dashed border-red-300 pointer-events-none opacity-60 z-10"
                style={{
                  left: `${(marginMm / pW) * 100}%`,
                  top: `${(marginMm / pH) * 100}%`,
                  width: `${((pW - 2 * marginMm) / pW) * 100}%`,
                  height: `${((pH - 2 * marginMm) / pH) * 100}%`,
                }}
              />

              {layoutMode === "single" ? (
                /* SINGLE DUI WORKSPACE PREVIEW */
                <div className="w-full h-full relative">
                  
                  {/* Front Side Card Container */}
                  <div 
                    className="absolute flex items-center justify-center transition-all select-none"
                    style={{
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                      left: alignment === "vertical" ? `${((pW - docWidthMm) / 2 / pW) * 100}%` : `${(singleStartXHoriz / pW) * 100}%`,
                      top: alignment === "vertical" ? `${(singleStartYVert / pH) * 100}%` : `${(singleStartYHoriz / pH) * 100}%`
                    }}
                  >
                    {frontPreview ? (
                      <div 
                        onMouseDown={(e) => handleDragStart(e, "front")}
                        onTouchStart={(e) => handleDragStart(e, "front")}
                        className={`relative group w-full h-full border border-dashed rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
                          selectedDocId === "front" ? "ring-2 ring-blue-500" : "hover:border-slate-400"
                        }`}
                      >
                        <img 
                          src={frontPreview} 
                          alt="DUI Frente" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pointer-events-none"
                          draggable={false}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-[10px] text-white transition-opacity">
                          <span className="font-bold">Arrastra para alinear</span>
                          <span className="text-[8px] opacity-75">Click para editar</span>
                        </div>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 rounded font-bold">
                          FRENTE
                        </span>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 rounded-xl flex flex-col items-center justify-center w-full h-full p-2 space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Frente</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCameraTargetId("front")}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Tomar Foto con Cámara"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <label
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg shadow-sm hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Adjuntar Archivo"
                          >
                            <Upload className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/jpg"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, "front")}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Back Side Card Container */}
                  <div 
                    className="absolute flex items-center justify-center transition-all select-none"
                    style={{
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                      left: alignment === "vertical" ? `${((pW - docWidthMm) / 2 / pW) * 100}%` : `${((singleStartXHoriz + docWidthMm + singleSpacing) / pW) * 100}%`,
                      top: alignment === "vertical" ? `${((singleStartYVert + docHeightMm + singleSpacing) / pH) * 100}%` : `${(singleStartYHoriz / pH) * 100}%`
                    }}
                  >
                    {backPreview ? (
                      <div 
                        onMouseDown={(e) => handleDragStart(e, "back")}
                        onTouchStart={(e) => handleDragStart(e, "back")}
                        className={`relative group w-full h-full border border-dashed rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
                          selectedDocId === "back" ? "ring-2 ring-blue-500" : "hover:border-slate-400"
                        }`}
                      >
                        <img 
                          src={backPreview} 
                          alt="DUI Reverso" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pointer-events-none"
                          draggable={false}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-[10px] text-white transition-opacity">
                          <span className="font-bold">Arrastra para alinear</span>
                          <span className="text-[8px] opacity-75">Click para editar</span>
                        </div>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 rounded font-bold">
                          REVERSO
                        </span>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 rounded-xl flex flex-col items-center justify-center w-full h-full p-2 space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Reverso</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCameraTargetId("back")}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Tomar Foto con Cámara"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <label
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg shadow-sm hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
                            title="Adjuntar Archivo"
                          >
                            <Upload className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/jpg"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, "back")}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                /* DOUBLE DUI (GRID A & B) WORKSPACE PREVIEW */
                <div className="w-full h-full relative">
                  
                  {/* Doc A Front */}
                  <div 
                    className="absolute flex items-center justify-center transition-all select-none"
                    style={{
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                      left: `${(doubleStartX / pW) * 100}%`,
                      top: `${(doubleStartY_A / pH) * 100}%`
                    }}
                  >
                    {docAFrontPreview ? (
                      <div 
                        onMouseDown={(e) => handleDragStart(e, "docAFront")}
                        onTouchStart={(e) => handleDragStart(e, "docAFront")}
                        className={`relative group w-full h-full border rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
                          selectedDocId === "docAFront" ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <img src={docAFrontPreview} alt="Doc A Frente" className="w-full h-full object-cover pointer-events-none" draggable={false} referrerPolicy="no-referrer" />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[7px] px-1 rounded font-bold">A FRENTE</span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-lg flex flex-col items-center justify-center w-full h-full p-1 space-y-0.5">
                        <span className="text-[7px] font-bold text-slate-500 uppercase">A Frente</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCameraTargetId("docAFront")}
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow cursor-pointer flex items-center justify-center"
                            title="Tomar Foto con Cámara"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <label
                            className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow cursor-pointer flex items-center justify-center"
                            title="Adjuntar Archivo"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "docAFront")} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Doc A Back */}
                  <div 
                    className="absolute flex items-center justify-center transition-all select-none"
                    style={{
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                      left: `${((doubleStartX + docWidthMm + doubleSpacing) / pW) * 100}%`,
                      top: `${(doubleStartY_A / pH) * 100}%`
                    }}
                  >
                    {docABackPreview ? (
                      <div 
                        onMouseDown={(e) => handleDragStart(e, "docABack")}
                        onTouchStart={(e) => handleDragStart(e, "docABack")}
                        className={`relative group w-full h-full border rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
                          selectedDocId === "docABack" ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <img src={docABackPreview} alt="Doc A Reverso" className="w-full h-full object-cover pointer-events-none" draggable={false} referrerPolicy="no-referrer" />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[7px] px-1 rounded font-bold">A REVERSO</span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-lg flex flex-col items-center justify-center w-full h-full p-1 space-y-0.5">
                        <span className="text-[7px] font-bold text-slate-500 uppercase">A Reverso</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCameraTargetId("docABack")}
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow cursor-pointer flex items-center justify-center"
                            title="Tomar Foto con Cámara"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <label
                            className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow cursor-pointer flex items-center justify-center"
                            title="Adjuntar Archivo"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "docABack")} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Doc B Front */}
                  <div 
                    className="absolute flex items-center justify-center transition-all select-none"
                    style={{
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                      left: `${(doubleStartX / pW) * 100}%`,
                      top: `${(doubleStartY_B / pH) * 100}%`
                    }}
                  >
                    {docBFrontPreview ? (
                      <div 
                        onMouseDown={(e) => handleDragStart(e, "docBFront")}
                        onTouchStart={(e) => handleDragStart(e, "docBFront")}
                        className={`relative group w-full h-full border rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
                          selectedDocId === "docBFront" ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <img src={docBFrontPreview} alt="Doc B Frente" className="w-full h-full object-cover pointer-events-none" draggable={false} referrerPolicy="no-referrer" />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[7px] px-1 rounded font-bold">B FRENTE</span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-lg flex flex-col items-center justify-center w-full h-full p-1 space-y-0.5">
                        <span className="text-[7px] font-bold text-slate-500 uppercase">B Frente</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCameraTargetId("docBFront")}
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow cursor-pointer flex items-center justify-center"
                            title="Tomar Foto con Cámara"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <label
                            className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow cursor-pointer flex items-center justify-center"
                            title="Adjuntar Archivo"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "docBFront")} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Doc B Back */}
                  <div 
                    className="absolute flex items-center justify-center transition-all select-none"
                    style={{
                      width: `${wPct}%`,
                      height: `${hPct}%`,
                      left: `${((doubleStartX + docWidthMm + doubleSpacing) / pW) * 100}%`,
                      top: `${(doubleStartY_B / pH) * 100}%`
                    }}
                  >
                    {docBBackPreview ? (
                      <div 
                        onMouseDown={(e) => handleDragStart(e, "docBBack")}
                        onTouchStart={(e) => handleDragStart(e, "docBBack")}
                        className={`relative group w-full h-full border rounded-lg cursor-grab active:cursor-grabbing overflow-hidden transition-all ${
                          selectedDocId === "docBBack" ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <img src={docBBackPreview} alt="Doc B Reverso" className="w-full h-full object-cover pointer-events-none" draggable={false} referrerPolicy="no-referrer" />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[7px] px-1 rounded font-bold">B REVERSO</span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 rounded-lg flex flex-col items-center justify-center w-full h-full p-1 space-y-0.5">
                        <span className="text-[7px] font-bold text-slate-500 uppercase">B Reverso</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCameraTargetId("docBBack")}
                            className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow cursor-pointer flex items-center justify-center"
                            title="Tomar Foto con Cámara"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <label
                            className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded shadow cursor-pointer flex items-center justify-center"
                            title="Adjuntar Archivo"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, "docBBack")} />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* AI Info display & Guide card */}
          <div className="md:col-span-4 space-y-4">
            
            {/* AI Extracted data block */}
            {selectedDoc && selectedDoc.extractedInfo ? (
              <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100 space-y-4 animate-fadeIn">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-display font-semibold text-sm">Datos Extraídos por IA</span>
                </div>

                <div className="space-y-3 text-xs text-slate-700">
                  {selectedDoc.extractedInfo.duiNumber && (
                    <div>
                      <span className="text-[10px] text-slate-450 font-bold block uppercase">Número de DUI</span>
                      <div className="font-mono bg-white border border-slate-100 p-2 rounded flex justify-between items-center mt-0.5 font-bold text-slate-800">
                        <span>{selectedDoc.extractedInfo.duiNumber}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(selectedDoc.extractedInfo?.duiNumber || "")}
                          className="text-slate-400 hover:text-blue-600"
                          title="Copiar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedDoc.extractedInfo.fullName && (
                    <div>
                      <span className="text-[10px] text-slate-450 font-bold block uppercase">Nombre Completo</span>
                      <div className="bg-white border border-slate-100 p-2 rounded flex justify-between items-center mt-0.5">
                        <span className="font-bold text-slate-800 truncate mr-1">{selectedDoc.extractedInfo.fullName}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(selectedDoc.extractedInfo?.fullName || "")}
                          className="text-slate-400 hover:text-blue-600 flex-shrink-0"
                          title="Copiar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedDoc.extractedInfo.dob && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Fecha de Nacimiento/Exp.</span>
                      <div className="bg-white border border-slate-100 p-2 rounded mt-0.5">
                        {selectedDoc.extractedInfo.dob}
                      </div>
                    </div>
                  )}

                  {selectedDoc.extractedInfo.expiryDate && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Fecha de Vencimiento</span>
                      <div className="bg-white border border-slate-100 p-2 rounded mt-0.5">
                        {selectedDoc.extractedInfo.expiryDate}
                      </div>
                    </div>
                  )}

                  {selectedDoc.extractedInfo.department && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Dirección/Dpto</span>
                      <div className="bg-white border border-slate-100 p-2 rounded mt-0.5 text-[11px]">
                        {selectedDoc.extractedInfo.department}
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Transcription Box */}
                {selectedDoc.transcription && (
                  <div className="border-t border-emerald-100 pt-3">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Transcripción de Texto</span>
                    <textarea
                      readOnly
                      value={selectedDoc.transcription}
                      className="w-full h-24 bg-white border border-slate-100 text-[10px] p-2 rounded resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
                <h4 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  Instrucciones de Uso
                </h4>
                <ul className="text-xs text-slate-600 space-y-2.5 list-disc pl-4 leading-relaxed">
                  <li>Sube el <strong className="text-blue-600">Frente</strong> y el <strong className="text-blue-600">Reverso</strong> del DUI.</li>
                  <li>Usa el slider de ampliación para ajustarlo al <strong className="text-slate-850">150%</strong> (tamaño reglamentario).</li>
                  <li>Haz click sobre cualquier documento subido para habilitar el <strong className="text-blue-600">Mejorador IA</strong> y quitar sombras oscuras de celulares.</li>
                  <li>Si vienen dos clientes diferentes, activa el modo de <strong className="text-blue-600">2 DUIs</strong> para imprimir todos juntos y ahorrar papel.</li>
                </ul>
              </div>
            )}

            {/* Print Shop advice */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] text-slate-500 leading-normal">
              <span className="font-bold text-slate-700 block mb-1">💡 Consejo del Impresor</span>
              Para que el DUI reverso y derecho salga perfecto en blanco y negro, activa la opción <strong className="text-blue-600">B&N Puro (Láser)</strong> y ajusta el umbral. Esto removerá el fondo gris sucio de las fotos del celular.
            </div>

          </div>

        </div>

      </div>

      {cameraTargetId && (
        <CameraCapture
          title={`Tomar Foto para ${
            cameraTargetId === "front" ? "Frente del DUI" :
            cameraTargetId === "back" ? "Reverso del DUI" :
            cameraTargetId === "docAFront" ? "Documento A Frente" :
            cameraTargetId === "docABack" ? "Documento A Reverso" :
            cameraTargetId === "docBFront" ? "Documento B Frente" : "Documento B Reverso"
          }`}
          onCapture={handleCameraCapture}
          onClose={() => setCameraTargetId(null)}
        />
      )}

    </div>
  );
}

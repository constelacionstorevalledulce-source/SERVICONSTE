import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Trash2, Printer, Upload, Grid, Sliders, Settings, 
  HelpCircle, Eye, Info, Check, Sparkles, Heart, BookOpen, 
  Layers, RefreshCw, Move, Download
} from "lucide-react";
import { jsPDF } from "jspdf";
import { PhotoTemplate } from "../types";

const STANDARD_TEMPLATES: PhotoTemplate[] = [
  {
    id: "titulo",
    name: "4 Fotos Título / Visa (2x2\" / 5.08 cm)",
    widthCm: 5.08,
    heightCm: 5.08,
    cols: 2,
    rows: 2,
    description: "Formato cuadrado típico para visas y diplomas de educación."
  },
  {
    id: "infantil",
    name: "6 Fotos Infantil (3x4 cm)",
    widthCm: 3.0,
    heightCm: 4.0,
    cols: 3,
    rows: 2,
    description: "Formato escolar infantil para matrículas y carnés de El Salvador."
  },
  {
    id: "carne",
    name: "9 Fotos de Carné (2.5x3 cm)",
    widthCm: 2.5,
    heightCm: 3.0,
    cols: 3,
    rows: 3,
    description: "Formato ultra compacto para expedientes médicos o fichas."
  }
];

export default function TemplatesPrinter() {
  const [templates, setTemplates] = useState<PhotoTemplate[]>(STANDARD_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("titulo");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // Page configuration states
  const [pageSize, setPageSize] = useState<"letter" | "legal" | "a4">("letter");
  const [pageOrientation, setPageOrientation] = useState<"portrait" | "landscape">("portrait");
  const [marginMm, setMarginMm] = useState<number>(15); // in mm, default 15mm

  // TAB SELECTOR FOR STANDARD TEMPLATES VS AI COLLAGES
  const [printerMode, setPrinterMode] = useState<"standard" | "collage">("standard");

  // COLLAGE & SCRAPBOOK STUDIO STATES
  const [collageLayout, setCollageLayout] = useState<"heart" | "historybook" | "bento">("heart");
  const [collageFilter, setCollageFilter] = useState<"none" | "warm" | "retro" | "bw">("none");
  const [collagePhotos, setCollagePhotos] = useState<{
    id: string;
    src: string;
    name: string;
    xOffset: number; // For pan adjustments
    yOffset: number;
    rotate: number; // slight rotation degrees
    title: string; // customizable handwriting title for historybook
  }[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  // Refs for dragging photo alignment directly
  const dragStartPhotoOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartMousePosRef = useRef({ x: 0, y: 0 });
  const activeCollageDragIdRef = useRef<string | null>(null);

  const getLayoutCoords = (layout: "heart" | "historybook" | "bento") => {
    if (layout === "heart") {
      return [
        { x: 34, y: 18, w: 14, h: 14 }, { x: 52, y: 18, w: 14, h: 14 }, // Lobes
        { x: 23, y: 34, w: 14, h: 14 }, { x: 43, y: 34, w: 14, h: 14 }, { x: 63, y: 34, w: 14, h: 14 }, // Mid-upper
        { x: 23, y: 50, w: 14, h: 14 }, { x: 43, y: 50, w: 14, h: 14 }, { x: 63, y: 50, w: 14, h: 14 }, // Mid-lower
        { x: 34, y: 66, w: 14, h: 14 }, { x: 52, y: 66, w: 14, h: 14 }, // Lower
        { x: 43, y: 81, w: 14, h: 14 } // Bottom tip
      ];
    } else if (layout === "historybook") {
      return [
        { x: 14, y: 16, w: 32, h: 26 }, { x: 54, y: 18, w: 32, h: 26 },
        { x: 12, y: 48, w: 32, h: 26 }, { x: 56, y: 50, w: 32, h: 26 },
        { x: 15, y: 78, w: 32, h: 26 }, { x: 53, y: 79, w: 32, h: 26 }
      ];
    } else {
      // Bento
      return [
        { x: 10, y: 15, w: 80, h: 32 },
        { x: 10, y: 51, w: 38, h: 28 },
        { x: 52, y: 51, w: 38, h: 28 },
        { x: 10, y: 83, w: 38, h: 18 },
        { x: 52, y: 83, w: 38, h: 18 }
      ];
    }
  };

  const getFilterCss = (filter: typeof collageFilter) => {
    if (filter === "warm") return "sepia-[0.25] saturate-[1.35] contrast-[1.05] hue-rotate-[-8deg]";
    if (filter === "retro") return "sepia-[0.55] contrast-[0.92] saturate-[1.1] brightness-[1.03]";
    if (filter === "bw") return "grayscale contrast-[1.2] brightness-[0.98]";
    return "";
  };

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

  // Form states for creating custom templates
  const [showCreator, setShowCreator] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customWidth, setCustomWidth] = useState(4.0);
  const [customHeight, setCustomHeight] = useState(6.0);
  const [customCols, setCustomCols] = useState(3);
  const [customRows, setCustomRows] = useState(2);

  // Load standard and custom templates from local storage
  useEffect(() => {
    const saved = localStorage.getItem("copy_shop_templates");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PhotoTemplate[];
        setTemplates([...STANDARD_TEMPLATES, ...parsed]);
      } catch (err) {
        setTemplates(STANDARD_TEMPLATES);
      }
    } else {
      setTemplates(STANDARD_TEMPLATES);
    }
  }, []);

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0] || STANDARD_TEMPLATES[0];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName) return;

    const newTemplate: PhotoTemplate = {
      id: "custom_" + Date.now(),
      name: customName,
      widthCm: customWidth,
      heightCm: customHeight,
      cols: customCols,
      rows: customRows,
      description: `Plantilla personalizada de ${customWidth}x${customHeight} cm`,
      isCustom: true
    };

    const nextCustoms = templates.filter((t) => t.isCustom) as PhotoTemplate[];
    const updatedCustoms = [...nextCustoms, newTemplate];
    
    localStorage.setItem("copy_shop_templates", JSON.stringify(updatedCustoms));
    setTemplates([...STANDARD_TEMPLATES, ...updatedCustoms]);
    setSelectedTemplateId(newTemplate.id);
    
    // Reset form
    setCustomName("");
    setShowCreator(false);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCustoms = templates.filter((t) => t.isCustom && t.id !== id);
    localStorage.setItem("copy_shop_templates", JSON.stringify(nextCustoms));
    setTemplates([...STANDARD_TEMPLATES, ...nextCustoms]);
    
    if (selectedTemplateId === id) {
      setSelectedTemplateId("titulo");
    }
  };

  const generatePdf = () => {
    if (!uploadedImage || !activeTemplate) return;

    const { width: pW, height: pH } = getPageDimensions();

    const doc = new jsPDF({
      orientation: pageOrientation,
      unit: "mm",
      format: pageSize === "letter" ? "letter" : pageSize === "legal" ? "legal" : "a4"
    });

    const itemWidthMm = activeTemplate.widthCm * 10;
    const itemHeightMm = activeTemplate.heightCm * 10;

    const cols = activeTemplate.cols;
    const rows = activeTemplate.rows;
    const spacingMm = 4; // Space between pictures

    // Precise and editable starting margins
    const startX = marginMm;
    const startY = marginMm;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + (c * (itemWidthMm + spacingMm));
        const y = startY + (r * (itemHeightMm + spacingMm));

        // Add the image
        doc.addImage(uploadedImage, "JPEG", x, y, itemWidthMm, itemHeightMm);

        // Draw fine hairline border (perfect for copy shops as cutting guidelines!)
        doc.setLineWidth(0.1);
        doc.setDrawColor(180, 180, 180);
        doc.rect(x, y, itemWidthMm, itemHeightMm);
      }
    }

    doc.save(`Plantilla_${activeTemplate.name.replace(/\s+/g, "_")}_ServiciosConstelacion.pdf`);
  };

  // Upload multiple images for the collage studio
  const handleCollageImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readAndAdd = (file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setCollagePhotos(prev => {
          if (prev.length >= 12) return prev; // Limit to 12 max photos
          
          const defaultTitles = [
            "Lindo Recuerdo", "Día Especial", "Familia", 
            "Sonrisas", "Aventura", "Momentos", 
            "Amigos", "Felicidad", "Amor", 
            "Viaje", "Paz", "Destino"
          ];
          const newPhoto = {
            id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            src: base64,
            name: file.name,
            xOffset: 0,
            yOffset: 0,
            rotate: Math.floor(Math.random() * 12) - 6, // slight random rotation (-6 to +6 degrees)
            title: defaultTitles[prev.length % defaultTitles.length]
          };
          return [...prev, newPhoto];
        });
      };
      reader.readAsDataURL(file);
    };

    Array.from(files).forEach(readAndAdd);
  };

  // Re-distribute rotations and layouts using random AI alignment
  const handleAutoDistribute = () => {
    setCollagePhotos(prev => prev.map(p => ({
      ...p,
      rotate: Math.floor(Math.random() * 16) - 8, // Wider rotation for scrapbook effect
      xOffset: Math.floor(Math.random() * 20) - 10,
      yOffset: Math.floor(Math.random() * 20) - 10
    })));
  };

  // Interactive mouse/touch dragging handlers for framing pictures inside shapes
  const handleCollageDragStart = (e: React.MouseEvent | React.TouchEvent, photoId: string, currentXOffset: number, currentYOffset: number) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    
    dragStartMousePosRef.current = { x: clientX, y: clientY };
    dragStartPhotoOffsetRef.current = { x: currentXOffset, y: currentYOffset };
    activeCollageDragIdRef.current = photoId;
    setActivePhotoId(photoId);

    if (!("touches" in e)) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (!activeCollageDragIdRef.current) return;
      
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartMousePosRef.current.x;
      const deltaY = clientY - dragStartMousePosRef.current.y;

      const sensitivity = 0.5;
      const newXOffset = Math.max(-100, Math.min(100, dragStartPhotoOffsetRef.current.x + deltaX * sensitivity));
      const newYOffset = Math.max(-100, Math.min(100, dragStartPhotoOffsetRef.current.y + deltaY * sensitivity));

      setCollagePhotos(prev => prev.map(p => {
        if (p.id === activeCollageDragIdRef.current) {
          return {
            ...p,
            xOffset: Math.round(newXOffset),
            yOffset: Math.round(newYOffset)
          };
        }
        return p;
      }));
    };

    const handleGlobalEnd = () => {
      activeCollageDragIdRef.current = null;
    };

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalEnd);
    window.addEventListener("touchmove", handleGlobalMove, { passive: false });
    window.addEventListener("touchend", handleGlobalEnd);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalEnd);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("touchend", handleGlobalEnd);
    };
  }, []);

  // PDF Generator for Collage layouts
  const generateCollagePdf = () => {
    if (collagePhotos.length === 0) return;

    const { width: pW, height: pH } = getPageDimensions();
    const doc = new jsPDF({
      orientation: pageOrientation,
      unit: "mm",
      format: pageSize === "letter" ? "letter" : pageSize === "legal" ? "legal" : "a4"
    });

    // Draw background depending on layout
    if (collageLayout === "historybook") {
      doc.setFillColor(248, 246, 238); // warm vintage paper tone
      doc.rect(0, 0, pW, pH, "F");

      // Grid line decoration
      doc.setDrawColor(238, 234, 222);
      doc.setLineWidth(0.2);
      for (let l = 10; l < pW; l += 15) {
        doc.line(l, 0, l, pH);
      }
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pW, pH, "F");
    }

    const coords = getLayoutCoords(collageLayout);

    coords.forEach((coord, index) => {
      const photo = collagePhotos[index % collagePhotos.length];
      if (!photo) return;

      const xMm = (coord.x / 100) * pW;
      const yMm = (coord.y / 100) * pH;
      const wMm = (coord.w / 100) * pW;
      const hMm = (coord.h / 100) * pH;
      const rot = photo.rotate || 0;

      // Draw frames (Polaroids get white frame)
      if (collageLayout === "historybook") {
        const padding = 2.5;
        const bottomPad = 8;
        
        doc.setFillColor(255, 255, 255);
        // Note: we can draw a beautiful white frame centered at xMm, yMm
        doc.rect(xMm - padding, yMm - padding, wMm + (padding * 2), hMm + padding + bottomPad, "F");
        
        // Draw shadow/gray boundary for polaroid
        doc.setDrawColor(210, 205, 195);
        doc.setLineWidth(0.1);
        doc.rect(xMm - padding, yMm - padding, wMm + (padding * 2), hMm + padding + bottomPad, "S");
      }

      // Add actual image inside bounds
      doc.addImage(
        photo.src,
        "JPEG",
        xMm,
        yMm,
        wMm,
        hMm,
        undefined,
        "FAST",
        rot
      );

      // Draw paper cutting guideline
      doc.setLineWidth(0.1);
      doc.setDrawColor(190, 190, 190);
      doc.rect(xMm, yMm, wMm, hMm);

      // Draw Title for Polaroids
      if (collageLayout === "historybook") {
        doc.setTextColor(80, 70, 60);
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8);
        doc.text(photo.title || "Momento", xMm + wMm / 2, yMm + hMm + 4, { align: "center" });
      }
    });

    // Elegant text at bottom
    doc.setTextColor(140, 140, 140);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.text("DISEÑO EXCLUSIVO - SERVICIOS CONSTELACIÓN EL SALVADOR", pW / 2, pH - 6, { align: "center" });

    doc.save(`Collage_${collageLayout}_Servicios_Constelacion.pdf`);
  };

  const { width: pW, height: pH } = getPageDimensions();

  return (
    <div className="space-y-6" id="templates-printer-section">
      
      {/* TAB SELECTOR: STANDARD VS COLLAGE */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex max-w-lg mx-auto border border-slate-200 shadow-inner">
        <button
          type="button"
          onClick={() => setPrinterMode("standard")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            printerMode === "standard"
              ? "bg-white text-blue-700 shadow border border-slate-200/50"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Fotos Carné (Estándar)</span>
        </button>
        <button
          type="button"
          onClick={() => setPrinterMode("collage")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            printerMode === "collage"
              ? "bg-indigo-950 text-indigo-100 shadow border border-indigo-900"
              : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
          <span>Collage & Historybook IA ✨</span>
        </button>
      </div>

      {printerMode === "standard" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* LEFT COLUMN: Template selection & Custom creation */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Template list */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-display font-bold text-slate-850 text-base flex items-center gap-2">
                  <Grid className="w-5 h-5 text-blue-600" />
                  Plantillas de Impresión
                </h3>
                <button
                  onClick={() => setShowCreator(!showCreator)}
                  className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-blue-200/50"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Crear Nueva
                </button>
              </div>

              {/* New Custom Template Creator Panel */}
              {showCreator && (
                <form onSubmit={handleSaveCustomTemplate} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-slideDown">
                  <span className="text-xs font-bold text-slate-700 block uppercase">Nueva Plantilla Personalizada</span>
                  
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nombre de la Plantilla</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: 8 Fotos Pasaporte USA"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Ancho (cm)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="20"
                        required
                        value={customWidth}
                        onChange={(e) => setCustomWidth(parseFloat(e.target.value))}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Alto (cm)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="20"
                        required
                        value={customHeight}
                        onChange={(e) => setCustomHeight(parseFloat(e.target.value))}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Columnas</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        required
                        value={customCols}
                        onChange={(e) => setCustomCols(parseInt(e.target.value))}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Filas</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        required
                        value={customRows}
                        onChange={(e) => setCustomRows(parseInt(e.target.value))}
                        className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowCreator(false)}
                      className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white shadow transition-colors cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              )}

              {/* Template grid selector */}
              <div className="space-y-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex justify-between items-center ${
                      selectedTemplateId === tpl.id
                        ? "border-blue-600 bg-blue-50/30"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                    }`}
                  >
                    <div>
                      <span className={`text-xs font-bold ${selectedTemplateId === tpl.id ? "text-blue-700" : "text-slate-850"}`}>
                        {tpl.name}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {tpl.widthCm} x {tpl.heightCm} cm — {tpl.cols} col x {tpl.rows} fila ({tpl.cols * tpl.rows} fotos)
                      </p>
                      <p className="text-[10px] text-slate-400 italic mt-0.5">{tpl.description}</p>
                    </div>

                    {tpl.isCustom && (
                      <button
                        onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                        className="text-slate-300 hover:text-red-500 p-1.5 transition-colors"
                        title="Eliminar plantilla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CONFIGURACIÓN DE PÁGINA Y MÁRGENES */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-md flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                Configuración de Página
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Tamaño de Papel</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "letter", name: "Carta" },
                      { id: "legal", name: "Oficio" },
                      { id: "a4", name: "A4" }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPageSize(p.id as any)}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer ${
                          pageSize === p.id 
                            ? "border-blue-600 bg-blue-50 text-blue-700" 
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Orientación</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPageOrientation("portrait")}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer ${
                          pageOrientation === "portrait" 
                            ? "border-blue-600 bg-blue-50 text-blue-700" 
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        Vertical
                      </button>
                      <button
                        type="button"
                        onClick={() => setPageOrientation("landscape")}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer ${
                          pageOrientation === "landscape" 
                            ? "border-blue-600 bg-blue-50 text-blue-700" 
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        Horiz.
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Margen (mm)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={marginMm}
                        onChange={(e) => setMarginMm(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">mm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Image upload area */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-md flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Cargar Fotografía Cliente
              </h3>

              {uploadedImage ? (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden aspect-video border bg-slate-50">
                    <img 
                      src={uploadedImage} 
                      alt="Previa Cliente" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain" 
                    />
                    <button
                      onClick={() => {
                        setUploadedImage("");
                        setFileName("");
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow animate-pulse"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span className="truncate max-w-[180px] font-medium">{fileName}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase font-bold">Cargada</span>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700">SUBIR FOTO DEL CLIENTE</span>
                  <p className="text-[10px] text-slate-400 text-center mt-1 leading-relaxed">
                    Formatos JPG, PNG. La foto se acomodará automáticamente en la grilla.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive Paper Preview */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            
            {/* Preview banner */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded uppercase border border-blue-150">
                  Vista del Folio
                </span>
                <h3 className="font-display font-bold text-lg text-slate-800 mt-1">
                  {activeTemplate ? activeTemplate.name : "Seleccione una plantilla"}
                </h3>
                <p className="text-xs text-slate-500">
                  Las líneas punteadas son guías de corte finas que se incluirán en el PDF.
                </p>
              </div>

              <button
                onClick={generatePdf}
                disabled={!uploadedImage}
                className="w-full sm:w-auto py-2.5 px-5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                Generar PDF e Imprimir
              </button>
            </div>

            {/* Paper visualizer */}
            <div className="bg-slate-100 rounded-3xl p-8 flex justify-center border border-slate-200">
              
              <div 
                className="bg-white shadow-2xl border border-slate-300 rounded-sm relative flex flex-col justify-between items-center overflow-hidden"
                style={{
                  width: "100%",
                  maxWidth: "340px",
                  aspectRatio: `${pW} / ${pH}`,
                }}
              >
                {/* Margin Guide */}
                <div 
                  className="absolute border border-dashed border-red-300 pointer-events-none opacity-65 z-10"
                  style={{
                    left: `${(marginMm / pW) * 100}%`,
                    top: `${(marginMm / pH) * 100}%`,
                    width: `${((pW - 2 * marginMm) / pW) * 100}%`,
                    height: `${((pH - 2 * marginMm) / pH) * 100}%`,
                  }}
                />

                {/* Paper label */}
                <div className="absolute top-2 right-3 text-[8px] text-slate-300 font-bold select-none uppercase tracking-widest z-10">
                  Papel {pageSize === "letter" ? "Carta" : pageSize === "legal" ? "Oficio" : "A4"} • {pageOrientation === "portrait" ? "Vertical" : "Horizontal"}
                </div>

                {/* Margins & Guidelines visual container */}
                <div 
                  className="absolute w-full h-full flex flex-col pointer-events-none"
                  style={{
                    paddingLeft: `${(marginMm / pW) * 100}%`,
                    paddingTop: `${(marginMm / pH) * 100}%`,
                    paddingRight: `${(marginMm / pW) * 100}%`,
                    paddingBottom: `${(marginMm / pH) * 100}%`,
                  }}
                >
                  {uploadedImage ? (
                    <div 
                      className="grid gap-2 p-1 border border-dashed border-slate-200 bg-slate-50/50 rounded pointer-events-auto"
                      style={{
                        gridTemplateColumns: `repeat(${activeTemplate.cols}, minmax(0, 1fr))`,
                        width: "fit-content",
                        height: "fit-content"
                      }}
                    >
                      {Array.from({ length: activeTemplate.rows * activeTemplate.cols }).map((_, i) => (
                        <div
                          key={i}
                          className="border border-slate-300 relative group overflow-hidden bg-white shadow-sm flex items-center justify-center"
                          style={{
                            aspectRatio: `${activeTemplate.widthCm} / ${activeTemplate.heightCm}`,
                            width: "52px"
                          }}
                        >
                          <img 
                            src={uploadedImage} 
                            alt="Miniatura" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 border border-blue-500 opacity-20 group-hover:opacity-100 transition-opacity"></div>
                          <span className="absolute bottom-0.5 right-0.5 bg-black/50 text-[7px] text-white px-0.5 rounded font-bold scale-90">
                            {activeTemplate.widthCm}x{activeTemplate.heightCm}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center text-slate-400 space-y-2 p-6 pointer-events-auto">
                      <Sliders className="w-10 h-10 text-slate-300 mx-auto" />
                      <span className="text-xs font-semibold block text-slate-600">Falta Foto de Cliente</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Sube una foto en la columna de la izquierda para ver el acomodo automático de las {activeTemplate.cols * activeTemplate.rows} fotos de la plantilla.
                      </p>
                    </div>
                  )}
                </div>

                {/* Paper footer note */}
                <div className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none">
                  Líneas de corte agregadas automáticamente
                </div>

              </div>

            </div>

          </div>

        </div>
      ) : (
        /* COLLAGE & HISTORYBOOK DESIGN STUDIO */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* LEFT COLUMN: Collage Setup & Multi-Photo Manager */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Collage design selection */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2 pb-2 border-b">
                <Layers className="w-4 h-4 text-indigo-600" />
                1. Selecciona el Diseño Artístico
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "heart", name: "Corazón", desc: "11 fotos", icon: Heart },
                  { id: "historybook", name: "Historybook", desc: "6 Polaroids", icon: BookOpen },
                  { id: "bento", name: "Bento Grid", desc: "5 fotos", icon: Grid }
                ].map((layout) => {
                  const Icon = layout.icon;
                  return (
                    <button
                      key={layout.id}
                      type="button"
                      onClick={() => setCollageLayout(layout.id as any)}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        collageLayout === layout.id
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-1 ring-indigo-600/10"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${collageLayout === layout.id ? "text-indigo-600" : "text-slate-400"}`} />
                      <span className="text-[11px] font-bold block">{layout.name}</span>
                      <span className="text-[9px] text-slate-400 block">{layout.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collage Multi-Uploader */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  2. Cargar Fotos de Recuerdo
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-full">
                  {collagePhotos.length} / 12
                </span>
              </div>

              {/* Multi drag files label */}
              <label className="border-2 border-dashed border-slate-200 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50/10 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all">
                <Plus className="w-6 h-6 text-indigo-500 mb-1" />
                <span className="text-[11px] font-bold text-indigo-950 uppercase">Subir Fotos en Lote</span>
                <p className="text-[9px] text-slate-400 text-center mt-0.5">
                  Puedes seleccionar múltiples fotos de una sola vez.
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleCollageImagesUpload}
                  className="hidden"
                />
              </label>

              {collagePhotos.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Fotos Cargadas (Haz clic para seleccionar)</span>
                  <div className="grid grid-cols-4 gap-2">
                    {collagePhotos.map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => setActivePhotoId(photo.id)}
                        className={`relative rounded-lg overflow-hidden aspect-square border cursor-pointer transition-all ${
                          activePhotoId === photo.id ? "ring-2 ring-indigo-600 border-transparent scale-95 shadow-inner" : "border-slate-200 hover:scale-105"
                        }`}
                      >
                        <img src={photo.src} alt="Miniprev" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCollagePhotos(prev => prev.filter(p => p.id !== photo.id));
                            if (activePhotoId === photo.id) setActivePhotoId(null);
                          }}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-all"
                          title="Eliminar foto"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit selected photo title */}
              {activePhotoId && collagePhotos.find(p => p.id === activePhotoId) && (
                <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2 animate-fadeIn">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase block">Editar Título del Polaroid</span>
                  <input
                    type="text"
                    value={collagePhotos.find(p => p.id === activePhotoId)?.title || ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCollagePhotos(prev => prev.map(p => p.id === activePhotoId ? { ...p, title: text } : p));
                    }}
                    placeholder="Título ej: Familia Feliz"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 font-medium"
                  />
                  <div className="flex gap-2 text-[9px] text-slate-400">
                    <span>💡 También puedes mover las fotos directamente arrastrándolas con el click en el folio de la derecha.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Smart AI Tools */}
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-950 shadow-md space-y-4">
              <h3 className="font-display font-semibold text-indigo-200 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                3. Efectos y Distribución IA
              </h3>

              <div className="space-y-3">
                {/* AI Reorder button */}
                <button
                  type="button"
                  onClick={handleAutoDistribute}
                  disabled={collagePhotos.length === 0}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4 text-indigo-300" />
                  <span>Auto-Ajustar Posiciones y Rotaciones (IA)</span>
                </button>

                {/* Color filters selection */}
                <div>
                  <label className="text-[9px] font-bold text-indigo-300 uppercase block mb-1">Filtro de Impresión Creativo</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "none", name: "Estándar" },
                      { id: "warm", name: "Cálido" },
                      { id: "retro", name: "Retro" },
                      { id: "bw", name: "B&N" }
                    ].map((filt) => (
                      <button
                        key={filt.id}
                        type="button"
                        onClick={() => setCollageFilter(filt.id as any)}
                        className={`py-1.5 px-0.5 rounded-lg text-[10px] font-extrabold border transition-all text-center cursor-pointer ${
                          collageFilter === filt.id
                            ? "bg-indigo-500 border-indigo-400 text-white"
                            : "bg-indigo-950/40 border-indigo-800 text-indigo-200 hover:bg-indigo-900/30"
                        }`}
                      >
                        {filt.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Page Size reuse for collage */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <h3 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                4. Papel de Impresión
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "letter", name: "Carta" },
                  { id: "legal", name: "Oficio" },
                  { id: "a4", name: "A4" }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPageSize(p.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer ${
                      pageSize === p.id 
                        ? "border-blue-600 bg-blue-50 text-blue-700" 
                        : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Interactive Collage visualizer and PDF Generator */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            
            {/* Action Banner */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded uppercase border border-indigo-150">
                  Previsualización de Collage
                </span>
                <h3 className="font-display font-bold text-lg text-slate-850 mt-1">
                  Diseño {collageLayout === "heart" ? "Corazón Romántico" : collageLayout === "historybook" ? "Historybook Polaroid" : "Mesa Bento Grid"}
                </h3>
                <p className="text-xs text-slate-500">
                  Mueve las fotos directamente con el ratón/dedo para encuadrarlas perfectamente en sus marcos.
                </p>
              </div>

              <button
                type="button"
                onClick={generateCollagePdf}
                disabled={collagePhotos.length === 0}
                className="w-full sm:w-auto py-2.5 px-5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Guardar PDF e Imprimir</span>
              </button>
            </div>

            {/* Collage interactive physical canvas */}
            <div className="bg-slate-100 rounded-3xl p-8 flex justify-center border border-slate-200 select-none">
              
              <div
                className={`shadow-2xl border border-slate-300 rounded-sm relative overflow-hidden transition-colors duration-300 ${
                  collageLayout === "historybook" ? "bg-[#fcfaf4]" : "bg-white"
                }`}
                style={{
                  width: "100%",
                  maxWidth: "340px",
                  aspectRatio: `${pW} / ${pH}`,
                }}
              >
                {/* Margin guideline */}
                <div 
                  className="absolute border border-dashed border-indigo-300/40 pointer-events-none z-10"
                  style={{
                    left: `${(marginMm / pW) * 100}%`,
                    top: `${(marginMm / pH) * 100}%`,
                    width: `${((pW - 2 * marginMm) / pW) * 100}%`,
                    height: `${((pH - 2 * marginMm) / pH) * 100}%`,
                  }}
                />

                {collagePhotos.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-8 space-y-3">
                    <Sparkles className="w-12 h-12 text-indigo-400 fill-indigo-400/10 animate-bounce" />
                    <span className="font-bold text-slate-700 text-sm block">Tu Collage se Diseñará Aquí</span>
                    <p className="text-[11px] text-slate-400 leading-normal max-w-xs">
                      Sube tus fotografías en el panel izquierdo. Al cargarlas, se acomodarán mágicamente en la plantilla elegida.
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 w-full h-full">
                    {/* Render the photos according to selected layout coordinates */}
                    {getLayoutCoords(collageLayout).map((coord, index) => {
                      const photo = collagePhotos[index % collagePhotos.length];
                      if (!photo) return null;

                      const filterCss = getFilterCss(collageFilter);

                      return (
                        <div
                          key={`collage_slot_${index}`}
                          className={`absolute select-none overflow-visible group transition-transform ${
                            collageLayout === "historybook"
                              ? "bg-white p-1 pb-4 shadow-md border border-slate-200/60 rounded-xs"
                              : "bg-slate-100"
                          }`}
                          style={{
                            left: `${coord.x}%`,
                            top: `${coord.y}%`,
                            width: `${coord.w}%`,
                            height: `${coord.h + (collageLayout === "historybook" ? 4 : 0)}%`,
                            transform: `rotate(${photo.rotate || 0}deg)`,
                            zIndex: activePhotoId === photo.id ? 20 : 10
                          }}
                        >
                          {/* Polaroid Washi Tape Accent */}
                          {collageLayout === "historybook" && (
                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-yellow-100/60 rotate-6 border-l border-r border-dashed border-yellow-200/40 pointer-events-none shadow-[0_1px_1px_rgba(0,0,0,0.02)]" />
                          )}

                          <div 
                            className="w-full h-full relative overflow-hidden bg-slate-200 cursor-grab active:cursor-grabbing"
                            style={{
                              height: collageLayout === "historybook" ? "82%" : "100%"
                            }}
                            onMouseDown={(e) => handleCollageDragStart(e, photo.id, photo.xOffset, photo.yOffset)}
                            onTouchStart={(e) => handleCollageDragStart(e, photo.id, photo.xOffset, photo.yOffset)}
                          >
                            <img
                              src={photo.src}
                              alt="Collage frame"
                              referrerPolicy="no-referrer"
                              className={`absolute max-w-none w-[160%] h-[160%] object-cover pointer-events-none ${filterCss}`}
                              style={{
                                top: `${-30 + (photo.yOffset || 0)}%`,
                                left: `${-30 + (photo.xOffset || 0)}%`
                              }}
                            />

                            {/* Center drag helpers */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                              <Move className="w-4 h-4 text-white" />
                            </div>
                          </div>

                          {/* Captions for scrapbook */}
                          {collageLayout === "historybook" && (
                            <div className="w-full text-center text-[7px] text-slate-700 font-medium font-sans truncate py-0.5 tracking-tighter select-text">
                              {photo.title || "Recuerdo"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Paper footer note */}
                <div className="absolute bottom-2 left-0 right-0 text-center text-[8px] text-slate-300 font-bold uppercase tracking-widest pointer-events-none">
                  Alineación interactiva • Servicios Constelación
                </div>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

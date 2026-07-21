import React, { useState } from "react";
import { 
  Upload, Printer, Trash2, HelpCircle, AlertCircle, Info, Maximize2, Settings 
} from "lucide-react";
import { jsPDF } from "jspdf";

export default function SmartPhotoResizer() {
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // Dimensions
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [width, setWidth] = useState<number>(10); // Default 10 cm
  const [height, setHeight] = useState<number>(15); // Default 15 cm (typical 4x6" photo)
  const [quantity, setQuantity] = useState<number>(2); // Default 2 prints

  // Page Setup & Margins
  const [pageSize, setPageSize] = useState<"letter" | "legal" | "a4">("letter");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState<number>(10); // Margen en mm
  const [gap, setGap] = useState<number>(4); // Separación entre fotos en mm

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

  const getWidthInMm = () => {
    return unit === "cm" ? width * 10 : width * 25.4;
  };

  const getHeightInMm = () => {
    return unit === "cm" ? height * 10 : height * 25.4;
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

    if (orientation === "landscape") {
      return { width: baseHeight, height: baseWidth };
    }
    return { width: baseWidth, height: baseHeight };
  };

  const { width: pageW, height: pageH } = getPageDimensions();
  const wMm = getWidthInMm();
  const hMm = getHeightInMm();

  // Multi-page layout packing calculation
  const placements: { pageIndex: number; x: number; y: number; w: number; h: number }[] = [];
  
  if (wMm > 0 && hMm > 0) {
    let currentPage = 0;
    let currentX = margin;
    let currentY = margin;
    let maxRowHeight = 0;

    for (let i = 0; i < quantity; i++) {
      // Constrain image size to printable area if it is larger than the entire printable area
      const printableW = Math.max(10, pageW - 2 * margin);
      const printableH = Math.max(10, pageH - 2 * margin);
      const itemW = Math.min(wMm, printableW);
      const itemH = Math.min(hMm, printableH);

      // Check horizontal overflow
      if (currentX + itemW > pageW - margin) {
        currentX = margin;
        currentY += maxRowHeight + gap;
        maxRowHeight = 0;
      }

      // Check vertical overflow -> Create a new page
      if (currentY + itemH > pageH - margin) {
        currentPage++;
        currentX = margin;
        currentY = margin;
        maxRowHeight = 0;
      }

      placements.push({
        pageIndex: currentPage,
        x: currentX,
        y: currentY,
        w: itemW,
        h: itemH
      });

      currentX += itemW + gap;
      if (itemH > maxRowHeight) {
        maxRowHeight = itemH;
      }
    }
  }

  const totalPages = placements.length > 0 ? Math.max(...placements.map(p => p.pageIndex)) + 1 : 1;

  const generatePdf = () => {
    if (!uploadedImage) return;

    const doc = new jsPDF({
      orientation: orientation,
      unit: "mm",
      format: pageSize === "letter" ? "letter" : pageSize === "legal" ? "legal" : "a4"
    });

    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      if (pIdx > 0) {
        doc.addPage();
      }

      const pagePlacements = placements.filter(p => p.pageIndex === pIdx);
      for (const p of pagePlacements) {
        doc.addImage(uploadedImage, "JPEG", p.x, p.y, p.w, p.h);
        
        // Fine crop/outline borders
        doc.setLineWidth(0.1);
        doc.setDrawColor(200, 200, 200);
        doc.rect(p.x, p.y, p.w, p.h);
      }
    }

    doc.save(`Fotos_Redimensionadas_${width}x${height}${unit}_Servicios_Constelacion.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="smart-photo-section">
      
      {/* LEFT COLUMN: Custom sizing inputs */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Dimensions selector */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
          <h3 className="font-display font-bold text-slate-850 text-base flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-blue-600" />
            Configurar Tamaño Libre
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed">
            Mete las dimensiones exactas del cuadro del portarretratos o medida que te pida tu cliente (ej. fotos de graduación, diplomas, etc.).
          </p>

          {/* Unit selector */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">Unidad de Medida</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnit("cm")}
                className={`py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  unit === "cm"
                    ? "border-blue-600 bg-blue-50/30 text-blue-700 font-bold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Centímetros (cm)
              </button>
              <button
                type="button"
                onClick={() => setUnit("in")}
                className={`py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                  unit === "in"
                    ? "border-blue-600 bg-blue-50/30 text-blue-700 font-bold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Pulgadas (Inches)
              </button>
            </div>
          </div>

          {/* Custom dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Ancho</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="50"
                  value={width}
                  onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white font-medium pr-8"
                />
                <span className="absolute right-2.5 top-3 text-[10px] text-slate-400 font-bold">{unit}</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Alto</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="50"
                  value={height}
                  onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white font-medium pr-8"
                />
                <span className="absolute right-2.5 top-3 text-[10px] text-slate-400 font-bold">{unit}</span>
              </div>
            </div>
          </div>

          {/* Quantity Selector */}
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Cantidad de Copias / Fotos</label>
            <input
              type="number"
              min="1"
              max="50"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white font-medium"
            />
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              La página acomodará las {quantity} copias optimizando el espacio del folio. Si no caben en una página, ¡se generarán las páginas adicionales necesarias!
            </p>
          </div>
        </div>

        {/* Page Setup & Margins Block */}
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
                  onClick={() => setOrientation(orient)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    orientation === orient
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
                {margin} mm
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              value={margin}
              onChange={(e) => setMargin(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>5 mm</span>
              <span>20 mm</span>
              <span>40 mm</span>
            </div>
          </div>

          {/* Distancia de separación (gap) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Separación entre fotos (Gap)
              </label>
              <span className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {gap} mm
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={gap}
              onChange={(e) => setGap(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>0 mm (Unido)</span>
              <span>10 mm</span>
              <span>20 mm</span>
            </div>
          </div>
        </div>

        {/* Upload file */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
          <h3 className="font-display font-semibold text-slate-850 text-base flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Cargar Fotografía
          </h3>

          {uploadedImage ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden aspect-video border bg-slate-50">
                <img src={uploadedImage} alt="Previa" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                <button
                  onClick={() => {
                    setUploadedImage("");
                    setFileName("");
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-slate-500 truncate font-medium">
                {fileName}
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all">
              <Upload className="w-8 h-8 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-700">SUBIR FOTO ORIGINAL</span>
              <p className="text-[10px] text-slate-400 text-center mt-1 leading-relaxed">
                Sube la foto aquí y la ajustaremos a la medida exacta de {width}x{height} {unit}.
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

      {/* RIGHT COLUMN: Paper preview layout */}
      <div className="lg:col-span-7 flex flex-col space-y-6">
        
        {/* Banner with trigger */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded uppercase border border-blue-150">
              Vista de Distribución
            </span>
            <h3 className="font-display font-bold text-lg text-slate-850 mt-1">
              Impresión Libre de {width} x {height} {unit}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acomodo inteligente en papel {pageSize === "letter" ? "Carta" : pageSize === "legal" ? "Oficio" : "A4"} ({orientation}) para ahorrar papel.
            </p>
          </div>

          <button
            onClick={generatePdf}
            disabled={!uploadedImage}
            className="w-full sm:w-auto py-2.5 px-5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            Generar PDF e Imprimir
          </button>
        </div>

        {/* Paper Sheet Simulator with Multi-Page visualization */}
        <div className="bg-slate-100 rounded-3xl p-6 flex flex-col items-center gap-8 border border-slate-200 max-h-[750px] overflow-y-auto">
          
          {Array.from({ length: totalPages }).map((_, pIdx) => {
            const pagePlacements = placements.filter((p) => p.pageIndex === pIdx);
            return (
              <div key={pIdx} className="space-y-2 w-full max-w-[340px] animate-fadeIn">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-500">Página {pIdx + 1} de {totalPages}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">{pageSize} • {orientation}</span>
                </div>
                <div 
                  className="bg-white shadow-2xl border border-slate-300 rounded-sm relative overflow-hidden"
                  style={{
                    width: "100%",
                    aspectRatio: `${pageW} / ${pageH}`,
                  }}
                >
                  {/* Margin Guide */}
                  <div 
                    className="absolute border border-dashed border-red-300 pointer-events-none opacity-60"
                    style={{
                      left: `${(margin / pageW) * 100}%`,
                      top: `${(margin / pageH) * 100}%`,
                      width: `${((pageW - 2 * margin) / pageW) * 100}%`,
                      height: `${((pageH - 2 * margin) / pageH) * 100}%`,
                    }}
                  />

                  {uploadedImage ? (
                    pagePlacements.map((p, idx) => (
                      <div
                        key={idx}
                        className="absolute border border-slate-300 shadow-sm group overflow-hidden bg-slate-50 flex items-center justify-center transition-all"
                        style={{
                          left: `${(p.x / pageW) * 100}%`,
                          top: `${(p.y / pageH) * 100}%`,
                          width: `${(p.w / pageW) * 100}%`,
                          height: `${(p.h / pageH) * 100}%`,
                        }}
                      >
                        <img src={uploadedImage} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <span className="absolute bottom-1 right-1 bg-black/60 text-[7px] text-white px-1 rounded font-bold">
                          {width}x{height} {unit}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="absolute inset-0 flex flex-col justify-center items-center text-center text-slate-400 p-6 space-y-2">
                      <Maximize2 className="w-8 h-8 text-slate-300" />
                      <span className="text-[11px] font-semibold block text-slate-600">Espera de Fotografía</span>
                      <p className="text-[9px] text-slate-400 leading-normal max-w-[200px]">
                        Carga la foto y define las dimensiones. Calcularemos el acomodo ideal.
                      </p>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-0 right-0 text-center text-[7px] text-slate-300 font-bold uppercase tracking-widest select-none pointer-events-none">
                    Guía de corte precisa • Servicios Constelacion
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}

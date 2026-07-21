import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, Image as ImageIcon, Upload, Trash2, Printer, Loader2, RotateCw, 
  BookOpen, Heart, Award, Gift, AlignCenter, Frame, Sliders, Type as TypeIcon
} from "lucide-react";
import { jsPDF } from "jspdf";
import { processImageFilters } from "../utils/imageProcessor";

interface PortraitFilters {
  brightness: number;
  contrast: number;
  grayscale: boolean;
  sepia: boolean;
  vintage: boolean;
  rotate: number;
  scale: number;
  shiftX: number;
  shiftY: number;
}

const DEFAULT_FILTERS: PortraitFilters = {
  brightness: 0,
  contrast: 0,
  grayscale: false,
  sepia: false,
  vintage: false,
  rotate: 0,
  scale: 100,
  shiftX: 0,
  shiftY: 0
};

export default function CreativeStudio() {
  const [photoSrc, setPhotoSrc] = useState<string>("");
  const [photoName, setPhotoName] = useState<string>("");
  const [processedPreview, setProcessedPreview] = useState<string>("");
  
  // Custom Filters state
  const [filters, setFilters] = useState<PortraitFilters>({ ...DEFAULT_FILTERS });

  // Dedication draft state
  const [personName, setPersonName] = useState<string>("");
  const [selectedTheme, setSelectedTheme] = useState<string>("In Memoriam");
  const [customDetails, setCustomDetails] = useState<string>("");
  const [generatedTitle, setGeneratedTitle] = useState<string>("En Memoria Eterna");
  const [generatedText, setGeneratedText] = useState<string>(
    "Que tu recuerdo siga siendo la estrella que guíe nuestros pasos, un faro inquebrantable de amor y sabiduría que el tiempo jamás podrá borrar de nuestras almas."
  );
  
  const [isGeneratingDedication, setIsGeneratingDedication] = useState<boolean>(false);
  const [selectedBorder, setSelectedBorder] = useState<string>("gold"); // 'gold' | 'minimal' | 'rustic' | 'izote'

  // Interactive dragging states
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const filterStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);

  // File Upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoSrc(event.target?.result as string);
      setPhotoName(file.name);
      setFilters({ ...DEFAULT_FILTERS });
    };
    reader.readAsDataURL(file);
  };

  // Drag handlers for the photo viewport
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!photoSrc) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    filterStartRef.current = { x: filters.shiftX, y: filters.shiftY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    // Convert pixels to shifts (approx 0.5% shift per pixel)
    const sens = 0.5;
    setFilters(prev => ({
      ...prev,
      shiftX: Math.max(-100, Math.min(100, Math.round(filterStartRef.current.x + dx * sens))),
      shiftY: Math.max(-100, Math.min(100, Math.round(filterStartRef.current.y + dy * sens)))
    }));
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
  };

  // Touch support for mobile dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!photoSrc) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    filterStartRef.current = { x: filters.shiftX, y: filters.shiftY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    
    const sens = 0.5;
    setFilters(prev => ({
      ...prev,
      shiftX: Math.max(-100, Math.min(100, Math.round(filterStartRef.current.x + dx * sens))),
      shiftY: Math.max(-100, Math.min(100, Math.round(filterStartRef.current.y + dy * sens)))
    }));
  };

  // Process filters with HTML Canvas
  useEffect(() => {
    if (!photoSrc) {
      setProcessedPreview("");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Keep aspect ratio but limit size for preview performance
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = (maxDim / w) * h;
          w = maxDim;
        } else {
          w = (maxDim / h) * w;
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;

      // 1. Rotate & Translate
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((filters.rotate * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Apply Filters
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const b = (filters.brightness / 100) * 255;
        const c = filters.contrast;
        const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let bl = data[i + 2];

          // Brightness
          if (b !== 0) {
            r += b; g += b; bl += b;
          }

          // Contrast
          if (c !== 0) {
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            bl = contrastFactor * (bl - 128) + 128;
          }

          // Grayscale / Sepia / Vintage
          if (filters.grayscale) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
            r = g = bl = gray;
          } else if (filters.sepia) {
            const tr = 0.393 * r + 0.769 * g + 0.189 * bl;
            const tg = 0.349 * r + 0.686 * g + 0.168 * bl;
            const tb = 0.272 * r + 0.534 * g + 0.131 * bl;
            r = tr; g = tg; bl = tb;
          } else if (filters.vintage) {
            // Soft warm yellow-peach tone
            r = r * 1.05;
            g = g * 0.95;
            bl = bl * 0.85;
          }

          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, g));
          data[i + 2] = Math.max(0, Math.min(255, bl));
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        console.error("Filtros fallaron:", err);
      }

      setProcessedPreview(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = photoSrc;
  }, [photoSrc, filters.brightness, filters.contrast, filters.grayscale, filters.sepia, filters.vintage, filters.rotate]);

  // AI Dedication draft fetcher
  const handleAiDedicationDraft = async () => {
    if (!personName) return;
    setIsGeneratingDedication(true);

    try {
      const res = await fetch("/api/generate-dedication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: personName,
          theme: selectedTheme,
          customDetails: customDetails
        })
      });

      if (!res.ok) throw new Error("Fallo al contactar con la IA");
      const data = await res.json();
      setGeneratedTitle(data.title || "Homenaje Especial");
      setGeneratedText(data.dedicationText || "");
    } catch (err) {
      console.error(err);
      setGeneratedText("En honor a tu vida singular, que tu luz siga brillando eternamente en los corazones de quienes tuvimos la dicha de compartir tus días en esta tierra.");
    } finally {
      setIsGeneratingDedication(false);
    }
  };

  // Generate high-resolution PDF for printing (8x10 portrait frame size on Letter Paper)
  const handleGeneratePdf = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter"
    });

    const pW = 215.9; // Letter width
    const pH = 279.4; // Letter height

    // Draw background sheet color depending on border
    if (selectedBorder === "rustic") {
      doc.setFillColor(250, 247, 238); // Cream paper tint
      doc.rect(0, 0, pW, pH, "F");
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pW, pH, "F");
    }

    // 1. Draw elegant borders
    doc.setLineWidth(1.5);
    if (selectedBorder === "gold") {
      // Golden Double Frame
      doc.setDrawColor(218, 165, 32); // Gold
      doc.rect(10, 10, pW - 20, pH - 20);
      doc.setDrawColor(244, 215, 94); // Light gold
      doc.rect(12.5, 12.5, pW - 25, pH - 25);
    } else if (selectedBorder === "izote") {
      // Green/Botanical border
      doc.setDrawColor(46, 125, 50); // Leaf green
      doc.rect(10, 10, pW - 20, pH - 20);
      doc.setDrawColor(129, 199, 132); // Pale green
      doc.rect(13, 13, pW - 26, pH - 26);
    } else if (selectedBorder === "rustic") {
      // Warm charcoal rústico
      doc.setDrawColor(81, 40, 20); // Dark brown
      doc.rect(10, 10, pW - 20, pH - 20);
      doc.setDrawColor(141, 110, 99); // Light wood
      doc.rect(12, 12, pW - 24, pH - 24);
    } else {
      // Minimal modern clean
      doc.setDrawColor(30, 41, 59); // Slate
      doc.rect(15, 15, pW - 30, pH - 30);
    }

    // 2. Draw Portrait Image inside an elegant oval/oval-arch or clean rounded rectangle
    if (processedPreview) {
      // Portrait takes middle-top space: Width 90mm, Height 110mm, centered
      const imgW = 95;
      const imgH = 115;
      const imgX = (pW - imgW) / 2;
      const imgY = 22; // Position from top

      // Mask background to clean any clipping overlap
      doc.setFillColor(240, 240, 240);
      doc.rect(imgX, imgY, imgW, imgH, "F");

      doc.addImage(processedPreview, "JPEG", imgX, imgY, imgW, imgH);
      
      // Draw frame outline for image
      doc.setLineWidth(1);
      doc.setDrawColor(180, 180, 180);
      doc.rect(imgX, imgY, imgW, imgH);
    }

    // 3. Render elegant typography for title & dedication
    // Title
    doc.setTextColor(30, 41, 59);
    doc.setFont("Times", "bold");
    doc.setFontSize(22);
    doc.text(generatedTitle.toUpperCase(), pW / 2, 160, { align: "center" });

    // Subtitle (Name)
    if (personName) {
      doc.setTextColor(197, 160, 89); // Gold
      doc.setFont("Times", "bolditalic");
      doc.setFontSize(18);
      doc.text(personName, pW / 2, 172, { align: "center" });
    }

    // Separator Line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(pW / 2 - 25, 178, pW / 2 + 25, 178);

    // Dedication text (automatic word wrapping)
    doc.setTextColor(71, 85, 105);
    doc.setFont("Times", "italic");
    doc.setFontSize(13);
    const wrapWidth = 145; // mm width of text area
    const lines = doc.splitTextToSize(generatedText, wrapWidth);
    doc.text(lines, pW / 2, 188, { align: "center", lineHeightFactor: 1.4 });

    // Bottom decorative brand note
    doc.setTextColor(160, 160, 160);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.text("GENERADO POR SERVICIOS CONSTELACIÓN SV — RETRATO HISTÓRICO PREMIUM", pW / 2, pH - 15, { align: "center" });

    doc.save(`Retrato_${personName.replace(/\s+/g, "_") || "Personalizado"}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="creative-studio-tab">
      
      {/* LEFT COLUMN: Controls & AI Prompter */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Upload Portrait Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              1. Carga Fotografía de Retrato
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Alta Resolución
            </span>
          </div>

          {photoSrc ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden aspect-[4/5] border bg-slate-100 flex items-center justify-center">
                <img 
                  src={processedPreview || photoSrc} 
                  alt="Retrato original" 
                  referrerPolicy="no-referrer"
                  className="max-h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoSrc("");
                    setPhotoName("");
                    setProcessedPreview("");
                  }}
                  className="absolute top-3 right-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-all"
                  title="Eliminar foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span className="truncate max-w-[200px] font-medium">{photoName}</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2 py-0.5 rounded uppercase">Cargada</span>
              </div>
            </div>
          ) : (
            <label className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/10 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all">
              <Upload className="w-10 h-10 text-slate-400 mb-3" />
              <span className="text-xs font-bold text-slate-700 uppercase">Seleccionar Retrato del Cliente</span>
              <p className="text-[10px] text-slate-400 text-center mt-1.5 leading-relaxed max-w-[220px]">
                Ideal para fotos antiguas, de carné o de celular de seres queridos que deseen inmortalizar.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* AI Creative Dedication Card */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
          <h3 className="font-display font-semibold text-indigo-300 text-sm flex items-center gap-2 pb-2 border-b border-slate-800">
            <Sparkles className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
            2. Redacción Poética y Dedicatoria IA
          </h3>

          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Nombre Completo del Homenajeado</label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Ej: Doña Carmen de Jesús Martínez"
                className="w-full text-xs p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tema del Retrato</label>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl focus:outline-none text-white font-medium"
                >
                  <option value="In Memoriam">In Memoriam</option>
                  <option value="Logro Académico / Graduación">Graduación / Logro</option>
                  <option value="Boda de Oro / Matrimonio">Aniversario Boda</option>
                  <option value="Cumpleaños Especial">Cumpleaños Especial</option>
                  <option value="Homenaje a la Madre/Padre">Homenaje Familiar</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Detalle / Firmado Por</label>
                <input
                  type="text"
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                  placeholder="Ej: Con amor de tus hijos y nietos"
                  className="w-full text-xs p-2.5 bg-slate-900 border border-slate-700/60 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAiDedicationDraft}
              disabled={!personName || isGeneratingDedication}
              className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-950/40"
            >
              {isGeneratingDedication ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                  <span>Redactando Dedicatoria...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-300 fill-indigo-300/20" />
                  <span>Redactar Dedicatoria con IA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Vintage Image Adjustment Filters Card */}
        {photoSrc && (
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
            <h3 className="font-display font-semibold text-slate-850 text-base flex items-center gap-2 pb-2 border-b">
              <Sliders className="w-4 h-4 text-slate-600" />
              3. Ajustes de Filtros Artísticos
            </h3>

            <div className="space-y-3.5">
              {/* Presets Grid */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1.5">Tonalidad del Retrato</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "normal", name: "Estándar", state: { grayscale: false, sepia: false, vintage: false } },
                    { id: "grayscale", name: "B&N Retro", state: { grayscale: true, sepia: false, vintage: false } },
                    { id: "sepia", name: "Sepia Warm", state: { grayscale: false, sepia: true, vintage: false } },
                    { id: "vintage", name: "Estudio", state: { grayscale: false, sepia: false, vintage: true } }
                  ].map((preset) => {
                    const isSelected = preset.id === "normal" 
                      ? (!filters.grayscale && !filters.sepia && !filters.vintage)
                      : (preset.id === "grayscale" ? filters.grayscale : preset.id === "sepia" ? filters.sepia : filters.vintage);
                    
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFilters(prev => ({ ...prev, ...preset.state }))}
                        className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold border transition-all text-center cursor-pointer ${
                          isSelected 
                            ? "border-blue-600 bg-blue-50 text-blue-700" 
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rotate and Brightness Slider */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Brillo</span>
                    <span className="font-bold">{filters.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={filters.brightness}
                    onChange={(e) => setFilters(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                    className="w-full accent-slate-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Contraste</span>
                    <span className="font-bold">{filters.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={filters.contrast}
                    onChange={(e) => setFilters(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                    className="w-full accent-slate-600"
                  />
                </div>
              </div>

              {/* Rotation buttons */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Rotación de Foto</label>
                <div className="flex gap-2">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => setFilters(prev => ({ ...prev, rotate: deg }))}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        filters.rotate === deg
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
            </div>
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: Interactive Frame Canvas Preview & Print PDF Button */}
      <div className="lg:col-span-7 flex flex-col space-y-6">
        
        {/* Top Control Bar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded uppercase border border-indigo-150">
              Retrato de Recuerdo IA
            </span>
            <h3 className="font-display font-bold text-lg text-slate-850 mt-1">
              Diseño de Lienzo Conmemorativo
            </h3>
            <p className="text-xs text-slate-500">
              Usa el click o toque para desplazar el retrato dentro del cuadro de arriba.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGeneratePdf}
            className="w-full sm:w-auto py-2.5 px-5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>Imprimir Cuadro 8x10"</span>
          </button>
        </div>

        {/* Paper visualizer with Frame Theme */}
        <div className="bg-slate-100 rounded-3xl p-8 flex justify-center border border-slate-200">
          
          <div 
            className={`shadow-2xl rounded-sm relative flex flex-col justify-between items-center overflow-hidden p-6 select-none transition-all duration-300 ${
              selectedBorder === "rustic" ? "bg-[#fcfaf4]" : "bg-white"
            }`}
            style={{
              width: "100%",
              maxWidth: "340px",
              aspectRatio: "215.9 / 279.4", // Letter ratio
            }}
          >
            {/* Elegant physical borders on the preview */}
            {selectedBorder === "gold" && (
              <>
                <div className="absolute inset-2 border-2 border-[#caa34b] pointer-events-none z-10" />
                <div className="absolute inset-3 border border-[#f4d75e] pointer-events-none z-10" />
              </>
            )}

            {selectedBorder === "izote" && (
              <>
                <div className="absolute inset-2 border-2 border-green-700 pointer-events-none z-10" />
                <div className="absolute inset-3.5 border border-green-300 pointer-events-none z-10" />
              </>
            )}

            {selectedBorder === "rustic" && (
              <>
                <div className="absolute inset-2 border-2 border-amber-900 pointer-events-none z-10" />
                <div className="absolute inset-3.5 border border-[#8d6e63] pointer-events-none z-10" />
              </>
            )}

            {selectedBorder === "minimal" && (
              <div className="absolute inset-4 border border-slate-800 pointer-events-none z-10" />
            )}

            {/* Frame info note */}
            <div className="absolute top-2 right-4 text-[7px] text-slate-300 font-bold select-none uppercase tracking-widest z-10">
              Marco Conmemorativo 8x10
            </div>

            {/* Canvas Main Content area */}
            <div className="w-full flex-1 flex flex-col items-center pt-2.5">
              
              {/* PORTRAIT IMAGE FRAME PORT */}
              <div 
                className="w-[150px] h-[180px] bg-slate-50 border border-slate-200 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing shadow-inner rounded-sm"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUpOrLeave}
              >
                {photoSrc ? (
                  <img
                    src={processedPreview || photoSrc}
                    alt="Lienzo de retrato"
                    referrerPolicy="no-referrer"
                    className="absolute max-w-none pointer-events-none object-cover"
                    style={{
                      width: `${140 + (filters.scale - 100)}%`,
                      height: `${140 + (filters.scale - 100)}%`,
                      top: `${-20 + filters.shiftY}%`,
                      left: `${-20 + filters.shiftX}%`
                    }}
                  />
                ) : (
                  <div className="text-center p-4 text-slate-350">
                    <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-45" />
                    <span className="text-[9px] block font-bold uppercase tracking-wider">Falta Foto</span>
                  </div>
                )}
                {photoSrc && (
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/15 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-[8px] font-bold text-white bg-black/70 px-2 py-1 rounded">Arrastra para encuadrar</span>
                  </div>
                )}
              </div>

              {/* DEDICATION TEXT AREA */}
              <div className="w-full text-center mt-4 px-2 space-y-1.5">
                <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider font-serif">
                  {generatedTitle || "HOMENAJE ESPECIAL"}
                </h4>
                
                {personName && (
                  <p className="text-[#caa34b] font-serif font-black italic text-[11px]">
                    {personName}
                  </p>
                )}

                <div className="w-8 h-[0.5px] bg-slate-200 mx-auto" />

                <p className="text-slate-500 font-serif italic text-[9px] leading-relaxed max-w-[210px] mx-auto line-clamp-4">
                  "{generatedText}"
                </p>

                {customDetails && (
                  <p className="text-[8px] font-sans font-bold text-slate-400 uppercase tracking-widest pt-1">
                    — {customDetails} —
                  </p>
                )}
              </div>

            </div>

            {/* Bottom metadata */}
            <div className="text-[7px] text-slate-300 text-center font-bold uppercase tracking-widest">
              Líneas de encuadre fino de impresión
            </div>

          </div>

        </div>

        {/* Border Picker tool */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
          <h3 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Frame className="w-4 h-4 text-slate-600" />
            4. Elige Estilo de Orla o Borde
          </h3>

          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "gold", name: "Oro Imperial", color: "bg-amber-400" },
              { id: "minimal", name: "Sencillo Negro", color: "bg-slate-800" },
              { id: "rustic", name: "Rústico Madera", color: "bg-amber-800" },
              { id: "izote", name: "Flor de Izote", color: "bg-emerald-600" }
            ].map((bdr) => (
              <button
                key={bdr.id}
                type="button"
                onClick={() => setSelectedBorder(bdr.id)}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                  selectedBorder === bdr.id
                    ? "border-indigo-600 bg-indigo-50/40 text-indigo-700 font-bold"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${bdr.color}`} />
                <span className="text-[10px] block">{bdr.name}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

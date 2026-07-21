import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { 
  FileText, Upload, Copy, Check, Loader2, AlertCircle, 
  Building, Briefcase, MapPin, Sparkles, Printer, RefreshCw, FileSearch, 
  Camera, User, Calendar, CreditCard, ShieldAlert, Download, Edit3, Save, Info, HelpCircle
} from "lucide-react";
import jsPDF from "jspdf";
import CameraCapture from "./CameraCapture";

interface ExtractedIvaData {
  nombreContribuyente: string;
  nit: string;
  nrc: string;
  giroActividad: string;
  direccionCasaMatriz: string;
  categoriaContribuyente: string;
  nuevoMunicipio?: string;
  distrito?: string;
  extractedNotes?: string;
}

interface ExtractedDuiData {
  nombres: string;
  apellidos: string;
  dui: string;
  nit?: string;
  fechaNacimiento: string;
  lugarNacimiento?: string;
  genero: string;
  fechaExpiracion: string;
  residencia: string;
  municipio?: string;
  departamento?: string;
  nuevoMunicipio?: string;
  distrito?: string;
  estadoFamiliar?: string;
  profesion?: string;
  extractedNotes?: string;
}

export default function IvaExtractor() {
  const [docType, setDocType] = useState<"iva" | "dui">("iva");
  
  // File uploading states (IVA)
  const [ivaFileBase64, setIvaFileBase64] = useState<string>("");
  const [ivaFileType, setIvaFileType] = useState<string>("");
  const [ivaFileName, setIvaFileName] = useState<string>("");
  
  // File uploading states (DUI)
  const [duiFrontBase64, setDuiFrontBase64] = useState<string>("");
  const [duiFrontType, setDuiFrontType] = useState<string>("");
  const [duiFrontName, setDuiFrontName] = useState<string>("");
  
  const [duiBackBase64, setDuiBackBase64] = useState<string>("");
  const [duiBackType, setDuiBackType] = useState<string>("");
  const [duiBackName, setDuiBackName] = useState<string>("");

  // Loading, Errors, and Modal States
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraTarget, setCameraTarget] = useState<"iva" | "duiFront" | "duiBack" | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Extracted Data States
  const [ivaData, setIvaData] = useState<ExtractedIvaData | null>(null);
  const [duiData, setDuiData] = useState<ExtractedDuiData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const duiFrontInputRef = useRef<HTMLInputElement>(null);
  const duiBackInputRef = useRef<HTMLInputElement>(null);

  // Helper to convert base64
  const getBase64 = (file: File): Promise<{ base64: string, type: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const parts = result.split(",");
        const type = file.type || "image/jpeg";
        resolve({ base64: parts[1], type });
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Process IVA file upload
  const handleIvaFile = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("El archivo supera el límite de tamaño de 10 MB.");
      return;
    }
    setIvaFileName(file.name);
    setError(null);
    setLoading(true);
    setIvaData(null);

    try {
      const { base64, type } = await getBase64(file);
      setIvaFileType(type);
      setIvaFileBase64(base64);

      const response = await fetch("/api/extract-iva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mimeType: type })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error al procesar el archivo con IA.");
      }

      const data = await response.json();
      setIvaData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No se pudo extraer la información. Asegúrate de subir una Tarjeta de IVA legible.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger unified AI Extraction for DUI (requires front)
  const extractDuiWithIa = async () => {
    if (!duiFrontBase64) {
      setError("Se requiere al menos la foto frontal del DUI para realizar la extracción.");
      return;
    }

    setLoading(true);
    setError(null);
    setDuiData(null);

    try {
      const response = await fetch("/api/extract-dui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontBase64: duiFrontBase64,
          backBase64: duiBackBase64 || undefined,
          mimeType: duiFrontType || "image/jpeg"
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Error al procesar el DUI con IA.");
      }

      const data = await response.json();
      setDuiData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al realizar el reconocimiento de datos del DUI.");
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers (IVA)
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const validTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
      if (validTypes.includes(file.type) || file.name.endsWith(".pdf")) {
        handleIvaFile(file);
      } else {
        setError("Tipo de archivo no permitido. Sube un PDF o imagen JPG/PNG.");
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleIvaFile(e.target.files[0]);
    }
  };

  const handleDuiUpload = async (e: ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { base64, type } = await getBase64(file);
      if (side === "front") {
        setDuiFrontBase64(base64);
        setDuiFrontType(type);
        setDuiFrontName(file.name);
      } else {
        setDuiBackBase64(base64);
        setDuiBackType(type);
        setDuiBackName(file.name);
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la imagen del DUI.");
    }
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyAllToClipboard = () => {
    if (docType === "iva" && ivaData) {
      const allText = `--- INFORMACIÓN DE TARJETA DE IVA ---
Nombre del Contribuyente: ${ivaData.nombreContribuyente}
No. de Identificación Tributaria (NIT): ${ivaData.nit}
Número de Registro (NRC): ${ivaData.nrc}
Giro o Actividad Económica: ${ivaData.giroActividad}
Dirección Casa Matriz: ${ivaData.direccionCasaMatriz}
Categoría de Contribuyente: ${ivaData.categoriaContribuyente}
-------------------------------------`;
      copyToClipboard(allText, "all");
    } else if (docType === "dui" && duiData) {
      const allText = `--- INFORMACIÓN DE DUI (EL SALVADOR) ---
Nombres: ${duiData.nombres}
Apellidos: ${duiData.apellidos}
DUI: ${duiData.dui}
NIT: ${duiData.nit || "No detectado"}
Fecha de Nacimiento: ${duiData.fechaNacimiento}
Lugar de Nacimiento: ${duiData.lugarNacimiento || "No detectado"}
Género: ${duiData.genero}
Vence el: ${duiData.fechaExpiracion}
Dirección Residencia: ${duiData.residencia}
Municipio: ${duiData.municipio || ""}
Departamento: ${duiData.departamento || ""}
Estado Familiar: ${duiData.estadoFamiliar || ""}
Profesión/Oficio: ${duiData.profesion || ""}
-------------------------------------`;
      copyToClipboard(allText, "all");
    }
  };

  const resetExtractor = () => {
    setIvaFileBase64("");
    setIvaFileType("");
    setIvaFileName("");
    setDuiFrontBase64("");
    setDuiFrontName("");
    setDuiBackBase64("");
    setDuiBackName("");
    setIvaData(null);
    setDuiData(null);
    setError(null);
    setIsEditing(false);
  };

  // PDF Generation for IVA or DUI
  const generatePdfReport = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "letter"
    });

    // Color Theme: Premium Slate Blue
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 215.9, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SERVICIOS CONSTELACION STORE", 15, 12);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(190, 200, 220);
    doc.text("Ficha Estructurada de Documentación e Información Fiscal", 15, 18);
    doc.text(`Generado por IA • Fecha: ${new Date().toLocaleDateString()} • Hora: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, 15, 23);

    // Decorative right-aligned stamp
    doc.setFillColor(30, 41, 59);
    doc.rect(170, 6, 30, 22, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(129, 140, 248);
    doc.text("CONSTELACION", 172, 14);
    doc.text("SISTEMAS IA", 173, 19);
    doc.text("STORE", 179, 24);

    if (docType === "iva" && ivaData) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont("Helvetica", "bold");
      doc.text("RESUMEN DE DATOS DEL CONTRIBUYENTE (IVA)", 15, 46);

      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.5);
      doc.line(15, 49, 200, 49);

      const fields = [
        { label: "NOMBRE DEL CONTRIBUYENTE", val: ivaData.nombreContribuyente },
        { label: "NÚMERO DE IDENTIFICACIÓN TRIBUTARIA (NIT)", val: ivaData.nit },
        { label: "NÚMERO DE REGISTRO (NRC)", val: ivaData.nrc },
        { label: "GIRO O ACTIVIDAD ECONÓMICA PRINCIPAL", val: ivaData.giroActividad },
        { label: "DIRECCIÓN DE CASA MATRIZ", val: ivaData.direccionCasaMatriz },
        { label: "NUEVO MUNICIPIO / DISTRITO (REFORMA 2024)", val: `${ivaData.nuevoMunicipio || "No detectado"} — Distrito: ${ivaData.distrito || "No detectado"}` },
        { label: "CATEGORÍA DE CONTRIBUYENTE", val: ivaData.categoriaContribuyente }
      ];

      let currentY = 53;
      fields.forEach((f) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 185.9, 15, "F");
        doc.setDrawColor(241, 245, 249);
        doc.rect(15, currentY, 185.9, 15, "D");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(f.label, 18, currentY + 4);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);

        const splitVal = doc.splitTextToSize(f.val || "No especificado", 175);
        doc.text(splitVal, 18, currentY + 9);
        currentY += 20;
      });

      if (ivaData.extractedNotes) {
        doc.setFillColor(254, 254, 254);
        doc.rect(15, currentY, 185.9, 15, "F");
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Observaciones adicionales del sistema:", 18, currentY + 4);
        
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const splitNotes = doc.splitTextToSize(ivaData.extractedNotes, 175);
        doc.text(splitNotes, 18, currentY + 9);
      }

      doc.save(`Resumen_IVA_${ivaData.nrc || "Contribuyente"}.pdf`);
    } else if (docType === "dui" && duiData) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont("Helvetica", "bold");
      doc.text("FICHA DE DATOS DEL CIUDADANO (DUI EL SALVADOR)", 15, 46);

      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.5);
      doc.line(15, 49, 200, 49);

      const fields = [
        { label: "NOMBRES COMPLETOS", val: duiData.nombres },
        { label: "APELLIDOS", val: duiData.apellidos },
        { label: "NÚMERO ÚNICO DE IDENTIDAD (DUI)", val: duiData.dui },
        { label: "NÚMERO DE IDENTIFICACIÓN TRIBUTARIA (NIT)", val: duiData.nit || "Unificado con el DUI" },
        { label: "FECHA Y LUGAR DE NACIMIENTO", val: `${duiData.fechaNacimiento} — ${duiData.lugarNacimiento || "No especificado"}` },
        { label: "GÉNERO / SEXO", val: duiData.genero === "M" || duiData.genero?.toUpperCase() === "MASCULINO" ? "MASCULINO (M)" : "FEMENINO (F)" },
        { label: "DIRECCIÓN DE RESIDENCIA", val: `${duiData.residencia} (${duiData.municipio || "Sin municipio"}, ${duiData.departamento || "Sin dpto"})` },
        { label: "NUEVO MUNICIPIO / DISTRITO (REFORMA 2024)", val: `${duiData.nuevoMunicipio || "No detectado"} — Distrito: ${duiData.distrito || "No detectado"}` },
        { label: "PROFESIÓN U OFICIO", val: duiData.profesion || "No especificado" },
        { label: "ESTADO FAMILIAR", val: duiData.estadoFamiliar || "No especificado" },
        { label: "FECHA DE VENCIMIENTO DEL DOCUMENTO", val: duiData.fechaExpiracion }
      ];

      let currentY = 52;
      fields.forEach((f) => {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 185.9, 12, "F");
        doc.setDrawColor(241, 245, 249);
        doc.rect(15, currentY, 185.9, 12, "D");

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(f.label, 18, currentY + 3.5);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);

        const splitVal = doc.splitTextToSize(f.val || "No especificado", 175);
        doc.text(splitVal, 18, currentY + 8);
        currentY += 15;
      });

      doc.save(`Ficha_DUI_${duiData.dui || "Ciudadano"}.pdf`);
    }

    // Border around sheet
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.rect(5, 5, 205.9, 269.4, "D");
  };

  // Download structured row as Excel compatible CSV (Innovative Feature A!)
  const downloadCsvRow = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (docType === "iva" && ivaData) {
      const headers = ["Nombre Contribuyente", "NIT", "NRC", "Giro", "Direccion Casa Matriz", "Nuevo Municipio", "Distrito", "Categoria"].join(",");
      const row = [
        `"${ivaData.nombreContribuyente.replace(/"/g, '""')}"`,
        `"${ivaData.nit}"`,
        `"${ivaData.nrc}"`,
        `"${ivaData.giroActividad.replace(/"/g, '""')}"`,
        `"${ivaData.direccionCasaMatriz.replace(/"/g, '""')}"`,
        `"${(ivaData.nuevoMunicipio || "").replace(/"/g, '""')}"`,
        `"${(ivaData.distrito || "").replace(/"/g, '""')}"`,
        `"${ivaData.categoriaContribuyente}"`
      ].join(",");
      csvContent += headers + "\n" + row;
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Fila_Fiscal_IVA_${ivaData.nrc}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (docType === "dui" && duiData) {
      const headers = ["Nombres", "Apellidos", "DUI", "NIT", "Fecha Nacimiento", "Lugar Nacimiento", "Genero", "Expiracion", "Direccion", "Municipio", "Departamento", "Nuevo Municipio", "Distrito", "Estado Familiar", "Profesion"].join(",");
      const row = [
        `"${duiData.nombres.replace(/"/g, '""')}"`,
        `"${duiData.apellidos.replace(/"/g, '""')}"`,
        `"${duiData.dui}"`,
        `"${duiData.nit || ""}"`,
        `"${duiData.fechaNacimiento}"`,
        `"${(duiData.lugarNacimiento || "").replace(/"/g, '""')}"`,
        `"${duiData.genero}"`,
        `"${duiData.fechaExpiracion}"`,
        `"${duiData.residencia.replace(/"/g, '""')}"`,
        `"${(duiData.municipio || "").replace(/"/g, '""')}"`,
        `"${(duiData.departamento || "").replace(/"/g, '""')}"`,
        `"${(duiData.nuevoMunicipio || "").replace(/"/g, '""')}"`,
        `"${(duiData.distrito || "").replace(/"/g, '""')}"`,
        `"${duiData.estadoFamiliar || ""}"`,
        `"${(duiData.profesion || "").replace(/"/g, '""')}"`
      ].join(",");
      csvContent += headers + "\n" + row;

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Fila_DUI_${duiData.dui}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Check if DUI is expired (Innovative Feature B: Validation Alerts)
  const getDuiValidationAlerts = () => {
    if (docType !== "dui" || !duiData) return null;
    
    const alerts = [];
    const expiryStr = duiData.fechaExpiracion; // DD/MM/AAAA or standard formats
    
    // Attempt parsing date
    try {
      const parts = expiryStr.split("/");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed
        const year = parseInt(parts[2], 10);
        const expiryDate = new Date(year, month, day);
        const today = new Date();
        
        if (expiryDate < today) {
          alerts.push({
            type: "error",
            msg: `⚠️ ESTE DOCUMENTO ESTÁ EXPIRADO (Venció el ${expiryStr}). No se recomienda usar para actas legales.`
          });
        } else {
          // If less than 6 months to expire
          const sixMonthsFromNow = new Date();
          sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
          if (expiryDate < sixMonthsFromNow) {
            alerts.push({
              type: "warning",
              msg: `⚠️ Próximo a vencer en menos de 6 meses (Vence el ${expiryStr}). Sugerir renovación al cliente.`
            });
          }
        }
      }
    } catch (e) {
      // Date parse error
    }

    // DUI checksum validator
    const duiClean = duiData.dui.replace(/[^0-9]/g, "");
    if (duiClean.length === 9) {
      let sum = 0;
      for (let i = 0; i < 8; i++) {
        sum += parseInt(duiClean[i], 10) * (9 - i);
      }
      const rem = sum % 10;
      const checkDigit = (10 - rem) % 10;
      const actualCheck = parseInt(duiClean[8], 10);
      if (checkDigit !== actualCheck) {
        alerts.push({
          type: "warning",
          msg: "⚠️ El dígito verificador del DUI parece no coincidir con el formato estándar. Verifica que el número sea correcto."
        });
      }
    }

    return alerts;
  };

  // Simplificador de Giro (AI explanation of economic activity - Innovative Feature C!)
  const getSimplifiedGiro = (giro: string) => {
    if (!giro) return null;
    const lower = giro.toLowerCase();
    if (lower.includes("vias de navegacion") || lower.includes("transporte maritimo")) {
      return "Transporte en barcos o lanchas.";
    }
    if (lower.includes("hilados") || lower.includes("tejidos") || lower.includes("prendas de vestir")) {
      return "Venta de ropa, telas o costura.";
    }
    if (lower.includes("al por menor de otros productos") || lower.includes("bazar") || lower.includes("variedades")) {
      return "Tienda de variedades, bazar o librería.";
    }
    if (lower.includes("servicio de comida") || lower.includes("restaurante") || lower.includes("pupuseria")) {
      return "Pupusería, restaurante o venta de alimentos.";
    }
    if (lower.includes("mantenimiento") || lower.includes("reparacion de vehiculos")) {
      return "Taller mecánico o venta de repuestos.";
    }
    if (lower.includes("cultivo de") || lower.includes("agricultura")) {
      return "Siembra y agricultura.";
    }
    return "Comercio de productos o servicios generales.";
  };

  // Handler when photo captured by camera
  const handleCameraCapture = (base64: string) => {
    if (!cameraTarget) return;

    if (cameraTarget === "iva") {
      setIvaFileBase64(base64);
      setIvaFileType("image/jpeg");
      setIvaFileName(`Foto_Capturada_IVA_${new Date().getTime()}.jpg`);
      setError(null);
      setLoading(true);

      fetch("/api/extract-iva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mimeType: "image/jpeg" })
      })
        .then((res) => {
          if (!res.ok) throw new Error("Error en extracción.");
          return res.json();
        })
        .then((data) => setIvaData(data))
        .catch((err) => {
          console.error(err);
          setError("No se pudo extraer datos de la foto capturada. Reintenta con más iluminación.");
        })
        .finally(() => setLoading(false));
    } else if (cameraTarget === "duiFront") {
      setDuiFrontBase64(base64);
      setDuiFrontType("image/jpeg");
      setDuiFrontName(`Foto_DUI_Frente_${new Date().getTime()}.jpg`);
    } else if (cameraTarget === "duiBack") {
      setDuiBackBase64(base64);
      setDuiBackType("image/jpeg");
      setDuiBackName(`Foto_DUI_Atras_${new Date().getTime()}.jpg`);
    }

    setCameraTarget(null);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-black px-3 py-1 rounded-full uppercase tracking-wider">
            Reconocimiento de Documentos por IA (OCR Multi-Documento)
          </span>
          <h2 className="font-display font-black text-2xl mt-2 text-slate-900">
            Extractor Inteligente de Documentos
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Reconoce y digitaliza al instante tarjetas de IVA o DUIs utilizando la cámara o subiendo archivos.
          </p>
        </div>

        {(ivaData || duiData) && (
          <button
            onClick={resetExtractor}
            className="self-start md:self-center py-2.5 px-4 bg-slate-100 border border-slate-200 hover:bg-slate-200/70 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
            Escanear Otro Documento
          </button>
        )}
      </div>

      {/* DOCUMENT TYPE SELECTOR TOGGLE (DUI vs IVA) */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex max-w-md border border-slate-200">
        <button
          type="button"
          onClick={() => {
            if (!loading) {
              setDocType("iva");
              resetExtractor();
            }
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            docType === "iva"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building className="w-4 h-4" />
          Tarjeta de IVA
        </button>
        <button
          type="button"
          onClick={() => {
            if (!loading) {
              setDocType("dui");
              resetExtractor();
            }
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            docType === "dui"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <User className="w-4 h-4" />
          DUI (Identidad El Salvador)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: CAMERA CAPTURE / FILE UPLOADING STAGE */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-sm text-slate-800">
              {docType === "iva" ? "Captura de Tarjeta de IVA" : "Captura de Documento Único de Identidad (DUI)"}
            </h3>

            {docType === "iva" ? (
              /* IVA STAGE (SINGLE FILE) */
              !ivaFileBase64 ? (
                <div className="space-y-3">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all flex flex-col items-center justify-center min-h-[220px] ${
                      isDragging 
                        ? "border-indigo-500 bg-indigo-50/20" 
                        : "border-slate-200 hover:border-slate-350 bg-slate-50/50"
                    }`}
                  >
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Adjunta tu Tarjeta de IVA
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-normal">
                      Arrastra una foto o PDF aquí, o usa los botones de abajo para capturar.
                    </p>

                    <div className="flex gap-2 mt-4 w-full justify-center">
                      <button
                        type="button"
                        onClick={() => setCameraTarget("iva")}
                        className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        Usar Cámara
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2 px-3.5 bg-slate-200 hover:bg-slate-350 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Subir Archivo
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, application/pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50 space-y-3 relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 truncate">{ivaFileName}</p>
                      <p className="text-[9px] text-slate-450 uppercase font-bold mt-0.5">
                        {ivaFileType === "application/pdf" ? "Documento PDF" : "Foto Capturada"}
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 bg-white rounded-lg p-2 flex items-center justify-center min-h-[160px] max-h-[220px] overflow-hidden">
                    {ivaFileType === "application/pdf" ? (
                      <div className="text-center p-4">
                        <FileSearch className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-500">Vista Previa de PDF</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Documento adjunto listo para extraer</p>
                      </div>
                    ) : (
                      <img
                        src={`data:${ivaFileType};base64,${ivaFileBase64}`}
                        alt="Vista previa Tarjeta IVA"
                        className="max-h-[200px] object-contain rounded"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                </div>
              )
            ) : (
              /* DUI STAGE (TWO FILES: FRONT AND BACK) */
              <div className="space-y-4">
                
                {/* DUI FRONT SLOT */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Foto Frente del DUI (Obligatorio)</span>
                  
                  {duiFrontBase64 ? (
                    <div className="relative border border-slate-200 bg-white rounded-lg p-1.5 flex items-center justify-center h-28 overflow-hidden group">
                      <img src={`data:${duiFrontType};base64,${duiFrontBase64}`} alt="DUI Frente" className="h-full object-contain rounded" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => { setDuiFrontBase64(""); setDuiFrontName(""); }}
                        className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Quitar"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1 left-1.5 text-[8px] bg-indigo-900 text-indigo-100 font-bold px-1 py-0.5 rounded uppercase">FRENTE</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraTarget("duiFront")}
                        className="flex-1 py-4 bg-indigo-50 border border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100/20 text-indigo-700 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold cursor-pointer"
                      >
                        <Camera className="w-5 h-5 text-indigo-600" />
                        <span>Tomar Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => duiFrontInputRef.current?.click()}
                        className="flex-1 py-4 bg-slate-50 border border-dashed border-slate-200 hover:border-slate-450 hover:bg-slate-100 text-slate-600 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold cursor-pointer"
                      >
                        <Upload className="w-5 h-5 text-slate-450" />
                        <span>Subir Archivo</span>
                      </button>
                      <input ref={duiFrontInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleDuiUpload(e, "front")} />
                    </div>
                  )}
                </div>

                {/* DUI BACK SLOT */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2. Foto Reverso del DUI (Opcional)</span>
                    <span className="text-[8px] bg-slate-100 text-slate-400 font-bold px-1.5 py-0.5 rounded uppercase">Para leer NIT</span>
                  </div>
                  
                  {duiBackBase64 ? (
                    <div className="relative border border-slate-200 bg-white rounded-lg p-1.5 flex items-center justify-center h-28 overflow-hidden group">
                      <img src={`data:${duiBackType};base64,${duiBackBase64}`} alt="DUI Reverso" className="h-full object-contain rounded" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => { setDuiBackBase64(""); setDuiBackName(""); }}
                        className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Quitar"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1 left-1.5 text-[8px] bg-amber-900 text-amber-100 font-bold px-1 py-0.5 rounded uppercase">REVERSO</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraTarget("duiBack")}
                        className="flex-1 py-4 bg-indigo-50 border border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100/20 text-indigo-700 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold cursor-pointer"
                      >
                        <Camera className="w-5 h-5 text-indigo-600" />
                        <span>Tomar Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => duiBackInputRef.current?.click()}
                        className="flex-1 py-4 bg-slate-50 border border-dashed border-slate-200 hover:border-slate-450 hover:bg-slate-100 text-slate-600 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold cursor-pointer"
                      >
                        <Upload className="w-5 h-5 text-slate-450" />
                        <span>Subir Archivo</span>
                      </button>
                      <input ref={duiBackInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleDuiUpload(e, "back")} />
                    </div>
                  )}
                </div>

                {/* Extraction action trigger */}
                {duiFrontBase64 && !duiData && (
                  <button
                    onClick={extractDuiWithIa}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer transition-all hover:-translate-y-0.5"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-bounce" />
                    Extraer Datos del DUI con IA
                  </button>
                )}

              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 p-3.5 rounded-xl text-xs text-red-700 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Error de Extracción:</span>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
            <h4 className="font-display font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-100" />
              Soporte de Cámara y Movilidad
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Puedes digitalizar las tarjetas tomándoles fotos directamente desde la cámara de tu celular o computadora. Para mayor nitidez, evita sombras y encuadra el documento en la guía punteada.
            </p>
          </div>

        </div>

        {/* RIGHT COLUMN: INTERACTIVE FORM EDITING & EXPORT MODULE */}
        <div className="lg:col-span-7">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm min-h-[350px] flex flex-col">
            
            {/* Results Title and Interactive Options */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
              <h3 className="font-display font-bold text-sm text-slate-800">
                Ficha del Cliente en Formato Estructurado
              </h3>
              
              {(ivaData || duiData) && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border cursor-pointer ${
                      isEditing
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                    title={isEditing ? "Guardar cambios" : "Editar Ficha de Datos"}
                  >
                    {isEditing ? (
                      <>
                        <Save className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Guardar</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={downloadCsvRow}
                    className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer"
                    title="Exportar a base de datos CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Exportar CSV</span>
                  </button>

                  <button
                    onClick={generatePdfReport}
                    className="py-1.5 px-2.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/70 rounded-lg text-xs font-bold text-indigo-700 flex items-center gap-1 cursor-pointer"
                    title="Imprimir resumen estructurado"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir</span>
                  </button>
                </div>
              )}
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <span className="text-sm font-bold text-slate-700">Digitalizando Documento con Gemini AI...</span>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Llamando al modelo multimodal en tiempo real para digitalizar todos los campos fiscales estructurados.
                </p>
              </div>
            )}

            {/* Empty state when no data */}
            {!loading && !ivaData && !duiData && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-bold text-slate-500">Sin Datos para Mostrar</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                  {docType === "iva" 
                    ? "Sube la tarjeta de IVA o tómale una foto para iniciar la lectura fiscal."
                    : "Registra el Frente de tu DUI y presiona el botón Extraer."}
                </p>
              </div>
            )}

            {/* RENDER DYNAMIC SYSTEM ALERTS (Innovative Feature B) */}
            {!loading && duiData && getDuiValidationAlerts() && (
              <div className="space-y-2 mb-4 animate-fadeIn">
                {getDuiValidationAlerts()?.map((alert, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border text-[11px] font-semibold flex items-start gap-2 ${
                      alert.type === "error" 
                        ? "bg-red-50 border-red-100 text-red-700" 
                        : "bg-amber-50 border-amber-100 text-amber-700"
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{alert.msg}</p>
                  </div>
                ))}
              </div>
            )}

            {/* RENDER TARJETA DE IVA FORM OR DUI FORM */}
            {!loading && docType === "iva" && ivaData && (
              <div className="space-y-4 animate-fadeIn">
                
                {/* 1. Nombre */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Nombre del Contribuyente</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={ivaData.nombreContribuyente} 
                      onChange={(e) => setIvaData({ ...ivaData, nombreContribuyente: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-xs font-bold text-slate-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">{ivaData.nombreContribuyente || "No detectado"}</span>
                      <button onClick={() => copyToClipboard(ivaData.nombreContribuyente, "nombre")} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                        {copiedField === "nombre" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 2. NIT */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">No. Identificación Tributaria (NIT)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={ivaData.nit} 
                        onChange={(e) => setIvaData({ ...ivaData, nit: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-slate-800">{ivaData.nit || "No detectado"}</span>
                        <button onClick={() => copyToClipboard(ivaData.nit, "nit")} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                          {copiedField === "nit" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. NRC */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Número de Registro (NRC)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={ivaData.nrc} 
                        onChange={(e) => setIvaData({ ...ivaData, nrc: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-slate-800">{ivaData.nrc || "No detectado"}</span>
                        <button onClick={() => copyToClipboard(ivaData.nrc, "nrc")} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                          {copiedField === "nrc" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Giro */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Giro o Actividad Económica (Ministerio de Hacienda)</span>
                  {isEditing ? (
                    <textarea 
                      value={ivaData.giroActividad} 
                      onChange={(e) => setIvaData({ ...ivaData, giroActividad: e.target.value })}
                      className="w-full h-16 bg-white border border-slate-200 text-xs text-slate-800 p-2 rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-slate-800 leading-normal pr-6">{ivaData.giroActividad || "No detectado"}</span>
                        <button onClick={() => copyToClipboard(ivaData.giroActividad, "giro")} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                          {copiedField === "giro" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      
                      {/* Innovative Feature C: Simplified Giro explanation */}
                      {getSimplifiedGiro(ivaData.giroActividad) && (
                        <div className="text-[10px] text-indigo-600 bg-indigo-50/55 p-1.5 rounded inline-flex items-center gap-1 font-bold">
                          <HelpCircle className="w-3 h-3" />
                          <span>IA Simplifica Giro: {getSimplifiedGiro(ivaData.giroActividad)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Dirección */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Dirección de Casa Matriz</span>
                  {isEditing ? (
                    <textarea 
                      value={ivaData.direccionCasaMatriz} 
                      onChange={(e) => setIvaData({ ...ivaData, direccionCasaMatriz: e.target.value })}
                      className="w-full h-16 bg-white border border-slate-200 text-xs text-slate-800 p-2 rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-slate-800 leading-normal pr-6">{ivaData.direccionCasaMatriz || "No detectado"}</span>
                      <button onClick={() => copyToClipboard(ivaData.direccionCasaMatriz, "direccion")} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                        {copiedField === "direccion" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 5b. Distrito y Nuevo Municipio (Reforma 25) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/60 relative group">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase block mb-1">Nuevo Municipio (Ley 2024)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={ivaData.nuevoMunicipio || ""} 
                        onChange={(e) => setIvaData({ ...ivaData, nuevoMunicipio: e.target.value })}
                        className="w-full bg-white border border-indigo-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-950">{ivaData.nuevoMunicipio || "Cargando..."}</span>
                        <button onClick={() => copyToClipboard(ivaData.nuevoMunicipio || "", "nuevo_m")} className="p-1 hover:bg-indigo-100 rounded text-indigo-400">
                          {copiedField === "nuevo_m" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/60 relative group">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase block mb-1">Distrito correspondiente (Antiguo Municipio)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={ivaData.distrito || ""} 
                        onChange={(e) => setIvaData({ ...ivaData, distrito: e.target.value })}
                        className="w-full bg-white border border-indigo-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-950">{ivaData.distrito || "Cargando..."}</span>
                        <button onClick={() => copyToClipboard(ivaData.distrito || "", "distr")} className="p-1 hover:bg-indigo-100 rounded text-indigo-400">
                          {copiedField === "distr" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Categoría */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Categoría del Contribuyente</span>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={ivaData.categoriaContribuyente} 
                      onChange={(e) => setIvaData({ ...ivaData, categoriaContribuyente: e.target.value })}
                      className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">{ivaData.categoriaContribuyente || "No detectado"}</span>
                      <button onClick={() => copyToClipboard(ivaData.categoriaContribuyente, "categoria")} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition-colors">
                        {copiedField === "categoria" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* RENDER DUI RECONOCIDO FORM */}
            {!loading && docType === "dui" && duiData && (
              <div className="space-y-4 animate-fadeIn">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombres */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Nombres del Ciudadano</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.nombres} 
                        onChange={(e) => setDuiData({ ...duiData, nombres: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">{duiData.nombres}</span>
                        <button onClick={() => copyToClipboard(duiData.nombres, "nomb")} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                          {copiedField === "nomb" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Apellidos */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Apellidos</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.apellidos} 
                        onChange={(e) => setDuiData({ ...duiData, apellidos: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">{duiData.apellidos}</span>
                        <button onClick={() => copyToClipboard(duiData.apellidos, "apel")} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                          {copiedField === "apel" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DUI */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">DUI</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.dui} 
                        onChange={(e) => setDuiData({ ...duiData, dui: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-slate-800">{duiData.dui}</span>
                        <button onClick={() => copyToClipboard(duiData.dui, "dui")} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                          {copiedField === "dui" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* NIT */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">NIT</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.nit} 
                        onChange={(e) => setDuiData({ ...duiData, nit: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs font-mono text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono text-slate-700">{duiData.nit || "Unificado"}</span>
                        <button onClick={() => copyToClipboard(duiData.nit || "", "nit")} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                          {copiedField === "nit" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fecha Nacimiento */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Fecha de Nacimiento</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.fechaNacimiento} 
                        onChange={(e) => setDuiData({ ...duiData, fechaNacimiento: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <span className="text-xs text-slate-800">{duiData.fechaNacimiento}</span>
                    )}
                  </div>

                  {/* Vencimiento */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Fecha de Expiración (Vence)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.fechaExpiracion} 
                        onChange={(e) => setDuiData({ ...duiData, fechaExpiracion: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <span className="text-xs text-slate-800 font-bold">{duiData.fechaExpiracion}</span>
                    )}
                  </div>
                </div>

                {/* Dirección Completa */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Dirección de Residencia</span>
                  {isEditing ? (
                    <textarea 
                      value={duiData.residencia} 
                      onChange={(e) => setDuiData({ ...duiData, residencia: e.target.value })}
                      className="w-full h-16 bg-white border border-slate-200 text-xs text-slate-800 p-2 rounded resize-none focus:outline-none"
                    />
                  ) : (
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-slate-800 leading-normal">{duiData.residencia}</span>
                      <button onClick={() => copyToClipboard(duiData.residencia, "res")} className="p-1 hover:bg-slate-200 rounded text-slate-400">
                        {copiedField === "res" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Nuevo Municipio y Distrito 2024 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/60 relative group">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase block mb-1">Nuevo Municipio (Ley 2024)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.nuevoMunicipio || ""} 
                        onChange={(e) => setDuiData({ ...duiData, nuevoMunicipio: e.target.value })}
                        className="w-full bg-white border border-indigo-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-950">{duiData.nuevoMunicipio || "Cargando..."}</span>
                        <button onClick={() => copyToClipboard(duiData.nuevoMunicipio || "", "nuevo_m_dui")} className="p-1 hover:bg-indigo-100 rounded text-indigo-400">
                          {copiedField === "nuevo_m_dui" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/60 relative group">
                    <span className="text-[9px] text-indigo-500 font-bold uppercase block mb-1">Distrito correspondiente (Antiguo Municipio)</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.distrito || ""} 
                        onChange={(e) => setDuiData({ ...duiData, distrito: e.target.value })}
                        className="w-full bg-white border border-indigo-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-950">{duiData.distrito || "Cargando..."}</span>
                        <button onClick={() => copyToClipboard(duiData.distrito || "", "distr_dui")} className="p-1 hover:bg-indigo-100 rounded text-indigo-400">
                          {copiedField === "distr_dui" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Profesión */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Profesión u Oficio</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.profesion} 
                        onChange={(e) => setDuiData({ ...duiData, profesion: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <span className="text-xs text-slate-800">{duiData.profesion || "No especificado"}</span>
                    )}
                  </div>

                  {/* Estado Familiar */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Estado Familiar / Civil</span>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={duiData.estadoFamiliar} 
                        onChange={(e) => setDuiData({ ...duiData, estadoFamiliar: e.target.value })}
                        className="w-full bg-white border border-slate-200 text-xs text-slate-800 p-1.5 rounded focus:outline-none"
                      />
                    ) : (
                      <span className="text-xs text-slate-800">{duiData.estadoFamiliar || "No especificado"}</span>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Helper tips when empty */}
            {!loading && !ivaData && !duiData && (
              <div className="mt-auto border-t border-slate-100 pt-4 flex gap-3 text-[11px] text-slate-500 leading-normal">
                <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5 fill-indigo-100" />
                <p>
                  Tecnología de lectura inteligente y automatización optimizada para <strong className="text-slate-700">Servicios Constelacion Store</strong>. Permite guardar, digitalizar y agilizar trámites para el contribuyente o ciudadano de manera ágil y 100% precisa.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* CAMERA CAPTURE MODAL PORTAL */}
      {cameraTarget && (
        <CameraCapture
          title={`Tomar Foto para ${
            cameraTarget === "iva" ? "Tarjeta de IVA" :
            cameraTarget === "duiFront" ? "Frente del DUI" : "Reverso del DUI"
          }`}
          onCapture={handleCameraCapture}
          onClose={() => setCameraTarget(null)}
        />
      )}

    </div>
  );
}

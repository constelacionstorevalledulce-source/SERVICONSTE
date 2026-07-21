import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request size limit for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Shared Gemini client setup
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API Routes
app.post("/api/enhance-document", async (req: express.Request, res: express.Response) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Falta la imagen en base64" });
    }

    // Call Gemini 3.6-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        "Analiza detalladamente este documento de identidad (usualmente DUI de El Salvador u otro similar). Extrae los datos y evalúa la calidad visual de la imagen para recomendar ajustes de brillo, contraste, escala de grises y binarización con el fin de mejorar su legibilidad al imprimir.",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING, description: "Tipo de documento detectado" },
            extractedInfo: {
              type: Type.OBJECT,
              properties: {
                duiNumber: { type: Type.STRING, description: "Número de DUI o ID" },
                fullName: { type: Type.STRING, description: "Nombre completo" },
                dob: { type: Type.STRING, description: "Fecha de nacimiento o expedición" },
                expiryDate: { type: Type.STRING, description: "Fecha de vencimiento" },
                department: { type: Type.STRING, description: "Departamento/Municipio o dirección relevante" },
              },
            },
            textTranscription: { type: Type.STRING, description: "Transcripción completa del texto legible" },
            visualAnalysis: { type: Type.STRING, description: "Análisis de calidad visual (ej. oscuro, con sombras, de lado)" },
            recommendedFilters: {
              type: Type.OBJECT,
              properties: {
                brightness: { type: Type.INTEGER, description: "Ajuste de brillo recomendado (-100 a 100, donde 0 es sin cambio)" },
                contrast: { type: Type.INTEGER, description: "Ajuste de contraste recomendado (-100 a 100, donde 0 es sin cambio)" },
                grayscale: { type: Type.BOOLEAN, description: "Si se recomienda convertir a escala de grises" },
                binarize: { type: Type.BOOLEAN, description: "Si se recomienda binarizar (convertir a blanco y negro puro) para impresión láser" },
                binarizeThreshold: { type: Type.INTEGER, description: "Umbral recomendado para binarizar (0-255, típicamente 120-140)" },
                rotateDegrees: { type: Type.INTEGER, description: "Ángulo de rotación recomendado para alinear (0, 90, 180, 270 o ajuste fino)" },
              },
              required: ["brightness", "contrast", "grayscale", "binarize", "binarizeThreshold", "rotateDegrees"],
            },
          },
          required: ["documentType", "extractedInfo", "textTranscription", "visualAnalysis", "recommendedFilters"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se obtuvo respuesta de Gemini");
    }

    const resultJson = JSON.parse(resultText.trim());
    return res.json(resultJson);
  } catch (error: any) {
    console.error("Error en enhance-document:", error);
    return res.status(500).json({ error: error.message || "Error al procesar el documento con IA" });
  }
});

// Endpoint to automatically detect ID card boundaries (DUI crop)
app.post("/api/detect-card-bounds", async (req: express.Request, res: express.Response) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Falta la imagen en base64" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
        "Analiza detenidamente esta imagen que contiene un documento de identidad (como un DUI de El Salvador). Identifica las coordenadas del borde exacto de la tarjeta de identificación principal para recortarla y descartar el fondo (mesa, manos o bordes vacíos). Proporciona las coordenadas en porcentajes de la imagen original (0 a 100): top, left, width, height. Sé extremadamente preciso para que el recorte contenga exactamente la tarjeta de borde a borde sin salirse.",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            top: { type: Type.NUMBER, description: "Distancia desde el borde superior de la imagen (0-100)" },
            left: { type: Type.NUMBER, description: "Distancia desde el borde izquierdo de la imagen (0-100)" },
            width: { type: Type.NUMBER, description: "Ancho de la tarjeta como porcentaje de la imagen (0-100)" },
            height: { type: Type.NUMBER, description: "Alto de la tarjeta como porcentaje de la imagen (0-100)" },
            confidence: { type: Type.NUMBER, description: "Nivel de confianza en la detección (0-1)" }
          },
          required: ["top", "left", "width", "height"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se obtuvo respuesta de Gemini");
    }

    const resultJson = JSON.parse(resultText.trim());
    return res.json(resultJson);
  } catch (error: any) {
    console.error("Error en detect-card-bounds:", error);
    return res.status(500).json({ error: error.message || "Error al detectar bordes de la tarjeta con IA" });
  }
});

// Endpoint to extract taxpayer information from Tarjeta de IVA (PDF or Image)
app.post("/api/extract-iva", async (req: express.Request, res: express.Response) => {
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "Falta el archivo en base64" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: fileBase64,
          },
        },
        "Extrae con precisión la información de esta Tarjeta de IVA. Adicionalmente, analiza la dirección de la Casa Matriz del contribuyente e investiga a qué NUEVO MUNICIPIO (de los 44 nuevos municipios aprobados en la Ley de Reestructuración Territorial de El Salvador de 2024, por ejemplo: San Salvador Centro, San Salvador Oeste, La Libertad Este, La Libertad Sur, Santa Ana Centro) y a qué DISTRITO (antiguo municipio, por ejemplo: Apopa, Mejicanos, Santa Tecla, Antiguo Cuscatlán, San Salvador) corresponde dicha dirección. Rellena los campos correspondientes.",
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombreContribuyente: { type: Type.STRING, description: "Nombre del Contribuyente o Razón Social" },
            nit: { type: Type.STRING, description: "No. de Identificación Tributaria o NIT" },
            nrc: { type: Type.STRING, description: "Número de Registro de Contribuyente (NRC)" },
            giroActividad: { type: Type.STRING, description: "Giro o Actividad Económica Principal/Primaria" },
            direccionCasaMatriz: { type: Type.STRING, description: "Dirección de la Casa Matriz del contribuyente" },
            categoriaContribuyente: { type: Type.STRING, description: "Categoría del contribuyente (ej: Pequeño, Mediano, Grande, etc.)" },
            nuevoMunicipio: { type: Type.STRING, description: "Nuevo Municipio según reforma de El Salvador 2024 (ej: San Salvador Oeste, San Salvador Centro, La Libertad Este, etc.)" },
            distrito: { type: Type.STRING, description: "Distrito municipal correspondiente según reforma de El Salvador 2024 (antiguo municipio, ej: Apopa, Mejicanos, Antiguo Cuscatlán)" },
            extractedNotes: { type: Type.STRING, description: "Otros detalles o notas importantes de la tarjeta" }
          },
          required: ["nombreContribuyente", "nit", "nrc", "giroActividad", "direccionCasaMatriz", "categoriaContribuyente", "nuevoMunicipio", "distrito"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se obtuvo respuesta de Gemini");
    }

    const resultJson = JSON.parse(resultText.trim());
    return res.json(resultJson);
  } catch (error: any) {
    console.error("Error en extract-iva:", error);
    return res.status(500).json({ error: error.message || "Error al extraer datos de la tarjeta de IVA" });
  }
});

// Endpoint to extract Salvadoran DUI fields with high-precision from front and/or back images
app.post("/api/extract-dui", async (req: express.Request, res: express.Response) => {
  try {
    const { frontBase64, backBase64, mimeType } = req.body;
    if (!frontBase64) {
      return res.status(400).json({ error: "Falta al menos la foto frontal en base64" });
    }

    const contentsArray: any[] = [];
    
    // Add front image
    contentsArray.push({
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: frontBase64,
      }
    });

    // Add back image if present
    if (backBase64) {
      contentsArray.push({
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: backBase64,
        }
      });
    }

    // Add prompt
    contentsArray.push(
      "Extrae con extrema precisión la información de este Documento Único de Identidad (DUI) de El Salvador a partir de la(s) foto(s) de frente y/o atrás adjuntas. Adicionalmente, analiza la dirección de residencia del ciudadano e investiga a qué NUEVO MUNICIPIO (de los 44 nuevos municipios vigentes desde 2024, por ejemplo: San Salvador Centro, San Salvador Oeste, La Libertad Sur, La Libertad Este, Santa Ana Centro) y a qué DISTRITO (antiguo municipio, por ejemplo: Apopa, Mejicanos, Santa Tecla, Antiguo Cuscatlán, Nejapa) pertenece. Recuerda que Apopa es distrito de San Salvador Oeste; Mejicanos y Ayutuxtepeque son distritos de San Salvador Centro; Antiguo Cuscatlán y Santa Tecla son distritos de La Libertad Sur; etc. Proporciona el NIT si aparece en el reverso (formato de 14 dígitos con guiones)."
    );

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: contentsArray,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombres: { type: Type.STRING, description: "Nombres del ciudadano" },
            apellidos: { type: Type.STRING, description: "Apellidos del ciudadano" },
            dui: { type: Type.STRING, description: "Número de DUI (formato xxxxxxxx-x)" },
            nit: { type: Type.STRING, description: "NIT de 14 dígitos, usualmente en el reverso, o el DUI unificado" },
            fechaNacimiento: { type: Type.STRING, description: "Fecha de nacimiento (ej. DD/MM/AAAA)" },
            lugarNacimiento: { type: Type.STRING, description: "Lugar de nacimiento (Municipio, Departamento)" },
            genero: { type: Type.STRING, description: "Género o sexo: Masculino (M) o Femenino (F)" },
            fechaExpiracion: { type: Type.STRING, description: "Fecha de expiración o vencimiento (ej. DD/MM/AAAA)" },
            residencia: { type: Type.STRING, description: "Dirección completa de residencia" },
            municipio: { type: Type.STRING, description: "Municipio de residencia (anterior)" },
            departamento: { type: Type.STRING, description: "Departamento de residencia" },
            nuevoMunicipio: { type: Type.STRING, description: "Nuevo Municipio 2024 (ej: San Salvador Oeste, San Salvador Centro, La Libertad Sur, etc.)" },
            distrito: { type: Type.STRING, description: "Distrito municipal 2024 (antiguo municipio de residencia, ej: Apopa, Mejicanos, Santa Tecla, etc.)" },
            estadoFamiliar: { type: Type.STRING, description: "Estado familiar o civil (Soltero, Casado, Acompañado, etc.)" },
            profesion: { type: Type.STRING, description: "Profesión u Oficio" },
            extractedNotes: { type: Type.STRING, description: "Cualquier otra observación o datos ilegibles" }
          },
          required: ["nombres", "apellidos", "dui", "fechaNacimiento", "genero", "fechaExpiracion", "residencia", "nuevoMunicipio", "distrito"],
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se obtuvo respuesta de Gemini");
    }

    const resultJson = JSON.parse(resultText.trim());
    return res.json(resultJson);
  } catch (error: any) {
    console.error("Error en extract-dui:", error);
    return res.status(500).json({ error: error.message || "Error al extraer datos del DUI" });
  }
});

// Endpoint to generate beautiful poetic or formal dedications for memorable portraits
app.post("/api/generate-dedication", async (req: express.Request, res: express.Response) => {
  try {
    const { name, theme, customDetails } = req.body;
    if (!name || !theme) {
      return res.status(400).json({ error: "Faltan datos obligatorios (nombre o tema)" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Escribe una dedicatoria hermosa, sumamente respetuosa, poética y elegante para imprimir en un cuadro/retrato conmemorativo o de felicitación.
      Nombre de la persona: ${name}
      Tema del cuadro: ${theme}
      Detalles adicionales: ${customDetails || "Ninguno"}
      
      La dedicatoria debe ser de extensión moderada (30 a 70 palabras), ideal para lucir en un diseño ornamental con tipografía elegante. Redáctala con mucho sentimiento y refinamiento en español de El Salvador. Proporciona también un título sugerido corto (2 a 5 palabras).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título sugerido para el cuadro (ej. En Memoria Eterna, Triunfo de Graduación)" },
            dedicationText: { type: Type.STRING, description: "La dedicatoria redactada de forma poética y elegante" }
          },
          required: ["title", "dedicationText"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se obtuvo respuesta de Gemini");
    }

    const resultJson = JSON.parse(resultText.trim());
    return res.json(resultJson);
  } catch (error: any) {
    console.error("Error en generate-dedication:", error);
    return res.status(500).json({ error: error.message || "Error al redactar dedicatoria con IA" });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

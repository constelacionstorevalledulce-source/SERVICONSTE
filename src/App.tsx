/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, Grid, Maximize2, Calculator, Printer, 
  HelpCircle, ChevronRight, Settings, Info, SearchCode, FileSearch, Sparkles
} from "lucide-react";
import DuiMerger from "./components/DuiMerger";
import IvaExtractor from "./components/IvaExtractor";
import TemplatesPrinter from "./components/TemplatesPrinter";
import SmartPhotoResizer from "./components/SmartPhotoResizer";
import PricingCalculator from "./components/PricingCalculator";
import CreativeStudio from "./components/CreativeStudio";

type TabId = "dui" | "iva" | "templates" | "custom_photo" | "calculator" | "creative_studio";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("dui");

  const tabList = [
    {
      id: "dui",
      label: "Alineador de DUI / ID",
      description: "Frente y reverso al 150% en una sola página",
      icon: FileText,
      color: "text-blue-600 bg-blue-50"
    },
    {
      id: "iva",
      label: "Extractor de IVA / DUI",
      description: "OCR inteligente para Tarjeta de IVA o DUI",
      icon: FileSearch,
      color: "text-indigo-600 bg-indigo-50"
    },
    {
      id: "templates",
      label: "Plantillas de Fotos",
      description: "4 de Título, Infantiles, Carné, Collages",
      icon: Grid,
      color: "text-blue-600 bg-blue-50"
    },
    {
      id: "custom_photo",
      label: "Fotos a Medida Libre",
      description: "Dimensiones en cm/pulgadas para marcos",
      icon: Maximize2,
      color: "text-blue-600 bg-blue-50"
    },
    {
      id: "creative_studio",
      label: "Retratos y Dedicatorias IA",
      description: "Filtros artísticos y orlas para cuadros",
      icon: Sparkles,
      color: "text-indigo-600 bg-indigo-50"
    },
    {
      id: "calculator",
      label: "Calculadora de Precios",
      description: "Cuentas de clientes, recibos y tarifas editables",
      icon: Calculator,
      color: "text-blue-600 bg-blue-50"
    }
  ] as const;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased">
      
      {/* GLOBAL BANNER */}
      <div className="bg-[#0b0f19] text-white py-3 px-4 shadow-inner border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <p className="text-xs font-semibold text-slate-300">
              Servicios de Impresión, Fotocopias y Soluciones Digitales — El Salvador
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-blue-300">
            <span>Hora Local SV: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <span className="hidden md:inline text-slate-700">•</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">Optimizado para Papel Carta (Letter)</span>
          </div>
        </div>
      </div>

      {/* HEADER SECTION */}
      <header className="bg-[#0f172a] text-white py-5 px-6 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="font-bold text-white tracking-wider text-base">SC</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-2xl tracking-tight text-white">
                  SERVICIOS <span className="text-indigo-400">CONSTELACION</span> STORE
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                  El Salvador
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Optimización de copias, alineación inteligente de documentos oficiales, OCR fiscal y diseño de plantillas de fotos.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-800/60 p-2.5 px-4 rounded-2xl border border-slate-700/50">
            <div className="text-right">
              <span className="text-[10px] text-slate-450 font-bold block uppercase tracking-wider">Alineador y Extractor</span>
              <span className="text-xs font-black text-indigo-400">Soporte DUI + IVA Activo</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS SECTION */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {tabList.map((tab) => {
            const IconComponent = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? "border-indigo-600 bg-white shadow-lg shadow-indigo-600/5 ring-1 ring-indigo-600/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-sm"
                }`}
              >
                {/* Accent glow for selected tab */}
                {isSelected && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full filter blur-2xl opacity-70 -mr-4 -mt-4"></div>
                )}

                <div className="flex items-start gap-4 relative">
                  <div className={`p-3 rounded-xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                    isSelected ? "text-white bg-indigo-600 shadow-md shadow-indigo-600/10" : "text-indigo-600 bg-indigo-50"
                  }`}>
                    <IconComponent className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                      Módulo
                    </span>
                    <span className={`text-sm font-black block mt-0.5 ${isSelected ? "text-indigo-900" : "text-slate-800"} group-hover:text-indigo-950`}>
                      {tab.label}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block leading-normal line-clamp-1">
                      {tab.description}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* WORKSPACE AREA with animations */}
        <main className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-md min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "dui" && <DuiMerger />}
              {activeTab === "iva" && <IvaExtractor />}
              {activeTab === "templates" && <TemplatesPrinter />}
              {activeTab === "custom_photo" && <SmartPhotoResizer />}
              {activeTab === "creative_studio" && <CreativeStudio />}
              {activeTab === "calculator" && <PricingCalculator />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* FOOTER SECTION */}
      <footer className="border-t border-slate-200 py-10 px-4 mt-12 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-600/70" />
            <span className="font-bold text-slate-600">Servicios Constelacion Store El Salvador — Sistema de Impresión y Copias</span>
          </div>
          <div className="flex gap-4 font-medium text-slate-500">
            <span className="hover:text-indigo-600 transition-colors cursor-pointer">Soporte Local</span>
            <span>•</span>
            <span className="hover:text-indigo-600 transition-colors cursor-pointer">Seguridad de Datos</span>
            <span>•</span>
            <span className="hover:text-indigo-600 transition-colors cursor-pointer">Alineador de Documentos Estándar</span>
          </div>
        </div>
      </footer>

    </div>
  );
}


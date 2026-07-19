import React, { useState, useEffect } from "react";
import { 
  Calculator, Settings, Edit3, Save, Plus, Trash2, Printer, 
  RefreshCw, ClipboardList, CheckCircle2, Ticket, DollarSign 
} from "lucide-react";
import { ServicePrice } from "../types";
import jsPDF from "jspdf";

const INITIAL_PRICES: ServicePrice[] = [
  { id: "imp_bk", name: "Impresión Blanco y Negro (BK)", price: 0.25, category: "printing" },
  { id: "imp_color", name: "Impresión a Color (Básica)", price: 0.30, category: "printing" },
  { id: "imp_color_high", name: "Impresión a Color (Alta Cobertura/Foto)", price: 0.80, category: "printing" },
  { id: "cop_bk", name: "Copia Blanco y Negro (BK)", price: 0.15, category: "copying" },
  { id: "cop_color", name: "Copia a Color", price: 0.20, category: "copying" },
  { id: "scan", name: "Escaneo de Página (Digitalización)", price: 0.25, category: "scanning" },
  { id: "amp_bk", name: "Ampliación de Documento BK", price: 0.30, category: "enlargement" },
  { id: "amp_color", name: "Ampliación de Documento Color", price: 0.50, category: "enlargement" }
];

interface CartItem {
  id: string;
  priceId: string;
  quantity: number; // number of copies
  pages: number; // pages per copy
  customPrice?: number; // override if needed
}

export default function PricingCalculator() {
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [activeTab, setActiveTab] = useState<"calc" | "settings">("calc");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Editing state for settings
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingValue, setEditingValue] = useState(0);

  // New custom rate builder state
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(0.25);
  const [newCategory, setNewCategory] = useState<ServicePrice["category"]>("other");

  // Receipt details state
  const [customerName, setCustomerName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");

  // Load prices from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("copy_shop_prices");
    if (saved) {
      try {
        setPrices(JSON.parse(saved));
      } catch (e) {
        setPrices(INITIAL_PRICES);
      }
    } else {
      setPrices(INITIAL_PRICES);
    }
    generateReceiptNumber();
  }, []);

  const generateReceiptNumber = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setReceiptNumber(`REC-${rand}`);
  };

  const handleSavePricesToStorage = (updatedPrices: ServicePrice[]) => {
    setPrices(updatedPrices);
    localStorage.setItem("copy_shop_prices", JSON.stringify(updatedPrices));
  };

  const startEditingPrice = (item: ServicePrice) => {
    setEditingPriceId(item.id);
    setEditingName(item.name);
    setEditingValue(item.price);
  };

  const saveEditedPrice = (id: string) => {
    const updated = prices.map((p) => {
      if (p.id === id) {
        return { ...p, name: editingName, price: editingValue };
      }
      return p;
    });
    handleSavePricesToStorage(updated);
    setEditingPriceId(null);
  };

  const handleAddCustomPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newRate: ServicePrice = {
      id: "rate_" + Date.now(),
      name: newName,
      price: newPrice,
      category: newCategory
    };

    const updated = [...prices, newRate];
    handleSavePricesToStorage(updated);

    setNewName("");
    setNewPrice(0.25);
    setNewCategory("other");
  };

  const handleDeletePrice = (id: string) => {
    const updated = prices.filter((p) => p.id !== id);
    handleSavePricesToStorage(updated);
  };

  // Cart operations
  const addToCart = (priceId: string) => {
    const existing = cart.find((c) => c.priceId === priceId);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.priceId === priceId ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([...cart, { id: "item_" + Date.now(), priceId, quantity: 1, pages: 1 }]);
    }
  };

  const updateCartItem = (itemId: string, updates: Partial<CartItem>) => {
    setCart(cart.map((c) => (c.id === itemId ? { ...c, ...updates } : c)));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setShowReceipt(false);
    setCustomerName("");
    generateReceiptNumber();
  };

  // Calculation helpers
  const getItemPrice = (item: CartItem) => {
    const base = prices.find((p) => p.id === item.priceId);
    return item.customPrice !== undefined ? item.customPrice : (base ? base.price : 0);
  };

  const getItemSubtotal = (item: CartItem) => {
    const unitPrice = getItemPrice(item);
    return unitPrice * item.quantity * item.pages;
  };

  const getCartTotal = () => {
    return cart.reduce((acc, item) => acc + getItemSubtotal(item), 0);
  };

  const printReceipt = () => {
    // Generate a professional thermal-style receipt PDF (80mm width, dynamic height)
    // 80mm is approximately 226 points, we'll use a dynamic height based on item count.
    const itemHeight = 12;
    const baseHeight = 110;
    const dynamicHeight = baseHeight + (cart.length * itemHeight);
    
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, Math.max(150, dynamicHeight)]
    });

    // Font setup
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900

    // Title / Brand
    doc.text("CONSTELACION STORE", 40, 10, { align: "center" });
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("Servicios de Imprenta y Copias", 40, 14, { align: "center" });
    doc.text("El Salvador", 40, 18, { align: "center" });
    
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.line(5, 22, 75, 22);

    // Metadata
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7);
    doc.text(`TICKET DE SERVICIO: ${receiptNumber}`, 5, 27);
    
    doc.setFont("Helvetica", "normal");
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.text(`Fecha: ${dateStr}   Hora: ${timeStr}`, 5, 31);
    
    if (customerName) {
      doc.text(`Cliente: ${customerName}`, 5, 35);
    }

    doc.line(5, 38, 75, 38);

    // Table Headers
    doc.setFont("Helvetica", "bold");
    doc.text("Descripción", 5, 42);
    doc.text("Cant.", 48, 42, { align: "center" });
    doc.text("Subtotal", 75, 42, { align: "right" });
    doc.line(5, 44, 75, 44);

    // Items
    let currentY = 49;
    doc.setFont("Helvetica", "normal");
    
    cart.forEach((item) => {
      const srv = prices.find((p) => p.id === item.priceId);
      const name = srv ? srv.name : "Servicio";
      const subtotal = getItemSubtotal(item);
      const price = getItemPrice(item);
      
      // Split name if too long to fit in narrow receipt
      const splitName = doc.splitTextToSize(name, 38);
      doc.text(splitName, 5, currentY);
      
      // Quantity details (pages x quantity)
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`${item.pages} pág x ${item.quantity} jgo ($${price.toFixed(2)})`, 5, currentY + 3.5);
      
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${item.quantity * item.pages}`, 48, currentY, { align: "center" });
      doc.text(`$${subtotal.toFixed(2)}`, 75, currentY, { align: "right" });
      
      currentY += 10;
    });

    doc.line(5, currentY - 2, 75, currentY - 2);

    // Total
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text("TOTAL NETO:", 5, currentY + 3);
    doc.text(`$${getCartTotal().toFixed(2)}`, 75, currentY + 3, { align: "right" });

    // Footer Warning "NO ES FACTURA"
    const footerY = currentY + 12;
    doc.setDrawColor(239, 68, 68); // red-500
    doc.setLineWidth(0.4);
    doc.line(5, footerY, 75, footerY);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(220, 38, 38); // red-600
    doc.text("*** TICKET DE SERVICIO PROVISIONAL ***", 40, footerY + 4, { align: "center" });
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(127, 29, 29); // red-900
    doc.text("NO ES FACTURA NI COMPROBANTE FISCAL", 40, footerY + 7, { align: "center" });
    doc.text("Solo válido para control interno de imprenta.", 40, footerY + 10, { align: "center" });
    doc.text("Constelacion Store agradece su preferencia.", 40, footerY + 13, { align: "center" });

    // Save PDF
    doc.save(`Ticket_Servicio_${receiptNumber}.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="pricing-calculator-section">
      
      {/* LEFT COLUMN: Service pricing sheets / Rates config */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl w-max">
          <button
            onClick={() => setActiveTab("calc")}
            className={`py-2 px-5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "calc"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Calculator className="w-4 h-4 text-blue-600" />
            Ventanilla de Cobro
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`py-2 px-5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "settings"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Settings className="w-4 h-4 text-blue-600" />
            Configurar Tarifas / Precios
          </button>
        </div>

        {activeTab === "calc" ? (
          /* CALCULATION PANEL: Menu list of items */
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-5">
            <div>
              <h3 className="font-display font-semibold text-slate-800 text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Catálogo de Servicios El Salvador
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-normal">
                Haz click en cualquier servicio para añadirlo a la cuenta del cliente.
              </p>
            </div>

            {/* Quick-add buttons arranged by categories */}
            <div className="space-y-4">
              {["printing", "copying", "scanning", "enlargement", "other"].map((category) => {
                const categoryItems = prices.filter((p) => p.category === category);
                if (categoryItems.length === 0) return null;

                const categoryLabels: Record<string, string> = {
                  printing: "Impresiones",
                  copying: "Copias / Fotocopias",
                  scanning: "Escaneos",
                  enlargement: "Ampliaciones",
                  other: "Otros Servicios"
                };

                return (
                  <div key={category} className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      {categoryLabels[category]}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {categoryItems.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p.id)}
                          className="p-3 bg-slate-50 hover:bg-blue-50/20 border border-slate-100 hover:border-blue-200 rounded-xl text-left transition-all flex justify-between items-center group cursor-pointer"
                        >
                          <div className="truncate pr-2">
                            <span className="text-xs font-semibold text-slate-700 block group-hover:text-blue-950 truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-slate-400">Tarifa fija</span>
                          </div>
                          <span className="text-xs font-bold text-blue-600 bg-white border border-slate-100 px-2 py-1 rounded">
                            ${p.price.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* RATES CONFIG PANEL */
          <div className="space-y-6">
            
            {/* List of current rates with edit forms */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <div>
                <h3 className="font-display font-semibold text-slate-800 text-md flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  Tarifario Vigente
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Modifica los nombres o valores de los servicios preestablecidos según las tarifas de tu negocio.
                </p>
              </div>

              <div className="space-y-2.5">
                {prices.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 border border-slate-100 rounded-xl flex items-center justify-between gap-4 bg-slate-50/50"
                  >
                    {editingPriceId === p.id ? (
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-8">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full text-xs p-2 bg-white border rounded focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-3 relative">
                          <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-bold">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(parseFloat(e.target.value) || 0)}
                            className="w-full text-xs p-2 pl-6 bg-white border rounded focus:outline-none font-bold"
                          />
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            onClick={() => saveEditedPrice(p.id)}
                            className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                            title="Guardar"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-700 block truncate">{p.name}</span>
                          <span className="text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">
                            {p.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-black text-slate-800">${p.price.toFixed(2)}</span>
                          <button
                            onClick={() => startEditingPrice(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-colors"
                            title="Editar tarifa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePrice(p.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded transition-colors"
                            title="Eliminar tarifa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form to create a completely new price category */}
            <form onSubmit={handleAddCustomPrice} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-md space-y-4">
              <h4 className="font-display font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                Agregar Nuevo Servicio Personalizado
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nombre del Servicio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Encuadernado Espiral"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Precio Unitario ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newPrice}
                      onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Categoría</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white font-medium"
                    >
                      <option value="printing">Impresiones</option>
                      <option value="copying">Copias / Fotocopias</option>
                      <option value="scanning">Escaneos</option>
                      <option value="enlargement">Ampliaciones</option>
                      <option value="other">Otros / Varios</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Active Bill Calculation / Cart receipt */}
      <div className="lg:col-span-5 flex flex-col space-y-6">
        
        {/* Active Bill Ledger */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4 flex-1 flex flex-col justify-between">
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <div>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">
                  {receiptNumber}
                </span>
                <h3 className="font-display font-bold text-slate-800 text-md mt-1">
                  Cuenta del Cliente
                </h3>
              </div>
              <button
                onClick={clearCart}
                className="text-xs text-slate-400 hover:text-red-500 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Vaciar Cuenta
              </button>
            </div>

            {/* Cart input fields */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nombre del Cliente (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: Carlos Ayala"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none font-medium"
              />
            </div>

            {/* Cart Items List */}
            {cart.length > 0 ? (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {cart.map((item) => {
                  const srv = prices.find((p) => p.id === item.priceId);
                  const price = getItemPrice(item);
                  const subtotal = getItemSubtotal(item);

                  return (
                    <div
                      key={item.id}
                      className="p-3 border border-slate-100 rounded-xl flex flex-col gap-2 bg-slate-50/40"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-xs font-bold text-slate-700 truncate">
                          {srv ? srv.name : "Servicio Personalizado"}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          {/* Quantity */}
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Hojas/Pág</span>
                            <input
                              type="number"
                              min="1"
                              value={item.pages}
                              onChange={(e) => updateCartItem(item.id, { pages: parseInt(e.target.value) || 1 })}
                              className="w-12 text-center text-xs border border-slate-100 bg-white rounded p-1 font-bold"
                            />
                          </div>

                          <span className="text-xs text-slate-400 self-end mb-1">x</span>

                          {/* Copies */}
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">Juegos/Cop</span>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                              className="w-12 text-center text-xs border border-slate-100 bg-white rounded p-1 font-bold"
                            />
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">${price.toFixed(2)} c/u</span>
                          <span className="text-xs font-black text-blue-600">${subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-8 text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold block text-slate-600">Cuenta Vacía</span>
                <p className="text-[10px] text-slate-400">
                  Selecciona servicios del catálogo a la izquierda para sumarlos al recibo del cliente.
                </p>
              </div>
            )}
          </div>

          {/* Cart totals & Receipt button */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-800">Total a Cobrar:</span>
                <span className="text-2xl font-black text-blue-600">${getCartTotal().toFixed(2)}</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setShowReceipt(true)}
                  className="py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/10"
                >
                  <Ticket className="w-4 h-4" />
                  Ver Recibo de Pago
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Receipt Drawer (Simulating Thermal Printer receipt) */}
        {showReceipt && cart.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-fadeIn relative overflow-hidden" id="thermal-receipt-container">
            <div className="border-b border-dashed border-slate-300 pb-4 text-center space-y-1">
              <h4 className="font-display font-black text-md text-slate-800 uppercase tracking-wider">
                *** RECIBO DE COMPRA ***
              </h4>
              <p className="text-[10px] text-slate-500 font-semibold font-mono">SERVICIOS DE IMPRENTA Y COPIAS</p>
              <p className="text-[9px] text-slate-400 font-mono">El Salvador — Tel: (Negocio Local)</p>
              <div className="pt-2 flex justify-between text-[9px] font-mono text-slate-500 px-2">
                <span>{receiptNumber}</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              {customerName && (
                <div className="text-[10px] text-slate-600 text-left px-2 pt-1 font-mono">
                  Cliente: <span className="font-bold">{customerName}</span>
                </div>
              )}
            </div>

            {/* Cart list in receipt style */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-4 font-mono text-[10px] text-slate-700">
              {cart.map((item) => {
                const srv = prices.find((p) => p.id === item.priceId);
                const subtotal = getItemSubtotal(item);
                return (
                  <div key={item.id} className="flex justify-between items-start">
                    <div>
                      <span>{srv ? srv.name : "Servicio"}</span>
                      <div className="text-[8px] text-slate-400">
                        {item.pages} pág x {item.quantity} juegos
                      </div>
                    </div>
                    <span className="font-bold">${subtotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex justify-between items-baseline font-mono text-xs text-slate-800 font-black">
              <span>TOTAL NETO COBRADO:</span>
              <span>${getCartTotal().toFixed(2)}</span>
            </div>

            {/* Print action */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold"
              >
                Cerrar Recibo
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Recibo
              </button>
            </div>
            
            <p className="text-[8px] text-slate-400 text-center font-mono italic">
              ¡Gracias por preferir nuestro servicio de impresión y copiado!
            </p>
          </div>
        )}

      </div>

    </div>
  );
}

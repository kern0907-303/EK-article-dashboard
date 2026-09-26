"use client";

import React, { useState } from "react";
import { ChevronDown, Brain, Compass, Sparkles, Activity, Check, Facebook } from "lucide-react";

export interface Brand {
  id: string;
  name: string;
  desc: string;
  fbPageName: string;
  icon: React.ComponentType<any>;
  colorClass: string;
  borderClass: string;
  textClass: string;
}

export const BRANDS: Brand[] = [
  { 
    id: "brand_a_i8", 
    name: "I8 (Initial 8 CO.)", 
    desc: "企業關鍵因素與決策校準", 
    fbPageName: "I8 企業關鍵因素與決策校準",
    icon: Activity, 
    colorClass: "bg-indigo-500/10 text-indigo-400",
    borderClass: "border-indigo-500/20",
    textClass: "text-indigo-400"
  },
  { 
    id: "brand_b_nas", 
    name: "NAS (平衡空間)", 
    desc: "生命數字自我探索與關係理解", 
    fbPageName: "NAS 平衡空間生命數字",
    icon: Compass, 
    colorClass: "bg-purple-500/10 text-purple-400",
    borderClass: "border-purple-500/20",
    textClass: "text-purple-400"
  },
  { 
    id: "brand_c_abl", 
    name: "ABL (量子調頻)", 
    desc: "信息場狀態分析與能量調和", 
    fbPageName: "ABL 信息場狀態分析與調和",
    icon: Sparkles, 
    colorClass: "bg-cyan-500/10 text-cyan-400",
    borderClass: "border-cyan-500/20",
    textClass: "text-cyan-400"
  },
  { 
    id: "personal_brand", 
    name: "Erick 個人品牌", 
    desc: "事業與人生關鍵因素諮詢", 
    fbPageName: "Erick 事業與人生關鍵因素諮詢",
    icon: Brain, 
    colorClass: "bg-amber-500/10 text-amber-400",
    borderClass: "border-amber-500/20",
    textClass: "text-amber-400"
  }
];

interface BrandSelectorProps {
  activeBrandId: string;
  onChangeBrand: (brandId: string) => void;
}

export default function BrandSelector({ activeBrandId, onChangeBrand }: BrandSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeBrand = BRANDS.find((b) => b.id === activeBrandId) || BRANDS[0];

  const handleSelect = (id: string) => {
    onChangeBrand(id);
    setIsOpen(false);
  };

  const ActiveIcon = activeBrand.icon;

  return (
    <div className="relative w-full">
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
        切換營運品牌 / 領域
      </label>
      
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border bg-slate-900/60 hover:bg-slate-800/80 transition-all duration-300 backdrop-blur-md cursor-pointer ${activeBrand.borderClass}`}
      >
        <div className="flex items-center gap-3 text-left min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${activeBrand.colorClass}`}>
            <ActiveIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-slate-100 text-sm leading-tight truncate">
              {activeBrand.name}
            </h4>
            <p className="text-xs text-slate-400 truncate max-w-[170px]">
              {activeBrand.desc}
            </p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-400 font-medium">
              <Facebook className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="truncate">{activeBrand.fbPageName}</span>
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown List */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
          />
          
          <ul className="absolute left-0 right-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl z-40 backdrop-blur-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
            {BRANDS.map((brand) => {
              const BrandIcon = brand.icon;
              const isSelected = brand.id === activeBrandId;
              
              return (
                <li key={brand.id}>
                  <button
                    onClick={() => handleSelect(brand.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/60 transition-colors text-left cursor-pointer ${
                      isSelected ? "bg-slate-800/40" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-md shrink-0 ${brand.colorClass}`}>
                        <BrandIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className={`text-sm font-semibold block truncate ${isSelected ? "text-slate-100" : "text-slate-300"}`}>
                          {brand.name}
                        </span>
                        <span className="text-xs text-slate-500 block truncate">
                          {brand.desc}
                        </span>
                        <span className="text-[10px] text-blue-400/90 flex items-center gap-1 mt-0.5">
                          <Facebook className="w-2.5 h-2.5" />
                          <span className="truncate">{brand.fbPageName}</span>
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className={`w-4 h-4 shrink-0 ${brand.textClass}`} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

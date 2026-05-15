import React, { createContext, useState, useContext } from 'react';
import type { Package, AddOn } from '../types';

interface AppContextType {
  language: 'ar' | 'en';
  design: 1 | 2;
  selectedPackage: Package | null;
  selectedAddOns: AddOn[];
  subtotal: number;
  vat: number;
  total: number;
  
  setLanguage: (lang: 'ar' | 'en') => void;
  setDesign: (design: 1 | 2) => void;
  selectPackage: (pkg: Package) => void;
  toggleAddOn: (addon: AddOn) => void;
  clearAddOns: () => void;
  resetBooking: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [design, setDesign] = useState<1 | 2>(1);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);

  // Calculate totals
  const subtotal = (selectedPackage?.price || 0) + 
                   selectedAddOns.reduce((sum, addon) => sum + addon.price, 0);
  const vat = Math.round(subtotal * 0.15);
  const total = subtotal + vat;

  const selectPackage = (pkg: Package) => {
    setSelectedPackage(pkg);
  };

  const toggleAddOn = (addon: AddOn) => {
    setSelectedAddOns(prev => {
      const exists = prev.find(a => a.id === addon.id);
      if (exists) {
        return prev.filter(a => a.id !== addon.id);
      } else {
        return [...prev, { ...addon, quantity: 1 }];
      }
    });
  };

  const clearAddOns = () => {
    setSelectedAddOns([]);
  };

  const resetBooking = () => {
    setSelectedPackage(null);
    setSelectedAddOns([]);
  };

  return (
    <AppContext.Provider
      value={{
        language,
        design,
        selectedPackage,
        selectedAddOns,
        subtotal,
        vat,
        total,
        setLanguage,
        setDesign,
        selectPackage,
        toggleAddOn,
        clearAddOns,
        resetBooking
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

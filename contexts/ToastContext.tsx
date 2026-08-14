// contexts/ToastContext.tsx

/**
 * This project was developed by Nikandr Surkov.
 * You may not use this code if you purchased it from any source other than the official website https://nikandr.com.
 * If you purchased it from the official website, you may use it for your own projects,
 * but you may not resell it or publish it publicly.
 * 
 * Website: https://nikandr.com
 * YouTube: https://www.youtube.com/@NikandrSurkov
 * Telegram: https://t.me/nikandr_s
 * Telegram channel for news/updates: https://t.me/clicker_game_news
 * GitHub: https://github.com/nikandr-surkov
 */

'use client'

import React, { createContext, useContext, ReactNode } from 'react';
import { Toaster, toast, ToasterProps } from 'react-hot-toast';

type ToastContextType = {
  showToast: (message: string, type: 'success' | 'error') => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toasterConfig: ToasterProps = {
  position: "top-center",
  toastOptions: {
    className: '',
    style: {
      background: '#333',
      color: '#fff',
    },
    success: {
      iconTheme: {
        primary: '#10B981',
        secondary: '#333',
      },
    },
    error: {
      iconTheme: {
        primary: '#EF4444',
        secondary: '#333',
      },
    },
  },
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const showToast = (message: string, type: 'success' | 'error') => {
    if (type === 'success') {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster {...toasterConfig} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.showToast;
};
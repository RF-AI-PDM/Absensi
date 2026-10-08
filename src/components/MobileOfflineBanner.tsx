import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const MobileOfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-md sticky top-0 z-50 animate-in fade-in">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Mode Offline — Data tersimpan secara lokal dan akan disinkronkan saat koneksi internet kembali.
      </span>
    </div>
  );
};

import React from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  FileText,
  MapPin,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';

export type MobileTab = 'monitoring' | 'terminal' | 'recap' | 'payroll' | 'agent' | 'security';

interface MobileBottomNavigationProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  isCheckedInToday: boolean;
  unreadCount?: number;
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  isCheckedInToday,
  unreadCount = 0,
}) => {
  const navItems = [
    {
      id: 'monitoring' as MobileTab,
      label: 'Monitoring',
      icon: BarChart3,
    },
    {
      id: 'terminal' as MobileTab,
      label: 'Absen GPS',
      icon: MapPin,
      isPrimaryAction: true,
    },
    {
      id: 'recap' as MobileTab,
      label: 'Rekap & Gaji',
      icon: FileText,
    },
    {
      id: 'agent' as MobileTab,
      label: 'Asisten AI',
      icon: Bot,
    },
    {
      id: 'security' as MobileTab,
      label: '2FA & Unit',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl safe-area-bottom">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.isPrimaryAction) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className="flex flex-col items-center justify-center -mt-5 relative group"
                aria-label={item.label}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : isCheckedInToday
                      ? 'bg-slate-900 text-emerald-400'
                      : 'bg-emerald-600 text-white animate-bounce ring-2 ring-white'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <span
                  className={`text-[10px] font-semibold mt-1 transition-colors ${
                    isActive ? 'text-emerald-700 font-bold' : 'text-slate-700'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
                isActive ? 'text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-slate-900' : 'text-slate-500'
                  }`}
                />
                {item.id === 'agent' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 truncate max-w-[62px] ${
                  isActive ? 'font-bold text-slate-900' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-4 h-0.5 bg-slate-900 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

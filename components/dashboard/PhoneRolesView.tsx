'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { PhoneRolesForm } from './PhoneRolesForm';
import { PhoneWhitelistTable } from './PhoneWhitelistTable';
import { GuideModal } from './GuideModal';
import { Phone, ShieldCheck, PlusCircle, ShoppingBag, HelpCircle, Hash } from 'lucide-react';

interface PhoneRolesViewProps {
  onNavigateToOrders?: () => void;
}

export const PhoneRolesView: React.FC<PhoneRolesViewProps> = ({ onNavigateToOrders }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const [subTab, setSubTab] = useState<'create' | 'whitelist'>('create');
  const [whitelistCount, setWhitelistCount] = useState<number>(0);
  const [showGuide, setShowGuide] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Fetch initial whitelist count for admin badge
  useEffect(() => {
    if (isAdmin) {
      fetch('/api/whitelist')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.whitelist)) {
            setWhitelistCount(data.whitelist.length);
          }
        })
        .catch(err => console.error('Error fetching whitelist count:', err));
    }
  }, [isAdmin]);

  // Non-admin users only have access to the order creation form
  if (!isAdmin) {
    return <PhoneRolesForm onNavigateToOrders={onNavigateToOrders} hideHeader={false} />;
  }

  return (
    <div className="space-y-6">
      {/* Guide Modal */}
      <GuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        titleKey="phoneGuideTitle"
        contentKey="phoneGuideContent"
        storageKey="hide_phone_guide"
      />

      {/* Sub-tab Navigation Header Bar (Admin Only) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{t('phoneRolesTitle')}</h2>
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 transition cursor-pointer"
              >
                <HelpCircle className="w-3 h-3" />
                {t('openGuideBtn')}
              </button>
            </div>
            <p className="text-xs text-slate-400">{t('phoneRolesSub')}</p>
          </div>
        </div>

        {/* Sub-tab Switcher Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl w-full sm:w-auto">
          {/* Sub-tab 1: Form Đăng ký Phone & Role */}
          <button
            onClick={() => setSubTab('create')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'create'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {t('phoneRolesSubTabRegister')}
          </button>

          {/* Sub-tab 2: Danh sách Whitelist (Admin only) */}
          <button
            onClick={() => setSubTab('whitelist')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              subTab === 'whitelist'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('phoneRolesSubTabWhitelist')}</span>
            {whitelistCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                subTab === 'whitelist' ? 'bg-emerald-800 text-white' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {whitelistCount}
              </span>
            )}
          </button>

          {/* Shortcut to Orders */}
          {onNavigateToOrders && (
            <button
              onClick={onNavigateToOrders}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-purple-300 hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer border border-transparent hover:border-purple-500/30"
              title={t('ordersTab')}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
              <span>{t('ordersTab')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-tab Content */}
      {subTab === 'create' && (
        <PhoneRolesForm onNavigateToOrders={onNavigateToOrders} hideHeader={true} />
      )}

      {subTab === 'whitelist' && (
        <PhoneWhitelistTable onWhitelistCountChange={setWhitelistCount} />
      )}
    </div>
  );
};

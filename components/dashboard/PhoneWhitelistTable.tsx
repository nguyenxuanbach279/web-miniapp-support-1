'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useToast } from '@/lib/toast-context';
import { PhoneWhitelistItem } from '@/lib/types';
import { parseMultiplePhoneNumbers } from '@/lib/phone-utils';
import {
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  X,
  Phone,
  Calendar,
  FileText,
  AlertTriangle,
  RefreshCw,
  Hash,
  Sparkles
} from 'lucide-react';

interface PhoneWhitelistTableProps {
  onWhitelistCountChange?: (count: number) => void;
}

export const PhoneWhitelistTable: React.FC<PhoneWhitelistTableProps> = ({ onWhitelistCountChange }) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [whitelist, setWhitelist] = useState<PhoneWhitelistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [rawPhonesInput, setRawPhonesInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<PhoneWhitelistItem | null>(null);
  const [editReasonInput, setEditReasonInput] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Confirm State
  const [itemToDelete, setItemToDelete] = useState<PhoneWhitelistItem | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Copied indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Live parsed numbers in the add modal
  const detectedNumbers = useMemo(() => {
    return parseMultiplePhoneNumbers(rawPhonesInput);
  }, [rawPhonesInput]);

  const fetchWhitelist = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/whitelist');
      const data = await res.json();
      if (data.success && Array.isArray(data.whitelist)) {
        setWhitelist(data.whitelist);
        if (onWhitelistCountChange) {
          onWhitelistCountChange(data.whitelist.length);
        }
      }
    } catch (err) {
      console.error('Error fetching whitelist:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchWhitelist();
    }
  }, [isAdmin]);

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!reasonInput.trim()) {
      setAddError(t('whitelistReasonLabel') + ' là bắt buộc!');
      return;
    }

    if (detectedNumbers.length === 0) {
      setAddError('Không tìm thấy số điện thoại hợp lệ nào. Vui lòng kiểm tra lại!');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch('/api/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phones: rawPhonesInput,
          reason: reasonInput.trim(),
          createdBy: currentUser?.name || currentUser?.email || 'Admin'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('toastWhitelistAdded', 'success');
        setIsAddModalOpen(false);
        setRawPhonesInput('');
        setReasonInput('');
        fetchWhitelist(true);
      } else {
        setAddError(data.message || 'Lỗi thêm số vào whitelist');
      }
    } catch (err) {
      setAddError('Lỗi kết nối tới máy chủ');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleEditWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editReasonInput.trim()) {
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/whitelist/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: editReasonInput.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('toastWhitelistUpdated', 'success');
        setEditingItem(null);
        fetchWhitelist(true);
      } else {
        showToast(data.message || 'Lỗi cập nhật whitelist', 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteWhitelist = async () => {
    if (!itemToDelete) return;

    setSubmittingDelete(true);
    try {
      const res = await fetch(`/api/whitelist/${itemToDelete.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        showToast('toastWhitelistDeleted', 'success');
        setItemToDelete(null);
        fetchWhitelist(true);
      } else {
        showToast(data.message || 'Lỗi xóa số khỏi whitelist', 'error');
      }
    } catch (err) {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const filteredWhitelist = useMemo(() => {
    if (!searchQuery.trim()) return whitelist;
    const q = searchQuery.toLowerCase().trim();
    return whitelist.filter(
      item =>
        item.phone.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        (item.createdAt && item.createdAt.toLowerCase().includes(q))
    );
  }, [whitelist, searchQuery]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl text-slate-400 text-sm">
        {t('whitelistOnlyAdminNotice')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {t('whitelistTitle')}
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {whitelist.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 pl-10 leading-relaxed">
            {t('whitelistSub')}
          </p>
        </div>

        <div className="flex items-center gap-2 pl-10 md:pl-0">
          <button
            onClick={() => fetchWhitelist(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/80 transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={() => {
              setRawPhonesInput('');
              setReasonInput('');
              setAddError(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('whitelistAddBtn')}
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('whitelistSearchPlaceholder')}
          className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Whitelist Table Container */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Đang tải danh sách whitelist...</span>
          </div>
        ) : filteredWhitelist.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-slate-600" />
            <p>{searchQuery ? t('whitelistNoSearchResults') : t('whitelistNoItems')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4">{t('whitelistColPhone')}</th>
                  <th className="py-3.5 px-4">{t('whitelistColReason')}</th>
                  <th className="py-3.5 px-4">{t('whitelistColCreated')}</th>
                  <th className="py-3.5 px-4 text-right">{t('whitelistColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredWhitelist.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                      {index + 1}
                    </td>

                    {/* Phone Number */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono font-bold text-emerald-300 text-sm">
                          {item.phone}
                        </span>
                        <button
                          onClick={() => handleCopyPhone(item.id, item.phone)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white rounded transition"
                          title="Sao chép SĐT"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-200 font-medium truncate" title={item.reason}>
                          {item.reason}
                        </span>
                      </div>
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.createdAt}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Reason Button */}
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditReasonInput(item.reason);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-slate-700 transition cursor-pointer"
                          title="Sửa lý do"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 hover:border-rose-800 transition cursor-pointer"
                          title="Xóa khỏi whitelist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD NUMBERS MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('whitelistAddModalTitle')}</h3>
                  <p className="text-[11px] text-slate-400">{t('whitelistAddModalSub')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-rose-950/50 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddWhitelist} className="space-y-4">
              {/* Phones Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {t('whitelistPhonesLabel')} <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={rawPhonesInput}
                  onChange={(e) => setRawPhonesInput(e.target.value)}
                  placeholder={t('whitelistPhonesPlaceholder')}
                  className="w-full p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition leading-relaxed"
                />

                {/* Live Preview Badge */}
                <div className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      {t('whitelistDetectedCountLabel')}
                    </span>
                    <span className="font-bold text-emerald-400">
                      {detectedNumbers.length} số
                    </span>
                  </div>

                  {detectedNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                      {detectedNumbers.map((ph, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] rounded-lg"
                        >
                          {ph}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Reason Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {t('whitelistReasonLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={t('whitelistReasonPlaceholder')}
                  className="w-full p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  {t('whitelistCancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd || detectedNumbers.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingAdd ? (
                    t('whitelistSubmittingAddBtn')
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      {t('whitelistSubmitAddBtn')} ({detectedNumbers.length})
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT REASON MODAL --- */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('whitelistEditModalTitle')}</h3>
                  <p className="text-[11px] font-mono text-emerald-400">{editingItem.phone}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditWhitelist} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  {t('whitelistEditReasonLabel')} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editReasonInput}
                  onChange={(e) => setEditReasonInput(e.target.value)}
                  className="w-full p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  {t('whitelistCancelBtn')}
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit || !editReasonInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingEdit ? t('whitelistSavingBtn') : t('whitelistSaveBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRM MODAL --- */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t('whitelistDeleteConfirmTitle')}</h3>
                <p className="text-xs font-mono font-bold text-rose-400">{itemToDelete.phone}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {t('whitelistDeleteConfirmMsg')}
            </p>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] space-y-1">
              <div className="text-slate-400">
                Lý do: <span className="text-white font-medium">{itemToDelete.reason}</span>
              </div>
              <div className="text-slate-400">
                Ngày tạo: <span className="text-white font-medium">{itemToDelete.createdAt}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                {t('whitelistCancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleDeleteWhitelist}
                disabled={submittingDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {submittingDelete ? 'Đang xóa...' : t('whitelistDeleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

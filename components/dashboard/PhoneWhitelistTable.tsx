'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { useToast } from '@/lib/toast-context';
import { PhoneWhitelistItem } from '@/lib/types';
import { parseMultiplePhoneNumbers, normalizeCanonicalPhone, isValidPhoneNumber } from '@/lib/phone-utils';
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
  Sparkles,
  Download,
  Upload,
  FileUp,
  Layers
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

  // Import Modal State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'paste'>('file');
  const [importFileName, setImportFileName] = useState('');
  const [importRawText, setImportRawText] = useState('');
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [importParsedItems, setImportParsedItems] = useState<{ phone: string; reason: string; createdAt: string }[]>([]);
  const [importInvalidCount, setImportInvalidCount] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [submittingImport, setSubmittingImport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const parseImportJson = (text: string) => {
    if (!text.trim()) {
      return { items: [], invalidCount: 0, error: null };
    }

    try {
      const parsed = JSON.parse(text);
      let rawList: any[] = [];
      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.whitelist)) {
          rawList = parsed.whitelist;
        } else if (Array.isArray(parsed.items)) {
          rawList = parsed.items;
        } else if (Array.isArray(parsed.data)) {
          rawList = parsed.data;
        } else {
          return {
            items: [],
            invalidCount: 0,
            error: 'Định dạng JSON không hợp lệ! Vui lòng cung cấp mảng dữ liệu.'
          };
        }
      } else {
        return { items: [], invalidCount: 0, error: 'Định dạng JSON không hợp lệ!' };
      }

      let invalidCount = 0;
      const validItems: { phone: string; reason: string; createdAt: string }[] = [];

      for (const raw of rawList) {
        if (!raw || typeof raw !== 'object') {
          invalidCount++;
          continue;
        }

        const rawPhone =
          raw.phone ??
          raw.phoneNumber ??
          raw.soDienThoai ??
          raw.so_dien_thoai ??
          raw['Số điện thoại'] ??
          '';

        const canonical = normalizeCanonicalPhone(String(rawPhone));
        if (!canonical || !isValidPhoneNumber(canonical)) {
          invalidCount++;
          continue;
        }

        const rawReason =
          raw.reason ??
          raw.lyDo ??
          raw.ly_do ??
          raw['Reason'] ??
          raw['Lý do'] ??
          '';

        const cleanReason = String(rawReason).trim() || 'Imported';

        const rawCreatedAt =
          raw.createdAt ??
          raw.created_at ??
          raw.ngayTao ??
          raw.ngay_tao ??
          raw['Ngày tạo'] ??
          '';

        validItems.push({
          phone: canonical,
          reason: cleanReason,
          createdAt: String(rawCreatedAt || '').trim()
        });
      }

      // Deduplicate within the file itself
      const dedupedMap = new Map<string, { phone: string; reason: string; createdAt: string }>();
      for (const item of validItems) {
        dedupedMap.set(item.phone, item);
      }

      const items = Array.from(dedupedMap.values());

      return {
        items,
        invalidCount,
        error: items.length === 0 ? 'Không tìm thấy số điện thoại hợp lệ nào trong file JSON!' : null
      };
    } catch (err: any) {
      return {
        items: [],
        invalidCount: 0,
        error: 'Lỗi phân tích cú pháp JSON: ' + (err.message || 'Cú pháp không đúng')
      };
    }
  };

  const processJsonText = (text: string) => {
    setImportRawText(text);
    setImportError(null);
    if (!text.trim()) {
      setImportParsedItems([]);
      setImportInvalidCount(0);
      return;
    }
    const result = parseImportJson(text);
    setImportParsedItems(result.items);
    setImportInvalidCount(result.invalidCount);
    setImportError(result.error);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      processJsonText(text);
    };
    reader.onerror = () => {
      setImportError('Lỗi đọc file!');
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      processJsonText(text);
    };
    reader.onerror = () => {
      setImportError('Lỗi đọc file!');
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const targetItems = searchQuery.trim() ? filteredWhitelist : whitelist;
    if (targetItems.length === 0) {
      showToast('Không có dữ liệu whitelist nào để xuất!', 'info');
      return;
    }

    // Export with required fields: phone, reason, createdAt
    const exportData = targetItems.map(item => ({
      phone: item.phone,
      reason: item.reason,
      createdAt: item.createdAt
    }));

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    a.download = `whitelist_export_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('toastWhitelistExportSuccess', 'success');
  };

  const handleConfirmImport = async () => {
    if (importParsedItems.length === 0) {
      setImportError('Vui lòng chọn hoặc dán file JSON có chứa số điện thoại hợp lệ!');
      return;
    }

    setSubmittingImport(true);
    setImportError(null);

    try {
      const res = await fetch('/api/whitelist/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: importParsedItems,
          mode: importMode,
          importedBy: currentUser?.name || currentUser?.email || 'Admin'
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message || t('toastWhitelistImportSuccess'), 'success');
        setIsImportModalOpen(false);
        setImportRawText('');
        setImportFileName('');
        setImportParsedItems([]);
        setImportInvalidCount(0);
        fetchWhitelist(true);
      } else {
        setImportError(data.message || 'Lỗi khi import dữ liệu whitelist');
      }
    } catch (err) {
      setImportError('Lỗi kết nối tới máy chủ khi import');
    } finally {
      setSubmittingImport(false);
    }
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

        <div className="flex flex-wrap items-center gap-2 pl-10 md:pl-0">
          <button
            onClick={() => fetchWhitelist(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/80 transition cursor-pointer"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            title="Xuất dữ liệu whitelist ra file JSON (số điện thoại, reason, ngày tạo)"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('whitelistExportBtn')}</span>
          </button>
          <button
            onClick={() => {
              setImportError(null);
              setImportRawText('');
              setImportFileName('');
              setImportParsedItems([]);
              setImportInvalidCount(0);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
            title="Import dữ liệu whitelist từ file JSON hoặc chuỗi JSON"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('whitelistImportBtn')}</span>
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
      {/* --- IMPORT MODAL --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4 my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{t('whitelistImportModalTitle')}</h3>
                  <p className="text-[11px] text-slate-400">{t('whitelistImportModalSub')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {importError && (
              <div className="p-3 bg-rose-950/50 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Tab Switcher: Upload File / Paste Text */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setImportTab('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  importTab === 'file'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                {t('whitelistImportFileTab')}
              </button>
              <button
                type="button"
                onClick={() => setImportTab('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  importTab === 'paste'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {t('whitelistImportPasteTab')}
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {importTab === 'file' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-950/50 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-slate-800 text-emerald-400 rounded-2xl">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-semibold text-slate-200">
                      {importFileName ? (
                        <span className="text-emerald-400 flex items-center gap-1.5 font-mono">
                          <Check className="w-4 h-4" />
                          {importFileName}
                        </span>
                      ) : (
                        t('whitelistImportFilePlaceholder')
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Định dạng chuẩn: File .json chứa số điện thoại, reason, ngày tạo
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Paste JSON Text */}
            {importTab === 'paste' && (
              <div className="space-y-1.5">
                <textarea
                  rows={6}
                  value={importRawText}
                  onChange={(e) => processJsonText(e.target.value)}
                  placeholder={t('whitelistImportPastePlaceholder')}
                  className="w-full p-3 bg-slate-800/90 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition leading-relaxed"
                />
              </div>
            )}

            {/* Import Mode Selection */}
            <div className="space-y-2 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                {t('whitelistImportModeLabel')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                  importMode === 'upsert'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="importMode"
                    value="upsert"
                    checked={importMode === 'upsert'}
                    onChange={() => setImportMode('upsert')}
                    className="mt-0.5 text-emerald-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-white text-xs">{t('whitelistImportModeUpsert')}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Giữ nguyên số hiện có, cập nhật ngày tạo & lý do nếu trùng</div>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                  importMode === 'replace'
                    ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
                    : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-rose-500 focus:ring-0"
                  />
                  <div>
                    <div className="font-semibold text-white text-xs">{t('whitelistImportModeReplace')}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Xóa sạch toàn bộ whitelist cũ và nạp mới hoàn toàn</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Live Preview Section */}
            {importParsedItems.length > 0 && (
              <div className="space-y-2 p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    {t('whitelistImportPreviewTitle')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold rounded-lg">
                      {t('whitelistImportDetectedCount')} {importParsedItems.length}
                    </span>
                    {importInvalidCount > 0 && (
                      <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold rounded-lg">
                        {t('whitelistImportInvalidCount')} {importInvalidCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini Preview Table */}
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800/80">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-3">SĐT</th>
                        <th className="py-1.5 px-3">Reason</th>
                        <th className="py-1.5 px-3">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {importParsedItems.slice(0, 5).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-1.5 px-3 font-mono font-semibold text-emerald-400">{item.phone}</td>
                          <td className="py-1.5 px-3 text-slate-300 truncate max-w-[150px]">{item.reason}</td>
                          <td className="py-1.5 px-3 text-slate-400 whitespace-nowrap">{item.createdAt || 'Mới'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importParsedItems.length > 5 && (
                    <div className="py-1 px-3 text-center text-slate-500 bg-slate-900/60 text-[10px]">
                      ... và {importParsedItems.length - 5} số khác
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                {t('whitelistCancelBtn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={submittingImport || importParsedItems.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submittingImport ? (
                  t('whitelistImportingBtn')
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    {t('whitelistImportConfirmBtn')} ({importParsedItems.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { NextResponse } from 'next/server';
import { readWhitelistDB, writeWhitelistDB } from '@/lib/server-db';
import { normalizeCanonicalPhone, isValidPhoneNumber } from '@/lib/phone-utils';
import { getUTC7Timestamp } from '@/lib/date-utils';
import { PhoneWhitelistItem } from '@/lib/types';

interface RawImportItem {
  phone?: unknown;
  phoneNumber?: unknown;
  soDienThoai?: unknown;
  so_dien_thoai?: unknown;
  'Số điện thoại'?: unknown;
  reason?: unknown;
  lyDo?: unknown;
  ly_do?: unknown;
  'Reason'?: unknown;
  'Lý do'?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  ngayTao?: unknown;
  ngay_tao?: unknown;
  'Ngày tạo'?: unknown;
  createdBy?: unknown;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let rawList: RawImportItem[] = [];
    let mode: 'upsert' | 'replace' = 'upsert';
    let importedBy = 'Admin';

    if (Array.isArray(body)) {
      rawList = body;
    } else if (body && typeof body === 'object') {
      if (Array.isArray(body.items)) {
        rawList = body.items;
      } else if (Array.isArray(body.whitelist)) {
        rawList = body.whitelist;
      } else if (Array.isArray(body.data)) {
        rawList = body.data;
      }

      if (body.mode === 'replace') {
        mode = 'replace';
      }
      if (body.importedBy && typeof body.importedBy === 'string') {
        importedBy = body.importedBy.trim();
      }
    }

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Dữ liệu JSON rỗng hoặc không đúng định dạng mảng các mục whitelist!'
      }, { status: 400 });
    }

    const nowTime = getUTC7Timestamp();
    let skippedCount = 0;

    // Normalize and filter items
    const parsedItems: { phone: string; reason: string; createdAt: string; createdBy?: string }[] = [];

    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') {
        skippedCount++;
        continue;
      }

      const rawPhone =
        raw.phone ??
        raw.phoneNumber ??
        raw.soDienThoai ??
        raw.so_dien_thoai ??
        raw['Số điện thoại'] ??
        '';

      const canonicalPhone = normalizeCanonicalPhone(String(rawPhone));
      if (!canonicalPhone || !isValidPhoneNumber(canonicalPhone)) {
        skippedCount++;
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

      const cleanCreatedAt =
        rawCreatedAt && String(rawCreatedAt).trim()
          ? String(rawCreatedAt).trim()
          : nowTime;

      parsedItems.push({
        phone: canonicalPhone,
        reason: cleanReason,
        createdAt: cleanCreatedAt,
        createdBy: typeof raw.createdBy === 'string' && raw.createdBy.trim() ? raw.createdBy.trim() : importedBy
      });
    }

    if (parsedItems.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy số điện thoại hợp lệ nào trong file JSON để import!'
      }, { status: 400 });
    }

    // Deduplicate within import payload (keep last item for matching phone)
    const dedupedImportMap = new Map<string, { phone: string; reason: string; createdAt: string; createdBy: string }>();
    for (const it of parsedItems) {
      dedupedImportMap.set(it.phone, {
        phone: it.phone,
        reason: it.reason,
        createdAt: it.createdAt,
        createdBy: it.createdBy || importedBy
      });
    }

    const db = await readWhitelistDB();
    let addedCount = 0;
    let updatedCount = 0;

    if (mode === 'replace') {
      // Overwrite all existing items with imported items
      const newWhitelist: PhoneWhitelistItem[] = [];
      let index = 0;
      for (const [, item] of dedupedImportMap) {
        newWhitelist.push({
          id: `wl_imp_${Date.now()}_${index++}_${Math.random().toString(36).substring(2, 6)}`,
          phone: item.phone,
          reason: item.reason,
          createdAt: item.createdAt,
          createdBy: item.createdBy
        });
      }
      db.whitelist = newWhitelist;
      addedCount = newWhitelist.length;
      updatedCount = 0;
    } else {
      // Upsert: merge and update existing, insert new
      const existingMap = new Map(db.whitelist.map(item => [normalizeCanonicalPhone(item.phone), item]));

      for (const [phone, item] of dedupedImportMap) {
        if (existingMap.has(phone)) {
          const existing = existingMap.get(phone)!;
          existing.reason = item.reason;
          // Ensure exact createdAt from export is preserved
          if (item.createdAt) {
            existing.createdAt = item.createdAt;
          }
          if (item.createdBy) {
            existing.createdBy = item.createdBy;
          }
          updatedCount++;
        } else {
          const newItem: PhoneWhitelistItem = {
            id: `wl_imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            phone: item.phone,
            reason: item.reason,
            createdAt: item.createdAt,
            createdBy: item.createdBy
          };
          db.whitelist.unshift(newItem);
          existingMap.set(phone, newItem);
          addedCount++;
        }
      }
    }

    await writeWhitelistDB(db);

    let message = `Đã import thành công: ${addedCount} số mới, ${updatedCount} số cập nhật.`;
    if (skippedCount > 0) {
      message += ` (${skippedCount} mục không hợp lệ đã bị bỏ qua).`;
    }

    return NextResponse.json({
      success: true,
      addedCount,
      updatedCount,
      skippedCount,
      totalCount: db.whitelist.length,
      whitelist: db.whitelist,
      message
    });
  } catch (error) {
    console.error('Error importing whitelist items:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi máy chủ khi import danh sách whitelist'
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { readWhitelistDB, writeWhitelistDB } from '@/lib/server-db';
import { parseMultiplePhoneNumbers, normalizeCanonicalPhone } from '@/lib/phone-utils';
import { getUTC7Timestamp } from '@/lib/date-utils';
import { PhoneWhitelistItem } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';

    const db = await readWhitelistDB();
    let list = db.whitelist;

    if (search) {
      list = list.filter(item =>
        item.phone.toLowerCase().includes(search) ||
        item.reason.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      whitelist: list,
      total: db.whitelist.length
    });
  } catch (error) {
    console.error('Error getting whitelist:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách whitelist' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phones, reason, createdBy } = body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json({
        success: false,
        message: 'Lý do (reason) là bắt buộc khi thêm số vào whitelist!'
      }, { status: 400 });
    }

    if (!phones || (typeof phones !== 'string' && !Array.isArray(phones))) {
      return NextResponse.json({
        success: false,
        message: 'Vui lòng cung cấp số điện thoại cần thêm!'
      }, { status: 400 });
    }

    const inputString = Array.isArray(phones) ? phones.join('\n') : phones;
    const parsedPhones = parseMultiplePhoneNumbers(inputString);

    if (parsedPhones.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy số điện thoại hợp lệ nào trong nội dung nhập!'
      }, { status: 400 });
    }

    const db = await readWhitelistDB();
    const existingMap = new Map(db.whitelist.map(item => [normalizeCanonicalPhone(item.phone), item]));

    let addedCount = 0;
    let updatedCount = 0;
    const cleanReason = reason.trim();
    const nowTime = getUTC7Timestamp();
    const newlyAddedList: PhoneWhitelistItem[] = [];

    for (const ph of parsedPhones) {
      const canonical = normalizeCanonicalPhone(ph);
      if (existingMap.has(canonical)) {
        // Update existing item's reason
        const existing = existingMap.get(canonical)!;
        existing.reason = cleanReason;
        if (createdBy) existing.createdBy = createdBy;
        updatedCount++;
      } else {
        // Create new item
        const newItem: PhoneWhitelistItem = {
          id: `wl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          phone: canonical,
          reason: cleanReason,
          createdAt: nowTime,
          createdBy: createdBy || 'Admin'
        };
        db.whitelist.unshift(newItem);
        existingMap.set(canonical, newItem);
        newlyAddedList.push(newItem);
        addedCount++;
      }
    }

    await writeWhitelistDB(db);

    let message = `Đã thêm thành công ${addedCount} số điện thoại vào whitelist!`;
    if (updatedCount > 0) {
      message += ` (Cập nhật lý do cho ${updatedCount} số đã có sẵn).`;
    }

    return NextResponse.json({
      success: true,
      addedCount,
      updatedCount,
      totalCount: db.whitelist.length,
      whitelist: db.whitelist,
      message
    });
  } catch (error) {
    console.error('Error adding whitelist items:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ khi thêm số vào whitelist' }, { status: 500 });
  }
}

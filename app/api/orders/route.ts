import { NextResponse } from 'next/server';
import { readOrdersDB, writeOrdersDB, readWhitelistDB } from '@/lib/server-db';
import { Order, PhoneRole } from '@/lib/types';
import { extractAllPhoneNumbers, extractPhoneNumbers, normalizeCanonicalPhone } from '@/lib/phone-utils';
import { getUTC7Timestamp } from '@/lib/date-utils';
import { broadcastNewOrder } from '@/lib/realtime';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userRole = searchParams.get('role');

    const db = await readOrdersDB();

    if (userRole === 'admin') {
      return NextResponse.json({ success: true, orders: db.orders });
    }

    if (userId) {
      const userOrders = db.orders.filter(o => o.userId === userId);
      return NextResponse.json({ success: true, orders: userOrders });
    }

    return NextResponse.json({ success: true, orders: db.orders });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Lỗi khi lấy danh sách đơn hàng!' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, userEmail, userName, rawText, phoneRole } = await request.json();

    if (!userId || !userEmail || !rawText) {
      return NextResponse.json({ success: false, message: 'Missing required order data!' }, { status: 400 });
    }

    const detectedPhone = extractAllPhoneNumbers(rawText);
    if (!detectedPhone) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy số điện thoại hợp lệ nào từ văn bản nhập!'
      }, { status: 400 });
    }

    // WHITELIST CHECK: Only whitelisted phone numbers are allowed to create Phone & Role orders
    const detectedList = extractPhoneNumbers(rawText);
    const whitelistDb = await readWhitelistDB();
    const whitelistedSet = new Set(whitelistDb.whitelist.map(w => normalizeCanonicalPhone(w.phone)));

    const nonWhitelisted = detectedList.filter(ph => !whitelistedSet.has(normalizeCanonicalPhone(ph)));
    if (nonWhitelisted.length > 0) {
      const phoneText = nonWhitelisted.join(', ');
      return NextResponse.json({
        success: false,
        message: nonWhitelisted.length === 1
          ? `Số điện thoại (${phoneText}) của bạn không nằm trong whitelist, vui lòng liên hệ admin!`
          : `Các số điện thoại (${phoneText}) của bạn không nằm trong whitelist, vui lòng liên hệ admin!`
      }, { status: 403 });
    }

    const validRole: PhoneRole = ['poc', 'prod', 'full', 'admin', 'default'].includes(phoneRole)
      ? phoneRole
      : 'full';

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      userId,
      userEmail,
      userName: userName || userEmail.split('@')[0],
      type: 'phone&role',
      rawText: rawText.trim(),
      detectedPhone,
      phoneRole: validRole,
      status: 'Pending',
      createdAt: getUTC7Timestamp()
    };

    const db = await readOrdersDB();
    db.orders.unshift(newOrder);
    await writeOrdersDB(db);

    // Broadcast new order to mobile apps via Supabase Realtime (non-blocking)
    broadcastNewOrder(newOrder).catch(err => console.error('Error broadcasting new order:', err));

    return NextResponse.json({
      success: true,
      order: newOrder,
      message: 'Phone & Role order created successfully!'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ success: false, message: 'Server error while creating order!' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { readWhitelistDB, writeWhitelistDB } from '@/lib/server-db';
import { normalizeCanonicalPhone, isValidPhoneNumber } from '@/lib/phone-utils';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = await readWhitelistDB();

    const itemIndex = db.whitelist.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy số trong whitelist!' }, { status: 404 });
    }

    const currentItem = db.whitelist[itemIndex];

    if (body.reason !== undefined) {
      if (typeof body.reason !== 'string' || !body.reason.trim()) {
        return NextResponse.json({ success: false, message: 'Lý do (reason) không được để trống!' }, { status: 400 });
      }
      currentItem.reason = body.reason.trim();
    }

    if (body.phone !== undefined) {
      const canonical = normalizeCanonicalPhone(body.phone);
      if (!canonical || !isValidPhoneNumber(canonical)) {
        return NextResponse.json({ success: false, message: 'Số điện thoại không hợp lệ!' }, { status: 400 });
      }
      // Check if duplicate with another item
      const duplicate = db.whitelist.find(w => w.id !== id && normalizeCanonicalPhone(w.phone) === canonical);
      if (duplicate) {
        return NextResponse.json({ success: false, message: `Số ${canonical} đã tồn tại trong danh sách whitelist!` }, { status: 400 });
      }
      currentItem.phone = canonical;
    }

    await writeWhitelistDB(db);

    return NextResponse.json({
      success: true,
      item: currentItem,
      message: 'Cập nhật thông tin whitelist thành công!'
    });
  } catch (error) {
    console.error('Error updating whitelist item:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ khi cập nhật whitelist' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await readWhitelistDB();

    const itemIndex = db.whitelist.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy số trong whitelist!' }, { status: 404 });
    }

    const deletedPhone = db.whitelist[itemIndex].phone;
    db.whitelist = db.whitelist.filter(item => item.id !== id);
    await writeWhitelistDB(db);

    return NextResponse.json({
      success: true,
      message: `Đã xóa số điện thoại ${deletedPhone} khỏi danh sách whitelist!`
    });
  } catch (error) {
    console.error('Error deleting whitelist item:', error);
    return NextResponse.json({ success: false, message: 'Lỗi máy chủ khi xóa số khỏi whitelist' }, { status: 500 });
  }
}

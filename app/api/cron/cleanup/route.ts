import { NextResponse } from 'next/server';
import { cleanupOldData } from '@/lib/server-db';

export async function GET(request: Request) {
  try {
    // Check authorization if CRON_SECRET is set in environment
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await cleanupOldData();

    return NextResponse.json({
      success: true,
      message: 'Cleanup job completed successfully',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error executing cleanup cron:', error);
    return NextResponse.json(
      { success: false, message: 'Cleanup job failed', error: String(error) },
      { status: 500 }
    );
  }
}

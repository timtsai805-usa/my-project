import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/** 安全取得 path param int */
function getIntParam(param: unknown): number | null {
  if (typeof param === 'string') {
    const n = parseInt(param, 10);
    return isNaN(n) ? null : n;
  }
  if (typeof param === 'number') return param;
  return null;
}

/** 解析 deviceTime 字串到 Date */
function parseDeviceTime(dt: any): Date | null {
  if (!dt) return null;
  const iso = String(dt).replace(' ', 'T');
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/** 將 Device 物件序列化成 API 回傳格式 */
function serializeDevice(device: any) {
  return {
    ...device,
    deviceTime: device.deviceTime ? device.deviceTime.toISOString() : null,
    method: device.method ?? null,
  };
}

/** POST /devices - 新增設備，只需 imei */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { imei } = req.body;

    if (!imei || imei.length < 15 || imei.length > 100)
      return res.status(400).json({ message: 'Invalid imei' });

    const existing = await prisma.device.findUnique({ where: { imei } });
    if (existing) return res.status(409).json({ message: 'Device already exists' });

    const newDevice = await prisma.device.create({
      data: {
        imei,
        iccid: null,
        operator: '1',
        rsrp: null,          // 可自由更新
        battery: null,
        charging: false,
        motion: false,
        deviceTime: new Date(),
        macs: '',
        method: null,        // 可自由更新
      },
    });

    return res.status(201).json(serializeDevice(newDevice));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
});

/** GET /devices - 所有設備 */
router.get('/', async (_req, res) => {
  try {
    const devices = await prisma.device.findMany();
    return res.status(200).json(devices.map(serializeDevice));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
});

/** GET /devices/:deviceId - 單一設備 */
router.get('/:deviceId', async (req, res) => {
  try {
    const deviceId = getIntParam(req.params.deviceId);
    if (deviceId === null) return res.status(400).json({ message: 'Invalid deviceId' });

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ message: 'Device not found' });

    return res.status(200).json(serializeDevice(device));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
});

/** PUT /devices/:deviceId - 更新設備，method/rsrp 自由填寫 */
router.put('/:deviceId', async (req, res) => {
  try {
    const deviceId = getIntParam(req.params.deviceId);
    if (deviceId === null) return res.status(400).json({ message: 'Invalid deviceId' });

    let {
      battery,
      charging,
      method,
      latitude,
      longitude,
      accuracy,
      macs,
      deviceTime,
      motion,
      rsrp
    } = req.body;

    // 型別轉換
    battery = battery !== undefined ? Number(battery) : undefined;
    if (battery !== undefined && isNaN(battery))
      return res.status(400).json({ message: 'battery must be a number' });

    charging = charging === true || charging === 'true' || charging === 'Active';
    motion = motion === true || motion === 'true' || motion === 'moving';

    // method 和 rsrp 都改成自由字串
    if (method !== undefined && method !== null) method = String(method);
    if (rsrp !== undefined && rsrp !== null) rsrp = String(rsrp);

    const parsedDate = parseDeviceTime(deviceTime) || new Date();

    const updatedDevice = await prisma.$transaction(async (tx) => {
      const existing = await tx.device.findUnique({ where: { id: deviceId } });
      if (!existing) throw new Error('NOT_FOUND');

      const updated = await tx.device.update({
        where: { id: deviceId },
        data: {
          battery,
          charging,
          method,
          latitude,
          longitude,
          accuracy,
          macs,
          deviceTime: parsedDate,
          motion,
          rsrp,
        },
      });

      // 建立 track 記錄
      await tx.track.create({
        data: {
          deviceId,
          method,
          latitude,
          longitude,
          accuracy,
          deviceTime: parsedDate,
          motion,
        },
      });

      return updated;
    });

    return res.status(200).json(serializeDevice(updatedDevice));
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') return res.status(404).json({ message: 'Device not found' });
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
});

/** DELETE /devices/:deviceId */
router.delete('/:deviceId', async (req, res) => {
  try {
    const deviceId = getIntParam(req.params.deviceId);
    if (deviceId === null) return res.status(400).json({ message: 'Invalid deviceId' });

    await prisma.track.deleteMany({ where: { deviceId } });
    await prisma.device.delete({ where: { id: deviceId } });

    return res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Device not found' });
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
});

/** GET /devices/:deviceId/track?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD */
router.get('/:deviceId/track', async (req, res) => {
  try {
    const deviceId = getIntParam(req.params.deviceId);
    if (deviceId === null)
      return res.status(400).json({ message: 'Invalid deviceId' });

    // 取 query 參數
    let startDateStr = (req.query.startDate as string)?.trim();
    let endDateStr = (req.query.endDate as string)?.trim();

    // 檢查必填
    if (!startDateStr || !endDateStr) {
      return res.status(400).json({
        message: 'Missing startDate or endDate',
      });
    }

    // 驗證格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
      return res.status(400).json({
        message: 'Date format must be YYYY-MM-DD',
      });
    }

    // 解析成 Date 並補齊全天
    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T23:59:59.999Z`);

    if (start > end) {
      return res.status(400).json({
        message: 'startDate cannot be after endDate',
      });
    }

    // 查詢 track
    const tracks = await prisma.track.findMany({
      where: {
        deviceId,
        deviceTime: { gte: start, lte: end },
      },
      orderBy: { deviceTime: 'asc' },
      select: { latitude: true, longitude: true, deviceTime: true },
    });

    // 格式化回傳
    const formatted = tracks.map((t) => ({
      latitude: t.latitude,
      longitude: t.longitude,
      timestamp: t.deviceTime?.toISOString() ?? null,
    }));

    return res.status(200).json({
      total_count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', error });
  }
});
export default router;
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'upload':
        return await importUsers(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[userImport] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

// 一次性查重：分批查询已存在的手机号，避免 in 条件过大
async function findExistingPhones(phones) {
  const existing = new Set();
  const CHUNK_SIZE = 500;
  for (let i = 0; i < phones.length; i += CHUNK_SIZE) {
    const chunk = phones.slice(i, i + CHUNK_SIZE);
    const res = await db.collection('users')
      .where({ phone: _.in(chunk) })
      .field({ phone: true })
      .limit(1000)
      .get();
    res.data.forEach(d => existing.add(d.phone));
  }
  return existing;
}

async function importUsers(data) {
  const fileId = data && data.fileId;
  const operatorId = data && data.operatorId;
  const operatorName = data && data.operatorName;
  if (!fileId || typeof fileId !== 'string') {
    console.error('[importUsers] 参数错误: fileId =', fileId, 'data =', JSON.stringify(data));
    return { code: 1001, message: '参数缺失（fileId 无效）' };
  }

  try {
    // 获取云存储中的 Excel 文件（wx-server-sdk v3.x 使用 fileID 单参）
    const res = await cloud.downloadFile({ fileID: fileId });
    const buffer = res.fileContent;

    // 解析 Excel
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // raw: false -> 优先读取字符串值，但手机号仍可能以 number 类型返回
    // 因此后续用 String() 做二次保险
    // defval: '' -> 空单元格返回空字符串
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: ['name', 'phone'],
      raw: false,
      defval: ''
    });

    // 跳过表头行（第 1 行），过滤掉姓名或手机号为空的无效行
    const dataRows = rows.slice(1).filter(r => {
      const name = r.name ? String(r.name).trim() : '';
      const phone = r.phone !== undefined && r.phone !== null ? String(r.phone).trim() : '';
      return name && phone;
    });
    const result = { total: dataRows.length, success: 0, failed: 0, errors: [] };

    // 1) 逐行基础校验 + 文件内手机号去重
    const pending = [];
    const seenPhones = new Set();
    dataRows.forEach((r, i) => {
      const name = String(r.name).trim();
      const phone = String(r.phone).trim();
      const rowNum = i + 2; // Excel 行号（含表头）

      if (!/^1\d{10}$/.test(phone)) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: `手机号格式错误（"${phone}" 不是有效的11位手机号）` });
        return;
      }
      if (seenPhones.has(phone)) {
        result.failed++;
        result.errors.push({ row: rowNum, reason: `手机号 ${phone} 在文件中重复` });
        return;
      }
      seenPhones.add(phone);
      pending.push({ name, phone, row: rowNum });
    });

    // 2) 一次性查重：把待导入手机号一次性查出来，已存在的直接标记失败
    const existingPhones = pending.length
      ? await findExistingPhones(pending.map(p => p.phone))
      : new Set();

    const toInsert = [];
    for (const p of pending) {
      if (existingPhones.has(p.phone)) {
        result.failed++;
        result.errors.push({ row: p.row, reason: `手机号 ${p.phone} 已存在` });
      } else {
        toInsert.push(p);
      }
    }

    // 3) 批量写入（分批 add，单批 500 条）
    const BATCH_SIZE = 500;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      try {
        await db.collection('users').add({
          data: batch.map(p => ({
            name: p.name,
            phone: p.phone,
            password: '', // 普通用户默认空密码
            role: 'user',
            openId: '',
            status: 'active',
            lastLoginAt: null,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }))
        });
        result.success += batch.length;
      } catch (e) {
        // 整批失败时逐条回退，尽量保住其他记录并给出具体失败原因
        for (const p of batch) {
          try {
            await db.collection('users').add({
              data: {
                name: p.name,
                phone: p.phone,
                password: '',
                role: 'user',
                openId: '',
                status: 'active',
                lastLoginAt: null,
                createdAt: db.serverDate(),
                updatedAt: db.serverDate()
              }
            });
            result.success++;
          } catch (e2) {
            result.failed++;
            result.errors.push({ row: p.row, reason: '导入失败: ' + e2.message });
          }
        }
      }
    }

    await writeLog({
      module: 'user',
      action: 'import',
      targetName: '批量导入',
      detail: `批量导入用户 (成功 ${result.success} 人，失败 ${result.failed} 人)`,
      operatorId,
      operatorName
    });

    return { code: 0, data: result };
  } catch (err) {
    console.error('[importUsers] 错误:', err);
    let message = '文件解析失败，请检查 Excel 格式';
    if (err.message && err.message.includes('Cannot find module')) {
      message = '服务依赖缺失，请重新部署云函数（npm install）';
    } else if (err.message) {
      message = '解析失败: ' + err.message;
    }
    return { code: 500, message };
  }
}

async function writeLog(logData) {
  try {
    await db.collection('admin_logs').add({
      data: {
        ...logData,
        createdAt: db.serverDate()
      }
    });
  } catch (err) {
    if (err.errCode === -502005 || (err.message && err.message.includes('not exist'))) {
      try {
        await db.createCollection('admin_logs');
        await db.collection('admin_logs').add({
          data: {
            ...logData,
            createdAt: db.serverDate()
          }
        });
      } catch (e2) {
        console.error('[userImport] 创建集合或写入失败:', e2);
      }
    } else {
      console.error('[userImport] 日志写入失败:', err);
    }
  }
}

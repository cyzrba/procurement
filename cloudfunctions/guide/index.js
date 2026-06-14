const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createGuide(data);
      case 'update':
        return await updateGuide(data);
      case 'publish':
        return await setGuideStatus({ _id: data._id, status: 'published', operatorId: data.operatorId, operatorName: data.operatorName });
      case 'unpublish':
        return await setGuideStatus({ _id: data._id, status: 'unpublished', operatorId: data.operatorId, operatorName: data.operatorName });
      case 'delete':
        return await deleteGuide(data);
      case 'list':
        return await listGuides(data);
      case 'detail':
        return await getGuideDetail(data);
      case 'match':
        return await matchGuides(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[guide] 错误:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    console.error('[guide] action:', action);
    console.error('[guide] data keys:', data ? Object.keys(data).join(',') : 'no data');
    console.error('[guide] data types:', JSON.stringify(data ? Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === null ? 'null' : typeof v])
    ) : {}));
    return { code: 500, message: '服务器内部错误' };
  }
};

async function createGuide(data) {
  const { title, preparation, processSteps, categoryId, priceRangeId } = data;
  // 兼容旧版（字符串）和新版（{content, media}）preparation 格式
  const prepStr = typeof preparation === 'string' ? preparation : (preparation && preparation.content || '');
  const hasPrepText = prepStr.trim().length > 0;
  const hasPrepMedia = preparation && Array.isArray(preparation.media) && preparation.media.length > 0;
  if (!title || (!hasPrepText && !hasPrepMedia) || !categoryId || !priceRangeId) {
    return { code: 1001, message: '参数缺失（标题、前期准备、类目、价格区间为必填）' };
  }

  // 统一存储为对象格式
  const preparationData = typeof preparation === 'string'
    ? { content: preparation, media: [] }
    : {
        content: (preparation.content || '').trim(),
        media: (preparation.media || []).map(m => ({
          name: m.name,
          fileId: m.fileId,
          size: m.size,
          type: m.type
        }))
      };
  if (!processSteps || !Array.isArray(processSteps) || processSteps.length === 0) {
    return { code: 1001, message: '参数缺失（至少需要一个采购流程步骤）' };
  }

  const res = await db.collection('guides').add({
    data: {
      title,
      preparation: preparationData,
      processSteps: processSteps.map((step, i) => {
        const stepData = {
          stepOrder: i + 1,
          description: step.description || '',
          media: (step.media || []).map(m => ({
            name: m.name,
            fileId: m.fileId,
            size: m.size,
            type: m.type
          }))
        };

        if (step.groups && step.groups.length > 0) {
          stepData.groups = step.groups.map(g => ({
            title: g.title || '',
            media: (g.media || []).map(m => ({
              name: m.name,
              fileId: m.fileId,
              size: m.size,
              type: m.type
            }))
          }));
        }

        return stepData;
      }),
      categoryId,
      priceRangeId,
      status: data.status || 'draft',
      publishedAt: null,
      createdBy: data.createdBy || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  await writeLog({
    module: 'guide',
    action: 'create',
    targetId: res._id,
    targetName: title,
    detail: `新增采购指南「${title}」`,
    operatorId: data.operatorId,
    operatorName: data.operatorName
  });

  return { code: 0, data: { _id: res._id } };
}

async function updateGuide(data) {
  try {
    if (!data._id) return { code: 1001, message: '参数缺失' };
  } catch (e) {
    console.error('[updateGuide:guard]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    return { code: 1001, message: '参数缺失' };
  }

  const updateData = { updatedAt: db.serverDate() };

  // 直接赋值的标量字段
  try {
    const fields = ['title', 'categoryId', 'priceRangeId', 'status'];
    fields.forEach(f => {
      if (data[f] !== undefined) updateData[f] = data[f];
    });
  } catch (e) {
    console.error('[updateGuide:scalar]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    throw e;
  }

  // 临时变量：存储清洗后的原始数据（供 cleanup 使用）和 _.set 包装（供 updateData 使用）
  let rawPreparation, rawProcessSteps;

  // 清洗 preparation（兼容旧版字符串、新版对象、null）
  try {
    if (data.preparation != null) {  // != null 同时排除 undefined 和 null
      if (typeof data.preparation === 'string') {
        rawPreparation = { content: data.preparation, media: [] };
      } else if (typeof data.preparation === 'object') {
        const content = typeof data.preparation.content === 'string'
          ? data.preparation.content.trim()
          : String(data.preparation.content || '').trim();
        const media = (data.preparation.media || []).map(m => ({
          name: m && m.name ? String(m.name) : '',
          fileId: m && m.fileId ? String(m.fileId) : '',
          size: m && typeof m.size === 'number' ? m.size : 0,
          type: m && m.type ? String(m.type) : ''
        }));
        rawPreparation = { content, media };
      } else {
        // 兜底：未知类型
        rawPreparation = { content: String(data.preparation), media: [] };
      }
      updateData.preparation = _.set(rawPreparation);
    }
  } catch (e) {
    console.error('[updateGuide:preparation]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    throw e;
  }

  // 清洗 processSteps
  try {
    if (data.processSteps != null) {
      if (!Array.isArray(data.processSteps) || data.processSteps.length === 0) {
        return { code: 1001, message: '参数缺失（至少需要一个采购流程步骤）' };
      }
      rawProcessSteps = data.processSteps.map((step, i) => {
        const stepData = {
          stepOrder: i + 1,
          description: step && typeof step.description === 'string'
            ? step.description.trim()
            : String(step && step.description || '').trim(),
          media: (step && step.media || []).map(m => ({
            name: m && m.name ? String(m.name) : '',
            fileId: m && m.fileId ? String(m.fileId) : '',
            size: m && typeof m.size === 'number' ? m.size : 0,
            type: m && m.type ? String(m.type) : ''
          }))
        };
        if (step && step.groups && step.groups.length > 0) {
          stepData.groups = step.groups.map(g => ({
            title: g && typeof g.title === 'string'
              ? g.title.trim()
              : String(g && g.title || '').trim(),
            media: (g && g.media || []).map(m => ({
              name: m && m.name ? String(m.name) : '',
              fileId: m && m.fileId ? String(m.fileId) : '',
              size: m && typeof m.size === 'number' ? m.size : 0,
              type: m && m.type ? String(m.type) : ''
            }))
          }));
        }
        return stepData;
      });
      updateData.processSteps = _.set(rawProcessSteps);
    }
  } catch (e) {
    console.error('[updateGuide:processSteps]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    throw e;
  }

  // 清理被删除的云存储媒体文件（对比新旧 fileId 差异）
  try {
    const oldGuide = await db.collection('guides').doc(data._id).get();
    if (oldGuide.data) {
      const oldFileIds = collectMediaFileIds(oldGuide.data);
      const newFileIds = collectMediaFileIds({
        preparation: rawPreparation,
        processSteps: rawProcessSteps
      });
      const removedIds = oldFileIds.filter(id => !newFileIds.includes(id));
      if (removedIds.length > 0) {
        const BATCH_SIZE = 50;
        for (let i = 0; i < removedIds.length; i += BATCH_SIZE) {
          await cloud.deleteFile({ fileList: removedIds.slice(i, i + BATCH_SIZE) });
        }
        console.log('[updateGuide] 清理被替换的媒体文件:', removedIds.length, '个');
      }
    }
  } catch (err) {
    console.error('[updateGuide:cleanup]', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    // 不阻断主流程
  }

  try {
    await db.collection('guides').doc(data._id).update({ data: updateData });
  } catch (e) {
    console.error('[updateGuide:dbUpdate]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    throw e;
  }

  try {
    await writeLog({
      module: 'guide',
      action: 'update',
      targetId: data._id,
      targetName: data.title || '',
      detail: `编辑采购指南「${data.title || ''}」`,
      operatorId: data.operatorId,
      operatorName: data.operatorName
    });
  } catch (e) {
    console.error('[updateGuide:log]', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    // 日志失败不阻断
  }

  return { code: 0, message: '更新成功' };
}

async function setGuideStatus({ _id, status, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  const guide = await db.collection('guides').doc(_id).get();
  const title = guide.data ? guide.data.title : '';

  const updateData = { status, updatedAt: db.serverDate() };
  if (status === 'published') updateData.publishedAt = db.serverDate();

  await db.collection('guides').doc(_id).update({ data: updateData });

  const actionLabel = status === 'published' ? '发布' : '下架';
  await writeLog({
    module: 'guide',
    action: status === 'published' ? 'publish' : 'unpublish',
    targetId: _id,
    targetName: title,
    detail: `${actionLabel}采购指南「${title}」`,
    operatorId,
    operatorName
  });

  return { code: 0, message: status === 'published' ? '发布成功' : '已下架' };
}

async function deleteGuide({ _id, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  const guide = await db.collection('guides').doc(_id).get();
  if (!guide.data) return { code: 1004, message: '指南不存在' };
  const title = guide.data.title || '';

  // 1. 收集所有云存储 fileId
  const fileIds = collectMediaFileIds(guide.data);

  // 2. 级联删除云存储文件（批量，最多 50 个一批）
  if (fileIds.length > 0) {
    try {
      const BATCH_SIZE = 50;
      for (let i = 0; i < fileIds.length; i += BATCH_SIZE) {
        const batch = fileIds.slice(i, i + BATCH_SIZE);
        await cloud.deleteFile({ fileList: batch });
      }
    } catch (err) {
      console.error('[guide] 删除云存储文件失败:', err);
    }
  }

  // 3. 删除指南文档
  await db.collection('guides').doc(_id).remove();

  // 4. 级联删除收藏记录
  try {
    await db.collection('favorites').where({ guideId: _id }).remove();
  } catch (err) {
    console.error('[guide] 删除收藏记录失败:', err);
  }

  await writeLog({
    module: 'guide',
    action: 'delete',
    targetId: _id,
    targetName: title,
    detail: `删除采购指南「${title}」` + (fileIds.length > 0 ? `（级联清除 ${fileIds.length} 个媒体文件）` : ''),
    operatorId,
    operatorName
  });

  return { code: 0, message: '删除成功' };
}

/**
 * 从指南数据中递归提取所有媒体 fileId
 */
function collectMediaFileIds(guideData) {
  const ids = [];

  // 前期准备媒体
  if (guideData.preparation && Array.isArray(guideData.preparation.media)) {
    guideData.preparation.media.forEach(m => {
      if (m.fileId) ids.push(m.fileId);
    });
  }

  // 采购流程步骤媒体 + 分组子项媒体
  if (Array.isArray(guideData.processSteps)) {
    guideData.processSteps.forEach(step => {
      if (Array.isArray(step.media)) {
        step.media.forEach(m => {
          if (m.fileId) ids.push(m.fileId);
        });
      }
      if (Array.isArray(step.groups)) {
        step.groups.forEach(g => {
          if (Array.isArray(g.media)) {
            g.media.forEach(m => {
              if (m.fileId) ids.push(m.fileId);
            });
          }
        });
      }
    });
  }

  return ids;
}

async function listGuides({ status, categoryId, page = 1, pageSize = 20 } = {}) {
  const where = {};
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;

  const countRes = await db.collection('guides').where(where).count();
  const total = countRes.total;

  const res = await db.collection('guides')
    .where(where)
    .orderBy('updatedAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return {
    code: 0,
    data: {
      total,
      page,
      pageSize,
      list: res.data.map(({ _id, title, categoryId, priceRangeId, status, publishedAt, createdAt, updatedAt }) => ({
        _id, title, categoryId, priceRangeId, status, publishedAt, createdAt, updatedAt
      }))
    }
  };
}

async function getGuideDetail({ guideId }) {
  if (!guideId) return { code: 1001, message: '参数缺失' };

  const res = await db.collection('guides').doc(guideId).get();
  if (!res.data) {
    return { code: 1004, message: '指南不存在' };
  }

  return { code: 0, data: res.data };
}

async function matchGuides({ categoryId, priceRangeId }) {
  console.log('[matchGuides] input:', JSON.stringify({ categoryId, priceRangeId }));

  if (!categoryId || !priceRangeId) {
    console.error('[matchGuides] 参数缺失: categoryId=%s, priceRangeId=%s', categoryId, priceRangeId);
    return { code: 1001, message: '参数缺失' };
  }

  // 查询价格区间详情
  const priceRes = await db.collection('priceRanges').doc(priceRangeId).get();
  if (!priceRes.data) {
    return { code: 1003, message: '价格区间不存在' };
  }
  const priceRange = priceRes.data;

  // 查询匹配的指南
  const guideRes = await db.collection('guides')
    .where({
      categoryId,
      priceRangeId,
      status: 'published'
    })
    .orderBy('publishedAt', 'desc')
    .get();

  if (guideRes.data.length === 0) {
    return { code: 1004, message: '该条件下暂无采购指南' };
  }

  return {
    code: 0,
    data: {
      priceRange: {
        _id: priceRange._id,
        label: priceRange.label,
        min: priceRange.min,
        max: priceRange.max
      },
      guides: guideRes.data.map(({ _id, title, publishedAt }) => ({
        _id, title, publishedAt
      }))
    }
  };
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
        console.error('[guide] 创建集合或写入失败:', e2);
      }
    } else {
      console.error('[guide] 日志写入失败:', err);
    }
  }
}

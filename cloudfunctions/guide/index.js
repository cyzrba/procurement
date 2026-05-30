const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createGuide(data);
      case 'update':
        return await updateGuide(data);
      case 'publish':
        return await setGuideStatus({ _id: data._id, status: 'published' });
      case 'unpublish':
        return await setGuideStatus({ _id: data._id, status: 'unpublished' });
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
    console.error('[guide] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function createGuide(data) {
  const { title, content, categoryId, priceRangeId } = data;
  if (!title || !content || !categoryId || !priceRangeId) {
    return { code: 1001, message: '参数缺失（标题、内容、类目、价格区间为必填）' };
  }

  const res = await db.collection('guides').add({
    data: {
      title,
      coverImage: data.coverImage || '',
      content,
      categoryId,
      priceRangeId,
      attachments: data.attachments || [],
      status: data.status || 'draft',
      publishedAt: null,
      createdBy: data.createdBy || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  return { code: 0, data: { _id: res._id } };
}

async function updateGuide(data) {
  if (!data._id) return { code: 1001, message: '参数缺失' };

  const updateData = { updatedAt: db.serverDate() };
  const fields = ['title', 'coverImage', 'content', 'categoryId', 'priceRangeId', 'attachments', 'status'];
  fields.forEach(f => {
    if (data[f] !== undefined) updateData[f] = data[f];
  });

  await db.collection('guides').doc(data._id).update({ data: updateData });
  return { code: 0, message: '更新成功' };
}

async function setGuideStatus({ _id, status }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  const updateData = { status, updatedAt: db.serverDate() };
  if (status === 'published') updateData.publishedAt = db.serverDate();

  await db.collection('guides').doc(_id).update({ data: updateData });
  return { code: 0, message: status === 'published' ? '发布成功' : '已下架' };
}

async function deleteGuide({ _id }) {
  if (!_id) return { code: 1001, message: '参数缺失' };
  await db.collection('guides').doc(_id).remove();
  return { code: 0, message: '删除成功' };
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
      list: res.data.map(({ _id, title, coverImage, categoryId, priceRangeId, status, publishedAt, createdAt, updatedAt }) => ({
        _id, title, coverImage, categoryId, priceRangeId, status, publishedAt, createdAt, updatedAt
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
      guides: guideRes.data.map(({ _id, title, coverImage, publishedAt }) => ({
        _id, title, coverImage, publishedAt
      }))
    }
  };
}

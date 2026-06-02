const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: 401, message: '未登录' };
  }

  try {
    switch (action) {
      case 'toggle':
        return await toggleFavorite(OPENID, data);
      case 'list':
        return await listFavorites(OPENID, data);
      case 'check':
        return await checkFavorites(OPENID, data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[favorite] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function toggleFavorite(openId, { guideId }) {
  if (!guideId) return { code: 1001, message: '参数缺失' };

  let existRes;
  try {
    existRes = await db.collection('favorites')
      .where({ userId: openId, guideId })
      .get();
  } catch (e) {
    existRes = { data: [] };
  }

  if (existRes.data.length > 0) {
    try {
      await db.collection('favorites').doc(existRes.data[0]._id).remove();
    } catch (e) {
      // ignore remove error
    }
    return { code: 0, data: { favorited: false } };
  }

  try {
    await db.createCollection('favorites').catch(() => {});
    await db.collection('favorites').add({
      data: {
        userId: openId,
        guideId,
        createdAt: new Date()
      }
    });
  } catch (e) {
    console.error('[toggleFavorite] add 失败:', e);
    return { code: 500, message: '添加收藏失败: ' + (e.message || '') };
  }

  return { code: 0, data: { favorited: true } };
}

async function listFavorites(openId, { categoryId } = {}) {
  let favRes;
  try {
    favRes = await db.collection('favorites')
      .where({ userId: openId })
      .get();
  } catch (e) {
    favRes = { data: [] };
  }

  if (favRes.data.length === 0) {
    return { code: 0, data: [] };
  }

  const guideIds = favRes.data.map(f => f.guideId);
  const guides = [];
  for (const guideId of guideIds) {
    try {
      const guideRes = await db.collection('guides').doc(guideId).get();
      if (guideRes.data) {
        if (categoryId && guideRes.data.categoryId !== categoryId) {
          continue;
        }
        guides.push({
          _id: guideRes.data._id,
          title: guideRes.data.title,
          coverImage: guideRes.data.coverImage || '',
          categoryId: guideRes.data.categoryId,
          priceRangeId: guideRes.data.priceRangeId,
          status: guideRes.data.status,
          publishedAt: guideRes.data.publishedAt,
          favoritedAt: favRes.data.find(f => f.guideId === guideId).createdAt
        });
      }
    } catch (e) {
      // guide 可能已被删除，跳过
    }
  }

  return { code: 0, data: guides };
}

async function checkFavorites(openId, { guideIds }) {
  if (!guideIds || guideIds.length === 0) {
    return { code: 0, data: {} };
  }

  const _ = db.command;
  let favRes;
  try {
    favRes = await db.collection('favorites')
      .where({
        userId: openId,
        guideId: _.in(guideIds)
      })
      .get();
  } catch (e) {
    favRes = { data: [] };
  }

  const result = {};
  guideIds.forEach(id => { result[id] = false; });
  favRes.data.forEach(fav => { result[fav.guideId] = true; });

  return { code: 0, data: result };
}

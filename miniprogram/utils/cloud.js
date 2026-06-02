/**
 * 云函数调用封装
 */
const auth = require('./auth');

const call = (name, action, data = {}) => {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data: { action, data }
    }).then(res => {
      const result = res.result || {};
      if (result.code === 0) {
        resolve(result.data);
      } else {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' });
        reject(result);
      }
    }).catch(err => {
      wx.showToast({ title: '网络错误', icon: 'none' });
      reject(err);
    });
  });
};

const withAdminCtx = (data) => {
  const user = auth.getUser();
  if (user) {
    data.operatorId = user.userId;
    data.operatorName = user.username || user.name;
  }
  return data;
};

module.exports = {
  // 用户
  userLogin: (name, phone) => call('user', 'userLogin', { name, phone }),
  adminLogin: (username, password) => call('user', 'adminLogin', { username, password }),
  autoLogin: () => call('user', 'autoLogin'),
  updateSubscription: (templates) => call('user', 'updateSubscription', { templates }),
  getUserInfo: (userId) => call('user', 'getUserInfo', { userId }),
  updateUser: (_id, data) => call('user', 'updateUser', withAdminCtx({ _id, ...data })),
  deleteUser: (_id) => call('user', 'deleteUser', withAdminCtx({ _id })),
  createUser: (name, phone, status) => call('user', 'createUser', withAdminCtx({ name, phone, status })),

  // 类目
  getCategories: (status) => call('category', 'list', { status }),
  createCategory: (name, description) => call('category', 'create', withAdminCtx({ name, description })),
  updateCategory: (_id, data) => call('category', 'update', withAdminCtx({ _id, ...data })),
  deleteCategory: (_id) => call('category', 'delete', withAdminCtx({ _id })),

  // 价格区间
  getPriceRanges: (enabled) => call('priceRange', 'list', { enabled }),
  createPriceRange: (data) => call('priceRange', 'create', withAdminCtx(data)),
  updatePriceRange: (_id, data) => call('priceRange', 'update', withAdminCtx({ _id, ...data })),
  deletePriceRange: (_id) => call('priceRange', 'delete', withAdminCtx({ _id })),
  matchPriceRange: (amount) => call('priceRange', 'match', { amount }),

  // 指南
  createGuide: (data) => call('guide', 'create', withAdminCtx(data)),
  updateGuide: (data) => call('guide', 'update', withAdminCtx(data)),
  publishGuide: (_id) => call('guide', 'publish', withAdminCtx({ _id })),
  unpublishGuide: (_id) => call('guide', 'unpublish', withAdminCtx({ _id })),
  deleteGuide: (_id) => call('guide', 'delete', withAdminCtx({ _id })),
  getGuides: (params) => call('guide', 'list', params),
  getGuideDetail: (guideId) => call('guide', 'detail', { guideId }),
  matchGuides: (categoryId, priceRangeId) => call('guide', 'match', { categoryId, priceRangeId }),

  // 用户导入
  importUsers: (fileId) => call('userImport', 'upload', withAdminCtx({ fileId })),

  // 消息
  createMessage: (data) => call('message', 'create', data),
  getMessages: (page, pageSize) => call('message', 'list', { page, pageSize }),
  sendSubscriptionMessage: (messageId) => call('message', 'sendSubscription', { messageId }),

  // 收藏
  toggleFavorite: (guideId) => call('favorite', 'toggle', { guideId }),
  getFavorites: () => call('favorite', 'list'),
  checkFavorites: (guideIds) => call('favorite', 'check', { guideIds }),

  // 上传
  getTempFileURL: (fileList) => call('upload', 'getTempFileURL', { fileList }),

  // 管理员日志
  getAdminLogs: (module, page, pageSize) => call('adminLog', 'list', { module, page, pageSize }),
  deleteAdminLogs: (ids) => call('adminLog', 'deleteBatch', { ids }),
};

/**
 * 云函数调用封装
 */
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

module.exports = {
  // 用户
  userLogin: (name, phone) => call('user', 'userLogin', { name, phone }),
  adminLogin: (username, password) => call('user', 'adminLogin', { username, password }),
  autoLogin: () => call('user', 'autoLogin'),
  updateSubscription: (templates) => call('user', 'updateSubscription', { templates }),
  getUserInfo: (userId) => call('user', 'getUserInfo', { userId }),
  updateUser: (_id, data) => call('user', 'updateUser', { _id, ...data }),
  deleteUser: (_id) => call('user', 'deleteUser', { _id }),
  createUser: (name, phone, status) => call('user', 'createUser', { name, phone, status }),

  // 类目
  getCategories: (status) => call('category', 'list', { status }),
  createCategory: (name, description) => call('category', 'create', { name, description }),
  updateCategory: (_id, data) => call('category', 'update', { _id, ...data }),
  deleteCategory: (_id) => call('category', 'delete', { _id }),

  // 价格区间
  getPriceRanges: (enabled) => call('priceRange', 'list', { enabled }),
  createPriceRange: (data) => call('priceRange', 'create', data),
  updatePriceRange: (_id, data) => call('priceRange', 'update', { _id, ...data }),
  deletePriceRange: (_id) => call('priceRange', 'delete', { _id }),
  matchPriceRange: (amount) => call('priceRange', 'match', { amount }),

  // 指南
  createGuide: (data) => call('guide', 'create', data),
  updateGuide: (data) => call('guide', 'update', data),
  publishGuide: (_id) => call('guide', 'publish', { _id }),
  unpublishGuide: (_id) => call('guide', 'unpublish', { _id }),
  deleteGuide: (_id) => call('guide', 'delete', { _id }),
  getGuides: (params) => call('guide', 'list', params),
  getGuideDetail: (guideId) => call('guide', 'detail', { guideId }),
  matchGuides: (categoryId, priceRangeId) => call('guide', 'match', { categoryId, priceRangeId }),

  // 用户导入
  importUsers: (fileId) => call('userImport', 'upload', { fileId }),

  // 消息
  createMessage: (data) => call('message', 'create', data),
  getMessages: (page, pageSize) => call('message', 'list', { page, pageSize }),
  sendSubscriptionMessage: (messageId) => call('message', 'sendSubscription', { messageId }),

  // 上传
  getTempFileURL: (fileList) => call('upload', 'getTempFileURL', { fileList }),
};

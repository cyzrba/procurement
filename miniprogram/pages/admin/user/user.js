const cloud = require('../../../utils/cloud');
const auth = require('../../../utils/auth');

Page({
  data: {
    list: [],
    total: 0,
    importResult: null,
    importErrors: [],
    // 编辑弹窗
    showModal: false,
    editing: null,
    formName: '',
    formPhone: '',
    formStatus: 'active',
    statusOptions: ['正常', '禁用'],
    // 导入弹窗
    showImportModal: false,
    importFormName: '',
    importFormPhone: '',
    importFormStatus: 'active'
  },

  onLoad() { this.loadUsers(); },

  onShow() { this.loadUsers(); },

  loadUsers() {
    const db = wx.cloud.database();
    db.collection('users').where({ role: 'user' }).get().then(res => {
      this.setData({ list: res.data, total: res.data.length });
    });
  },

  // ===== 批量导入 =====
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        if (!res.tempFiles || !res.tempFiles.length) {
          return wx.showToast({ title: '未选择文件', icon: 'none' });
        }
        const file = res.tempFiles[0];
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
          return wx.showToast({ title: '请选择 Excel 文件（.xlsx/.xls）', icon: 'none' });
        }
        if (!file.path) {
          return wx.showToast({ title: '无法读取文件路径', icon: 'none' });
        }

        wx.showLoading({ title: '上传中...' });
        const cloudPath = `imports/${Date.now()}_${file.name}`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: file.path,
          success: (uploadRes) => {
            if (!uploadRes || !uploadRes.fileID) {
              wx.hideLoading();
              return wx.showToast({ title: '上传失败，未获取到文件 ID', icon: 'none' });
            }
            wx.hideLoading();
            wx.showLoading({ title: '导入中...' });
            cloud.importUsers(uploadRes.fileID).then(result => {
              wx.hideLoading();
              this.setData({
                importResult: result,
                importErrors: result.errors || []
              });
              wx.showToast({ title: `导入完成: ${result.success}/${result.total}` });
              this.loadUsers();
              if (result.failed > 0) {
                setTimeout(() => {
                  wx.showModal({
                    title: '导入详情',
                    content: `成功 ${result.success} 人，失败 ${result.failed} 人\n点击「查看详情」查看失败原因`,
                    confirmText: '查看详情',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        // 页面已显示错误区域
                      }
                    }
                  });
                }, 1500);
              }
            }).catch((err) => {
              wx.hideLoading();
              console.error('[import error]', err);
            });
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('[upload fail]', err);
            wx.showToast({ title: '上传失败，请检查网络', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('[chooseFile fail]', err);
        wx.showToast({ title: '选择文件失败', icon: 'none' });
      }
    });
  },

  clearImportResult() {
    this.setData({ importResult: null, importErrors: [] });
  },

  // ===== 弹窗表单绑定 =====
  onNameInput(e) {
    this.setData({ formName: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ formPhone: e.detail.value });
  },

  onStatusChange(e) {
    const value = Number(e.detail.value) === 0 ? 'active' : 'disabled';
    this.setData({ formStatus: value });
  },

  // ===== 编辑用户 =====
  showEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true,
      editing: item,
      formName: item.name,
      formPhone: item.phone,
      formStatus: item.status || 'active'
    });
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  handleSave() {
    const { formName, formPhone, formStatus, editing } = this.data;

    if (!formName.trim()) {
      return wx.showToast({ title: '请输入用户姓名', icon: 'none' });
    }
    if (!/^1\d{10}$/.test(formPhone.trim())) {
      return wx.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
    }

    cloud.updateUser(editing._id, {
      name: formName.trim(),
      phone: formPhone.trim(),
      status: formStatus
    }).then(() => {
      wx.showToast({ title: '更新成功' });
      this.closeModal();
      this.loadUsers();
    });
  },

  // ===== 删除用户 =====
  handleDelete(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除用户「${item.name}」吗？删除后不可恢复。`,
      success: (res) => {
        if (res.confirm) {
          cloud.deleteUser(item._id).then(() => {
            wx.showToast({ title: '已删除' });
            this.loadUsers();
          });
        }
      }
    });
  },

  // ===== 单独导入用户 =====
  showImportModal() {
    this.setData({
      showImportModal: true,
      importFormName: '',
      importFormPhone: '',
      importFormStatus: 'active'
    });
  },

  closeImportModal() {
    this.setData({ showImportModal: false });
  },

  onImportNameInput(e) {
    this.setData({ importFormName: e.detail.value });
  },

  onImportPhoneInput(e) {
    this.setData({ importFormPhone: e.detail.value });
  },

  onImportStatusChange(e) {
    const value = Number(e.detail.value) === 0 ? 'active' : 'disabled';
    this.setData({ importFormStatus: value });
  },

  handleImportSubmit() {
    const { importFormName, importFormPhone, importFormStatus } = this.data;

    if (!importFormName.trim()) {
      return wx.showToast({ title: '请输入用户姓名', icon: 'none' });
    }
    if (!/^1\d{10}$/.test(importFormPhone.trim())) {
      return wx.showToast({ title: '请输入正确的11位手机号', icon: 'none' });
    }

    cloud.createUser(importFormName.trim(), importFormPhone.trim(), importFormStatus).then(() => {
      wx.showToast({ title: '导入成功' });
      this.closeImportModal();
      this.loadUsers();
    });
  }
});

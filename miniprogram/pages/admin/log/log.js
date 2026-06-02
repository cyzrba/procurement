const cloud = require('../../../utils/cloud');
const auth = require('../../../utils/auth');

const TAB_MAP = [
  { label: '类目管理', key: 'category' },
  { label: '价格区间', key: 'priceRange' },
  { label: '采购指南', key: 'guide' },
  { label: '用户管理', key: 'user' }
];

Page({
  data: {
    tabs: TAB_MAP,
    activeTab: 0,
    logs: [],
    total: 0,
    page: 1,
    pageSize: 50,
    loading: false,
    noMore: false,
    selectingMode: false,
    selectedIds: {},
    selectedCount: 0
  },

  onLoad() {
    const user = auth.getUser();
    if (!user || user.role !== 'admin') {
      return wx.reLaunch({ url: '/pages/login/login' });
    }
    this.loadLogs();
  },

  loadLogs() {
    if (this.data.loading || this.data.noMore) return;
    this.setData({ loading: true });

    const module = TAB_MAP[this.data.activeTab].key;
    cloud.getAdminLogs(module, this.data.page, this.data.pageSize).then(result => {
      let logs = result.list || [];
      logs = logs.map(item => ({
        ...item,
        createdAt: item.createdAt || '',
        timeDisplay: this.formatTime(item.createdAt)
      }));

      if (this.data.page === 1) {
        this.setData({ logs, total: result.total || 0, noMore: logs.length >= result.total });
      } else {
        const combined = this.data.logs.concat(logs);
        this.setData({ logs: combined, total: result.total || 0, noMore: combined.length >= result.total });
      }
    }).catch(() => {
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  switchTab(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.activeTab) return;
    this.setData({
      activeTab: index,
      logs: [],
      page: 1,
      noMore: false,
      selectingMode: false,
      selectedIds: {},
      selectedCount: 0
    });
    this.loadLogs();
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    this.loadLogs();
  },

  formatTime(dateVal) {
    if (!dateVal) return '';
    let d;
    if (typeof dateVal === 'string') {
      d = new Date(dateVal);
    } else if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else if (dateVal.getTime) {
      d = dateVal;
    } else {
      return dateVal;
    }
    if (isNaN(d.getTime())) return dateVal;
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  },

  // 进入/退出多选模式
  toggleSelectingMode() {
    if (this.data.selectingMode) {
      this.setData({ selectingMode: false, selectedIds: {}, selectedCount: 0 });
    } else {
      this.setData({ selectingMode: true, selectedIds: {}, selectedCount: 0 });
    }
  },

  // 切换单条选中
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const newSelected = { ...this.data.selectedIds };
    if (newSelected[id]) {
      delete newSelected[id];
    } else {
      newSelected[id] = true;
    }
    const count = Object.keys(newSelected).length;
    this.setData({ selectedIds: newSelected, selectedCount: count });
  },

  // 全选当前页
  selectAll() {
    const ids = {};
    this.data.logs.forEach(log => { ids[log._id] = true; });
    this.setData({ selectedIds: ids, selectedCount: this.data.logs.length });
  },

  // 删除选中日志
  confirmDelete() {
    const ids = Object.keys(this.data.selectedIds);
    if (ids.length === 0) {
      return wx.showToast({ title: '请先选择日志', icon: 'none' });
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的 ${ids.length} 条日志吗？`,
      success: (res) => {
        if (res.confirm) {
          cloud.deleteAdminLogs(ids).then(() => {
            wx.showToast({ title: `已删除 ${ids.length} 条` });
            this.setData({
              selectingMode: false,
              selectedIds: {},
              selectedCount: 0,
              logs: [],
              page: 1,
              noMore: false
            });
            this.loadLogs();
          }).catch(() => {});
        }
      }
    });
  }
});

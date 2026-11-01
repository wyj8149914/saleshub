<template>
  <div class="page">
    <div class="page-head">
      <!-- 筛选条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-input
          v-model:value="filterUsername"
          placeholder="用户名"
          style="width: 150px"
          allow-clear
          @pressEnter="handleSearch"
        />

        <a-input
          v-model:value="filterName"
          placeholder="姓名"
          style="width: 150px"
          allow-clear
          @pressEnter="handleSearch"
        />

        <a-input
          v-model:value="filterPhone"
          placeholder="手机号"
          style="width: 150px"
          allow-clear
          @pressEnter="handleSearch"
        />

        <a-select
          v-model:value="filterRole"
          placeholder="角色"
          allow-clear
          style="width: 120px"
          :options="roleOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterStatus"
          placeholder="状态"
          allow-clear
          style="width: 100px"
          :options="statusOptions"
          @change="handleSearch"
        />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <!-- 新建用户入口 -->
      <a-space :size="12" wrap class="action-buttons">
        <a-button type="primary" @click="openForm(null)">
          <template #icon><PlusOutlined /></template>
          新建用户
        </a-button>
      </a-space>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="{
          current: pageIndex,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 条`,
          onChange: handlePageChange,
        }"
        bordered
        :row-key="(record: UserListItem) => record.user_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'phone'">
            {{ record.phone || '-' }}
          </template>

          <template v-else-if="column.key === 'role'">
            <a-tag :color="record.role === 'admin' ? 'geekblue' : 'default'">
              {{ USER_ROLE_LABELS[record.role as UserRole] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.status === UserStatus.NORMAL" color="success">正常</a-tag>
            <a-tag v-else color="error">停用</a-tag>
          </template>

          <template v-else-if="column.key === 'last_login_time'">
            {{ formatDateTime(record.last_login_time) }}
          </template>

          <template v-else-if="column.key === 'create_time'">
            {{ formatDateTime(record.create_time) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openForm(record)">修改</a-button>
              <!-- 自我保护:当前登录用户自己的行不展示修改密码/停用 -->
              <a-button v-if="!isSelf(record)" type="link" size="small" @click="openPassword(record)">
                修改密码
              </a-button>
              <a-popconfirm
                v-if="!isSelf(record)"
                :title="record.status === UserStatus.NORMAL ? '确定要停用该用户吗？' : '确定要启用该用户吗？'"
                ok-text="确认"
                cancel-text="取消"
                placement="left"
                @confirm="handleToggleStatus(record)"
              >
                <a-button type="link" size="small" :danger="record.status === UserStatus.NORMAL">
                  {{ record.status === UserStatus.NORMAL ? '停用' : '启用' }}
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/修改用户弹窗 -->
    <UserFormModal v-model:open="formOpen" :user="formTarget" @success="loadList" />

    <!-- 修改密码弹窗 -->
    <UserPasswordModal v-model:open="passwordOpen" :user="passwordTarget" @success="loadList" />
  </div>
</template>

<script setup lang="ts">
/**
 * 用户管理列表页(仅管理员可见,路由守卫已拦截非 admin 访问)
 * 功能:分页查询 + 筛选(用户名/姓名/手机号/角色/状态)、新建/修改用户、修改密码、启用/停用
 * 自我保护:当前登录 admin 自己的行隐藏「修改密码」与「停用」,避免锁死自己
 */
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/stores/auth';
import { USER_ROLE_LABELS, USER_STATUS_LABELS, UserStatus } from '@/types/user';
import type { UserListItem, UserListQuery } from '@/types/user';
import type { UserRole } from '@/types/auth';
import UserFormModal from '@/components/system/UserFormModal.vue';
import UserPasswordModal from '@/components/system/UserPasswordModal.vue';

const authStore = useAuthStore();

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 150, fixed: 'left' as const },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 130, ellipsis: true },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '角色', key: 'role', width: 100 },
  { title: '状态', key: 'status', width: 90 },
  { title: '最后登录时间', dataIndex: 'last_login_time', key: 'last_login_time', width: 180 },
  { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 180 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<UserListItem[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 筛选状态 ============
const filterUsername = ref('');
const filterName = ref('');
const filterPhone = ref('');
const filterRole = ref<UserRole | undefined>(undefined);
const filterStatus = ref<number | undefined>(undefined);

// 筛选下拉选项
const roleOptions = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({
  label,
  value,
}));
const statusOptions = Object.entries(USER_STATUS_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 是否当前登录用户自己的行 */
const isSelf = (record: UserListItem) => record.user_id === authStore.user?.user_id;

/** 加载用户列表(服务端分页);翻页/筛选/刷新共用 */
const loadList = async () => {
  loading.value = true;
  try {
    const query: UserListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    };
    const username = filterUsername.value.trim();
    if (username) {
      query.username = username;
    }
    const name = filterName.value.trim();
    if (name) {
      query.name = name;
    }
    const phone = filterPhone.value.trim();
    if (phone) {
      query.phone = phone;
    }
    if (filterRole.value) {
      query.role = filterRole.value;
    }
    if (filterStatus.value) {
      query.status = filterStatus.value;
    }

    const res = await userApi.listUsers(query);
    records.value = res.datas.items || [];
    total.value = res.datas.total || 0;
  } catch {
    // 错误已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

/** 查询(重置页码) */
const handleSearch = () => {
  pageIndex.value = 1;
  loadList();
};

/** 重置筛选条件并刷新 */
const handleReset = () => {
  filterUsername.value = '';
  filterName.value = '';
  filterPhone.value = '';
  filterRole.value = undefined;
  filterStatus.value = undefined;
  pageIndex.value = 1;
  loadList();
};

const handlePageChange = (page: number, size: number) => {
  pageIndex.value = page;
  pageSize.value = size;
  loadList();
};

// ============ 新建/修改弹窗 ============
const formOpen = ref(false);
/** 编辑目标用户,null 表示新建 */
const formTarget = ref<UserListItem | null>(null);

const openForm = (record: UserListItem | null) => {
  formTarget.value = record;
  formOpen.value = true;
};

// ============ 修改密码弹窗 ============
const passwordOpen = ref(false);
const passwordTarget = ref<UserListItem | null>(null);

const openPassword = (record: UserListItem) => {
  passwordTarget.value = record;
  passwordOpen.value = true;
};

/**
 * 启用/停用用户(popconfirm 二次确认)
 * 停用后该用户无法登录,成功后刷新列表
 */
const handleToggleStatus = async (record: UserListItem) => {
  const targetStatus = record.status === UserStatus.NORMAL ? UserStatus.DISABLED : UserStatus.NORMAL;
  try {
    await userApi.updateUserStatus({ user_id: record.user_id, status: targetStatus });
    message.success(targetStatus === UserStatus.NORMAL ? '已启用' : '已停用');
    loadList();
  } catch {
    // 错误已由全局拦截器提示
  }
};

/** 时间格式化为本地日期时间 */
const formatDateTime = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

onMounted(() => {
  loadList();
});
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.action-buttons {
  margin-top: 12px;
}

.table-card {
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.table-card :deep(.ant-card-body) {
  padding: 0;
}

.table-card :deep(.ant-table-tbody > tr:hover > td) {
  background: #dce8f5;
}
</style>

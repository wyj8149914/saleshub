<template>
  <div class="page">
    <div class="page-head">
      <!-- 第一行:关键字筛选与查询/重置 -->
      <a-space :size="12" wrap>
        <a-input
          v-model:value="filterKeyword"
          placeholder="类型名称关键字"
          style="width: 220px"
          allow-clear
          @press-enter="handleSearch"
        />
        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <!-- 第二行:新建入口 -->
      <a-space :size="12" wrap class="action-buttons">
        <a-button type="primary" @click="formOpen = true">
          <template #icon>
            <PlusOutlined />
          </template>
          新建类型
        </a-button>
      </a-space>
    </div>

    <a-card :bordered="false" class="table-card">
      <a-table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        :pagination="false"
        bordered
        :row-key="(record: TodoType) => record.type_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type_name'">
            {{ record.type_name }}
          </template>

          <template v-else-if="column.key === 'user_id'">
            {{ userName(record.user_id) }}
          </template>

          <template v-else-if="column.key === 'create_time'">
            {{ formatDateTime(record.create_time) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-popconfirm
              title="确定要删除此类型吗？"
              ok-text="删除"
              cancel-text="取消"
              placement="left"
              @confirm="handleDelete(record)"
            >
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建类型弹窗 -->
    <TodoTypeFormModal v-model:open="formOpen" @success="loadList" />
  </div>
</template>

<script setup lang="ts">
/**
 * 待办类型列表页:查询全部正常状态的类型(不分页),支持名称关键字模糊筛选
 * 入口:新建(弹窗)、删除(popconfirm 软删除)
 */
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { todoTypeApi } from '@/api/todo';
import { userApi } from '@/api/user';
import type { TodoType } from '@/types/todo';
import TodoTypeFormModal from '@/components/todo/TodoTypeFormModal.vue';

const columns = [
  { title: '类型名称', dataIndex: 'type_name', key: 'type_name', width: 240, ellipsis: true },
  { title: '创建人', key: 'user_id', width: 180 },
  { title: '创建时间', key: 'create_time', width: 180 },
  { title: '操作', key: 'action', width: 100 },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<TodoType[]>([]);
const filterKeyword = ref('');

// ============ 新建类型弹窗 ============
const formOpen = ref(false);

// ============ 用户映射(创建人翻译姓名) ============
const userNameMap = ref<Record<string, string>>({});

/** 拉取用户列表建立 user_id → 姓名 映射 */
const loadUserMap = async () => {
  try {
    const res = await userApi.listUsers({ pageIndex: 1, pageSize: 500 });
    const map: Record<string, string> = {};
    for (const user of res.datas.items || []) {
      map[user.user_id] = `${user.name} (${user.username})`;
    }
    userNameMap.value = map;
  } catch {
    userNameMap.value = {};
  }
};

/** 用户 ID 翻译姓名,映射缺失时降级为 ID 前 8 位 */
const userName = (userId: string): string => userNameMap.value[userId] || userId.slice(0, 8);

/** 加载类型列表;筛选/刷新共用 */
const loadList = async () => {
  loading.value = true;
  try {
    const keyword = filterKeyword.value.trim();
    const res = await todoTypeApi.list(keyword || undefined);
    records.value = res.datas.items || [];
  } catch {
    // 错误已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

/** 查询 */
const handleSearch = () => {
  loadList();
};

/** 重置筛选条件并刷新 */
const handleReset = () => {
  filterKeyword.value = '';
  loadList();
};

/**
 * 删除类型:popconfirm 二次确认 → 调接口 → 成功后刷新列表
 * 已被待办引用的类型删除后不影响既有待办的类型名展示
 */
const handleDelete = async (record: TodoType) => {
  try {
    await todoTypeApi.delete(record.type_id);
    message.success('删除成功');
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
  loadUserMap();
});
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 头部两行布局:第一行筛选条件,第二行操作按钮 */
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

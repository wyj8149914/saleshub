<template>
  <div class="page">
    <div class="page-head">
      <!-- 第一行:筛选条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-select
          v-model:value="filterPriority"
          placeholder="重要程度"
          allow-clear
          style="width: 130px"
          :options="priorityOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterCompleted"
          placeholder="完成状态"
          allow-clear
          style="width: 110px"
          :options="completedOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterSort"
          placeholder="排序方式"
          allow-clear
          style="width: 140px"
          :options="sortOptions"
          @change="handleSearch"
        />

        <a-range-picker v-model:value="filterDateRange" format="YYYY-MM-DD" value-format="YYYY-MM-DD" />

        <a-input
          v-model:value="filterKeyword"
          placeholder="待办名称关键字"
          style="width: 180px"
          allow-clear
          @press-enter="handleSearch"
        />

        <!-- 仅我的待办:executor_id 填当前登录用户 -->
        <a-checkbox :checked="filterMineOnly" @change="handleMineOnlyChange">仅我的待办</a-checkbox>

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
        <a-button type="primary" @click="openForm(null)">
          <template #icon>
            <PlusOutlined />
          </template>
          新建待办
        </a-button>
      </a-space>
    </div>

    <a-card :bordered="false" class="table-card">
      <!-- 待办类型 tab 切换(默认全部,选项由接口加载) -->
      <a-tabs v-model:active-key="typeTabKey" class="list-tabs" @change="handleSearch">
        <a-tab-pane key="all" tab="全部" />
        <a-tab-pane v-for="opt in typeOptions" :key="opt.value" :tab="opt.label" />
      </a-tabs>

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
        :row-key="(record: Todo) => record.todo_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            {{ record.title }}
          </template>

          <template v-else-if="column.key === 'type_name'">
            {{ record.type_name || '-' }}
          </template>

          <template v-else-if="column.key === 'priority'">
            <a-tag :color="PRIORITY_COLORS[record.priority]">
              {{ TODO_PRIORITY_LABELS[record.priority] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'deadline'">
            <div>{{ record.deadline }}</div>
            <div :class="remainingClass(record.remaining_days)" class="remaining-text">
              {{ remainingText(record.remaining_days) }}
            </div>
          </template>

          <template v-else-if="column.key === 'executors'">
            <template v-if="record.executors.length > 0">
              <a-tag v-for="e in record.executors" :key="e.user_id" color="blue" class="executor-tag">
                {{ userName(e.user_id) }}
              </a-tag>
            </template>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'postpone'">
            <span v-if="record.postpone_count > 0">
              {{ record.postpone_count }} 次 / {{ record.total_delay_days }} 天
            </span>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'is_completed'">
            <a-tag :color="record.is_completed === TodoCompleted.YES ? 'green' : 'orange'">
              {{ record.is_completed === TodoCompleted.YES ? '已完成' : '未完成' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'create_time'">
            {{ formatDatePart(record.create_time) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <!-- 完成状态切换:popconfirm 二次确认 -->
              <a-popconfirm
                :title="record.is_completed === TodoCompleted.YES ? '确认取消完成状态吗？' : '确认标记为已完成吗？'"
                ok-text="确认"
                cancel-text="取消"
                @confirm="handleComplete(record)"
              >
                <a-button type="link" size="small">
                  {{ record.is_completed === TodoCompleted.YES ? '取消完成' : '完成' }}
                </a-button>
              </a-popconfirm>
              <a-button
                v-if="record.is_completed === TodoCompleted.NO"
                type="link"
                size="small"
                @click="openPostpone(record)"
                >延期</a-button
              >
              <a-button type="link" size="small" @click="openForm(record)">编辑</a-button>
              <a-popconfirm
                title="确定要删除此待办吗？"
                ok-text="删除"
                cancel-text="取消"
                placement="left"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/修改弹窗 -->
    <TodoFormModal v-model:open="formOpen" :todo="formTarget" :user-options="userOptions" @success="loadList" />

    <!-- 详情抽屉 -->
    <TodoDetailDrawer
      ref="detailDrawerRef"
      v-model:open="detailOpen"
      :todo-id="detailId"
      :user-name-map="userNameMap"
      @success="handleDetailChanged"
      @postpone="handleDetailPostpone"
      @edit="handleDetailEdit"
    />

    <!-- 延期弹窗 -->
    <TodoPostponeModal v-model:open="postponeOpen" :todo="postponeTarget" @success="handlePostponeSuccess" />
  </div>
</template>

<script setup lang="ts">
/**
 * 待办事项列表页:分页查询 + 类型 tab 切换 + 筛选(重要程度/完成状态/截止日期区间/关键字/仅我的待办/排序)
 * 入口:新建/编辑(弹窗)、详情(抽屉,内含完成状态变更/延期/编辑入口)、延期(弹窗)、
 * 完成状态切换(popconfirm)、删除(popconfirm 软删除)
 */
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { todoApi, todoTypeApi } from '@/api/todo';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/stores/auth';
import { TODO_PRIORITY_LABELS, TODO_SORT_LABELS, TodoCompleted, TodoPriority } from '@/types/todo';
import type { Todo, TodoListQuery, TodoType } from '@/types/todo';
import TodoFormModal from '@/components/todo/TodoFormModal.vue';
import TodoDetailDrawer from '@/components/todo/TodoDetailDrawer.vue';
import TodoPostponeModal from '@/components/todo/TodoPostponeModal.vue';

const authStore = useAuthStore();

/** 重要程度标签颜色:1-红(紧急) 2-橙 3-蓝 4-灰 */
const PRIORITY_COLORS: Record<number, string> = {
  [TodoPriority.IMPORTANT_URGENT]: 'red',
  [TodoPriority.IMPORTANT_NOT_URGENT]: 'orange',
  [TodoPriority.NOT_IMPORTANT_URGENT]: 'blue',
  [TodoPriority.NOT_IMPORTANT_NOT_URGENT]: 'default',
};

const columns = [
  { title: '待办名称', dataIndex: 'title', key: 'title', width: 180, fixed: 'left' as const, ellipsis: true },
  { title: '类型', dataIndex: 'type_name', key: 'type_name', width: 110 },
  { title: '重要程度', key: 'priority', width: 110 },
  { title: '截止日期', key: 'deadline', width: 130 },
  { title: '执行人', key: 'executors', width: 180 },
  { title: '延期(次数/天数)', key: 'postpone', width: 120 },
  { title: '完成状态', key: 'is_completed', width: 90 },
  { title: '创建日期', key: 'create_time', width: 110 },
  { title: '操作', key: 'action', width: 280, fixed: 'right' as const },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<Todo[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 筛选状态 ============
/** 待办类型筛选:undefined-全部,字符串-类型 ID */
const filterTypeId = ref<string | undefined>(undefined);

/** 待办类型 tab 的 activeKey('all'-全部),与 filterTypeId 双向同步 */
const typeTabKey = computed<string | number>({
  get: () => filterTypeId.value ?? 'all',
  set: (key) => {
    filterTypeId.value = key === 'all' ? undefined : String(key);
  },
});
const filterPriority = ref<number | undefined>(undefined);
const filterCompleted = ref<number | undefined>(undefined);
const filterSort = ref<number | undefined>(undefined);
const filterKeyword = ref('');
/** 仅我的待办:开启时 executor_id 填当前登录用户 */
const filterMineOnly = ref(false);
/** 截止日期区间,[start_date, end_date],YYYY-MM-DD */
const filterDateRange = ref<[string, string]>();

// 筛选下拉选项(由枚举 label map 生成)
const priorityOptions = Object.entries(TODO_PRIORITY_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const sortOptions = Object.entries(TODO_SORT_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const completedOptions = [
  { label: '未完成', value: TodoCompleted.NO },
  { label: '已完成', value: TodoCompleted.YES },
];

/** 切换「仅我的待办」筛选 */
const handleMineOnlyChange = () => {
  filterMineOnly.value = !filterMineOnly.value;
  handleSearch();
};

// ============ 待办类型选项(列表 tab) ============
const typeOptions = ref<{ label: string; value: string }[]>([]);

/** 加载待办类型选项(筛选 tab 使用) */
const loadTypes = async () => {
  try {
    const res = await todoTypeApi.list();
    typeOptions.value = (res.datas.items || []).map((t: TodoType) => ({
      label: t.type_name,
      value: t.type_id,
    }));
  } catch {
    typeOptions.value = [];
  }
};

// ============ 用户缓存(进入页面查询一次,列表翻译/详情/编辑共用) ============
const userNameMap = ref<Record<string, string>>({});
/** 全量用户下拉选项,传给表单弹窗的执行人选择器,避免重复请求 */
const userOptions = ref<{ label: string; value: string }[]>([]);

/** 拉取用户列表建立缓存:user_id → 姓名 映射 + 下拉选项(接口仅返回 user_id,姓名由前端映射) */
const loadUserMap = async () => {
  try {
    const res = await userApi.listUsers({ pageIndex: 1, pageSize: 500 });
    const map: Record<string, string> = {};
    const options: { label: string; value: string }[] = [];
    for (const user of res.datas.items || []) {
      const label = `${user.name} (${user.username})`;
      map[user.user_id] = label;
      options.push({ label, value: user.user_id });
    }
    userNameMap.value = map;
    userOptions.value = options;
  } catch {
    userNameMap.value = {};
    userOptions.value = [];
  }
};

/** 用户 ID 翻译姓名,映射缺失时降级为 ID 前 8 位 */
const userName = (userId: string): string => userNameMap.value[userId] || userId.slice(0, 8);

/** 加载待办列表(服务端分页);翻页/筛选/刷新共用 */
const loadList = async () => {
  loading.value = true;
  try {
    const query: TodoListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    };
    if (filterTypeId.value !== undefined) {
      query.type_id = filterTypeId.value;
    }
    if (filterPriority.value !== undefined) {
      query.priority = filterPriority.value;
    }
    if (filterCompleted.value !== undefined) {
      query.is_completed = filterCompleted.value;
    }
    if (filterSort.value !== undefined) {
      query.sort = filterSort.value;
    }
    if (filterMineOnly.value && authStore.user?.user_id) {
      query.executor_id = authStore.user.user_id;
    }
    if (filterDateRange.value?.[0]) {
      query.start_date = filterDateRange.value[0];
    }
    if (filterDateRange.value?.[1]) {
      query.end_date = filterDateRange.value[1];
    }
    const keyword = filterKeyword.value.trim();
    if (keyword) {
      query.keyword = keyword;
    }

    const res = await todoApi.list(query);
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
  filterTypeId.value = undefined;
  filterPriority.value = undefined;
  filterCompleted.value = undefined;
  filterSort.value = undefined;
  filterKeyword.value = '';
  filterMineOnly.value = false;
  filterDateRange.value = undefined;
  pageIndex.value = 1;
  loadList();
};

const handlePageChange = (page: number, size: number) => {
  pageIndex.value = page;
  pageSize.value = size;
  loadList();
};

// ============ 新建/编辑弹窗 ============
const formOpen = ref(false);
/** 编辑目标列表行,null 表示新建 */
const formTarget = ref<Todo | null>(null);

const openForm = (record: Todo | null) => {
  formTarget.value = record;
  formOpen.value = true;
};

// ============ 详情抽屉 ============
const detailOpen = ref(false);
const detailId = ref('');
const detailDrawerRef = ref<InstanceType<typeof TodoDetailDrawer>>();

const openDetail = (record: Todo) => {
  detailId.value = record.todo_id;
  detailOpen.value = true;
};

/** 详情内操作(完成状态变更/延期/编辑)成功后刷新列表与详情 */
const handleDetailChanged = () => {
  loadList();
  detailDrawerRef.value?.loadDetail();
};

/** 详情抽屉内点击延期:按 ID 找到列表行打开延期弹窗 */
const handleDetailPostpone = (todoId: string) => {
  const record = records.value.find((r) => r.todo_id === todoId);
  if (record) {
    openPostpone(record);
  }
};

/** 详情抽屉内点击编辑:按 ID 找到列表行打开编辑弹窗 */
const handleDetailEdit = (todoId: string) => {
  const record = records.value.find((r) => r.todo_id === todoId);
  if (record) {
    openForm(record);
  }
};

// ============ 延期弹窗 ============
const postponeOpen = ref(false);
const postponeTarget = ref<Todo | null>(null);

const openPostpone = (record: Todo) => {
  postponeTarget.value = record;
  postponeOpen.value = true;
};

/** 延期成功后刷新列表与详情 */
const handlePostponeSuccess = () => {
  loadList();
  if (detailOpen.value) {
    detailDrawerRef.value?.loadDetail();
  }
};

// ============ 完成状态变更 ============
const handleComplete = async (record: Todo) => {
  const target = record.is_completed === TodoCompleted.YES ? TodoCompleted.NO : TodoCompleted.YES;
  try {
    const res = await todoApi.complete({
      todo_id: record.todo_id,
      is_completed: target,
    });
    if (res.result === 0) {
      message.success(target === TodoCompleted.YES ? '已标记完成' : '已取消完成');
      loadList();
    }
  } catch {
    // 失败已由全局拦截器提示
  }
};

/**
 * 删除待办:popconfirm 二次确认 → 调接口 → 成功后刷新列表
 * 若当前页删至最后一条且不在第一页,自动回退一页,避免看到空页
 */
const handleDelete = async (record: Todo) => {
  try {
    await todoApi.delete(record.todo_id);
    message.success('删除成功');
    if (records.value.length === 1 && pageIndex.value > 1) {
      pageIndex.value -= 1;
    }
    loadList();
  } catch {
    // 错误已由全局拦截器提示
  }
};

/** 剩余天数展示文案:负数-已过期,0-今天截止,正数-剩余天数 */
const remainingText = (days: number): string => {
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天截止';
  return `剩 ${days} 天`;
};

/** 剩余天数样式:已过期红色,今天截止橙色 */
const remainingClass = (days: number): string => {
  if (days < 0) return 'remaining-overdue';
  if (days === 0) return 'remaining-today';
  return '';
};

/** 创建时间仅展示日期部分 */
const formatDatePart = (date: string | null): string => {
  if (!date) return '-';
  return date.slice(0, 10);
};

onMounted(() => {
  loadList();
  loadTypes();
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

/* 待办类型 tab:去掉默认下边距,由 .page 的 gap 控制间距 */
.list-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.executor-tag {
  margin-bottom: 4px;
}

.remaining-text {
  font-size: 12px;
}

.remaining-overdue {
  color: #dc2626;
  font-weight: 600;
}

.remaining-today {
  color: #ea580c;
  font-weight: 600;
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

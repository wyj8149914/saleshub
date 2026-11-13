<template>
  <div class="page">
    <div class="page-head">
      <!-- 筛选条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-input
          v-model:value="filterKeyword"
          placeholder="操作说明/对象名称"
          style="width: 200px"
          allow-clear
          @search="handleSearch"
        />

        <a-input
          v-model:value="filterOperationType"
          placeholder="操作大类"
          style="width: 120px"
          allow-clear
          @search="handleSearch"
        />

        <a-input
          v-model:value="filterOperationCode"
          placeholder="操作代码"
          style="width: 140px"
          allow-clear
          @search="handleSearch"
        />

        <a-input
          v-model:value="filterOperatorName"
          placeholder="操作人姓名"
          style="width: 120px"
          allow-clear
          @search="handleSearch"
        />

        <a-input
          v-model:value="filterTargetName"
          placeholder="对象名称"
          style="width: 140px"
          allow-clear
          @search="handleSearch"
        />

        <a-select
          v-model:value="filterResult"
          placeholder="操作结果"
          allow-clear
          style="width: 110px"
          :options="resultOptions"
          @change="handleSearch"
        />

        <a-range-picker v-model:value="filterDateRange" format="YYYY-MM-DD" value-format="YYYY-MM-DD" />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
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
        :row-key="(record: OperationLog) => record.log_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'operation_desc'">
            <span class="ellipsis-cell" :title="record.operation_desc">{{ record.operation_desc }}</span>
          </template>

          <template v-else-if="column.key === 'operator_role'">
            <template v-if="record.operator_role && record.operator_role.length > 0">
              <a-tag v-for="role in record.operator_role" :key="role" color="blue">{{ role }}</a-tag>
            </template>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'target_name'">
            <span v-if="record.target_name" class="ellipsis-cell" :title="record.target_name">
              {{ record.target_name }}
            </span>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'operation_result'">
            <a-tag :color="record.operation_result === LogResult.SUCCESS ? 'success' : 'error'">
              {{ LOG_RESULT_LABELS[record.operation_result] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'error_msg'">
            <span v-if="record.error_msg" class="ellipsis-cell" :title="record.error_msg">
              {{ record.error_msg }}
            </span>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'request_path'">
            <span v-if="record.request_path" class="ellipsis-cell" :title="record.request_path">
              {{ record.request_path }}
            </span>
            <span v-else>-</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 操作日志详情抽屉 -->
    <OperationLogDetailDrawer v-model:open="detailOpen" :log-id="detailId" />
  </div>
</template>

<script setup lang="ts">
/**
 * 操作日志列表页(仅管理员):分页查询 + 筛选
 * (关键字/操作大类/操作代码/操作人姓名/对象名称/操作结果/操作时间区间)
 * 入口:详情(抽屉,含变更前后值与附加数据)
 * 权限:服务端按当前登录用户校验管理员角色,非管理员返回无权限提示
 */
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { logApi } from '@/api/log';
import { LOG_RESULT_LABELS, LogResult } from '@/types/log';
import type { OperationLog, OperationLogListQuery } from '@/types/log';
import OperationLogDetailDrawer from '@/components/log/OperationLogDetailDrawer.vue';

const authStore = useAuthStore();

const columns = [
  { title: '操作时间', dataIndex: 'operation_time', key: 'operation_time', width: 170, fixed: 'left' as const },
  { title: '操作大类', dataIndex: 'operation_type', key: 'operation_type', width: 110 },
  { title: '操作代码', dataIndex: 'operation_code', key: 'operation_code', width: 160 },
  { title: '操作说明', key: 'operation_desc', width: 260, ellipsis: true },
  { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 110 },
  { title: '角色', key: 'operator_role', width: 110 },
  { title: '对象名称', key: 'target_name', width: 180, ellipsis: true },
  { title: '操作结果', key: 'operation_result', width: 100 },
  { title: '失败信息', key: 'error_msg', width: 200, ellipsis: true },
  { title: 'IP', dataIndex: 'ip_address', key: 'ip_address', width: 130 },
  { title: '请求方式', dataIndex: 'request_method', key: 'request_method', width: 90 },
  { title: '请求路径', dataIndex: 'request_path', key: 'request_path', width: 220, ellipsis: true },
  { title: '操作', key: 'action', width: 80, fixed: 'right' as const },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<OperationLog[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 筛选状态 ============
const filterKeyword = ref('');
const filterOperationType = ref('');
const filterOperationCode = ref('');
const filterOperatorName = ref('');
const filterTargetName = ref('');
const filterResult = ref<number | undefined>(undefined);
/** 操作时间区间,[time_start, time_end],YYYY-MM-DD */
const filterDateRange = ref<[string, string]>();

// 操作结果下拉选项
const resultOptions = Object.entries(LOG_RESULT_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 加载操作日志列表(服务端分页);翻页/筛选/刷新共用 */
const loadList = async () => {
  // 请求者用户 ID 用于服务端管理员权限校验
  const userId = authStore.user?.user_id;
  if (!userId) {
    return;
  }
  loading.value = true;
  try {
    const query: OperationLogListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
      user_id: userId,
    };
    const keyword = filterKeyword.value.trim();
    if (keyword) {
      query.keyword = keyword;
    }
    const operationType = filterOperationType.value.trim();
    if (operationType) {
      query.operation_type = operationType;
    }
    const operationCode = filterOperationCode.value.trim();
    if (operationCode) {
      query.operation_code = operationCode;
    }
    const operatorName = filterOperatorName.value.trim();
    if (operatorName) {
      query.operator_name = operatorName;
    }
    const targetName = filterTargetName.value.trim();
    if (targetName) {
      query.target_name = targetName;
    }
    if (filterResult.value !== undefined) {
      query.operation_result = filterResult.value;
    }
    if (filterDateRange.value?.[0]) {
      query.time_start = filterDateRange.value[0];
    }
    if (filterDateRange.value?.[1]) {
      query.time_end = filterDateRange.value[1];
    }

    const res = await logApi.operationList(query);
    records.value = res.datas.items || [];
    total.value = res.datas.total || 0;
  } catch {
    // 错误已由全局拦截器提示(如非管理员无权限)
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
  filterKeyword.value = '';
  filterOperationType.value = '';
  filterOperationCode.value = '';
  filterOperatorName.value = '';
  filterTargetName.value = '';
  filterResult.value = undefined;
  filterDateRange.value = undefined;
  pageIndex.value = 1;
  loadList();
};

const handlePageChange = (page: number, size: number) => {
  pageIndex.value = page;
  pageSize.value = size;
  loadList();
};

// ============ 详情抽屉 ============
const detailOpen = ref(false);
const detailId = ref('');

const openDetail = (record: OperationLog) => {
  detailId.value = record.log_id;
  detailOpen.value = true;
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

/* 头部布局:筛选条件与查询/重置 */
.page-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

/* 单行省略单元格,配合原生 title 悬浮查看全文 */
.ellipsis-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

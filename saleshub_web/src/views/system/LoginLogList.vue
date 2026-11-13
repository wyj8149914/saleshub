<template>
  <div class="page">
    <div class="page-head">
      <!-- 筛选条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-input
          v-model:value="filterUsername"
          placeholder="用户名"
          style="width: 160px"
          allow-clear
          @search="handleSearch"
        />

        <a-select
          v-model:value="filterResult"
          placeholder="登录结果"
          allow-clear
          style="width: 110px"
          :options="resultOptions"
          @change="handleSearch"
        />

        <a-input
          v-model:value="filterIp"
          placeholder="登录IP"
          style="width: 160px"
          allow-clear
          @search="handleSearch"
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
        :row-key="(record: LoginLog) => record.log_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'result'">
            <a-tag :color="record.result === LogResult.SUCCESS ? 'success' : 'error'">
              {{ LOG_RESULT_LABELS[record.result] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'fail_msg'">
            {{ record.fail_msg || '-' }}
          </template>

          <template v-else-if="column.key === 'user_agent'">
            <!-- UA 较长,单行省略 + 原生 title 悬浮查看全文 -->
            <span class="ellipsis-cell" :title="record.user_agent || ''">
              {{ record.user_agent || '-' }}
            </span>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 登录日志列表页:分页查询 + 筛选(用户名/登录结果/IP/登录时间区间)
 * 登录成功与失败均记录,用于安全审计与异常登录排查
 */
import { onMounted, ref } from 'vue';
import { logApi } from '@/api/log';
import { LOG_RESULT_LABELS, LogResult } from '@/types/log';
import type { LoginLog, LoginLogListQuery } from '@/types/log';

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 140, fixed: 'left' as const },
  { title: '登录结果', key: 'result', width: 100 },
  { title: '失败原因', dataIndex: 'fail_msg', key: 'fail_msg', ellipsis: true },
  { title: '登录IP', dataIndex: 'ip', key: 'ip', width: 140 },
  { title: '登录时间', dataIndex: 'create_time', key: 'create_time', width: 170 },
  { title: '客户端(User-Agent)', dataIndex: 'user_agent', key: 'user_agent', width: 320, ellipsis: true },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<LoginLog[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 筛选状态 ============
const filterUsername = ref('');
const filterResult = ref<number | undefined>(undefined);
const filterIp = ref('');
/** 登录时间区间,[start_time, end_time],YYYY-MM-DD */
const filterDateRange = ref<[string, string]>();

// 登录结果下拉选项
const resultOptions = Object.entries(LOG_RESULT_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 加载登录日志列表(服务端分页);翻页/筛选/刷新共用 */
const loadList = async () => {
  loading.value = true;
  try {
    const query: LoginLogListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    };
    const username = filterUsername.value.trim();
    if (username) {
      query.username = username;
    }
    if (filterResult.value !== undefined) {
      query.result = filterResult.value;
    }
    const ip = filterIp.value.trim();
    if (ip) {
      query.ip = ip;
    }
    if (filterDateRange.value?.[0]) {
      query.start_time = filterDateRange.value[0];
    }
    if (filterDateRange.value?.[1]) {
      query.end_time = filterDateRange.value[1];
    }

    const res = await logApi.listLogin(query);
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
  filterResult.value = undefined;
  filterIp.value = '';
  filterDateRange.value = undefined;
  pageIndex.value = 1;
  loadList();
};

const handlePageChange = (page: number, size: number) => {
  pageIndex.value = page;
  pageSize.value = size;
  loadList();
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

<template>
  <div class="page">
    <div class="page-head">
      <!-- 筛选条件与查询/重置 -->
      <a-space :size="12" wrap>
        <a-select
          v-model:value="filterOrderStatus"
          placeholder="订单状态"
          allow-clear
          style="width: 120px"
          :options="orderStatusOptions"
          @change="handleSearch"
        />

        <a-select
          v-model:value="filterPayStatus"
          placeholder="收款状态"
          allow-clear
          style="width: 120px"
          :options="payStatusOptions"
          @change="handleSearch"
        />

        <a-range-picker v-model:value="filterDateRange" format="YYYY-MM-DD" value-format="YYYY-MM-DD" />

        <a-input
          v-model:value="filterKeyword"
          placeholder="订单编号/客户名称"
          style="width: 220px"
          allow-clear
          @search="handleSearch"
        />

        <a-button type="primary" @click="handleSearch">查询</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>

      <!-- 新建订单入口 -->
      <a-space :size="12" wrap class="action-buttons">
        <a-button type="primary" @click="openForm(null)">
          <template #icon><PlusOutlined /></template>
          新建订单
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
        :row-key="(record: SalesOrder) => record.order_id"
        :scroll="{ x: 'max-content' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'customer_name'">
            {{ record.customer_name }}
          </template>

          <template v-else-if="column.key === 'amount'">
            <span class="amount-text">¥{{ record.amount }}</span>
          </template>

          <template v-else-if="column.key === 'received_amount'">
            <span class="amount-text">¥{{ record.received_amount }}</span>
          </template>

          <template v-else-if="column.key === 'pay_status'">
            <a-tag :color="PAY_STATUS_COLORS[record.pay_status] || 'default'">
              {{ PAY_STATUS_LABELS[record.pay_status] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'order_status'">
            <a-tag :color="ORDER_STATUS_COLORS[record.order_status] || 'default'">
              {{ ORDER_STATUS_LABELS[record.order_status] || '-' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'delivery_date'">
            {{ formatDatePart(record.delivery_date) }}
          </template>

          <template v-else-if="column.key === 'create_time'">
            {{ record.create_time }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-space :size="0">
              <a-button type="link" size="small" @click="openDetail(record)">详情</a-button>
              <a-button type="link" size="small" @click="openForm(record)">修改</a-button>
              <!-- 收款:已收款或已取消订单不可再收款 -->
              <a-button
                v-if="record.pay_status !== PayStatus.PAID && record.order_status !== OrderStatus.CANCELLED"
                type="link"
                size="small"
                @click="openReceive(record)"
              >
                收款
              </a-button>
              <!-- 状态变更:已取消为终态不可变更 -->
              <a-button
                v-if="record.order_status !== OrderStatus.CANCELLED"
                type="link"
                size="small"
                @click="openStatus(record)"
              >
                变更状态
              </a-button>
              <a-popconfirm title="确定要删除此订单吗？" ok-text="删除" cancel-text="取消" placement="left" @confirm="handleDelete(record)">
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/修改订单弹窗 -->
    <SalesOrderFormModal v-model:open="formOpen" :order="formTarget" @success="loadList" />

    <!-- 订单详情抽屉 -->
    <SalesOrderDetailDrawer v-model:open="detailOpen" :order-id="detailId" />

    <!-- 收款弹窗 -->
    <SalesOrderReceiveModal v-model:open="receiveOpen" :order="receiveTarget" @success="loadList" />

    <!-- 变更状态弹窗 -->
    <SalesOrderStatusModal v-model:open="statusOpen" :order="statusTarget" @success="loadList" />
  </div>
</template>

<script setup lang="ts">
/**
 * 销售订单列表页:分页查询 + 筛选(订单状态/收款状态/交货日期区间/关键字)
 * 入口:新建/修改(弹窗,合同文件上传)、详情(抽屉,合同预览)、收款、变更状态、删除
 * 业务规则:已取消订单为终态(不可收款/变更状态);已收款订单隐藏收款入口
 */
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { salesOrderApi } from '@/api/salesOrder';
import {
  ORDER_STATUS_LABELS,
  PAY_STATUS_LABELS,
  OrderStatus,
  PayStatus,
} from '@/types/salesOrder';
import type { SalesOrder, SalesOrderListQuery } from '@/types/salesOrder';
import SalesOrderFormModal from '@/components/order/SalesOrderFormModal.vue';
import SalesOrderDetailDrawer from '@/components/order/SalesOrderDetailDrawer.vue';
import SalesOrderReceiveModal from '@/components/order/SalesOrderReceiveModal.vue';
import SalesOrderStatusModal from '@/components/order/SalesOrderStatusModal.vue';

/** 订单状态标签颜色 */
const ORDER_STATUS_COLORS: Record<number, string> = {
  1: 'blue',
  2: 'cyan',
  3: 'success',
  4: 'error',
};

/** 收款状态标签颜色 */
const PAY_STATUS_COLORS: Record<number, string> = {
  1: 'error',
  2: 'warning',
  3: 'success',
};

const columns = [
  { title: '订单编号', dataIndex: 'order_no', key: 'order_no', width: 110, fixed: 'left' as const },
  { title: '订单名称', dataIndex: 'order_title', key: 'order_title', width: 150, ellipsis: true },
  { title: '客户名称', dataIndex: 'customer_name', key: 'customer_name', width: 160, ellipsis: true },
  { title: '联系方式', dataIndex: 'customer_phone', key: 'customer_phone', width: 130 },
  { title: '订单金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' as const },
  { title: '已收金额', dataIndex: 'received_amount', key: 'received_amount', width: 120, align: 'right' as const },
  { title: '收款状态', key: 'pay_status', width: 110 },
  { title: '订单状态', key: 'order_status', width: 100 },
  { title: '交货日期', key: 'delivery_date', width: 110 },
  { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 170 },
  { title: '操作', key: 'action', width: 260, fixed: 'right' as const },
];

// ============ 列表状态 ============
const loading = ref(false);
const records = ref<SalesOrder[]>([]);
const pageIndex = ref(1);
const pageSize = ref(10);
const total = ref(0);

// ============ 筛选状态 ============
const filterOrderStatus = ref<number | undefined>(undefined);
const filterPayStatus = ref<number | undefined>(undefined);
const filterKeyword = ref('');
/** 交货日期区间,[start_date, end_date],YYYY-MM-DD */
const filterDateRange = ref<[string, string]>();

// 筛选下拉选项
const orderStatusOptions = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const payStatusOptions = Object.entries(PAY_STATUS_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 加载订单列表(服务端分页);翻页/筛选/刷新共用 */
const loadList = async () => {
  loading.value = true;
  try {
    const query: SalesOrderListQuery = {
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    };
    if (filterOrderStatus.value) {
      query.order_status = filterOrderStatus.value;
    }
    if (filterPayStatus.value) {
      query.pay_status = filterPayStatus.value;
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

    const res = await salesOrderApi.list(query);
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
  filterOrderStatus.value = undefined;
  filterPayStatus.value = undefined;
  filterKeyword.value = '';
  filterDateRange.value = undefined;
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
/** 编辑目标订单,null 表示新建 */
const formTarget = ref<SalesOrder | null>(null);

const openForm = (record: SalesOrder | null) => {
  formTarget.value = record;
  formOpen.value = true;
};

// ============ 详情抽屉 ============
const detailOpen = ref(false);
const detailId = ref('');

const openDetail = (record: SalesOrder) => {
  detailId.value = record.order_id;
  detailOpen.value = true;
};

// ============ 收款弹窗 ============
const receiveOpen = ref(false);
const receiveTarget = ref<SalesOrder | null>(null);

const openReceive = (record: SalesOrder) => {
  receiveTarget.value = record;
  receiveOpen.value = true;
};

// ============ 变更状态弹窗 ============
const statusOpen = ref(false);
const statusTarget = ref<SalesOrder | null>(null);

const openStatus = (record: SalesOrder) => {
  statusTarget.value = record;
  statusOpen.value = true;
};

/**
 * 删除订单:popconfirm 二次确认 → 软删除 → 成功后刷新列表
 * 若当前页删至最后一条且不在第一页,自动回退一页,避免看到空页
 */
const handleDelete = async (record: SalesOrder) => {
  try {
    await salesOrderApi.delete(record.order_id);
    message.success('删除成功');
    if (records.value.length === 1 && pageIndex.value > 1) {
      pageIndex.value -= 1;
    }
    loadList();
  } catch {
    // 错误已由全局拦截器提示
  }
};

/** 交货日期仅展示日期部分 */
const formatDatePart = (date: string): string => {
  return date ? date.slice(0, 10) : '-';
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

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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

<template>
  <a-drawer
    :open="open"
    title="支出费用单详情"
    width="720"
    :mask-closable="true"
    @close="emit('update:open', false)"
  >
    <a-spin :spinning="loading">
      <template v-if="detail">
        <!-- 基本信息 -->
        <a-descriptions title="基本信息" :column="2" size="small" bordered>
          <a-descriptions-item label="费用单编号">{{ detail.expense_no }}</a-descriptions-item>
          <a-descriptions-item label="费用类型">
            <a-tag :color="detail.expense_type === ExpenseType.WITH_INVOICE ? 'blue' : 'purple'">
              {{ EXPENSE_TYPE_LABELS[detail.expense_type] || '-' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="费用名称">{{ detail.expense_title || '-' }}</a-descriptions-item>
          <a-descriptions-item label="支出金额">
            <span class="amount-text">¥{{ detail.amount }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="支出日期">{{ formatDatePart(detail.expense_date) }}</a-descriptions-item>
          <a-descriptions-item label="支出分类">
            {{ detail.category != null ? EXPENSE_CATEGORY_LABELS[detail.category] || '-' : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="采购渠道">
            {{ detail.channel != null ? EXPENSE_CHANNEL_LABELS[detail.channel] || '-' : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="电商订单号">{{ detail.order_no || '-' }}</a-descriptions-item>
          <a-descriptions-item label="收款方">{{ detail.payee || '-' }}</a-descriptions-item>
          <a-descriptions-item label="付款方式">
            {{ detail.payment_method != null ? EXPENSE_PAYMENT_METHOD_LABELS[detail.payment_method] || '-' : '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDateTime(detail.create_time) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatDateTime(detail.update_time) }}</a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>
        </a-descriptions>

        <!-- 关联发票摘要 -->
        <a-descriptions
          v-if="detail.expense_type === ExpenseType.WITH_INVOICE"
          title="关联发票"
          :column="2"
          size="small"
          bordered
          class="section-gap"
        >
          <a-descriptions-item label="发票号码">{{ detail.invoice_number || '未关联' }}</a-descriptions-item>
          <a-descriptions-item label="发票类型">{{ detail.sub_type_desc || '-' }}</a-descriptions-item>
          <a-descriptions-item label="开票日期">{{ formatDatePart(detail.invoice_date) }}</a-descriptions-item>
          <a-descriptions-item label="原始文件">
            <template v-if="detail.invoice_url">
              <a-image
                v-if="isImageUrl(detail.invoice_url)"
                :src="detail.invoice_url"
                :width="120"
                class="invoice-preview"
              />
              <a v-else :href="detail.invoice_url" target="_blank">查看原始发票(PDF)</a>
            </template>
            <span v-else>-</span>
          </a-descriptions-item>
        </a-descriptions>

        <!-- 采购明细 -->
        <div class="section-gap">
          <a-divider style="margin: 8px 0">
            <span class="section-title">采购明细({{ detail.items.length }})</span>
          </a-divider>
          <a-table
            :columns="itemColumns"
            :data-source="detail.items"
            :pagination="false"
            :row-key="(record: ExpenseDetailItem) => record.relation_id"
            size="small"
            bordered
            :scroll="{ x: 'max-content' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'item_name'">
                {{ itemLabel(record.item_id) }}
              </template>
              <template v-else-if="column.key === 'spec_name'">
                {{ specLabel(record.spec_id) }}
              </template>
              <template v-else-if="column.key === 'price'">
                ¥{{ record.price }}
              </template>
              <template v-else-if="column.key === 'row_amount'">
                <span class="amount-text">¥{{ rowAmount(record) }}</span>
              </template>
              <template v-else-if="column.key === 'remark'">
                {{ record.remark || '-' }}
              </template>
            </template>
            <template #summary>
              <a-table-summary-row>
                <a-table-summary-cell :index="0" :col-span="4" align="right">合计</a-table-summary-cell>
                <a-table-summary-cell :index="4" align="right">
                  <span class="amount-text">¥{{ itemsTotal }}</span>
                </a-table-summary-cell>
                <a-table-summary-cell :index="5" :col-span="2" />
              </a-table-summary-row>
            </template>
          </a-table>
        </div>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 支出费用单详情抽屉
 * 展示费用单全部业务字段、采购明细行(零件/规格名称由库存数据映射)与关联发票摘要(含原文件预览)
 */
import { computed, ref, watch } from 'vue';
import { expenseApi } from '@/api/expense';
import { inventoryApi } from '@/api/inventory';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CHANNEL_LABELS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_TYPE_LABELS,
  ExpenseType,
} from '@/types/expense';
import type { ExpenseDetail, ExpenseDetailItem } from '@/types/expense';
import type { InventoryItem } from '@/types/inventory';

interface Props {
  /** 抽屉可见性(v-model:open) */
  open: boolean;
  /** 支出费用单 ID */
  expenseId: string;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const detail = ref<ExpenseDetail | null>(null);
/** 全量零件(用于把明细行的 item_id/spec_id 映射为名称展示) */
const allItems = ref<InventoryItem[]>([]);

/** 明细表格列定义 */
const itemColumns = [
  { title: '零件', key: 'item_name', width: 180 },
  { title: '规格', key: 'spec_name', width: 120 },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right' as const },
  { title: '单价', key: 'price', width: 90, align: 'right' as const },
  { title: '小计', key: 'row_amount', width: 100, align: 'right' as const },
  { title: '备注', key: 'remark', ellipsis: true },
];

/** 零件显示名:名称(编码),找不到时降级为 ID 前 8 位 */
const itemLabel = (itemId: string): string => {
  const item = allItems.value.find((i) => i.item_id === itemId);
  return item ? `${item.name} (${item.code})` : itemId.slice(0, 8);
};

/** 规格显示名,找不到时降级为 ID 前 8 位 */
const specLabel = (specId: string): string => {
  for (const item of allItems.value) {
    const spec = item.specs?.find((s) => s.spec_id === specId);
    if (spec) return spec.spec || '默认';
  }
  return specId.slice(0, 8);
};

/** 行小计 = 数量 × 单价(两位小数) */
const rowAmount = (record: ExpenseDetailItem): string => {
  return (Math.round(record.quantity * Number(record.price) * 100) / 100).toFixed(2);
};

/** 明细合计 */
const itemsTotal = computed(() => {
  const total = (detail.value?.items || []).reduce(
    (sum, item) => sum + item.quantity * Number(item.price),
    0,
  );
  return (Math.round(total * 100) / 100).toFixed(2);
});

/** 判断预览地址是否为图片(图片内联预览,PDF 走链接) */
const isImageUrl = (url: string): boolean => {
  return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url);
};

/** 日期仅展示日期部分(YYYY-MM-DD HH24:MI:SS → YYYY-MM-DD) */
const formatDatePart = (date: string | null): string => (date ? date.slice(0, 10) : '-');

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

/** 加载费用单详情与零件引用数据 */
const loadDetail = async () => {
  loading.value = true;
  try {
    const [detailRes, itemsRes] = await Promise.all([
      expenseApi.detail(props.expenseId),
      inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 }),
    ]);
    detail.value = detailRes.datas;
    allItems.value = itemsRes.datas.items || [];
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.open, props.expenseId],
  ([open]) => {
    if (open && props.expenseId) {
      detail.value = null;
      loadDetail();
    }
  },
);
</script>

<style scoped lang="scss">
.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.section-gap {
  margin-top: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #52525b;
}

.invoice-preview {
  border-radius: 4px;
}
</style>

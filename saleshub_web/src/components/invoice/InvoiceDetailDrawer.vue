<template>
  <a-drawer :open="open" title="发票详情" width="920px" :mask-closable="!loading" @close="handleClose">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <!-- 原文件:不在抽屉内嵌展示,点击跳转独立页面查看 -->
        <div v-if="fileUrl" class="file-section">
          <h4 class="section-title">原文件</h4>
          <a-button type="primary" @click="openFileViewer">
            <template #icon><EyeOutlined /></template>
            查看源文件
          </a-button>
        </div>
        <a-alert v-else type="info" show-icon message="暂无原文件" class="no-file-tip" />

        <!-- 票面信息 -->
        <h4 class="section-title">票面信息</h4>
        <a-descriptions bordered :column="2" size="small" class="detail-desc">
          <a-descriptions-item label="发票号码" :span="2">
            {{ detail.invoice_number }}
          </a-descriptions-item>
          <a-descriptions-item label="发票类型">
            {{ detail.sub_type_desc || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="发票名称">
            {{ detail.title || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="发票代码">
            {{ detail.invoice_code || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="开票日期">
            {{ formatInvoiceDate(detail.invoice_date) }}
          </a-descriptions-item>
          <a-descriptions-item label="税前金额">
            {{ detail.pretax_amount ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="合计税额">
            {{ detail.tax_amount ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="价税合计">
            {{ detail.total_amount ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="价税合计大写">
            {{ detail.total_amount_cn || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="销售方名称">
            {{ detail.seller_name || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="销售方税号">
            {{ detail.seller_tax_id || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="购买方名称">
            {{ detail.buyer_name || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="购买方税号">
            {{ detail.buyer_tax_id || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="发票性质">
            {{ natureLabel }}
          </a-descriptions-item>
          <a-descriptions-item label="发票用途">
            {{ purposeLabel }}
          </a-descriptions-item>
          <a-descriptions-item label="开票人">
            {{ detail.issuer || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="页码">
            {{ detail.page ?? '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">
            {{ detail.remark || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="识别用户">
            {{ detail.user_id }}
          </a-descriptions-item>
          <a-descriptions-item label="入库时间">
            {{ formatDateTime(detail.create_time) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间" :span="2">
            {{ formatDateTime(detail.update_time) }}
          </a-descriptions-item>
        </a-descriptions>

        <!-- 明细条目:列随发票类型不同,按第一条的 key 动态生成;单元格单行省略避免撑高行 -->
        <template v-if="itemColumns.length">
          <h4 class="section-title">明细条目</h4>
          <a-table
            class="items-table"
            :columns="itemColumns"
            :data-source="detail.items || []"
            :pagination="false"
            bordered
            :row-key="itemRowKey"
            :scroll="{ x: true }"
          >
            <template #bodyCell="{ column, record }">
              <span v-if="column.key !== '__idx'" :title="formatItemValue(record[column.key])">
                {{ formatItemValue(record[column.key]) }}
              </span>
            </template>
          </a-table>
        </template>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 发票详情抽屉:按 invoice_id 加载完整票面字段与明细条目
 * - 原文件不在抽屉内嵌展示,「查看源文件」跳转独立页面查看
 * - 打开时自动加载;发票不存在等错误由全局拦截器提示并自动关闭
 * - 明细列字段随发票类型不同,常见腾讯云字段名翻译为中文
 */
import { computed, ref, watch } from 'vue';
import { EyeOutlined } from '@ant-design/icons-vue';
import { invoiceApi } from '@/api/invoice';
import { INVOICE_NATURE_LABELS, INVOICE_PURPOSE_LABELS } from '@/types/invoice';
import type { InvoiceDetail, InvoiceItemEntry } from '@/types/invoice';
import { invoiceItemFieldLabel } from '@/utils/invoice';

interface Props {
  /** 抽屉可见性(v-model:open) */
  open: boolean;
  /** 待查询的发票 ID */
  invoiceId: string;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const detail = ref<InvoiceDetail | null>(null);

const fileUrl = computed(() => detail.value?.file_url || '');

/** 跳转发票源文件查看页 */
function openFileViewer() {
  if (!props.invoiceId) return;
  window.open(fileUrl.value, '_blank');
}

const natureLabel = computed(() => {
  const n = detail.value?.invoice_nature;
  return n !== undefined && n !== null ? INVOICE_NATURE_LABELS[n] || '-' : '-';
});

const purposeLabel = computed(() => {
  const p = detail.value?.invoice_purpose;
  return p !== undefined && p !== null ? INVOICE_PURPOSE_LABELS[p] || '-' : '-';
});

/**
 * 明细表动态列:以第一条条目的字段生成列,常见字段名翻译为中文
 * 单元格开启单行省略,长文本靠 title 悬浮查看,避免撑高行
 */
const itemColumns = computed(() => {
  const first = detail.value?.items?.[0];
  if (!first) return [];
  return Object.keys(first).map((key) => ({
    title: invoiceItemFieldLabel(key),
    dataIndex: key,
    key,
    ellipsis: true,
  }));
});

/** 明细表行 key:条目无主键,使用行下标 */
const itemRowKey = (_record: InvoiceItemEntry, index: number): number => index;

/** 明细单元格:空值显示 - */
function formatItemValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

/** 开票日期仅展示日期部分 */
function formatInvoiceDate(date: string | null): string {
  if (!date) return '-';
  return date.slice(0, 10);
}

/** 时间格式化为本地日期时间 */
function formatDateTime(date: string): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 加载发票详情 */
async function loadDetail() {
  if (!props.invoiceId) return;
  loading.value = true;
  detail.value = null;
  try {
    const res = await invoiceApi.detail(props.invoiceId);
    detail.value = res.datas;
  } catch {
    // 错误已由全局拦截器提示(如「发票不存在」),自动关闭抽屉避免停留空白
    handleClose();
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  emit('update:open', false);
}

// 打开时加载详情,关闭时清空数据
watch(
  () => props.open,
  (open) => {
    if (open) {
      loadDetail();
    } else {
      detail.value = null;
    }
  },
);
</script>

<style scoped lang="scss">
.file-section {
  margin-bottom: 16px;
}

.no-file-tip {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
}

.detail-desc {
  margin-bottom: 20px;

  :deep(.ant-descriptions-item-label) {
    width: 100px;
  }
}

/* 明细条目表格:固定列宽 + 单行省略,长文本不再撑高行,悬浮 title 可看全文 */
// .items-table {
//   :deep(table) {
//     table-layout: fixed;
//   }

//   :deep(.ant-table-tbody > tr > td) {
//     max-width: 0;
//     white-space: nowrap;
//     overflow: hidden;
//     text-overflow: ellipsis;
//   }
// }
</style>

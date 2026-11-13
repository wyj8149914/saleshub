<template>
  <a-drawer :open="open" title="操作日志详情" width="880px" :mask-closable="!loading" @close="handleClose">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <!-- 基本信息 -->
        <h4 class="section-title">基本信息</h4>
        <a-descriptions bordered :column="2" size="small" class="detail-desc">
          <a-descriptions-item label="操作时间" :span="2">
            {{ detail.operation_time }}
          </a-descriptions-item>
          <a-descriptions-item label="操作大类">
            {{ detail.operation_type }}
          </a-descriptions-item>
          <a-descriptions-item label="操作代码">
            {{ detail.operation_code }}
          </a-descriptions-item>
          <a-descriptions-item label="操作说明" :span="2">
            {{ detail.operation_desc }}
          </a-descriptions-item>
          <a-descriptions-item label="操作人">
            {{ detail.operator_name || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="操作人角色">
            <template v-if="detail.operator_role && detail.operator_role.length > 0">
              <a-tag v-for="role in detail.operator_role" :key="role" color="blue">{{ role }}</a-tag>
            </template>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="操作结果">
            <a-tag :color="detail.operation_result === LogResult.SUCCESS ? 'success' : 'error'">
              {{ LOG_RESULT_LABELS[detail.operation_result] || '-' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="失败信息">
            {{ detail.error_msg || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="对象类型">
            {{ detail.target_type || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="对象名称">
            {{ detail.target_name || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="对象ID" :span="2">
            {{ detail.target_id || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="IP">
            {{ detail.ip_address || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="请求方式">
            {{ detail.request_method || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="请求路径" :span="2">
            <span class="ellipsis-cell" :title="detail.request_path || ''">{{ detail.request_path || '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="User-Agent" :span="2">
            <span class="ellipsis-cell" :title="detail.user_agent || ''">{{ detail.user_agent || '-' }}</span>
          </a-descriptions-item>
        </a-descriptions>

        <!-- 变更数据:JSON 内容格式化展示,解析失败时展示原文 -->
        <template v-if="oldValueText || newValueText || attachDataText">
          <h4 class="section-title">变更数据</h4>

          <template v-if="oldValueText">
            <h5 class="block-title">变更前</h5>
            <pre class="json-block">{{ oldValueText }}</pre>
          </template>

          <template v-if="newValueText">
            <h5 class="block-title">变更后</h5>
            <pre class="json-block">{{ newValueText }}</pre>
          </template>

          <template v-if="attachDataText">
            <h5 class="block-title">附加数据</h5>
            <pre class="json-block">{{ attachDataText }}</pre>
          </template>
        </template>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 操作日志详情抽屉:按 log_id 加载全部字段
 * - 含变更前/后值与附加数据,JSON 内容解析后美化展示,非 JSON 或解析失败时展示原文
 * - 打开时自动加载;权限不足/日志不存在等错误由全局拦截器提示并自动关闭
 */
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { logApi } from '@/api/log';
import { LOG_RESULT_LABELS, LogResult } from '@/types/log';
import type { OperationLogDetail } from '@/types/log';

interface Props {
  /** 抽屉可见性(v-model:open) */
  open: boolean;
  /** 待查询的日志 ID */
  logId: string;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();

const loading = ref(false);
const detail = ref<OperationLogDetail | null>(null);

/**
 * 格式化变更值文本:JSON 字符串解析后美化缩进,便于对比阅读
 * 纯文本(如「删除」等描述)或解析失败时返回原文
 */
const formatValueText = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

const oldValueText = computed(() => formatValueText(detail.value?.old_value ?? null));

const newValueText = computed(() => formatValueText(detail.value?.new_value ?? null));

const attachDataText = computed(() => {
  const attach = detail.value?.attach_data;
  return attach && Object.keys(attach).length > 0 ? JSON.stringify(attach, null, 2) : null;
});

/** 加载操作日志详情 */
async function loadDetail() {
  const userId = authStore.user?.user_id;
  if (!props.logId || !userId) return;
  loading.value = true;
  detail.value = null;
  try {
    const res = await logApi.operationDetail(props.logId, userId);
    detail.value = res.datas;
  } catch {
    // 错误已由全局拦截器提示(如无权限、日志不存在),自动关闭抽屉避免停留空白
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

.block-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 6px;
}

/* JSON/文本数据块:深色等宽展示,超高滚动,横向不换行滚动查看 */
.json-block {
  margin: 0 0 16px;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  background: #0c0e14;
  color: #d6deeb;
  border-radius: 8px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}

/* 单行省略单元格,配合原生 title 悬浮查看全文 */
.ellipsis-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

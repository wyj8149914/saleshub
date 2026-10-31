<template>
  <a-modal
    :open="open"
    :title="isSingle ? '单个发票识别' : '批量发票识别'"
    :width="isSingle ? 640 : 780"
    :mask-closable="false"
    :confirm-loading="submitting"
    @cancel="handleCancel"
    @ok="handleSubmit"
  >
    <template #footer>
      <template v-if="phase === 'form'">
        <a-button @click="handleCancel">取消</a-button>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">开始识别</a-button>
      </template>
      <template v-else>
        <a-button @click="handleRedo">重新识别</a-button>
        <a-button type="primary" @click="handleCancel">关闭</a-button>
      </template>
    </template>

    <!-- 表单与上传区 -->
    <div v-if="phase === 'form'" class="upload-form">
      <a-form layout="vertical">
        <a-form-item label="发票性质" required>
          <a-radio-group
            v-model:value="formState.invoice_nature"
            :disabled="submitting || fixedNature != null"
          >
            <a-radio :value="InvoiceNature.ACTUAL">实开</a-radio>
            <a-radio :value="InvoiceNature.DEDUCTION">进项抵扣</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="发票用途" required>
          <a-select
            v-model:value="formState.invoice_purpose"
            placeholder="请选择发票用途"
            :options="purposeOptions"
            :disabled="submitting"
          />
        </a-form-item>
        <a-form-item label="发票标签">
          <a-input v-model:value="formState.tag" placeholder="请输入发票标签" :disabled="submitting" />
        </a-form-item>
      </a-form>

      <!-- 上传区:单个模式选单文件,批量模式选文件夹 -->
      <a-upload-dragger
        v-if="isSingle"
        name="file"
        :accept="INVOICE_ACCEPT"
        :show-upload-list="false"
        :disabled="submitting"
        :before-upload="handleSingleSelect"
      >
        <p class="upload-icon">
          <InboxOutlined />
        </p>
        <p class="upload-text">点击或拖拽文件到此处上传</p>
        <p class="upload-hint">支持图片或 PDF,单个文件不超过 {{ INVOICE_MAX_FILE_SIZE_MB }}MB</p>
      </a-upload-dragger>
      <a-upload-dragger
        v-else
        name="files"
        :accept="INVOICE_ACCEPT"
        :directory="true"
        :show-upload-list="false"
        :disabled="submitting"
        :before-upload="handleBatchSelect"
      >
        <p class="upload-icon">
          <InboxOutlined />
        </p>
        <p class="upload-text">点击选择要识别的文件夹</p>
        <p class="upload-hint">
          识别文件夹内的图片与 PDF,最多 {{ INVOICE_MAX_BATCH_COUNT }} 个文件,每个不超过 {{ INVOICE_MAX_FILE_SIZE_MB }}MB
        </p>
      </a-upload-dragger>

      <!-- 已选文件列表(自维护,便于展示与移除) -->
      <div v-if="isSingle && selectedFile" class="file-list">
        <div class="file-item">
          <FileTextOutlined class="file-icon" />
          <span class="file-name" :title="selectedFile.name">{{ selectedFile.name }}</span>
          <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
          <a-button type="text" size="small" danger :disabled="submitting" @click="clearSingleFile">移除</a-button>
        </div>
      </div>
      <div v-else-if="!isSingle && selectedFiles.length" class="file-list">
        <div class="file-list-head">
          <span>已选 {{ selectedFiles.length }} 个文件{{ batchFolderName ? `(来自 ${batchFolderName})` : '' }}</span>
          <a-button type="link" size="small" danger :disabled="submitting" @click="clearBatchFiles">清空</a-button>
        </div>
        <div v-for="(f, i) in selectedFiles" :key="`${f.name}-${f.size}-${i}`" class="file-item">
          <FileTextOutlined class="file-icon" />
          <span class="file-name" :title="f.name">{{ f.name }}</span>
          <span class="file-size">{{ formatFileSize(f.size) }}</span>
          <a-button type="text" size="small" danger :disabled="submitting" @click="removeBatchFile(i)">移除</a-button>
        </div>
      </div>
    </div>

    <!-- 识别结果区 -->
    <div v-else class="upload-result">
      <!-- 单个识别结果 -->
      <template v-if="isSingle && singleResult">
        <a-alert
          v-if="singleResult.invoices.length"
          type="success"
          show-icon
          class="result-summary"
          :message="`识别完成:新入库 ${singleResult.invoices.length} 张,已存在 ${singleResult.existed.length} 张,失败 ${singleResult.failed.length} 张`"
        />
        <a-alert
          v-else
          type="warning"
          show-icon
          class="result-summary"
          message="未识别到新发票"
          :description="`已存在 ${singleResult.existed.length} 张,失败 ${singleResult.failed.length} 张,原始文件已保存可用于后续关联`"
        />

        <div v-if="singleResult.invoices.length" class="result-group">
          <h4 class="result-title result-title-new">新入库发票({{ singleResult.invoices.length }})</h4>
          <div v-for="inv in singleResult.invoices" :key="inv.invoice_id" class="result-row">
            <span class="result-no">{{ inv.invoice_number }}</span>
            <span class="result-desc">{{ inv.sub_type_desc || '-' }}</span>
            <span class="result-amount">¥{{ inv.total_amount ?? '-' }}</span>
          </div>
        </div>

        <div v-if="singleResult.existed.length" class="result-group">
          <h4 class="result-title result-title-exist">已存在发票({{ singleResult.existed.length }})</h4>
          <div v-for="inv in singleResult.existed" :key="inv.invoice_id" class="result-row">
            <span class="result-no">{{ inv.invoice_number }}</span>
            <span class="result-desc">{{ inv.sub_type_desc || '-' }}</span>
            <span class="result-amount">¥{{ inv.total_amount ?? '-' }}</span>
          </div>
        </div>

        <div v-if="singleResult.failed.length" class="result-group">
          <h4 class="result-title result-title-failed">识别失败({{ singleResult.failed.length }})</h4>
          <div v-for="(f, i) in singleResult.failed" :key="i" class="result-row result-row-failed">
            <span class="result-no">第 {{ f.page }} 页</span>
            <span class="result-desc">{{ f.msg }}</span>
          </div>
        </div>
      </template>

      <!-- 批量识别结果 -->
      <template v-else-if="batchResult">
        <a-alert
          type="info"
          show-icon
          class="result-summary"
          :message="`共 ${batchResult.total} 个文件:成功 ${batchResult.success_count} 个,失败 ${batchResult.fail_count} 个`"
        />
        <a-table
          :columns="batchColumns"
          :data-source="batchResult.results"
          :pagination="false"
          size="small"
          :row-key="batchRowKey"
          class="batch-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'result'">
              <a-tag :color="record.result === 0 ? 'success' : 'error'">
                {{ record.result === 0 ? '成功' : '失败' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'detail'">
              <span v-if="record.datas" class="detail-tags">
                <a-tag v-if="record.datas.invoices.length" color="green"
                  >新入库 {{ record.datas.invoices.length }}</a-tag
                >
                <a-tag v-if="record.datas.existed.length" color="orange"
                  >已存在 {{ record.datas.existed.length }}</a-tag
                >
                <a-tag v-if="record.datas.failed.length" color="red">失败 {{ record.datas.failed.length }}</a-tag>
              </span>
              <span v-else>-</span>
            </template>
          </template>
          <template #expandedRowRender="{ record }">
            <div v-if="record.datas" class="batch-expand">
              <div v-if="record.datas.invoices.length" class="expand-line">
                <span class="expand-label">新入库:</span>
                <span v-for="inv in record.datas.invoices" :key="inv.invoice_id" class="expand-item">
                  {{ inv.invoice_number }}(¥{{ inv.total_amount ?? '-' }})
                </span>
              </div>
              <div v-if="record.datas.existed.length" class="expand-line">
                <span class="expand-label">已存在:</span>
                <span v-for="inv in record.datas.existed" :key="inv.invoice_id" class="expand-item">
                  {{ inv.invoice_number }}(¥{{ inv.total_amount ?? '-' }})
                </span>
              </div>
              <div v-for="(f, i) in record.datas.failed" :key="i" class="expand-line expand-line-failed">
                <span class="expand-label">第 {{ f.page }} 页:</span>
                <span class="expand-item">{{ f.msg }}</span>
              </div>
            </div>
            <div v-else>-</div>
          </template>
        </a-table>
      </template>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 发票识别弹窗:单个/批量上传识别共用组件,通过 mode 区分
 * - 表单:发票性质 + 发票用途(所有文件共用),user_id 自动取当前登录用户
 * - 文件在前端先做类型/大小/数量校验(后端超限会整单拒绝,必须前置拦截)
 * - 批量模式选择文件夹上传,自动忽略隐藏文件与不支持的文件(聚合提示);超过 50 个有效文件整批拒绝,不允许识别
 * - 提交后展示识别结果(新入库/已存在/失败),有关闭时通知列表页刷新
 */
import { computed, reactive, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { FileTextOutlined, InboxOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { invoiceApi } from '@/api/invoice';
import { INVOICE_PURPOSE_LABELS, InvoiceNature } from '@/types/invoice';
import type { InvoiceBatchFileResult, InvoiceUploadBatchResult, InvoiceUploadResult } from '@/types/invoice';
import {
  INVOICE_ACCEPT,
  INVOICE_MAX_BATCH_COUNT,
  INVOICE_MAX_FILE_SIZE_MB,
  checkInvoiceFiles,
  formatFileSize,
  isValidInvoiceFileSize,
  isValidInvoiceFileType,
} from '@/utils/invoice';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 识别模式:single-单文件,batch-批量 */
  mode: 'single' | 'batch';
  /** 固定发票性质:传入时性质预填且不可修改(如支出费用场景固定实开) */
  fixedNature?: number;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  /** 本次识别有新发票入库,通知父级刷新列表 */
  (e: 'success'): void;
  /** 单个识别完成,返回完整识别结果(供调用方选取发票,如支出费用关联) */
  (e: 'uploaded', result: InvoiceUploadResult): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();

/** 识别阶段:form-填写并上传,result-展示识别结果 */
const phase = ref<'form' | 'result'>('form');
const submitting = ref(false);

// 表单状态(识别参数所有文件共用)
const formState = reactive<{
  invoice_nature?: number;
  invoice_purpose?: number;
  tag?: string;
}>({});

// 已选文件:单个模式 1 个,批量模式最多 50 个
const selectedFile = ref<File | null>(null);
const selectedFiles = ref<File[]>([]);

// 识别结果
const singleResult = ref<InvoiceUploadResult | null>(null);
const batchResult = ref<InvoiceUploadBatchResult | null>(null);
/** 本次识别是否产生了新入库发票(关闭时通知父级刷新) */
const hasNewInvoices = ref(false);

const isSingle = computed(() => props.mode === 'single');

// 发票用途下拉选项
const purposeOptions = Object.entries(INVOICE_PURPOSE_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

/** 弹窗打开时重置全部状态 */
watch(
  () => props.open,
  (open) => {
    if (open) {
      resetState();
      hasNewInvoices.value = false;
    }
  },
);

/** 重置到表单初始状态 */
function resetState() {
  phase.value = 'form';
  // 固定发票性质时预填,否则留空由用户选择
  formState.invoice_nature = props.fixedNature;
  formState.invoice_purpose = undefined;
  selectedFile.value = null;
  selectedFiles.value = [];
  singleResult.value = null;
  batchResult.value = null;
  submitting.value = false;
  processedBatchList = null;
}

/**
 * 单个模式选择文件:校验通过后替换当前已选文件
 * 返回 false 阻止 antd 自动上传,统一由「开始识别」提交
 */
function handleSingleSelect(file: File): boolean {
  const { errors } = checkInvoiceFiles([file], 1);
  if (errors.length) {
    message.error(errors[0]);
    return false;
  }
  selectedFile.value = file;
  return false;
}

// ============ 批量(文件夹)选择 ============

/** 文件夹选择时忽略的系统/隐藏文件 */
const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** 待聚合的忽略文件明细 */
interface BatchIgnoredEntry {
  name: string;
  reason: string;
}

/** 上一批选择的 fileList 引用(同一批每个文件触发一次 beforeUpload,整批只处理一次) */
let processedBatchList: File[] | null = null;

// 已选文件来源文件夹名(取第一个文件的相对路径首段)
const batchFolderName = computed(() => {
  const path = selectedFiles.value[0]?.webkitRelativePath || '';
  return path.split('/')[0] || '';
});

/**
 * 批量(文件夹)模式选择文件:同一批选择仅在首个文件时整批校验一次
 * 文件统一由 processBatchSelection 处理,这里一律拦截 antd 自动上传
 */
function handleBatchSelect(file: File, fileList: File[]): boolean {
  if (fileList !== processedBatchList) {
    processedBatchList = fileList;
    processBatchSelection(fileList);
  }
  return false;
}

/**
 * 整批校验文件夹选择的文件:
 * - 忽略隐藏/系统文件,类型或大小不合规的文件聚合为一次提示
 * - 有效文件(含已选)超过上限时整批拒绝,直接报错,不允许后续识别
 */
function processBatchSelection(files: File[]) {
  const ignored: BatchIgnoredEntry[] = [];
  const valid: File[] = [];
  for (const file of files) {
    const name = file.name;
    // 忽略系统隐藏文件
    if (name.startsWith('.') || IGNORED_FILE_NAMES.has(name)) {
      continue;
    }
    if (!isValidInvoiceFileType(file)) {
      ignored.push({ name, reason: '类型不支持' });
    } else if (!isValidInvoiceFileSize(file)) {
      ignored.push({ name, reason: `大小超过 ${INVOICE_MAX_FILE_SIZE_MB}MB` });
    } else {
      valid.push(file);
    }
  }

  if (!valid.length && !ignored.length) {
    message.warning('所选文件夹中没有图片或 PDF 文件');
    return;
  }

  // 超过数量上限:整批拒绝,直接报错
  if (selectedFiles.value.length + valid.length > INVOICE_MAX_BATCH_COUNT) {
    message.error(
      `单次最多识别 ${INVOICE_MAX_BATCH_COUNT} 个文件(当前已选 ${selectedFiles.value.length} 个,本次文件夹含 ${valid.length} 个有效文件),请清空后重新选择`,
    );
    return;
  }

  // 通过校验的文件追加到已选列表(保持提交顺序)
  selectedFiles.value.push(...valid);

  // 聚合提示被忽略的文件,按原因分组计数,每组最多展示 3 个文件名
  if (ignored.length) {
    const groups = new Map<string, string[]>();
    ignored.forEach(({ name, reason }) => {
      const names = groups.get(reason) || [];
      names.push(name);
      groups.set(reason, names);
    });
    const parts = [...groups.entries()].map(([reason, names]) => {
      const shown = names.slice(0, 3).join('、');
      return `${names.length} 个文件${reason}(${shown}${names.length > 3 ? ' 等' : ''})`;
    });
    message.warning(`已忽略:${parts.join(';')}`);
  }
}

function clearSingleFile() {
  selectedFile.value = null;
}

function removeBatchFile(index: number) {
  selectedFiles.value.splice(index, 1);
}

function clearBatchFiles() {
  selectedFiles.value = [];
}

/**
 * 提交识别:校验表单与文件后调用对应接口,成功切换到结果展示
 */
async function handleSubmit() {
  if (!formState.invoice_nature) {
    message.warning('请选择发票性质');
    return;
  }
  if (!formState.invoice_purpose) {
    message.warning('请选择发票用途');
    return;
  }
  // 识别用户自动取当前登录用户
  const userId = authStore.user?.user_id;
  if (!userId) {
    message.error('用户信息缺失,请重新登录后再试');
    return;
  }

  if (isSingle.value) {
    // 先取局部变量,避免 ref 属性收窄失效
    const file = selectedFile.value;
    if (!file) {
      message.warning('请选择要识别的文件');
      return;
    }
    submitting.value = true;
    try {
      const res = await invoiceApi.upload(
        file,
        userId,
        formState.invoice_nature,
        formState.invoice_purpose,
        formState.tag,
      );
      singleResult.value = res.datas;
      // 通知调用方识别结果(如支出费用关联场景选取发票)
      emit('uploaded', res.datas);
      if (res.datas.invoices.length > 0) {
        hasNewInvoices.value = true;
      }
      phase.value = 'result';
    } catch {
      // 失败原因(如「未识别到发票」)已由全局拦截器提示,保持表单可修改后重试
    } finally {
      submitting.value = false;
    }
  } else {
    if (!selectedFiles.value.length) {
      message.warning('请选择要识别的文件');
      return;
    }
    // 提交前整体兜底校验(选择时已逐个过滤,此处正常应为空)
    const { valid, errors } = checkInvoiceFiles(selectedFiles.value, INVOICE_MAX_BATCH_COUNT);
    if (errors.length) {
      errors.forEach((e) => message.error(e));
      return;
    }
    submitting.value = true;
    try {
      const res = await invoiceApi.uploadBatch(
        valid,
        userId,
        formState.invoice_nature,
        formState.invoice_purpose,
        formState.tag,
      );
      batchResult.value = res.datas;
      if (res.datas.results.some((r) => (r.datas?.invoices?.length ?? 0) > 0)) {
        hasNewInvoices.value = true;
      }
      phase.value = 'result';
    } catch {
      // 失败原因已由全局拦截器提示
    } finally {
      submitting.value = false;
    }
  }
}

/** 重新识别:保留识别参数,仅清空文件与结果 */
function handleRedo() {
  selectedFile.value = null;
  selectedFiles.value = [];
  singleResult.value = null;
  batchResult.value = null;
  phase.value = 'form';
}

/** 关闭弹窗;有新入库发票时通知父级刷新列表 */
function handleCancel() {
  emit('update:open', false);
  if (hasNewInvoices.value) {
    emit('success');
  }
}

// ============ 批量结果表格 ============
const batchColumns = [
  { title: '文件名', dataIndex: 'original_name', key: 'original_name', ellipsis: true },
  { title: '结果', dataIndex: 'result', key: 'result', width: 80 },
  { title: '提示', dataIndex: 'msg', key: 'msg', ellipsis: true },
  { title: '发票明细', key: 'detail', width: 240 },
];

/** 批量结果表行 key:文件名可能重复,直接用行下标 */
const batchRowKey = (_record: InvoiceBatchFileResult, index: number): number => index;
</script>

<style scoped lang="scss">
.upload-form {
  .upload-icon {
    font-size: 40px;
    color: #2563eb;
    margin-bottom: 8px;
  }

  .upload-text {
    font-size: 14px;
    color: #18181b;
  }

  .upload-hint {
    font-size: 12px;
    color: #71717a;
  }
}

.file-list {
  margin-top: 12px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  padding: 4px 8px;

  .file-list-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #52525b;
    padding: 4px 4px 0;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;

    & + .file-item {
      border-top: 1px dashed #f0f0f0;
    }

    .file-icon {
      color: #2563eb;
      flex-shrink: 0;
    }

    .file-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }

    .file-size {
      flex-shrink: 0;
      font-size: 12px;
      color: #71717a;
      font-variant-numeric: tabular-nums;
    }
  }
}

.upload-result {
  .result-summary {
    margin-bottom: 16px;
  }

  .result-group {
    margin-bottom: 16px;

    .result-title {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 6px;
    }

    .result-title-new {
      color: #16a34a;
    }

    .result-title-exist {
      color: #d97706;
    }

    .result-title-failed {
      color: #dc2626;
    }

    .result-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 8px;
      border-radius: 6px;
      background: #fafafa;
      font-size: 13px;

      & + .result-row {
        margin-top: 4px;
      }

      .result-no {
        flex-shrink: 0;
        min-width: 140px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }

      .result-desc {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #52525b;
      }

      .result-amount {
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }
    }

    .result-row-failed .result-desc {
      color: #dc2626;
    }
  }

  .batch-table {
    .detail-tags .ant-tag {
      margin-inline-end: 4px;
    }
  }

  .batch-expand {
    .expand-line {
      font-size: 12px;
      color: #52525b;
      line-height: 1.8;

      .expand-label {
        color: #18181b;
        font-weight: 500;
        margin-right: 4px;
      }

      .expand-item {
        margin-right: 12px;
      }
    }

    .expand-line-failed .expand-item {
      color: #dc2626;
    }
  }
}
</style>

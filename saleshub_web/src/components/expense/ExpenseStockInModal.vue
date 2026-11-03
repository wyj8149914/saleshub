<template>
  <a-modal
    :open="open"
    title="费用单入库"
    :confirm-loading="submitting"
    :mask-closable="false"
    width="720px"
    ok-text="确认入库"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-spin :spinning="loading">
      <!-- 费用单摘要 -->
      <a-descriptions v-if="expense" :column="3" size="small" class="expense-summary">
        <a-descriptions-item label="费用单编号">{{ expense.expense_no }}</a-descriptions-item>
        <a-descriptions-item label="费用名称">{{ expense.expense_title || '-' }}</a-descriptions-item>
        <a-descriptions-item label="支出金额">¥{{ expense.amount }}</a-descriptions-item>
      </a-descriptions>

      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="仓库（可选）">
              <WarehouseSelect v-model="warehouseId" placeholder="不指定仓库(仅入总库存)" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="入库日期" required>
              <a-date-picker
                v-model:value="stockInDate"
                placeholder="请选择入库日期"
                style="width: 100%"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <!-- 零件明细(只读,取自费用单采购明细) -->
      <div class="section-title">入库明细（{{ items.length }} 行）</div>
      <a-table
        :columns="itemColumns"
        :data-source="items"
        :pagination="false"
        size="small"
        bordered
        :row-key="(record: ExpenseDetailItem) => record.relation_id"
        :scroll="{ y: 240 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'item_name'">
            {{ record.item_name || '-' }}
          </template>
          <template v-else-if="column.key === 'spec_name'">
            {{ record.spec_name || '默认' }}
          </template>
          <template v-else-if="column.key === 'price'"> ¥{{ record.price }} </template>
        </template>
      </a-table>

      <!-- 入库照片 -->
      <a-form-item label="入库照片（可选）" class="upload-item">
        <a-upload
          v-model:file-list="fileList"
          :before-upload="beforeUpload"
          :custom-request="handleUpload"
          :max-count="1"
          list-type="picture-card"
          :disabled="uploading"
        >
          <div v-if="fileList.length < 1 && !uploading">
            <plus-outlined />
            <div style="margin-top: 8px">上传照片</div>
          </div>
        </a-upload>
      </a-form-item>

      <!-- 备注 -->
      <a-form-item label="备注（可选）">
        <a-textarea v-model:value="remark" placeholder="请输入备注" :rows="2" :maxlength="500" show-count />
      </a-form-item>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 费用单入库弹窗:展示费用单采购明细(只读),选择仓库/日期/照片/备注后
 * 调用 /expense/stockIn 整单入库(后端事务内入库并回写入库状态)
 */
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { UploadFile } from 'ant-design-vue/es/upload';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { PlusOutlined } from '@ant-design/icons-vue';
import { expenseApi } from '@/api/expense';
import { fileApi } from '@/api/inventory';
import type { Expense, ExpenseDetailItem } from '@/types/expense';
import WarehouseSelect from '@/components/inventory/WarehouseSelect.vue';

interface Props {
  open: boolean;
  /** 入库目标费用单列表行,null 表示关闭状态 */
  expense: Expense | null;
}
const props = defineProps<Props>();

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}
const emit = defineEmits<Emits>();

/** 明细表格列(只读展示) */
const itemColumns = [
  { title: '零件', dataIndex: 'item_name', key: 'item_name', width: 180, ellipsis: true },
  { title: '规格', dataIndex: 'spec_name', key: 'spec_name', width: 120 },
  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' as const },
  { title: '单价', key: 'price', width: 110, align: 'right' as const },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
];

// ============ 状态 ============
const loading = ref(false);
const submitting = ref(false);
const items = ref<ExpenseDetailItem[]>([]);

const warehouseId = ref<string | undefined>(undefined);
const stockInDate = ref<Dayjs>(dayjs());
const remark = ref('');
const fileList = ref<UploadFile[]>([]);
const uploading = ref(false);
const photoId = ref('');

/** 加载费用单详情(取采购明细,后端已联查零件/规格名称) */
const loadDetail = async () => {
  if (!props.expense) return;
  loading.value = true;
  try {
    const res = await expenseApi.detail(props.expense.expense_id);
    items.value = res.datas.items || [];
  } catch {
    // 错误已由全局拦截器提示
    items.value = [];
  } finally {
    loading.value = false;
  }
};

// ============ 照片上传 ============
const beforeUpload = (file: File) => {
  if (!file.type.startsWith('image/')) {
    message.error('只能上传图片文件');
    return false;
  }
  if (file.size / 1024 / 1024 >= 5) {
    message.error('图片大小不能超过5MB');
    return false;
  }
  return true;
};

const handleUpload = async (options: { file: File }) => {
  // customRequest 接收的是上传配置对象，真正的文件在 options.file 中
  const { file } = options;
  uploading.value = true;
  try {
    const data = await fileApi.uploadFile(file);
    photoId.value = data.relation_id;
    message.success('照片上传成功');
  } catch {
    message.error('照片上传失败');
    fileList.value = [];
  } finally {
    uploading.value = false;
  }
};

// ============ 提交 ============
const handleSubmit = async () => {
  if (!props.expense) return;
  if (!stockInDate.value) {
    message.warning('请选择入库日期');
    return;
  }
  if (!items.value.length) {
    message.warning('该费用单无零件明细,无法入库');
    return;
  }
  submitting.value = true;
  try {
    const res = await expenseApi.stockIn({
      expense_id: props.expense.expense_id,
      date: dayjs(stockInDate.value).format('YYYY-MM-DD'),
      warehouse_id: warehouseId.value || undefined,
      photo_id: photoId.value || undefined,
      remark: remark.value.trim() || undefined,
    });
    if (res.result === 0) {
      message.success('入库成功');
      emit('update:open', false);
      emit('success');
    } else {
      message.error(res.msg || '入库失败');
    }
  } catch {
    // 错误已由全局拦截器提示
  } finally {
    submitting.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

/** 打开时重置表单并加载明细 */
watch(
  () => props.open,
  (open) => {
    if (open && props.expense) {
      warehouseId.value = undefined;
      stockInDate.value = dayjs();
      remark.value = '';
      fileList.value = [];
      photoId.value = '';
      items.value = [];
      loadDetail();
    }
  },
);
</script>

<style scoped lang="scss">
.expense-summary {
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #52525b;
  margin-bottom: 8px;
}

.upload-item {
  margin-top: 16px;
}
</style>

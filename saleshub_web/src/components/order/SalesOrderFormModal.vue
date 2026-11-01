<template>
  <a-modal
    :open="open"
    :title="isEdit ? '修改销售订单' : '新建销售订单'"
    :confirm-loading="loading"
    :mask-closable="false"
    width="640px"
    ok-text="提交"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item
        label="订单名称"
        name="order_title"
        :rules="[
          { required: true, message: '请输入订单名称' },
          { max: 100, message: '订单名称最长100字符' },
        ]"
      >
        <a-input v-model:value="form.order_title" placeholder="请输入订单名称" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item
            label="客户名称"
            name="customer_name"
            :rules="[
              { required: true, message: '请输入客户名称' },
              { max: 100, message: '客户名称最长100字符' },
            ]"
          >
            <a-input v-model:value="form.customer_name" placeholder="请输入客户名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item
            label="客户联系方式"
            name="customer_phone"
            :rules="[
              { required: true, message: '请输入客户联系方式' },
              { max: 20, message: '联系方式最长20字符' },
            ]"
          >
            <a-input v-model:value="form.customer_phone" placeholder="请输入客户联系方式" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="收货地址" name="address" :rules="[{ max: 255, message: '收货地址最长255字符' }]">
        <a-input v-model:value="form.address" placeholder="请输入收货地址(可选)" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <!-- 订单金额:数字输入,最多两位小数(与后端校验一致) -->
          <a-form-item
            label="订单金额"
            name="amount"
            :rules="[{ required: true, message: '请输入订单金额' }, { validator: validateAmount }]"
          >
            <a-input-number
              v-model:value="form.amount"
              placeholder="请输入订单金额"
              :min="0"
              :precision="2"
              :step="100"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="交货日期" name="delivery_date" :rules="[{ required: true, message: '请选择交货日期' }]">
            <a-date-picker
              v-model:value="deliveryDateValue"
              value-format="YYYY-MM-DD"
              placeholder="请选择交货日期"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="备注" name="remark" :rules="[{ max: 500, message: '备注最长500字符' }]">
        <a-textarea v-model:value="form.remark" placeholder="请输入备注(可选)" :rows="2" />
      </a-form-item>

      <!-- 合同文件:选取后立即上传 /saleshub/file/upload,回填 relation_id -->
      <a-form-item label="合同文件">
        <a-upload
          :show-upload-list="false"
          :before-upload="handleContractSelect"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        >
          <a-button :loading="contractUploading">
            <template #icon><UploadOutlined /></template>
            {{ form.contract_file_id ? '重新上传合同' : '上传合同文件' }}
          </a-button>
        </a-upload>

        <!-- 已上传合同:展示文件名并可移除 -->
        <div v-if="contractFileName" class="contract-file">
          <PaperClipOutlined class="contract-file-icon" />
          <span class="contract-file-name">{{ contractFileName }}</span>
          <a-button type="link" size="small" danger @click="removeContract">移除</a-button>
        </div>
        <div v-else-if="isEdit && form.contract_file_id" class="contract-file">
          <PaperClipOutlined class="contract-file-icon" />
          <span class="contract-file-name">已上传合同文件(重新上传可替换)</span>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 新建/修改销售订单弹窗(props.order 为 null 表示新建)
 * - 必填:订单名称/客户名称/联系方式/金额/交货日期;新建人 user_id 自动取当前登录用户
 * - 合同文件:选取后立即调 fileApi.uploadFile 上传,回填 contract_file_id;移除仅清空回填,不删服务器文件
 * - 失败提示由全局拦截器统一处理
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { PaperClipOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { fileApi } from '@/api/inventory';
import { salesOrderApi } from '@/api/salesOrder';
import { useAuthStore } from '@/stores/auth';
import type { SalesOrder } from '@/types/salesOrder';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 编辑目标订单,null 表示新建 */
  order: SalesOrder | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();
const formRef = ref();
const loading = ref(false);

/** 表单数据(address/remark 用空串表示未填,提交时转 undefined) */
const form = ref({
  order_title: '',
  customer_name: '',
  customer_phone: '',
  address: '',
  amount: undefined as number | undefined,
  delivery_date: '',
  remark: '',
  contract_file_id: null as string | null,
});

/** 已上传合同的展示文件名(新建上传后记录原始文件名,编辑回填时为空则展示占位文案) */
const contractFileName = ref('');
/** 合同上传中状态 */
const contractUploading = ref(false);

/** 是否编辑模式 */
const isEdit = computed(() => !!props.order);

/** 交货日期(date-picker 双向绑定) */
const deliveryDateValue = computed({
  get: () => form.value.delivery_date || undefined,
  set: (val?: string) => {
    form.value.delivery_date = val ?? '';
  },
});

/** 订单金额校验:必须大于 0 */
const validateAmount = (_rule: unknown, value?: number) => {
  if (value === undefined || value === null) {
    return Promise.resolve();
  }
  return value > 0 ? Promise.resolve() : Promise.reject('订单金额必须大于0');
};

/**
 * 选择合同文件(before-upload 拦截自动上传):立即调 fileApi 上传并回填 relation_id
 * @returns 恒为 false,阻止 a-upload 自动上传行为
 */
const handleContractSelect = async (file: File) => {
  contractUploading.value = true;
  try {
    const res = await fileApi.uploadFile(file);
    form.value.contract_file_id = res.relation_id;
    contractFileName.value = file.name;
    message.success('合同文件上传成功');
  } catch {
    // 上传失败已由全局拦截器提示,保留原有合同不变
  } finally {
    contractUploading.value = false;
  }
  return false;
};

/** 移除已上传的合同(仅清空回填,不删除服务器文件) */
const removeContract = () => {
  form.value.contract_file_id = null;
  contractFileName.value = '';
};

/** 重置表单:编辑时回填目标订单,新建时清空 */
const resetForm = () => {
  form.value = {
    order_title: props.order?.order_title ?? '',
    customer_name: props.order?.customer_name ?? '',
    customer_phone: props.order?.customer_phone ?? '',
    address: props.order?.address ?? '',
    amount: props.order ? Number(props.order.amount) : undefined,
    delivery_date: props.order ? props.order.delivery_date.slice(0, 10) : '',
    remark: props.order?.remark ?? '',
    contract_file_id: props.order?.contract_file_id ?? null,
  };
  contractFileName.value = '';
};

/** 提交:校验通过后按模式调用 create/update */
const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const userId = authStore.user?.user_id;
  if (!isEdit.value && !userId) {
    message.error('用户信息缺失,请重新登录后再试');
    return;
  }
  loading.value = true;
  try {
    if (isEdit.value && props.order) {
      await salesOrderApi.update({
        order_id: props.order.order_id,
        order_title: form.value.order_title,
        customer_name: form.value.customer_name,
        customer_phone: form.value.customer_phone,
        address: form.value.address || undefined,
        amount: form.value.amount,
        delivery_date: form.value.delivery_date,
        remark: form.value.remark || undefined,
        contract_file_id: form.value.contract_file_id ?? undefined,
      });
      message.success('订单修改成功');
    } else {
      await salesOrderApi.create({
        user_id: userId!,
        order_title: form.value.order_title,
        customer_name: form.value.customer_name,
        customer_phone: form.value.customer_phone,
        address: form.value.address || undefined,
        amount: form.value.amount!,
        delivery_date: form.value.delivery_date,
        remark: form.value.remark || undefined,
        contract_file_id: form.value.contract_file_id ?? undefined,
      });
      message.success('订单创建成功');
    }
    emit('update:open', false);
    emit('success');
  } catch {
    // 失败已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

// 打开弹窗时重置表单并清除校验状态
watch(
  () => props.open,
  (val) => {
    if (!val) return;
    resetForm();
    formRef.value?.clearValidate();
  },
);
</script>

<style scoped lang="scss">
/* 已上传合同文件名展示行 */
.contract-file {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.contract-file-icon {
  color: #2563eb;
}

.contract-file-name {
  color: #52525b;
  font-size: 13px;
}
</style>

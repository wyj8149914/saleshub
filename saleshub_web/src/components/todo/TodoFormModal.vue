<template>
  <a-modal
    :open="open"
    :title="isEdit ? '修改待办事项' : '新建待办事项'"
    :confirm-loading="loading"
    :mask-closable="false"
    width="720px"
    ok-text="提交"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="emit('update:open', false)"
  >
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="待办名称" name="title" :rules="[{ required: true, message: '请输入待办名称' }]">
            <a-input v-model:value="form.title" placeholder="请输入待办名称" :maxlength="100" show-count />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="待办类型" name="type_id">
            <a-select
              v-model:value="form.type_id"
              placeholder="请选择类型（可选）"
              allow-clear
              :loading="typesLoading"
              :options="typeOptions"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="重要程度" name="priority" :rules="[{ required: true, message: '请选择重要程度' }]">
            <a-select v-model:value="form.priority" placeholder="请选择重要程度" :options="priorityOptions" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="截止日期" name="deadline" :rules="[{ required: true, message: '请选择截止日期' }]">
            <a-date-picker
              v-model:value="form.deadline"
              placeholder="请选择截止日期"
              style="width: 100%"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              :allow-clear="false"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <!-- 执行人:多选,至少 1 个、最多 20 个 -->
      <a-form-item label="执行人" name="executor_ids" :rules="executorRules">
        <UserSelect v-model:value="form.executor_ids" multiple :user-options="userOptions" />
      </a-form-item>

      <!-- 附件:多文件上传,relation_id 列表随表单提交 -->
      <a-form-item label="附件" name="attachments">
        <a-upload
          v-model:file-list="fileList"
          :custom-request="handleUpload"
          :show-upload-list="true"
          :before-upload="beforeUpload"
        >
          <a-button>
            <UploadOutlined />
            上传附件（可多选，单个不超过 10MB）
          </a-button>
        </a-upload>
      </a-form-item>

      <a-form-item label="备注" name="remark">
        <a-textarea
          v-model:value="form.remark"
          placeholder="请输入备注（可选）"
          :rows="3"
          :maxlength="500"
          show-count
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 待办事项新建/编辑弹窗
 * - 新建:user_id 取当前登录用户,初始未完成状态由后端写入
 * - 编辑:经 /saleshub/todo/detail 回显完整数据,executor_ids/attachments 整体替换
 * - 附件:走 /saleshub/file/upload 上传,提交 relation_id 列表
 */
import { computed, ref, watch } from 'vue';
import { message, Upload } from 'ant-design-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import { UploadOutlined } from '@ant-design/icons-vue';
import { todoApi, todoTypeApi } from '@/api/todo';
import { fileApi } from '@/api/inventory';
import { useAuthStore } from '@/stores/auth';
import { TODO_PRIORITY_LABELS, TodoPriority } from '@/types/todo';
import type { Todo } from '@/types/todo';
import UserSelect from '@/components/todo/UserSelect.vue';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 编辑目标列表行,null 表示新建 */
  todo: Todo | null;
  /** 缓存的全量用户选项(主页面统一查询,执行人下拉不再重复请求) */
  userOptions?: { label: string; value: string }[];
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
const MAX_EXECUTORS = 20;

// ============ 表单状态 ============
const form = ref({
  title: '',
  type_id: undefined as string | undefined,
  priority: TodoPriority.NOT_IMPORTANT_NOT_URGENT as number,
  deadline: '' as string,
  executor_ids: [] as string[],
  remark: '',
});

/** 是否编辑模式 */
const isEdit = computed(() => !!props.todo);

/** 执行人校验:至少 1 个、最多 20 个 */
const executorRules = [
  { required: true, message: '请选择执行人' },
  {
    validator: (_rule: unknown, value: string[]) => {
      if (!value || value.length === 0) return Promise.resolve();
      if (value.length > MAX_EXECUTORS) return Promise.reject(`执行人最多选择${MAX_EXECUTORS}个`);
      return Promise.resolve();
    },
  },
];

const priorityOptions = Object.entries(TODO_PRIORITY_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

// ============ 待办类型选项 ============
const typesLoading = ref(false);
const typeOptions = ref<{ label: string; value: string }[]>([]);

/** 加载待办类型下拉选项 */
const loadTypes = async () => {
  typesLoading.value = true;
  try {
    const res = await todoTypeApi.list();
    typeOptions.value = (res.datas.items || []).map((t) => ({ label: t.type_name, value: t.type_id }));
  } catch {
    typeOptions.value = [];
  } finally {
    typesLoading.value = false;
  }
};

// ============ 附件上传 ============
/** 上传文件列表(uid 即 relation_id) */
const fileList = ref<UploadFile[]>([]);

/** 上传前校验文件大小(与后端 10MB 限制一致) */
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  if (file.size > 1024 * 1024 * 10) {
    message.warning(`文件 ${file.name} 超过 10MB,已跳过`);
    return Upload.LIMIT_EXCEEDED;
  }
  return true;
};

/** 自定义上传:调 fileApi 上传后用返回的 relation_id 作为文件 uid */
const handleUpload: UploadProps['customRequest'] = (options) => {
  const file = options.file as File;
  fileApi
    .uploadFile(file)
    .then((data) => {
      // 上传成功后把 uid 替换为 relation_id,提交时直接取 uid 列表
      const item = fileList.value.find((f) => f.uid === (options.file as UploadFile).uid);
      if (item) {
        item.uid = data.relation_id;
        item.status = 'done';
      }
      options.onSuccess?.(data, undefined as never);
    })
    .catch(() => {
      const item = fileList.value.find((f) => f.uid === (options.file as UploadFile).uid);
      if (item) {
        item.status = 'error';
      }
      options.onError?.(new Error('上传失败'));
    });
};

/** 当前附件 relation_id 列表(仅取上传成功的) */
const attachmentIds = computed(() => fileList.value.filter((f) => f.status === 'done').map((f) => f.uid));

// ============ 提交 ============
const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  if (!form.value.deadline) {
    message.warning('请选择截止日期');
    return;
  }

  loading.value = true;
  try {
    if (isEdit.value && props.todo) {
      // 修改:执行人与附件整体替换,直接修改截止日期不产生延期记录
      const res = await todoApi.update({
        todo_id: props.todo.todo_id,
        title: form.value.title.trim(),
        type_id: form.value.type_id,
        priority: form.value.priority,
        deadline: form.value.deadline,
        executor_ids: form.value.executor_ids,
        attachments: attachmentIds.value,
        remark: form.value.remark || undefined,
      });
      if (res.result === 0) {
        message.success('修改成功');
        emit('update:open', false);
        emit('success');
      }
    } else {
      const userId = authStore.user?.user_id;
      if (!userId) {
        message.error('用户信息缺失,请重新登录后再试');
        return;
      }
      const res = await todoApi.create({
        title: form.value.title.trim(),
        type_id: form.value.type_id,
        priority: form.value.priority,
        deadline: form.value.deadline,
        executor_ids: form.value.executor_ids,
        attachments: attachmentIds.value.length > 0 ? attachmentIds.value : undefined,
        remark: form.value.remark || undefined,
        user_id: userId,
      });
      if (res.result === 0) {
        message.success('创建成功');
        emit('update:open', false);
        emit('success');
      }
    }
  } catch {
    // 失败已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

// ============ 打开时初始化 ============
const resetForm = () => {
  form.value = {
    title: '',
    type_id: undefined,
    priority: TodoPriority.NOT_IMPORTANT_NOT_URGENT,
    deadline: '',
    executor_ids: [],
    remark: '',
  };
  fileList.value = [];
  formRef.value?.clearValidate();
};

watch(
  () => props.open,
  async (val) => {
    if (!val) return;
    resetForm();
    loadTypes();
    if (props.todo) {
      // 编辑:加载详情回显(执行人/附件列表与列表行不同,需取详情)
      try {
        const res = await todoApi.detail(props.todo.todo_id);
        const detail = res.datas;
        form.value.title = detail.title;
        form.value.type_id = detail.type_id ?? undefined;
        form.value.priority = detail.priority;
        form.value.deadline = detail.deadline;
        form.value.executor_ids = detail.executors.map((e) => e.user_id);
        form.value.remark = detail.remark || '';
        // 已有附件无文件名信息,统一以「附件N」展示
        fileList.value = (detail.attachments || []).map((relationId, idx) => ({
          uid: relationId,
          name: `附件${idx + 1}`,
          status: 'done' as const,
        }));
      } catch {
        // 详情加载失败由拦截器提示,关闭弹窗避免提交脏数据
        emit('update:open', false);
      }
    }
  },
);
</script>

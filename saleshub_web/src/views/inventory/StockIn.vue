<template>
  <a-card title="入库操作" :bordered="false">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="handleSubmit">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="零件" name="itemId">
            <a-select v-model:value="form.itemId" placeholder="请选择零件" show-search :filter-option="filterItemOption"
              :loading="itemsLoading" :options="itemOptions" />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="数量" name="quantity">
            <a-input-number v-model:value="form.quantity" placeholder="请输入数量" :min="1" :precision="0"
              style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="入库日期" name="date">
            <a-date-picker v-model:value="form.date" placeholder="请选择入库日期" style="width: 100%" :format="'YYYY-MM-DD'" />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="批次号" name="batchNumber">
            <a-input v-model:value="form.batchNumber" placeholder="请输入批次号（可选）" :maxlength="50" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="照片" name="photo">
        <a-upload v-model:file-list="fileList" :before-upload="beforeUpload" :custom-request="handleUpload"
          :max-count="1" list-type="picture-card" :disabled="uploading">
          <div v-if="fileList.length < 1 && !uploading">
            <plus-outlined />
            <div style="margin-top: 8px">上传照片</div>
          </div>
        </a-upload>
      </a-form-item>

      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" placeholder="请输入备注" :rows="4" :maxlength="500" show-count />
      </a-form-item>

      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="loading">
            提交入库
          </a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { message } from 'ant-design-vue';
  import { PlusOutlined } from '@ant-design/icons-vue';
  import dayjs, { type Dayjs } from 'dayjs';
  import { inventoryApi } from '@/api/inventory';
  import type { InventoryItem } from '@/api/inventory';

  // 表单引用
  const formRef = ref();

  // 加载状态
  const loading = ref(false);
  const itemsLoading = ref(false);
  const uploading = ref(false);

  // 零件列表
  const items = ref<InventoryItem[]>([]);

  // 文件列表
  const fileList = ref<any[]>([]);

  // 上传的图片URL
  const photoUrl = ref<string>('');

  // 表单数据接口
  interface FormData {
    itemId: string;
    quantity: number;
    date: Dayjs;
    batchNumber?: string;
    remark?: string;
  }

  // 表单数据
  const form = ref<FormData>({
    itemId: '',
    quantity: 1,
    date: dayjs(),
    batchNumber: '',
    remark: ''
  });

  // 表单验证规则
  const rules = computed(() => ({
    itemId: [
      { required: true, message: '请选择零件', trigger: 'change' }
    ],
    quantity: [
      { required: true, message: '请输入数量', trigger: 'blur' },
      { type: 'number', min: 1, message: '数量必须大于0', trigger: 'blur' }
    ],
    date: [
      { required: true, message: '请选择入库日期', trigger: 'change' }
    ]
  }));

  // 零件选项
  const itemOptions = computed(() =>
    items.value
      .map(item => ({
        label: `${item.name} (${item.code})`,
        value: item.item_id
      }))
  );

  // 零件搜索过滤
  const filterItemOption = (input: string, option: { label: string; value: string }) => {
    return option.label.toLowerCase().includes(input.toLowerCase());
  };

  // 加载零件列表
  const loadInventoryItems = async () => {
    itemsLoading.value = true;
    try {
      const response = await inventoryApi.listItems({
        pageIndex: 1,
        pageSize: 1000
      });
      if (response.result === 0) {
        items.value = response.datas.items;
      } else {
        message.error(response.msg || '加载零件列表失败');
      }
    } catch (error) {
      console.error('加载零件列表失败:', error);
      message.error('加载零件列表失败');
    } finally {
      itemsLoading.value = false;
    }
  };

  // 上传前验证
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件');
      return false;
    }
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('图片大小不能超过5MB');
      return false;
    }
    return true;
  };

  // 自定义上传
  const handleUpload = async (options: any) => {
    // const { file } = options;
    // uploading.value = true;
    // try {
    //   const response = await inventoryApi.uploadPhoto(file);
    //   if (response.result === 0) {
    //     photoUrl.value = response.datas.url;
    //     message.success('照片上传成功');
    //   } else {
    //     message.error(response.msg || '照片上传失败');
    //   }
    // } catch (error) {
    //   console.error('照片上传失败:', error);
    //   message.error('照片上传失败');
    // } finally {
    //   uploading.value = false;
    // }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      loading.value = true;

      // 准备提交数据
      const submitData = {
        itemId: form.value.itemId,
        quantity: form.value.quantity,
        batchNumber: form.value.batchNumber || undefined,
        notes: form.value.remark || undefined
      };

      // const response = await inventoryApi.stockIn(submitData);

      // if (response.result === 0) {
      //   message.success('入库操作成功');
      //   handleReset();
      // } else {
      //   message.error(response.msg || '入库操作失败');
      // }
    } catch (error) {
      console.error('提交失败:', error);
      message.error('操作失败，请稍后重试');
    } finally {
      loading.value = false;
    }
  };

  // 重置表单
  const handleReset = () => {
    form.value = {
      itemId: '',
      quantity: 1,
      date: dayjs(),
      batchNumber: '',
      remark: ''
    };
    fileList.value = [];
    photoUrl.value = '';
    formRef.value?.clearValidate();
  };

  // 组件挂载时加载数据
  onMounted(() => {
    loadInventoryItems();
  });
</script>

<style scoped lang="scss">
  :deep(.ant-card) {
    max-width: 800px;
    margin: 0 auto;

    .ant-card-head-title {
      font-weight: 600;
    }
  }

  :deep(.ant-upload-select-picture-card) {
    width: 104px;
    height: 104px;
  }

  :deep(.ant-upload-list-picture-card-container) {
    width: 104px;
    height: 104px;
  }

  :deep(.ant-form-item) {
    margin-bottom: 24px;
  }

  :deep(.ant-input-textarea-show-count::after) {
    float: right;
    margin-top: 4px;
    color: rgba(0, 0, 0, 0.45);
  }
</style>

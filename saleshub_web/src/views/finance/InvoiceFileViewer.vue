<template>
  <a-card :bordered="false" class="file-viewer-card">
    <template #title>发票源文件{{ invoiceNumber ? `(${invoiceNumber})` : '' }}</template>
    <template #extra>
      <a-button type="link" @click="goBack">
        <template #icon><ArrowLeftOutlined /></template>
        返回详情
      </a-button>
    </template>

    <a-spin :spinning="loading">
      <!-- 图片自适应缩放居中展示,PDF 内嵌滚动查看 -->
      <div v-if="fileUrl" class="viewer-body">
        <img v-if="!isPdfFile" :src="fileUrl" class="viewer-image" alt="发票源文件" />
        <iframe v-else :src="fileUrl" class="viewer-pdf" title="发票源文件预览" />
      </div>
      <a-empty v-else-if="!loading" description="暂无原文件" />
    </a-spin>
  </a-card>
</template>

<script setup lang="ts">
/**
 * 发票源文件查看页:按路由中的 invoice_id 加载发票详情并展示原始文件
 * 图片居中自适应缩放,PDF 内嵌 iframe;文件缺失时展示空状态
 * 从发票详情抽屉的「查看源文件」按钮进入
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftOutlined } from '@ant-design/icons-vue';
import { invoiceApi } from '@/api/invoice';
import type { InvoiceDetail } from '@/types/invoice';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const detail = ref<InvoiceDetail | null>(null);

const fileUrl = computed(() => detail.value?.file_url || '');
/** 原文件是否为 PDF(决定用 iframe 还是图片展示) */
const isPdfFile = computed(() => /\.pdf(\?|#|$)/i.test(fileUrl.value));

const invoiceNumber = computed(() => detail.value?.invoice_number || '');

/** 加载发票详情,获取源文件地址 */
async function loadDetail() {
  const invoiceId = route.params.invoiceId;
  if (typeof invoiceId !== 'string' || !invoiceId) {
    return;
  }
  loading.value = true;
  try {
    const res = await invoiceApi.detail(invoiceId);
    detail.value = res.datas;
  } catch {
    // 错误已由全局拦截器提示(如「发票不存在」),保持空状态
  } finally {
    loading.value = false;
  }
}

/** 返回发票列表页(详情抽屉所在页) */
function goBack() {
  router.push({ name: 'InvoiceList' });
}

onMounted(() => {
  loadDetail();
});
</script>

<style scoped lang="scss">
.file-viewer-card {
  min-height: 100%;
}

.viewer-body {
  display: flex;
  justify-content: center;
}

.viewer-image {
  max-width: 100%;
  max-height: calc(100vh - 240px);
  object-fit: contain;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
}

.viewer-pdf {
  width: 100%;
  height: calc(100vh - 240px);
  border: 1px solid #e4e4e7;
  border-radius: 8px;
}
</style>

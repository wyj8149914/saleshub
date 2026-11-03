<template>
  <a-drawer :open="open" title="待办事项详情" width="720" :mask-closable="true" @close="emit('update:open', false)">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <!-- 头部操作:完成状态变更 / 延期 / 编辑 -->
        <div class="action-bar">
          <a-space>
            <a-popconfirm
              :title="detail.is_completed === TodoCompleted.YES ? '确认取消完成状态吗？' : '确认标记为已完成吗？'"
              ok-text="确认"
              cancel-text="取消"
              @confirm="handleComplete"
            >
              <a-button
                :type="detail.is_completed === TodoCompleted.YES ? 'default' : 'primary'"
                :danger="detail.is_completed === TodoCompleted.YES"
              >
                {{ detail.is_completed === TodoCompleted.YES ? '取消完成' : '标记完成' }}
              </a-button>
            </a-popconfirm>
            <a-button @click="emit('postpone', detail.todo_id)">延期</a-button>
            <a-button @click="emit('edit', detail.todo_id)">编辑</a-button>
          </a-space>
        </div>

        <!-- 基本信息 -->
        <a-descriptions title="基本信息" :column="2" size="small" bordered>
          <a-descriptions-item label="待办名称" :span="2">{{ detail.title }}</a-descriptions-item>
          <a-descriptions-item label="待办类型">{{ detail.type_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="重要程度">
            <a-tag :color="PRIORITY_COLORS[detail.priority]">
              {{ TODO_PRIORITY_LABELS[detail.priority] || '-' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="截止日期">{{ detail.deadline }}</a-descriptions-item>
          <a-descriptions-item label="剩余天数">
            <span :class="remainingClass">{{ remainingText }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="是否完成">
            <a-tag :color="detail.is_completed === TodoCompleted.YES ? 'green' : 'orange'">
              {{ detail.is_completed === TodoCompleted.YES ? '已完成' : '未完成' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="完成时间">{{ detail.completed_time || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ userName(detail.user_id) }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatDateTime(detail.create_time) }}</a-descriptions-item>
          <a-descriptions-item label="执行人" :span="2">
            <template v-if="detail.executors.length > 0">
              <a-tag v-for="e in detail.executors" :key="e.user_id" color="blue">
                {{ userName(e.user_id) }}
              </a-tag>
            </template>
            <span v-else>-</span>
          </a-descriptions-item>
          <a-descriptions-item label="延期统计" :span="2">
            {{ detail.postpone_records.length > 0 ? `延期 ${detail.postpone_records.length} 次` : '无延期记录' }}
          </a-descriptions-item>
          <a-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</a-descriptions-item>
        </a-descriptions>

        <!-- 附件列表(后端无文件下载接口,仅展示 relation_id) -->
        <div v-if="detail.attachments && detail.attachments.length > 0" class="section-gap">
          <a-divider style="margin: 8px 0">
            <span class="section-title">附件({{ detail.attachments.length }})</span>
          </a-divider>
          <div class="attachment-list">
            <a-tag v-for="(id, idx) in detail.attachments" :key="id" color="cyan"
              >附件{{ idx + 1 }}:{{ shortId(id) }}</a-tag
            >
          </div>
        </div>

        <!-- 延期记录时间线 -->
        <div v-if="detail.postpone_records.length > 0" class="section-gap">
          <a-divider style="margin: 8px 0">
            <span class="section-title">延期记录({{ detail.postpone_records.length }})</span>
          </a-divider>
          <a-timeline class="postpone-timeline">
            <a-timeline-item v-for="record in detail.postpone_records" :key="record.postpone_id" color="orange">
              <div class="postpone-item">
                <div class="postpone-dates">
                  {{ record.old_deadline }} → {{ record.new_deadline }}
                  <a-tag color="orange" class="delay-tag">+{{ record.delay_days }} 天</a-tag>
                </div>
                <div class="postpone-meta">
                  原因:{{ record.reason }} · 操作人:{{ userName(record.operator_id) }} ·
                  {{ formatDateTime(record.create_time) }}
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>
        </div>
      </template>
    </a-spin>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * 待办事项详情抽屉
 * 展示待办全部业务字段、执行人(姓名由父级传入的用户映射翻译)、附件与延期记录时间线
 * 支持标记完成/取消完成、延期与编辑入口(延期/编辑由父级打开对应弹窗)
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { todoApi } from '@/api/todo';
import { TODO_PRIORITY_LABELS, TodoCompleted } from '@/types/todo';
import type { TodoDetail } from '@/types/todo';

interface Props {
  /** 抽屉可见性(v-model:open) */
  open: boolean;
  /** 待办事项 ID */
  todoId: string;
  /** 用户 ID → 姓名映射(父级提供,找不到时降级显示 ID 前 8 位) */
  userNameMap?: Record<string, string>;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
  (e: 'postpone', todoId: string): void;
  (e: 'edit', todoId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const detail = ref<TodoDetail | null>(null);

/** 重要程度标签颜色:1-红(紧急) 2-橙 3-蓝 4-灰 */
const PRIORITY_COLORS: Record<number, string> = {
  1: 'red',
  2: 'orange',
  3: 'blue',
  4: 'default',
};

/** 用户 ID 翻译姓名,映射缺失时降级为 ID 前 8 位 */
const userName = (userId: string): string => props.userNameMap?.[userId] || userId.slice(0, 8);

/** relation_id 缩短展示 */
const shortId = (id: string): string => id.slice(0, 12);

/** 剩余天数展示文案:负数-已过期,0-今天截止,正数-剩余天数 */
const remainingText = computed(() => {
  if (!detail.value) return '-';
  const days = detail.value.remaining_days;
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天截止';
  return `剩 ${days} 天`;
});

/** 剩余天数样式:已过期红色,今天截止橙色 */
const remainingClass = computed(() => {
  if (!detail.value) return '';
  if (detail.value.remaining_days < 0) return 'remaining-overdue';
  if (detail.value.remaining_days === 0) return 'remaining-today';
  return '';
});

/** 完成/取消完成:popconfirm 确认后调接口并刷新详情与列表 */
const handleComplete = async () => {
  if (!detail.value) return;
  const target = detail.value.is_completed === TodoCompleted.YES ? TodoCompleted.NO : TodoCompleted.YES;
  try {
    const res = await todoApi.complete({
      todo_id: detail.value.todo_id,
      is_completed: target,
    });
    if (res.result === 0) {
      message.success(target === TodoCompleted.YES ? '已标记完成' : '已取消完成');
      emit('success');
      loadDetail();
    }
  } catch {
    // 失败已由全局拦截器提示
  }
};

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

/** 加载待办详情 */
const loadDetail = async () => {
  loading.value = true;
  try {
    const res = await todoApi.detail(props.todoId);
    detail.value = res.datas;
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.open, props.todoId],
  ([open]) => {
    if (open && props.todoId) {
      detail.value = null;
      loadDetail();
    }
  },
);

// 详情数据可能在父级操作(延期/编辑/完成)后变化,父级 success 时刷新
defineExpose({ loadDetail });
</script>

<style scoped lang="scss">
.action-bar {
  margin-bottom: 16px;
}

.section-gap {
  margin-top: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #52525b;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
}

.postpone-timeline {
  margin-top: 12px;
}

.postpone-dates {
  font-weight: 500;
}

.delay-tag {
  margin-left: 8px;
}

.postpone-meta {
  margin-top: 2px;
  font-size: 12px;
  color: #71717a;
}

.remaining-overdue {
  color: #dc2626;
  font-weight: 600;
}

.remaining-today {
  color: #ea580c;
  font-weight: 600;
}
</style>

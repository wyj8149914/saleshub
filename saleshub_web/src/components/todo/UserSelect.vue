<template>
  <a-select
    :value="value"
    :mode="multiple ? 'multiple' : undefined"
    placeholder="搜索并选择用户(姓名/用户名)"
    show-search
    :filter-option="false"
    :options="options"
    :loading="loading"
    :max-tag-count="multiple ? 5 : undefined"
    allow-clear
    @search="handleSearch"
    @change="handleChange"
    @dropdown-visible-change="handleDropdownVisible"
  />
</template>

<script setup lang="ts">
/**
 * 用户选择器
 * 优先使用父级传入的缓存用户选项(userOptions,主页面统一查询一次),本地过滤不发起请求
 * 未提供缓存时降级为远程搜索模式(基于 userApi.listUsers 按姓名模糊搜索)
 * option label 展示「姓名 (用户名)」,支持单选/多选(v-model:value 为 user_id 或 user_id 数组)
 */
import { computed, ref } from 'vue';
import { userApi } from '@/api/user';
import type { UserListItem } from '@/types/user';

interface UserOption {
  label: string;
  value: string;
}

interface Props {
  /** 选中值:user_id(单选)或 user_id 数组(多选) */
  value: string | string[] | undefined;
  /** 是否多选(默认多选) */
  multiple?: boolean;
  /** 缓存的全量用户选项(父级提供时不再发起远程请求) */
  userOptions?: UserOption[];
}

const props = withDefaults(defineProps<Props>(), {
  multiple: true,
  userOptions: undefined,
});

interface Emits {
  (e: 'update:value', value: string | string[] | undefined): void;
}

const emit = defineEmits<Emits>();

const loading = ref(false);
/** 远程搜索关键字(缓存模式下用于本地过滤) */
const keyword = ref('');
/** 远程搜索结果(未提供缓存时使用) */
const remoteOptions = ref<UserOption[]>([]);

/**
 * 下拉选项:有缓存时按关键字本地过滤,否则用远程搜索结果
 * 选中值始终能在缓存选项中找到对应 label,编辑回显不会显示原始 ID
 */
const options = computed<UserOption[]>(() => {
  if (props.userOptions?.length) {
    const kw = keyword.value.trim().toLowerCase();
    if (!kw) {
      return props.userOptions;
    }
    return props.userOptions.filter((o) => o.label.toLowerCase().includes(kw));
  }
  return remoteOptions.value;
});

/** 搜索:缓存模式仅记录关键字本地过滤,无缓存时远程查询 */
const handleSearch = async (input: string) => {
  if (props.userOptions?.length) {
    keyword.value = input;
    return;
  }
  loading.value = true;
  try {
    const res = await userApi.listUsers({ pageIndex: 1, pageSize: 50, name: input || undefined });
    remoteOptions.value = (res.datas.items || []).map(toOption);
  } catch {
    remoteOptions.value = [];
  } finally {
    loading.value = false;
  }
};

/** 首次展开下拉时加载默认用户列表(仅远程搜索模式),避免空下拉 */
const handleDropdownVisible = (open: boolean) => {
  if (open && !props.userOptions?.length && remoteOptions.value.length === 0) {
    handleSearch('');
  }
};

/** 用户列表项转下拉选项:label 展示「姓名 (用户名)」 */
const toOption = (user: UserListItem) => ({
  label: `${user.name} (${user.username})`,
  value: user.user_id,
});

const handleChange = (value: string | string[] | undefined) => {
  emit('update:value', value);
};
</script>

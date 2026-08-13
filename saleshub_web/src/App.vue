<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN';

// 全局中文 locale：a-table 分页（条/页）、a-modal 确定/取消、a-popconfirm、空状态等
const locale = zhCN;
</script>

<template>
  <a-config-provider :locale="locale">
    <router-view />
  </a-config-provider>
</template>

<style scoped></style>

<template>
  <div class="section-state" :class="status">
    <template v-if="status === 'loading'">
      <el-icon class="state-icon is-loading"><Loading /></el-icon>
      <span class="state-text">正在加载{{ label }}…</span>
    </template>

    <template v-else-if="status === 'error'">
      <el-icon class="state-icon error"><CircleCloseFilled /></el-icon>
      <div class="state-body">
        <div class="state-title">{{ label }}暂不可用</div>
        <div class="state-text">{{ errorMessage || '数据接口请求失败' }}</div>
      </div>
      <el-button size="small" type="primary" plain @click="$emit('retry')">重试</el-button>
    </template>

    <template v-else-if="status === 'empty'">
      <el-icon class="state-icon muted"><Files /></el-icon>
      <div class="state-body">
        <div class="state-title">当前时间范围 / 筛选条件下暂无{{ label }}数据</div>
        <div class="state-text">可尝试扩大时间范围或清除筛选条件</div>
      </div>
    </template>

    <template v-else>
      <slot />
      <div v-if="degraded" class="degraded-tip">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ label }}实时接口不可用，当前为本地缓存/模拟数据（{{ errorMessage || '请求失败' }}），统计口径与实时数据一致</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SectionStatus } from '@/types/briefing'

defineProps<{
  status: SectionStatus
  label: string
  errorMessage?: string
  degraded?: boolean
}>()

defineEmits<{ (e: 'retry'): void }>()
</script>

<style scoped lang="scss">
.section-state {
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;

  .state-icon {
    font-size: 26px;
    color: #94a3b8;

    &.is-loading {
      animation: rotate 1.4s linear infinite;
      color: #3b82f6;
    }

    &.error {
      color: #ef4444;
    }

    &.muted {
      color: #cbd5e1;
    }
  }

  .state-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .state-title {
    font-size: 14px;
    color: #475569;
  }

  .state-text {
    font-size: 12px;
    color: #94a3b8;
  }

  &:not(.loading):not(.error):not(.empty) {
    flex-direction: column;
    align-items: stretch;
    padding: 0;
    min-height: 0;
  }
}

.degraded-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 10px;
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 4px;
  line-height: 1.5;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<template>
  <el-card class="chart-panel" shadow="never">
    <template #header>
      <div class="panel-header">
        <span class="panel-title">
          {{ title }}
          <el-tooltip v-if="status === 'success'" content="数据正常" placement="top">
            <el-icon class="state-dot ok"><CircleCheckFilled /></el-icon>
          </el-tooltip>
          <el-tooltip v-else-if="status === 'empty'" :content="message || '暂无数据'" placement="top">
            <el-icon class="state-dot empty"><RemoveFilled /></el-icon>
          </el-tooltip>
          <el-tooltip v-else :content="message || '接口失败'" placement="top">
            <el-icon class="state-dot err"><CircleCloseFilled /></el-icon>
          </el-tooltip>
        </span>
        <div class="panel-extra">
          <slot name="extra" />
          <el-button
            v-if="status === 'error'"
            link
            type="primary"
            :loading="loading"
            @click="$emit('retry')"
          >
            重试
          </el-button>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="panel-body">
      <div v-if="status === 'success' && !renderError" ref="el" class="chart-el"></div>

      <div v-else-if="status === 'success' && renderError" class="placeholder">
        <el-icon :size="30"><WarningFilled /></el-icon>
        <p>图表渲染不可用，原始数据不受影响</p>
        <el-button size="small" @click="$emit('retry')">重新渲染</el-button>
      </div>

      <div v-else-if="status === 'empty'" class="placeholder muted">
        <el-icon :size="30"><PieChart /></el-icon>
        <p>{{ message || '当前条件下暂无数据' }}</p>
      </div>

      <div v-else-if="status === 'error'" class="placeholder danger">
        <el-icon :size="30"><CircleCloseFilled /></el-icon>
        <p>{{ message || '数据接口请求失败' }}</p>
        <p class="sub">该区块不影响其他区块与简报摘要</p>
        <el-button size="small" type="primary" plain @click="$emit('retry')">重新加载</el-button>
      </div>

      <div v-else class="placeholder muted">
        <el-icon :size="30" class="is-loading"><Loading /></el-icon>
        <p>加载中…</p>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useEChart } from '@/composables/useEChart'
import type { SectionStatus } from '@/api/operations'
import type { ECOption } from '@/utils/charts'

const props = defineProps<{
  title: string
  status: SectionStatus
  loading: boolean
  message?: string
  option: ECOption | null
  height?: string
}>()

defineEmits<{ (e: 'retry'): void }>()

const el = ref<HTMLElement>()
const optionRef = ref<ECOption | null>(props.option)
watch(
  () => props.option,
  v => (optionRef.value = v)
)
const { renderError } = useEChart(el, optionRef)
</script>

<style scoped lang="scss">
.chart-panel {
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #1e293b;
}

.panel-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 400;
}

.state-dot {
  margin-left: 6px;
  font-size: 14px;
  vertical-align: -2px;

  &.ok { color: #22c55e; }
  &.empty { color: #94a3b8; }
  &.err { color: #ef4444; }
}

.panel-body {
  min-height: v-bind('height || "300px"');
}

.chart-el {
  width: 100%;
  height: v-bind('height || "300px"');
}

.placeholder {
  height: v-bind('height || "300px"');
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #f59e0b;

  p { margin: 0; font-size: 13px; }
  .sub { color: #94a3b8; font-size: 12px; }

  &.muted { color: #94a3b8; }
  &.danger { color: #ef4444; }

  .is-loading {
    animation: rotating 1.4s linear infinite;
  }
}

@keyframes rotating {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}
</style>

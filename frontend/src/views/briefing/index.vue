<template>
  <div class="briefing-container">
    <!-- 筛选与视图管理 -->
    <el-card v-if="isDev" class="mb-20 dev-card">
      <div class="dev-bar">
        <span class="dev-title">开发调试：模拟分区接口失败（验证独立降级与缺失标注）</span>
        <el-checkbox-group v-model="failToggles" size="small" @change="applyFailures">
          <el-checkbox value="overview">关键指标失败</el-checkbox>
          <el-checkbox value="alarm">告警变化失败</el-checkbox>
          <el-checkbox value="production">产量趋势失败</el-checkbox>
          <el-checkbox value="abnormal">异常井失败</el-checkbox>
        </el-checkbox-group>
      </div>
    </el-card>

    <el-card class="mb-20 filter-card">
      <el-form :model="filter" inline class="filter-form">
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :disabled-date="disableFuture"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-radio-group v-model="presetDays" size="small" @change="applyPreset">
            <el-radio-button :value="7">近7天</el-radio-button>
            <el-radio-button :value="30">近30天</el-radio-button>
            <el-radio-button :value="90">近90天</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="区块">
          <el-select v-model="filter.block" placeholder="全部区块" clearable style="width: 130px">
            <el-option v-for="b in blockOptions" :key="b" :label="b" :value="b" />
          </el-select>
        </el-form-item>
        <el-form-item label="井型">
          <el-select v-model="filter.wellType" placeholder="全部井型" clearable style="width: 120px">
            <el-option v-for="t in wellTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="告警级别">
          <el-select v-model="filter.alarmLevel" placeholder="全部级别" clearable style="width: 120px">
            <el-option v-for="l in alarmLevelOptions" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleQuery">
            <el-icon><Search /></el-icon>生成简报
          </el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" plain @click="saveDialogVisible = true">
            <el-icon><Star /></el-icon>保存视图
          </el-button>
          <el-button type="warning" plain @click="copyNarrative">
            <el-icon><CopyDocument /></el-icon>复制简报
          </el-button>
        </el-form-item>
      </el-form>

      <div class="saved-views">
        <span class="saved-label">已保存视图：</span>
        <el-tag
          v-for="view in briefingStore.savedViews"
          :key="view.id"
          class="view-tag"
          :type="activeViewId === view.id ? 'primary' : 'info'"
          effect="light"
        >
          <span class="view-name" @click="applySavedView(view.id)">{{ view.name }}</span>
          <el-icon class="view-del" title="删除" @click.stop="removeView(view.id)"><Close /></el-icon>
        </el-tag>
        <span v-if="briefingStore.savedViews.length === 0" class="saved-hint">
          暂无，设置筛选后点击「保存视图」，下次进入可一键恢复
        </span>
      </div>
    </el-card>

    <!-- 可分享运营简报摘要 -->
    <el-card class="mb-20 narrative-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Document /></el-icon>
            <span>运营简报概览</span>
            <el-tag size="small" type="info" effect="plain">{{ filter.startDate }} ~ {{ filter.endDate }}</el-tag>
          </div>
          <div>
            <el-button size="small" @click="copyNarrative"><el-icon><CopyDocument /></el-icon>复制文本</el-button>
            <el-button size="small" @click="downloadNarrative"><el-icon><Download /></el-icon>下载 .txt</el-button>
          </div>
        </div>
      </template>
      <div class="narrative-text">
        <p v-for="(p, i) in narrative.paragraphs" :key="i">{{ p }}</p>
      </div>
      <el-alert
        v-if="narrative.missing.length > 0"
        class="missing-alert"
        type="warning"
        :closable="false"
        show-icon
        :title="`以下数据缺失：${narrative.missing.join('、')}。已在摘要中标注，接口恢复后重新生成即可补全。`"
      />
    </el-card>

    <!-- 关键指标 KPI -->
    <SectionState :status="overview.status" label="关键指标" :degraded="overview.degraded" :error-message="overview.errorMessage" @retry="retry('overview')">
      <el-row :gutter="20" class="kpi-row">
        <el-col :xs="12" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon well"><el-icon><Position /></el-icon></div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.data?.wellCount ?? '--' }}</div>
              <div class="stat-label">总井数</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon drilling"><el-icon><Monitor /></el-icon></div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.data?.drillingCount ?? '--' }}</div>
              <div class="stat-label">钻井中</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon production"><el-icon><TrendCharts /></el-icon></div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.data?.productionCount ?? '--' }}</div>
              <div class="stat-label">生产中</div>
            </div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="stat-card">
            <div class="stat-icon alarm"><el-icon><Warning /></el-icon></div>
            <div class="stat-content">
              <div class="stat-value">{{ overview.data?.alarmCount ?? '--' }}</div>
              <div class="stat-label">未处理告警</div>
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row v-if="overview.data" :gutter="20" class="kpi-sub">
        <el-col :xs="12" :sm="12" :md="6"><div class="sub-item">待修井 <b class="warning">{{ overview.data.maintenanceCount }}</b></div></el-col>
        <el-col :xs="12" :sm="12" :md="6"><div class="sub-item">关停井 <b class="danger">{{ overview.data.shutdownCount }}</b></div></el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="sub-item">本周期产油 <b>{{ production.data?.totalOil ?? '--' }}</b> 吨</div>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <div class="sub-item">异常井 <b class="danger">{{ abnormal.data?.length ?? '--' }}</b> 口</div>
        </el-col>
      </el-row>
    </SectionState>

    <!-- 图表区：产量趋势 + 井状态分布 -->
    <el-row :gutter="20" class="mb-20 chart-row">
      <el-col :xs="24" :md="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>产量趋势（与驾驶舱口径一致）</span>
              <span v-if="production.data" class="header-extra">
                日均油 {{ production.data.avgDailyOil }}t / 日均水 {{ production.data.avgDailyWater }}t
              </span>
            </div>
          </template>
          <SectionState :status="production.status" label="产量趋势" :degraded="production.degraded" :error-message="production.errorMessage" @retry="retry('production')">
            <div ref="productionChartEl" class="chart-container"></div>
          </SectionState>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header"><span>井状态分布</span></div>
          </template>
          <SectionState :status="overview.status" label="井状态分布" @retry="retry('overview')">
            <div ref="wellStatusChartEl" class="chart-container"></div>
          </SectionState>
        </el-card>
      </el-col>
    </el-row>

    <!-- 告警变化 -->
    <el-card class="mb-20">
      <template #header>
        <div class="card-header">
          <span>告警变化</span>
          <span v-if="alarm.data" class="header-extra">
            环比上期：总量 <DeltaTag :delta="alarm.data.totalDelta" />，未处理 <DeltaTag :delta="alarm.data.unresolvedDelta" />
          </span>
        </div>
      </template>
      <SectionState :status="alarm.status" label="告警变化" :degraded="alarm.degraded" :error-message="alarm.errorMessage" @retry="retry('alarm')">
        <el-row :gutter="20" v-if="alarm.data" class="alarm-body">
          <el-col :xs="24" :md="7">
            <div ref="alarmLevelChartEl" class="chart-container alarm-pie"></div>
          </el-col>
          <el-col :xs="24" :md="17">
            <el-row :gutter="12" class="alarm-stat-row">
              <el-col :span="8"><div class="alarm-stat"><div class="num">{{ alarm.data.totalInRange }}</div><div class="lbl">本周期告警</div></div></el-col>
              <el-col :span="8"><div class="alarm-stat"><div class="num warning">{{ alarm.data.unresolvedInRange }}</div><div class="lbl">未处理</div></div></el-col>
              <el-col :span="8"><div class="alarm-stat"><div class="num success">{{ alarm.data.resolvedInRange }}</div><div class="lbl">已闭环</div></div></el-col>
            </el-row>
            <el-table :data="alarm.data.alarms.slice(0, 8)" size="small" style="width: 100%">
              <el-table-column prop="time" label="时间" width="140" />
              <el-table-column prop="wellName" label="井名" width="90" />
              <el-table-column prop="alarmType" label="告警类型" width="110" />
              <el-table-column label="级别" width="80">
                <template #default="{ row }">
                  <el-tag :type="getAlarmType(row.level)" size="small">{{ row.level }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.status === '未处理' ? 'danger' : 'success'" size="small" effect="plain">
                    {{ row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="blockName" label="区块" />
            </el-table>
            <div v-if="alarm.data.alarms.length === 0" class="table-empty">该时间范围内无告警记录</div>
          </el-col>
        </el-row>
      </SectionState>
    </el-card>

    <!-- 异常井 -->
    <el-card class="mb-20">
      <template #header>
        <div class="card-header">
          <span>异常井清单</span>
          <span v-if="abnormal.data" class="header-extra">共 {{ abnormal.data.length }} 口</span>
        </div>
      </template>
      <SectionState :status="abnormal.status" label="异常井" :degraded="abnormal.degraded" :error-message="abnormal.errorMessage" @retry="retry('abnormal')">
        <el-table v-if="abnormal.data" :data="abnormal.data" size="small" style="width: 100%">
          <el-table-column prop="wellName" label="井名" width="100" />
          <el-table-column prop="blockName" label="区块" width="110" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="异常原因" min-width="200">
            <template #default="{ row }">
              <el-tag
                v-for="r in row.reasons.filter((x: string) => x !== row.status)"
                :key="r"
                size="small"
                :type="r === '严重告警未处理' ? 'danger' : r === '关停井' ? 'danger' : 'warning'"
                effect="plain"
                class="reason-tag"
              >
                {{ r }}
              </el-tag>
              <span v-if="row.reasons.every((x: string) => x === row.status)" class="muted">状态异常</span>
            </template>
          </el-table-column>
          <el-table-column label="本期产油(t)" width="110">
            <template #default="{ row }">{{ row.currentOil ?? '--' }}</template>
          </el-table-column>
          <el-table-column label="上期产油(t)" width="110">
            <template #default="{ row }">{{ row.previousOil ?? '--' }}</template>
          </el-table-column>
          <el-table-column label="环比" width="100">
            <template #default="{ row }">
              <span v-if="row.changeRate === null" class="muted">--</span>
              <span :class="row.changeRate <= -0.3 ? 'danger' : row.changeRate < 0 ? 'warning' : 'success'">
                {{ (row.changeRate * 100).toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
        </el-table>
      </SectionState>
    </el-card>

    <!-- 保存视图弹窗 -->
    <el-dialog v-model="saveDialogVisible" title="保存当前筛选视图" width="420px">
      <el-form @submit.prevent>
        <el-form-item label="视图名称">
          <el-input v-model="saveName" placeholder="如：胜利-近30天-严重告警" maxlength="30" show-word-limit @keyup.enter="confirmSave" />
        </el-form-item>
        <div class="save-preview">
          {{ filter.startDate }} ~ {{ filter.endDate }}
          <template v-if="filter.block"> · {{ filter.block }}</template>
          <template v-if="filter.wellType"> · {{ filter.wellType }}</template>
          <template v-if="filter.alarmLevel"> · {{ filter.alarmLevel }}</template>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { EChartsOption } from 'echarts'
import SectionState from '@/components/SectionState.vue'
import { useBriefingData } from '@/composables/useBriefingData'
import { useChart } from '@/composables/useChart'
import { useBriefingStore, type SavedView } from '@/store/modules/briefing'
import type { BriefingFilter } from '@/types/briefing'
import type { BriefingSection } from '@/api/briefing'
import { addDays, formatDate, parseDate } from '@/utils/date'
import { MOCK_TODAY } from '@/mock/briefing'
import {
  buildAlarmLevelOption,
  buildProductionTrendOption,
  buildWellStatusOption
} from '@/utils/chartOptions'
import { buildBriefingNarrative } from '@/utils/briefingNarrative'
import { forcedFailures } from '@/services/briefingService'

// 仅开发环境展示故障模拟条；生产构建中该常量被静态替换为 false，整段卡片会被剔除
const isDev = import.meta.env.DEV
const failToggles = ref<BriefingSection[]>([])
function applyFailures(val: BriefingSection[]) {
  forcedFailures.clear()
  val.forEach((s) => forcedFailures.add(s))
  load(filter)
}

/** 环比数字标签：告警增多（delta>0）标红，减少标绿 */
const DeltaTag = defineComponent({
  props: { delta: { type: Number, required: true } },
  setup(props) {
    return () => {
      const color = props.delta > 0 ? '#ef4444' : props.delta < 0 ? '#22c55e' : '#64748b'
      const text = props.delta > 0 ? `+${props.delta}` : `${props.delta}`
      return h('span', { style: { fontWeight: '600', margin: '0 2px', color } }, text)
    }
  }
})

const briefingStore = useBriefingStore()

const blockOptions = ['胜利油田', '大庆油田', '辽河油田', '长庆油田']
const wellTypeOptions = ['探井', '开发井', '评价井']
const alarmLevelOptions = ['严重', '警告', '提示']

// 重新进入：从 store（localStorage）恢复最近视图
const filter = reactive<BriefingFilter>({ ...briefingStore.lastFilter })
const dateRange = ref<[string, string]>([filter.startDate, filter.endDate])
const presetDays = ref<number | ''>('')
const activeViewId = ref('')
// 程序内批量修改维度筛选时，抑制 watcher 的自动查询，避免重复请求
let suppressWatch = false

const { loading, overview, alarm, production, abnormal, load, retry } = useBriefingData()

// ---- 图表 ----
const productionChartEl = ref<HTMLElement>()
const wellStatusChartEl = ref<HTMLElement>()
const alarmLevelChartEl = ref<HTMLElement>()

const productionOption = computed<EChartsOption | null>(() =>
  production.data ? buildProductionTrendOption(production.data.series) : null
)
const wellStatusOption = computed<EChartsOption | null>(() =>
  overview.data ? buildWellStatusOption(overview.data.statusDistribution) : null
)
const alarmLevelOption = computed<EChartsOption | null>(() =>
  alarm.data
    ? buildAlarmLevelOption({
        severeCount: alarm.data.severeCount,
        warningCount: alarm.data.warningCount,
        infoCount: alarm.data.infoCount
      })
    : null
)

useChart(productionChartEl, productionOption, computed(() => production.status === 'success'))
useChart(wellStatusChartEl, wellStatusOption, computed(() => overview.status === 'success'))
useChart(alarmLevelChartEl, alarmLevelOption, computed(() => alarm.status === 'success'))

// ---- 摘要文本（缺失分区传 null，自动标注缺失）----
const narrative = computed(() =>
  buildBriefingNarrative({
    startDate: filter.startDate,
    endDate: filter.endDate,
    block: filter.block,
    wellType: filter.wellType,
    alarmLevel: filter.alarmLevel,
    overview: overview.status === 'success' ? overview.data : null,
    alarm: alarm.status === 'success' ? alarm.data : null,
    production: production.status === 'success' ? production.data : null,
    abnormalWells: abnormal.status === 'success' ? abnormal.data : null
  })
)

// ---- 交互 ----
const disableFuture = (d: Date) => d.getTime() > parseDate(MOCK_TODAY).getTime() + 86399999

function handleDateChange(val: [string, string] | null) {
  if (val && val[0] && val[1]) {
    filter.startDate = val[0]
    filter.endDate = val[1]
    presetDays.value = ''
    activeViewId.value = ''
    handleQuery()
  }
}

function applyPreset(days: number | '' | undefined) {
  if (!days) return
  const end = MOCK_TODAY
  filter.endDate = end
  filter.startDate = formatDate(addDays(parseDate(end), -(days - 1)))
  dateRange.value = [filter.startDate, filter.endDate]
  activeViewId.value = ''
  handleQuery()
}

function handleQuery() {
  if (filter.startDate > filter.endDate) {
    ElMessage.warning('开始日期不能晚于结束日期')
    return
  }
  activeViewId.value = ''
  briefingStore.saveLastFilter(filter)
  load(filter)
}

function handleReset() {
  const def = briefingStore.resetFilter()
  suppressWatch = true
  Object.assign(filter, def)
  dateRange.value = [def.startDate, def.endDate]
  presetDays.value = 7
  activeViewId.value = ''
  handleQuery()
}

function applySavedView(id: string) {
  const restored = briefingStore.applyView(id)
  if (!restored) return
  // 恢复视图时维度字段可能同时变化，抑制 watcher 避免与显式 load 重复请求
  suppressWatch = true
  Object.assign(filter, restored)
  dateRange.value = [restored.startDate, restored.endDate]
  presetDays.value = ''
  activeViewId.value = id
  ElMessage.success('已应用保存的视图')
  load(filter)
}

async function removeView(id: string) {
  const view: SavedView | undefined = briefingStore.savedViews.find((v) => v.id === id)
  try {
    await ElMessageBox.confirm(`确定删除视图「${view?.name || ''}」吗？`, '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    briefingStore.deleteView(id)
    if (activeViewId.value === id) activeViewId.value = ''
    ElMessage.success('视图已删除')
  } catch {
    /* 取消删除 */
  }
}

const saveDialogVisible = ref(false)
const saveName = ref('')

function confirmSave() {
  const name = saveName.value.trim()
  if (!name) {
    ElMessage.warning('请输入视图名称')
    return
  }
  const view = briefingStore.saveView(name, filter)
  activeViewId.value = view.id
  saveDialogVisible.value = false
  saveName.value = ''
  ElMessage.success('视图已保存，下次进入可直接恢复')
}

async function copyNarrative() {
  const text = narrative.value.paragraphs.join('\n\n')
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success('简报文本已复制，可直接粘贴分享')
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}

function downloadNarrative() {
  const text = narrative.value.paragraphs.join('\n\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `运营简报_${filter.startDate}_${filter.endDate}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const getAlarmType = (level: string) =>
  ({ 严重: 'danger', 警告: 'warning', 提示: 'info' } as Record<string, 'danger' | 'warning' | 'info'>)[
    level
  ] || 'info'

const getStatusType = (status: string) =>
  ({ 生产中: 'success', 钻井中: 'primary', 待修井: 'warning', 关停井: 'danger' } as Record<string, 'success' | 'primary' | 'warning' | 'danger'>)[
    status
  ] || 'info'

// 首次进入：恢复最近视图并加载
presetDays.value = 7
load(filter)

// 维度筛选（区块 / 井型 / 告警级别）变化后自动重新生成，日期走显式按钮 / 预设
watch(
  () => [filter.block, filter.wellType, filter.alarmLevel],
  () => {
    if (suppressWatch) {
      suppressWatch = false
      return
    }
    handleQuery()
  }
)
</script>

<style scoped lang="scss">
.briefing-container {
  width: 100%;
}

.dev-card {
  border: 1px dashed #f59e0b;
  background: #fffbeb;
}

.dev-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;

  .dev-title {
    font-size: 13px;
    color: #b45309;
    font-weight: 600;
  }
}

.filter-card {
  :deep(.el-card__body) {
    padding-bottom: 12px;
  }
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;

  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.saved-views {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed #e2e8f0;

  .saved-label {
    font-size: 13px;
    color: #64748b;
  }

  .saved-hint {
    font-size: 12px;
    color: #94a3b8;
  }

  .view-tag {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;

    .view-name {
      font-size: 12px;
    }

    .view-del {
      font-size: 12px;
      border-radius: 50%;

      &:hover {
        background: rgba(0, 0, 0, 0.1);
      }
    }
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #1e293b;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-extra {
    font-size: 12px;
    font-weight: 400;
    color: #64748b;
  }
}

.narrative-card {
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 60%);

  .narrative-text {
    font-size: 14px;
    line-height: 1.9;
    color: #334155;

    p {
      margin-bottom: 8px;
    }

    p:first-child {
      font-weight: 600;
      color: #0f172a;
    }
  }
}

.missing-alert {
  margin-top: 10px;
}

.stat-card {
  background: #fff;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  flex-shrink: 0;

  &.well { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  &.drilling { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
  &.production { background: linear-gradient(135deg, #22c55e, #16a34a); }
  &.alarm { background: linear-gradient(135deg, #ef4444, #dc2626); }
}

.stat-content {
  .stat-value {
    font-size: 26px;
    font-weight: 600;
    color: #1e293b;
    line-height: 1;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 13px;
    color: #64748b;
  }
}

.kpi-row {
  margin-bottom: 4px;

  .el-col {
    margin-bottom: 16px;
  }
}

.kpi-sub {
  .sub-item {
    font-size: 13px;
    color: #64748b;
    padding: 8px 4px;

    b {
      color: #1e293b;
      font-size: 15px;

      &.danger { color: #ef4444; }
      &.warning { color: #f59e0b; }
    }
  }
}

.chart-row {
  margin: 0 !important;
}

.chart-card {
  height: 100%;
  margin-bottom: 20px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.alarm-pie {
  height: 260px;
}

.alarm-body {
  margin: 0 !important;
}

.alarm-stat-row {
  margin-bottom: 12px;

  .alarm-stat {
    text-align: center;
    background: #f8fafc;
    border-radius: 8px;
    padding: 14px 0;

    .num {
      font-size: 26px;
      font-weight: 700;
      color: #1e293b;

      &.warning { color: #f59e0b; }
      &.success { color: #22c55e; }
    }

    .lbl {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
  }
}

.reason-tag {
  margin-right: 6px;
  margin-bottom: 2px;
}

.table-empty {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 20px 0;
}

.danger { color: #ef4444; font-weight: 600; }
.warning { color: #f59e0b; font-weight: 600; }
.success { color: #22c55e; font-weight: 600; }
.muted { color: #94a3b8; }

.save-preview {
  font-size: 13px;
  color: #64748b;
  padding-left: 80px;
}
</style>

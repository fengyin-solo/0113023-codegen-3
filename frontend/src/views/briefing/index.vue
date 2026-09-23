<template>
  <div class="briefing-container">
    <!-- 筛选栏 -->
    <el-card class="mb-20 filter-card" shadow="never">
      <div class="filter-bar">
        <div class="filter-left">
          <el-radio-group v-model="filters.rangeType" size="default" @change="onRangePreset">
            <el-radio-button label="7d">近7天</el-radio-button>
            <el-radio-button label="30d">近30天</el-radio-button>
            <el-radio-button label="90d">近90天</el-radio-button>
            <el-radio-button label="180d">近6个月</el-radio-button>
            <el-radio-button label="custom">自定义</el-radio-button>
          </el-radio-group>
          <el-date-picker
            v-if="filters.rangeType === 'custom'"
            v-model="customRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :clearable="false"
            @change="applyFilters"
          />
          <el-select v-model="filters.block" placeholder="全部区块" clearable style="width: 130px" @change="applyFilters">
            <el-option v-for="b in BLOCKS" :key="b" :label="`${b} 区块`" :value="b" />
          </el-select>
          <el-select
            v-model="filters.alarmLevels"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="告警级别（全部）"
            style="width: 190px"
            @change="applyFilters"
          >
            <el-option v-for="l in ALARM_LEVELS" :key="l" :label="l" :value="l" />
          </el-select>
          <el-select
            v-model="filters.wellStatuses"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="异常井状态（全部）"
            style="width: 200px"
            @change="applyFilters"
          >
            <el-option v-for="s in WELL_STATUSES" :key="s" :label="s" :value="s" />
          </el-select>
        </div>

        <div class="filter-right">
          <el-tooltip content="模拟数据源场景，验证无数据/接口失败时的降级呈现（不会被保存）" placement="top">
            <el-select v-model="scenario" style="width: 140px" @change="loadAll">
              <template #prefix><el-icon><MagicStick /></el-icon></template>
              <el-option label="数据源：正常" value="normal" />
              <el-option label="数据源：无数据" value="empty" />
              <el-option label="数据源：全失败" value="error" />
              <el-option label="部分区块失败" value="partial" />
            </el-select>
          </el-tooltip>

          <el-dropdown @command="onViewCommand" trigger="click">
            <el-button>
              我的视图<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              <el-badge v-if="savedViews.length" :value="savedViews.length" :max="20" class="view-badge" />
            </el-button>
            <template #dropdown>
              <el-dropdown-menu class="view-menu">
                <el-dropdown-item v-if="!savedViews.length" disabled>暂无保存的视图</el-dropdown-item>
                <el-dropdown-item v-for="v in savedViews" :key="v.id" class="view-item">
                  <div class="view-row" @click="applyView(v)">
                    <el-icon><CollectionTag /></el-icon>
                    <span class="view-name" :title="v.name">{{ v.name }}</span>
                    <span class="view-time">{{ v.savedAt }}</span>
                    <el-icon class="view-del" title="删除" @click.stop="deleteView(v.id)"><Delete /></el-icon>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <el-button type="primary" @click="openSaveDialog">
            <el-icon><Star /></el-icon>保存当前视图
          </el-button>
          <el-button @click="loadAll">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- 运营简报概览（可分享文字摘要） -->
    <el-card class="mb-20 narrative-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="title-group">
            <el-icon class="title-icon"><Notebook /></el-icon>
            <div>
              <div class="title">运营简报概览</div>
              <div class="subtitle">
                统计区间 {{ rangeText }} · {{ range.label }} · 生成于 {{ narrative?.generatedAt || '—' }}
              </div>
            </div>
          </div>
          <div>
            <el-button size="small" @click="copyBriefing">
              <el-icon><CopyDocument /></el-icon>复制简报
            </el-button>
            <el-button size="small" @click="downloadBriefing">
              <el-icon><Download /></el-icon>下载 TXT
            </el-button>
          </div>
        </div>
      </template>

      <div v-loading="anyLoading && !narrative" class="narrative-body">
        <h3 class="narrative-title">{{ narrative?.title }}</h3>
        <p
          v-for="(p, i) in narrative?.paragraphs"
          :key="i"
          class="narrative-p"
          :class="{ 'is-degraded': p.degraded }"
        >
          {{ p.text }}
        </p>

        <el-alert
          v-if="failedMissing.length"
          class="missing-alert"
          type="error"
          :closable="false"
          show-icon
          title="部分数据接口失败，对应段落与看板区块已标注缺失："
        >
          <div v-for="m in failedMissing" :key="m.key" class="missing-line">
            · {{ m.label }}：{{ m.message }}
          </div>
        </el-alert>
        <el-alert
          v-if="emptyMissing.length"
          class="missing-alert"
          type="info"
          :closable="false"
          show-icon
          title="以下区块在所选条件下无数据（非异常）："
        >
          <div v-for="m in emptyMissing" :key="m.key" class="missing-line">
            · {{ m.label }}：{{ m.message }}
          </div>
        </el-alert>
        <el-alert
          v-if="!missing.length && !anyLoading"
          class="missing-alert"
          type="success"
          :closable="false"
          show-icon
          title="全部数据源加载成功，统计口径与综合驾驶舱一致。"
        />
      </div>
    </el-card>

    <!-- 关键指标 -->
    <el-row :gutter="16" class="mb-20">
      <el-col :xs="12" :sm="8" :md="6" :lg="6">
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">总井数</span><el-icon class="kpi-icon well"><Position /></el-icon></div>
          <div class="kpi-value">{{ overview?.data?.total ?? '—' }}</div>
          <div class="kpi-foot">
            <span v-if="overview?.status === 'success'">实时在管井数</span>
            <span v-else-if="overview?.status === 'error'" class="kpi-missing">数据缺失（接口失败）</span>
            <span v-else-if="overview?.status === 'empty'" class="kpi-missing">无数据</span>
            <span v-else>加载中…</span>
          </div>
        </div>
      </el-col>
      <el-col v-for="b in overview?.data?.breakdown || []" :key="b.name" :xs="12" :sm="8" :md="6" :lg="6">
        <div class="kpi-card">
          <div class="kpi-top">
            <span class="kpi-label">{{ b.name }}</span>
            <span class="kpi-dot" :style="{ background: STATUS_COLORS[b.name] }"></span>
          </div>
          <div class="kpi-value">{{ b.value }}</div>
          <div class="kpi-foot muted">占比 {{ overview?.data ? pct(b.value, overview.data.total) : '—' }}</div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="6">
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">区间新增告警</span><el-icon class="kpi-icon alarm"><Warning /></el-icon></div>
          <div class="kpi-value">{{ alarms?.status === 'success' && alarms.data ? alarms.data.currentCount : '—' }}</div>
          <div class="kpi-foot">
            <span v-if="alarms?.status === 'success' && alarms.data">环比 {{ deltaText(alarms.data.deltaPct) }}</span>
            <span v-else-if="alarms?.status === 'error'" class="kpi-missing">告警数据缺失</span>
            <span v-else-if="alarms?.status === 'empty'" class="kpi-missing">区间无告警</span>
            <span v-else>加载中…</span>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="6">
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">未处置告警</span><el-icon class="kpi-icon warn"><BellFilled /></el-icon></div>
          <div class="kpi-value">{{ alarms?.status === 'success' && alarms.data ? alarms.data.unresolved.length : '—' }}</div>
          <div class="kpi-foot">
            <span v-if="alarms?.status === 'success'" class="danger-text">需尽快跟进</span>
            <span v-else class="kpi-missing">数据缺失</span>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="6">
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">平均日产油</span><el-icon class="kpi-icon oil"><TrendCharts /></el-icon></div>
          <div class="kpi-value">{{ production?.status === 'success' && production.data ? production.data.avgOil : '—' }}</div>
          <div class="kpi-foot">
            <span v-if="production?.status === 'success' && production.data">
              吨/日 · 环比 {{ deltaText(production.data.oilDeltaPct) }}
            </span>
            <span v-else-if="production?.status === 'error'" class="kpi-missing">产量数据缺失</span>
            <span v-else-if="production?.status === 'empty'" class="kpi-missing">无产量数据</span>
            <span v-else>加载中…</span>
          </div>
        </div>
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="6">
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">异常井</span><el-icon class="kpi-icon abnormal"><Tools /></el-icon></div>
          <div class="kpi-value">{{ abnormal?.status === 'success' && abnormal.data ? abnormal.data.total : '—' }}</div>
          <div class="kpi-foot">
            <span v-if="abnormal?.status === 'success'">口 · 按严重程度排序</span>
            <span v-else-if="abnormal?.status === 'error'" class="kpi-missing">分析数据缺失</span>
            <span v-else-if="abnormal?.status === 'empty'" class="kpi-missing">暂无异常井</span>
            <span v-else>加载中…</span>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表区 -->
    <el-row :gutter="16" class="mb-20">
      <el-col :xs="24" :lg="16">
        <chart-panel
          title="产量趋势（日产油 / 日产水，口径同驾驶舱）"
          :status="production?.status || 'empty'"
          :loading="loading.production"
          :message="production?.message"
          :option="productionOption"
          height="300px"
          @retry="loadSection('production')"
        />
      </el-col>
      <el-col :xs="24" :lg="8">
        <chart-panel
          title="井状态分布（实时）"
          :status="overview?.status || 'empty'"
          :loading="loading.overview"
          :message="overview?.message"
          :option="statusOption"
          height="300px"
          @retry="loadSection('overview')"
        />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-20">
      <el-col :xs="24" :lg="14">
        <chart-panel
          title="告警变化（新增 / 已处置）"
          :status="alarms?.status || 'empty'"
          :loading="loading.alarms"
          :message="alarms?.message"
          :option="alarmOption"
          height="280px"
          @retry="loadSection('alarms')"
        />
      </el-col>
      <el-col :xs="24" :lg="10">
        <chart-panel
          title="异常井级别分布"
          :status="abnormalPanelStatus"
          :loading="loading.abnormal"
          message="所选条件下暂无异常井"
          :option="abnormalOption"
          height="280px"
          @retry="loadSection('abnormal')"
        />
      </el-col>
    </el-row>

    <!-- 明细：异常井 + 未处置告警 -->
    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card shadow="never" class="detail-card">
          <template #header>
            <div class="card-header">
              <span class="block-title">异常井清单（{{ abnormal?.data?.total ?? '—' }} 口）</span>
              <el-button v-if="abnormal?.status === 'error'" link type="primary" @click="loadSection('abnormal')">重试</el-button>
            </div>
          </template>
          <el-table
            :data="abnormal?.data?.items || []"
            v-loading="loading.abnormal"
            size="small"
            stripe
            max-height="360"
          >
            <template #empty>
              <el-empty
                :image-size="70"
                :description="
                  abnormal?.status === 'error'
                    ? '异常井数据接口失败，名单暂不可用'
                    : abnormal?.status === 'empty'
                    ? '所选条件下暂无异常井'
                    : '加载中…'
                "
              />
            </template>
            <el-table-column prop="wellName" label="井名" width="100" />
            <el-table-column prop="block" label="区块" width="70">
              <template #default="{ row }">{{ row.block }} 区块</template>
            </el-table-column>
            <el-table-column prop="status" label="井状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :color="statusColor(row.status)" style="color: #fff; border: none">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="level" label="风险级别" width="90">
              <template #default="{ row }">
                <el-tag :type="LEVEL_TAG_TYPE[row.level as AlarmLevel]" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="异常原因" min-width="220">
              <template #default="{ row }">
                <span v-for="(r, i) in row.reasons" :key="i">
                  <el-tag size="small" type="info" effect="plain" class="reason-tag">{{ r }}</el-tag>
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="10">
        <el-card shadow="never" class="detail-card">
          <template #header>
            <div class="card-header">
              <span class="block-title">未处置告警（{{ alarms?.data?.unresolved.length ?? '—' }} 起）</span>
              <el-button v-if="alarms?.status === 'error'" link type="primary" @click="loadSection('alarms')">重试</el-button>
            </div>
          </template>
          <el-table
            :data="alarms?.data?.unresolved || []"
            v-loading="loading.alarms"
            size="small"
            stripe
            max-height="360"
          >
            <template #empty>
              <el-empty
                :image-size="70"
                :description="
                  alarms?.status === 'error'
                    ? '告警接口失败，实时告警暂不可用'
                    : alarms?.status === 'empty'
                    ? '当前无告警记录'
                    : '加载中…'
                "
              />
            </template>
            <el-table-column prop="wellName" label="井名" width="90" />
            <el-table-column prop="alarmType" label="类型" width="100" />
            <el-table-column prop="level" label="级别" width="76">
              <template #default="{ row }">
                <el-tag :type="LEVEL_TAG_TYPE[row.level as AlarmLevel]" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="时间" min-width="140" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 保存视图对话框 -->
    <el-dialog v-model="saveDialogVisible" title="保存当前筛选视图" width="420px" append-to-body>
      <el-form @submit.prevent>
        <el-form-item label="视图名称">
          <el-input
            ref="viewNameInput"
            v-model="viewName"
            maxlength="20"
            show-word-limit
            placeholder="例如：A区块近30天严重告警"
            @keyup.enter="confirmSaveView"
          />
        </el-form-item>
        <el-form-item label="筛选内容">
          <span class="filters-preview">{{ filtersSummary }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveView">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ChartPanel from './ChartPanel.vue'
import {
  BLOCKS,
  ALARM_LEVELS,
  WELL_STATUSES,
  STATUS_COLORS,
  LEVEL_TAG_TYPE,
  USE_MOCK,
  fetchOverview,
  fetchProduction,
  fetchAlarms,
  fetchAbnormalWells,
  fetchOverviewRemote,
  fetchProductionRemote,
  fetchAlarmsRemote,
  fetchAbnormalRemote,
  resolveRange,
  buildNarrative,
  narrativeToText,
  type ReportFilters,
  type FailureScenario,
  type SectionData,
  type OverviewData,
  type ProductionData,
  type AlarmsData,
  type AbnormalData,
  type AlarmLevel
} from '@/api/operations'
import type { SavedView } from '@/composables/useBriefingViews'
import { useBriefingViews } from '@/composables/useBriefingViews'
import {
  productionTrendOption,
  wellStatusOption,
  alarmTrendOption,
  abnormalLevelOption,
  type ECOption
} from '@/utils/charts'

type SectionKey = 'overview' | 'production' | 'alarms' | 'abnormal'

const route = useRoute()
const router = useRouter()
const { savedViews, saveView, deleteView, rememberLast, loadLast } = useBriefingViews()

const defaultFilters = (): ReportFilters => ({
  rangeType: '7d',
  startDate: undefined,
  endDate: undefined,
  block: '',
  alarmLevels: [],
  wellStatuses: []
})

const filters = reactive<ReportFilters>(defaultFilters())
const customRange = ref<[string, string] | null>(null)
const scenario = ref<FailureScenario>('normal')

const loading = reactive<Record<SectionKey, boolean>>({
  overview: false,
  production: false,
  alarms: false,
  abnormal: false
})
const anyLoading = computed(() => Object.values(loading).some(Boolean))

const overview = ref<SectionData<OverviewData> | null>(null)
const production = ref<SectionData<ProductionData> | null>(null)
const alarms = ref<SectionData<AlarmsData> | null>(null)
const abnormal = ref<SectionData<AbnormalData> | null>(null)

const range = computed(() => resolveRange(filters))
const rangeText = computed(
  () =>
    `${range.value.start.getFullYear()}-${String(range.value.start.getMonth() + 1).padStart(2, '0')}-${String(
      range.value.start.getDate()
    ).padStart(2, '0')} 至 ${range.value.end.getFullYear()}-${String(range.value.end.getMonth() + 1).padStart(2, '0')}-${String(
      range.value.end.getDate()
    ).padStart(2, '0')}`
)

// 图表 option：仅在对应区块 success 时生成，保证图表与文字同源
const productionOption = computed<ECOption | null>(() =>
  production.value?.status === 'success' && production.value.data
    ? productionTrendOption(production.value.data.points)
    : null
)
const statusOption = computed<ECOption | null>(() =>
  overview.value?.status === 'success' && overview.value.data
    ? wellStatusOption(overview.value.data.breakdown)
    : null
)
const alarmOption = computed<ECOption | null>(() =>
  alarms.value?.status === 'success' && alarms.value.data
    ? alarmTrendOption(alarms.value.data.buckets)
    : null
)
const abnormalOption = computed<ECOption | null>(() =>
  abnormal.value?.status === 'success' && abnormal.value.data && abnormal.value.data.items.length
    ? abnormalLevelOption(abnormal.value.data.items)
    : null
)
// 成功但 0 口异常井时，饼图按"无数据"空状态呈现（而非空白图表）
const abnormalPanelStatus = computed<SectionData<unknown>['status']>(() => {
  if (!abnormal.value) return 'empty'
  if (abnormal.value.status === 'success' && !abnormal.value.data?.items.length) return 'empty'
  return abnormal.value.status
})

// 简报文字：各区块取最新状态，失败区块自动写成"暂缺"
const narrativeResult = computed(() =>
  overview.value && production.value && alarms.value && abnormal.value
    ? buildNarrative(filters, range.value, {
        overview: overview.value,
        production: production.value,
        alarms: alarms.value,
        abnormal: abnormal.value
      })
    : null
)
const narrative = computed(() => narrativeResult.value?.narrative || null)
const missing = computed(() => narrativeResult.value?.missing || [])
const failedMissing = computed(() => missing.value.filter(m => m.severity === 'error'))
const emptyMissing = computed(() => missing.value.filter(m => m.severity === 'empty'))

// ---------- 筛选 ----------

const applyFilters = () => {
  if (filters.rangeType === 'custom') {
    if (!customRange.value) return
    filters.startDate = customRange.value[0]
    filters.endDate = customRange.value[1]
  } else {
    filters.startDate = undefined
    filters.endDate = undefined
  }
  applyFiltersImmediate()
}

function applyFiltersImmediate() {
  rememberLast({ ...filters })
  syncUrl()
  loadAll()
}

// 切换到预设范围立即应用；切换到"自定义"则等待选择日期，避免沿用旧区间误刷新
const onRangePreset = () => {
  if (filters.rangeType !== 'custom') applyFilters()
}

// ---------- 数据加载（每区块独立失败） ----------

const loaders = {
  overview: (f: ReportFilters, s: FailureScenario) => (USE_MOCK ? fetchOverview(f, s) : fetchOverviewRemote(f)),
  production: (f: ReportFilters, s: FailureScenario) => (USE_MOCK ? fetchProduction(f, s) : fetchProductionRemote(f)),
  alarms: (f: ReportFilters, s: FailureScenario) => (USE_MOCK ? fetchAlarms(f, s) : fetchAlarmsRemote(f)),
  abnormal: (f: ReportFilters, s: FailureScenario) => (USE_MOCK ? fetchAbnormalWells(f, s) : fetchAbnormalRemote(f))
}

const refsMap = {
  overview,
  production,
  alarms,
  abnormal
} as const

async function loadSection(key: SectionKey) {
  loading[key] = true
  try {
    refsMap[key].value = await loaders[key]({ ...filters }, scenario.value)
  } catch (e) {
    refsMap[key].value = {
      status: 'error',
      data: null,
      message: (e as Error)?.message || '未知错误'
    }
  } finally {
    loading[key] = false
  }
}

function loadAll() {
  ;(Object.keys(loaders) as SectionKey[]).forEach(k => loadSection(k))
}

// ---------- URL 分享：筛选条件编码在 query 中 ----------

function syncUrl() {
  const q: Record<string, string> = { rangeType: filters.rangeType }
  if (filters.rangeType === 'custom' && filters.startDate && filters.endDate) {
    q.startDate = filters.startDate
    q.endDate = filters.endDate
  }
  if (filters.block) q.block = filters.block
  if (filters.alarmLevels.length) q.levels = filters.alarmLevels.join(',')
  if (filters.wellStatuses.length) q.statuses = filters.wellStatuses.join(',')
  router.replace({ path: route.path, query: q })
}

function initFromUrl(): boolean {
  const q = route.query
  if (!q.rangeType) return false
  const f = defaultFilters()
  if (['7d', '30d', '90d', '180d', 'custom'].includes(String(q.rangeType))) {
    f.rangeType = String(q.rangeType) as ReportFilters['rangeType']
  }
  if (q.startDate && q.endDate) {
    f.startDate = String(q.startDate)
    f.endDate = String(q.endDate)
    customRange.value = [f.startDate, f.endDate]
  }
  if (q.block && BLOCKS.includes(String(q.block))) f.block = String(q.block)
  if (typeof q.levels === 'string') {
    f.alarmLevels = q.levels.split(',').filter((l): l is AlarmLevel => (ALARM_LEVELS as string[]).includes(l))
  }
  if (typeof q.statuses === 'string') {
    f.wellStatuses = q.statuses
      .split(',')
      .filter((s): s is ReportFilters['wellStatuses'][number] => (WELL_STATUSES as string[]).includes(s))
  }
  Object.assign(filters, f)
  return true
}

// ---------- 保存视图 ----------

const saveDialogVisible = ref(false)
const viewName = ref('')
const viewNameInput = ref()

const filtersSummary = computed(() => {
  const parts = [range.value.label, filters.block ? `${filters.block} 区块` : '全部区块']
  parts.push(filters.alarmLevels.length ? `告警级别：${filters.alarmLevels.join('、')}` : '告警级别：全部')
  parts.push(filters.wellStatuses.length ? `异常井状态：${filters.wellStatuses.join('、')}` : '异常井状态：全部')
  return parts.join(' · ')
})

function openSaveDialog() {
  viewName.value = `${filters.block || '全部区块'}-${range.value.label}`
  saveDialogVisible.value = true
  nextTick(() => (viewNameInput.value as unknown as { focus: () => void })?.focus?.())
}

function confirmSaveView() {
  if (saveView(viewName.value, { ...filters })) {
    saveDialogVisible.value = false
  }
}

function applyView(v: SavedView) {
  Object.assign(filters, defaultFilters(), JSON.parse(JSON.stringify(v.filters)))
  if (filters.rangeType === 'custom' && filters.startDate && filters.endDate) {
    customRange.value = [filters.startDate, filters.endDate]
  } else {
    customRange.value = null
  }
  ElMessage.success(`已应用视图「${v.name}」`)
  applyFiltersImmediate()
}

function onViewCommand() {
  // 下拉通过菜单项内部点击处理，此处仅用于满足 dropdown 触发
}

// ---------- 分享：复制 / 下载 ----------

async function copyBriefing() {
  if (!narrative.value) return
  const text = narrativeToText(narrative.value, missing.value, range.value)
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('简报已复制到剪贴板，可直接粘贴分享')
  } catch {
    // 剪贴板权限不可用时降级为 textarea
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      ElMessage.success('简报已复制到剪贴板，可直接粘贴分享')
    } catch {
      ElMessage.error('复制失败，请使用「下载 TXT」')
    } finally {
      document.body.removeChild(ta)
    }
  }
}

function downloadBriefing() {
  if (!narrative.value) return
  const text = narrativeToText(narrative.value, missing.value, range.value)
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `运营简报_${range.value.start.toISOString().slice(0, 10)}_${range.value.end
    .toISOString()
    .slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- 工具 ----------

const pct = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : '—')

const statusColor = (s: string) => STATUS_COLORS[s as keyof typeof STATUS_COLORS] || '#94a3b8'

function deltaText(d: number | null): string {
  if (d == null) return '上期无基数'
  const cls = d >= 0 ? '+' : ''
  return `${cls}${d}%`
}

// ---------- 初始化：优先 URL（分享链接），其次恢复最近视图 ----------

onMounted(() => {
  const fromUrl = initFromUrl()
  if (!fromUrl) {
    const last = loadLast()
    if (last) {
      Object.assign(filters, defaultFilters(), last)
      if (filters.rangeType === 'custom' && filters.startDate && filters.endDate) {
        customRange.value = [filters.startDate, filters.endDate]
      }
    }
    syncUrl()
  }
  loadAll()
})
</script>

<style scoped lang="scss">
.briefing-container {
  width: 100%;
}

.filter-card {
  :deep(.el-card__body) {
    padding: 14px 18px;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-left,
.filter-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.view-badge {
  margin-left: 4px;
}

.view-menu {
  width: 320px;
}

.view-item {
  padding: 0 !important;
}

.view-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 4px;

  .view-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .view-time {
    font-size: 12px;
    color: #94a3b8;
  }

  .view-del {
    color: #cbd5e1;
    &:hover { color: #ef4444; }
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #1e293b;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 26px;
  color: #3b82f6;
}

.title {
  font-size: 16px;
}

.subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #94a3b8;
  margin-top: 2px;
}

.narrative-body {
  min-height: 120px;
}

.narrative-title {
  font-size: 15px;
  color: #1e293b;
  margin-bottom: 10px;
}

.narrative-p {
  font-size: 14px;
  line-height: 1.9;
  color: #334155;
  margin: 0;

  &.is-degraded {
    color: #b45309;
  }
}

.missing-alert {
  margin-top: 12px;
}

.missing-line {
  font-size: 13px;
  line-height: 1.8;
}

.kpi-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  margin-bottom: 16px;
  min-height: 118px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi-label {
  font-size: 13px;
  color: #64748b;
}

.kpi-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.kpi-icon {
  font-size: 18px;
  padding: 6px;
  border-radius: 8px;
  color: #fff;

  &.well { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  &.alarm { background: linear-gradient(135deg, #ef4444, #dc2626); }
  &.warn { background: linear-gradient(135deg, #f59e0b, #d97706); }
  &.oil { background: linear-gradient(135deg, #22c55e, #16a34a); }
  &.abnormal { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.kpi-foot {
  font-size: 12px;
  color: #475569;

  &.muted { color: #94a3b8; }
}

.kpi-missing {
  color: #b45309;
}

.danger-text {
  color: #ef4444;
}

.detail-card {
  margin-bottom: 4px;
}

.block-title {
  font-weight: 600;
  color: #1e293b;
}

.reason-tag {
  margin: 2px 4px 2px 0;
}

.filters-preview {
  font-size: 13px;
  color: #64748b;
}
</style>

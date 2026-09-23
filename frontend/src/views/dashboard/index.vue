<template>
  <div class="dashboard-container">
    <el-row :gutter="20" class="mb-20">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon well">
            <el-icon><Position /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">
              {{ overview.status === 'success' && overview.data ? overview.data.total : '—' }}
            </div>
            <div class="stat-label">总井数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon drilling">
            <el-icon><Monitor /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ statusValue('钻井中') }}</div>
            <div class="stat-label">钻井中</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon production">
            <el-icon><TrendCharts /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ statusValue('生产中') }}</div>
            <div class="stat-label">生产中</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon alarm">
            <el-icon><Warning /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">
              {{ alarms.status === 'success' && alarms.data ? alarms.data.unresolved.length : '—' }}
            </div>
            <div class="stat-label">告警数量（未处置）</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>产量趋势（近30天日均）</span>
              <el-button
                v-if="production.status === 'error'"
                link
                type="primary"
                size="small"
                @click="loadProduction"
              >重试</el-button>
            </div>
          </template>
          <div v-loading="loading.production" class="chart-wrap">
            <div v-show="production.status === 'success'" ref="productionTrendEl" class="chart-container"></div>
            <div v-if="production.status === 'empty'" class="chart-fallback muted">
              <el-empty :image-size="60" description="暂无产量数据" />
            </div>
            <div v-else-if="production.status === 'error'" class="chart-fallback danger">
              <el-result icon="error" title="产量趋势暂不可用" :sub-title="production.message">
                <template #extra>
                  <el-button size="small" type="primary" @click="loadProduction">重新加载</el-button>
                </template>
              </el-result>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>井状态分布</span>
              <el-button
                v-if="overview.status === 'error'"
                link
                type="primary"
                size="small"
                @click="loadOverview"
              >重试</el-button>
            </div>
          </template>
          <div v-loading="loading.overview" class="chart-wrap">
            <div v-show="overview.status === 'success'" ref="wellStatusEl" class="chart-container"></div>
            <div v-if="overview.status === 'error'" class="chart-fallback danger">
              <el-result icon="error" title="井状态数据暂不可用" :sub-title="overview.message">
                <template #extra>
                  <el-button size="small" type="primary" @click="loadOverview">重新加载</el-button>
                </template>
              </el-result>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="map-card">
          <template #header>
            <div class="card-header">
              <span>井位分布图</span>
              <el-tag v-if="overview.status !== 'success'" size="small" type="info">井位数据缺失</el-tag>
            </div>
          </template>
          <div ref="mapContainer" class="map-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="list-card">
          <template #header>
            <div class="card-header">
              <span>实时告警（未处置）</span>
              <div>
                <el-button
                  v-if="alarms.status === 'error'"
                  link
                  type="primary"
                  size="small"
                  @click="loadAlarms"
                >重试</el-button>
                <el-button type="primary" size="small" @click="goBriefing">生成运营简报</el-button>
              </div>
            </div>
          </template>
          <el-table
            v-loading="loading.alarms"
            :data="alarms.data?.unresolved || []"
            style="width: 100%"
          >
            <template #empty>
              <el-empty
                :image-size="60"
                :description="
                  alarms.status === 'error'
                    ? '告警数据获取失败，实时告警暂不可用'
                    : alarms.status === 'empty'
                    ? '当前无未处置告警'
                    : '加载中…'
                "
              />
            </template>
            <el-table-column prop="wellName" label="井名" width="100" />
            <el-table-column prop="alarmType" label="告警类型" width="120" />
            <el-table-column prop="level" label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="LEVEL_TAG_TYPE[row.level as AlarmLevel]" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="时间" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import * as echarts from 'echarts'
import {
  fetchOverview,
  fetchProduction,
  fetchAlarms,
  LEVEL_TAG_TYPE,
  STATUS_COLORS,
  type ReportFilters,
  type SectionData,
  type OverviewData,
  type ProductionData,
  type AlarmsData,
  type AlarmLevel
} from '@/api/operations'
import { productionTrendOption, wellStatusOption } from '@/utils/charts'

const router = useRouter()

// 与运营简报相同的数据源与口径；驾驶舱固定使用"近30天、全部区块"
const dashboardFilters: ReportFilters = {
  rangeType: '30d',
  startDate: undefined,
  endDate: undefined,
  block: '',
  alarmLevels: [],
  wellStatuses: []
}

const loading = reactive({ overview: false, production: false, alarms: false })
const overview = ref<SectionData<OverviewData>>({ status: 'empty', data: null })
const production = ref<SectionData<ProductionData>>({ status: 'empty', data: null })
const alarms = ref<SectionData<AlarmsData>>({ status: 'empty', data: null })

const statusValue = (name: keyof typeof STATUS_COLORS): string | number => {
  if (overview.value.status !== 'success' || !overview.value.data) return '—'
  return overview.value.data.breakdown.find(b => b.name === name)?.value ?? 0
}

// ---------- 图表（option 与简报共用构造器，保证视觉/口径一致） ----------

const productionTrendEl = ref<HTMLElement>()
const wellStatusEl = ref<HTMLElement>()
const mapContainer = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let statusChart: echarts.ECharts | null = null

watch(
  production,
  s => {
    if (s.status === 'success' && s.data && productionTrendEl.value) {
      trendChart ??= echarts.init(productionTrendEl.value)
      trendChart.setOption(productionTrendOption(s.data.points), true)
    }
  }
)

watch(
  overview,
  s => {
    if (s.status === 'success' && s.data && wellStatusEl.value) {
      statusChart ??= echarts.init(wellStatusEl.value)
      statusChart.setOption(wellStatusOption(s.data.breakdown), true)
      renderMapMarkers(s.data.wells)
    }
  }
)

// ---------- 地图 ----------

let map: mapboxgl.Map | null = null
let markersLayer = false

const initMap = () => {
  if (!mapContainer.value) return
  mapboxgl.accessToken = 'pk.eyJ1IjoibW9ja3Rva2VuIiwiYSI6ImNsa2M4OXF2ZjAxemgzYnA2djBqYjhxN3MifQ.Q'
  try {
    map = new mapboxgl.Map({
      container: mapContainer.value,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [118.8, 38.5],
      zoom: 6
    })
    map.on('load', () => {
      markersLayer = true
      if (overview.value.status === 'success' && overview.value.data) {
        renderMapMarkers(overview.value.data.wells)
      }
    })
  } catch {
    console.log('Mapbox token is mock, map will not display')
  }
}

// 以井名做确定性经纬度散列，保证井位与数据层中的井一一对应
function wellLngLat(name: string): [number, number] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return [117.6 + (h % 1000) / 1000 * 2.2, 37.7 + ((h >> 10) % 1000) / 1000 * 1.5]
}

function renderMapMarkers(wells: OverviewData['wells']) {
  if (!map || !markersLayer) return
  // mock token 下列表为空时直接返回，避免叠加重复标记
  document.querySelectorAll('.map-marker-well').forEach(el => el.remove())
  wells.slice(0, 60).forEach(well => {
    const [lng, lat] = wellLngLat(well.name)
    const el = document.createElement('div')
    el.className = 'map-marker-well'
    el.style.backgroundColor = STATUS_COLORS[well.status]
    new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(`<h5>${well.name}</h5><p>${well.block} 区块 · ${well.status}</p>`))
      .addTo(map!)
  })
}

// ---------- 数据加载 ----------

async function loadOverview() {
  loading.overview = true
  try {
    overview.value = await fetchOverview(dashboardFilters)
  } finally {
    loading.overview = false
  }
}
async function loadProduction() {
  loading.production = true
  try {
    production.value = await fetchProduction(dashboardFilters)
  } finally {
    loading.production = false
  }
}
async function loadAlarms() {
  loading.alarms = true
  try {
    alarms.value = await fetchAlarms(dashboardFilters)
  } finally {
    loading.alarms = false
  }
}

const goBriefing = () => router.push('/briefing')

const onResize = () => {
  trendChart?.resize()
  statusChart?.resize()
}

onMounted(() => {
  loadOverview()
  loadProduction()
  loadAlarms()
  initMap()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  trendChart?.dispose()
  statusChart?.dispose()
  map?.remove()
})
</script>

<style scoped lang="scss">
.dashboard-container {
  width: 100%;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;

  &.well { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  &.drilling { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
  &.production { background: linear-gradient(135deg, #22c55e, #16a34a); }
  &.alarm { background: linear-gradient(135deg, #ef4444, #dc2626); }
}

.stat-content {
  flex: 1;

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    color: #1e293b;
    line-height: 1;
    margin-bottom: 6px;
  }

  .stat-label {
    font-size: 14px;
    color: #64748b;
  }
}

.chart-card,
.map-card,
.list-card {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #1e293b;
}

.chart-wrap {
  position: relative;
  min-height: 300px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.chart-fallback {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.muted { color: #94a3b8; }
  &.danger :deep(.el-result__title p) { color: #ef4444; }
}

.map-container {
  width: 100%;
  height: 350px;
  background: #f8fafc;
  border-radius: 4px;
}

.map-marker-well {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
</style>

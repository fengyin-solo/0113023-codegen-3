<template>
  <div class="dashboard-container">
    <div class="dashboard-toolbar mb-20">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="本页指标与「运营简报」共用同一统计口径；如需按时间范围生成可分享简报，请前往运营简报。"
      >
        <el-button type="primary" size="small" @click="goBriefing">
          <el-icon><Notification /></el-icon>前往运营简报
        </el-button>
      </el-alert>
    </div>

    <el-row :gutter="20" class="mb-20" v-loading="loading">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon well">
            <el-icon><Position /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ display.wellCount }}</div>
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
            <div class="stat-value">{{ display.drillingCount }}</div>
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
            <div class="stat-value">{{ display.productionCount }}</div>
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
            <div class="stat-value">{{ display.alarmCount }}</div>
            <div class="stat-label">告警数量</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mb-20">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>产量趋势（月度总量，与运营简报同一产量数据源）</span>
              <el-tag v-if="degraded" size="small" type="warning" effect="plain">实时接口不可用，显示本地数据</el-tag>
            </div>
          </template>
          <div v-if="hasError" class="chart-error">
            <el-icon class="error-icon"><CircleCloseFilled /></el-icon>
            <div class="error-title">产量数据暂不可用</div>
            <div class="error-msg">{{ errorMessage }}</div>
            <el-button size="small" type="primary" plain @click="loadData">重试</el-button>
          </div>
          <div v-show="!hasError" ref="productionTrendChart" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>井状态分布</span>
            </div>
          </template>
          <div ref="wellStatusChart" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="map-card">
          <template #header>
            <div class="card-header">
              <span>井位分布图</span>
            </div>
          </template>
          <div ref="mapContainer" class="map-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="list-card">
          <template #header>
            <div class="card-header">
              <span>实时告警（未处理）</span>
              <el-button type="primary" size="small" @click="goBriefing">查看全部</el-button>
            </div>
          </template>
          <el-table :data="alarmList" style="width: 100%">
            <el-table-column prop="wellName" label="井名" width="100" />
            <el-table-column prop="alarmType" label="告警类型" width="120" />
            <el-table-column prop="level" label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="getAlarmType(row.level)" size="small">{{ row.level }}</el-tag>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  getDashboardSnapshot,
  type DashboardBundle
} from '@/services/briefingService'
import {
  buildProductionTrendOption,
  buildWellStatusOption
} from '@/utils/chartOptions'

const router = useRouter()
const goBriefing = () => router.push('/briefing')

const loading = ref(true)
const hasError = ref(false)
const errorMessage = ref('')
const degraded = ref(false)
const snapshot = ref<DashboardBundle | null>(null)

// 数据缺失时卡片展示占位而不是误导性的 0
const display = computed(() => {
  if (snapshot.value) return snapshot.value.overview
  return { wellCount: '--', drillingCount: '--', productionCount: '--', alarmCount: '--' }
})

const alarmList = computed(() => snapshot.value?.overview.openAlarms.slice(0, 5) || [])

const productionTrendChart = ref<HTMLElement>()
const wellStatusChart = ref<HTMLElement>()
const mapContainer = ref<HTMLElement>()

let trendChart: echarts.ECharts | null = null
let statusChart: echarts.ECharts | null = null

const getAlarmType = (level: string) => {
  const map: Record<string, 'danger' | 'warning' | 'info'> = {
    严重: 'danger',
    警告: 'warning',
    提示: 'info'
  }
  return map[level] || 'info'
}

function renderTrend() {
  if (!productionTrendChart.value || !snapshot.value) return
  trendChart = trendChart || echarts.init(productionTrendChart.value)
  const monthly = snapshot.value.monthly
  // 复用简报的双线趋势配置，仅把横轴由日改为月，确保口径 / 配色一致
  trendChart.setOption(
    {
      ...buildProductionTrendOption(
        monthly.map((m) => ({ date: m.month, oil: m.oil, water: m.water }))
      )
    },
    true
  )
}

function renderStatus() {
  if (!wellStatusChart.value || !snapshot.value) return
  statusChart = statusChart || echarts.init(wellStatusChart.value)
  statusChart.setOption(buildWellStatusOption(snapshot.value.overview.statusDistribution), true)
}

const resizeCharts = () => {
  trendChart?.resize()
  statusChart?.resize()
}

async function loadData() {
  loading.value = true
  hasError.value = false
  try {
    const result = await getDashboardSnapshot()
    snapshot.value = result.data
    degraded.value = !!result.degraded
    renderTrend()
    renderStatus()
  } catch (err) {
    hasError.value = true
    errorMessage.value = err instanceof Error ? err.message : '数据加载失败'
  } finally {
    loading.value = false
  }
}

const initMap = () => {
  if (!mapContainer.value) return
  mapboxgl.accessToken = 'pk.eyJ1IjoibW9ja3Rva2VuIiwiYSI6ImNsa2M4OXF2ZjAxemgzYnA2djBqYjhxN3MifQ.Q'
  try {
    const map = new mapboxgl.Map({
      container: mapContainer.value,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [118.8, 38.5],
      zoom: 6
    })

    map.on('load', () => {
      const wells = [
        { lng: 118.5, lat: 38.2, name: 'A-01井', status: 'production' },
        { lng: 118.8, lat: 38.5, name: 'B-03井', status: 'drilling' },
        { lng: 119.1, lat: 38.3, name: 'C-02井', status: 'production' },
        { lng: 118.6, lat: 38.7, name: 'D-05井', status: 'maintenance' }
      ]

      wells.forEach((well) => {
        const el = document.createElement('div')
        el.className = 'well-marker'
        el.style.backgroundColor =
          well.status === 'production' ? '#22c55e' : well.status === 'drilling' ? '#3b82f6' : '#f59e0b'
        el.style.width = '16px'
        el.style.height = '16px'
        el.style.borderRadius = '50%'
        el.style.border = '2px solid #fff'
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

        new mapboxgl.Marker(el)
          .setLngLat([well.lng, well.lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h4>${well.name}</h4><p>状态: ${well.status}</p>`))
          .addTo(map)
      })
    })
  } catch (e) {
    console.log('Mapbox token is mock, map will not display')
  }
}

onMounted(() => {
  loadData()
  initMap()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  statusChart?.dispose()
})
</script>

<style scoped lang="scss">
.dashboard-container {
  width: 100%;
}

.dashboard-toolbar {
  :deep(.el-alert__content) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
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

.chart-container {
  width: 100%;
  height: 300px;
}

.chart-error {
  height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  .error-icon {
    font-size: 28px;
    color: #ef4444;
  }

  .error-title {
    font-size: 14px;
    color: #475569;
  }

  .error-msg {
    font-size: 12px;
    color: #94a3b8;
  }
}

.map-container {
  width: 100%;
  height: 350px;
  background: #f8fafc;
  border-radius: 4px;
}
</style>

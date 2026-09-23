<template>
  <div class="lifecycle-container">
    <el-card class="well-select-card">
      <template #header>
        <div class="card-header">
          <span>井位选择</span>
        </div>
      </template>
      <div class="well-selector">
        <el-select v-model="selectedWellId" placeholder="请选择井位" style="width: 300px" @change="handleWellChange">
          <el-option v-for="well in wellList" :key="well.id" :label="well.wellName" :value="well.id" />
        </el-select>
        <div v-if="selectedWell" class="well-info">
          <el-tag size="small" :type="getStatusType(selectedWell.status)">{{ selectedWell.status }}</el-tag>
          <span class="well-code">{{ selectedWell.wellCode }}</span>
          <span class="well-block">{{ selectedWell.blockName }}</span>
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card class="timeline-card">
          <template #header>
            <div class="card-header">
              <span>全生命周期时间线</span>
              <el-tag type="info">当前阶段: {{ currentStage?.name }}</el-tag>
            </div>
          </template>
          <div class="timeline-container">
            <div class="timeline-track">
              <div class="timeline-progress" :style="{ width: `${progressPercentage}%` }"></div>
              <div v-for="(stage, index) in lifecycleStages" :key="stage.id" class="timeline-node" :class="{ active: stage.status === 'completed', current: stage.status === 'in_progress' }" @click="selectStage(stage)">
                <div class="node-icon">
                  <el-icon v-if="stage.status === 'completed'" size="20"><CircleCheck /></el-icon>
                  <el-icon v-else-if="stage.status === 'in_progress'" size="20"><Loading /></el-icon>
                  <el-icon v-else size="20"><CircleClose /></el-icon>
                </div>
                <div class="node-content">
                  <div class="node-name">{{ stage.name }}</div>
                  <div class="node-date">{{ stage.startDate }} ~ {{ stage.endDate || '进行中' }}</div>
                </div>
                <div class="node-line" v-if="index < lifecycleStages.length - 1"></div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="6">
        <el-card class="stage-list-card">
          <template #header>
            <span>阶段详情</span>
          </template>
          <div class="stage-nav">
            <div v-for="stage in lifecycleStages" :key="stage.id" class="stage-item" :class="{ active: selectedStage?.id === stage.id }" @click="selectStage(stage)">
              <div class="stage-indicator" :class="stage.status"></div>
              <div class="stage-info">
                <div class="stage-name">{{ stage.name }}</div>
                <div class="stage-duration">持续: {{ getStageDuration(stage) }}</div>
              </div>
              <el-icon class="stage-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="18">
        <el-card v-if="selectedStage" class="stage-detail-card">
          <template #header>
            <div class="card-header">
              <span>{{ selectedStage.name }} - 详细信息</span>
              <el-tag :type="getStageStatusType(selectedStage.status)">{{ getStageStatusText(selectedStage.status) }}</el-tag>
            </div>
          </template>
          
          <el-row :gutter="20" class="mb-20">
            <el-col :span="12">
              <div class="info-group">
                <div class="info-label">开始时间</div>
                <div class="info-value">{{ selectedStage.startDate }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="info-group">
                <div class="info-label">结束时间</div>
                <div class="info-value">{{ selectedStage.endDate || '-' }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="info-group">
                <div class="info-label">负责人</div>
                <div class="info-value">{{ selectedStage.manager || '-' }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="info-group">
                <div class="info-label">完成度</div>
                <div class="info-value">
                  <el-progress :percentage="selectedStage.progress" :status="selectedStage.progress === 100 ? 'success' : ''" />
                </div>
              </div>
            </el-col>
          </el-row>

          <el-tabs v-model="activeTab">
            <el-tab-pane label="关键指标" name="metrics">
              <el-row :gutter="20">
                <el-col :span="8" v-for="metric in selectedStage.metrics" :key="metric.name">
                  <div class="metric-card">
                    <div class="metric-icon" :style="{ background: metric.color }">
                      <el-icon><component :is="metric.icon" /></el-icon>
                    </div>
                    <div class="metric-content">
                      <div class="metric-value">{{ metric.value }}</div>
                      <div class="metric-name">{{ metric.name }}</div>
                    </div>
                  </div>
                </el-col>
              </el-row>
            </el-tab-pane>
            <el-tab-pane label="数据趋势" name="trend">
              <div ref="trendChart" class="chart-container"></div>
            </el-tab-pane>
            <el-tab-pane label="关键事件" name="events">
              <el-timeline>
                <el-timeline-item v-for="event in selectedStage.events" :key="event.id" :timestamp="event.time" :type="event.type" :color="event.color">
                  <el-card>
                    <h4>{{ event.title }}</h4>
                    <p>{{ event.description }}</p>
                  </el-card>
                </el-timeline-item>
              </el-timeline>
            </el-tab-pane>
            <el-tab-pane label="文档资料" name="docs">
              <el-table :data="selectedStage.documents" style="width: 100%">
                <el-table-column prop="name" label="文档名称" />
                <el-table-column prop="type" label="类型" width="120" />
                <el-table-column prop="size" label="大小" width="120" />
                <el-table-column prop="uploadTime" label="上传时间" width="180" />
                <el-table-column label="操作" width="120">
                  <template #default>
                    <el-button type="primary" size="small" link>下载</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="24">
        <el-card class="comparison-card">
          <template #header>
            <div class="card-header">
              <span>各阶段对比分析</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="12">
              <div ref="durationChart" class="chart-container"></div>
            </el-col>
            <el-col :span="12">
              <div ref="costChart" class="chart-container"></div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as echarts from 'echarts'

interface Well {
  id: number
  wellCode: string
  wellName: string
  blockName: string
  status: string
}

interface Stage {
  id: string
  name: string
  status: string
  startDate: string
  endDate?: string
  manager?: string
  progress: number
  duration?: number
  metrics?: Array<{ name: string; value: string; icon: string; color: string }>
  events?: Array<{ id: string; title: string; description: string; time: string; type: string; color: string }>
  documents?: Array<{ name: string; type: string; size: string; uploadTime: string }>
}

const wellList = ref<Well[]>([])
const selectedWellId = ref<number | null>(null)
const selectedWell = ref<Well | null>(null)
const lifecycleStages = ref<Stage[]>([])
const selectedStage = ref<Stage | null>(null)
const activeTab = ref('metrics')

const trendChart = ref<HTMLElement>()
const durationChart = ref<HTMLElement>()
const costChart = ref<HTMLElement>()

const currentStage = computed(() => {
  return lifecycleStages.value.find(s => s.status === 'in_progress')
})

const progressPercentage = computed(() => {
  const completed = lifecycleStages.value.filter(s => s.status === 'completed').length
  const total = lifecycleStages.value.length
  return Math.round((completed / total) * 100)
})

const getStatusType = (status: string) => {
  const map: Record<string, any> = {
    '生产中': 'success',
    '钻井中': 'primary',
    '待修井': 'warning',
    '关停井': 'danger'
  }
  return map[status] || 'info'
}

const getStageStatusType = (status: string) => {
  const map: Record<string, any> = {
    'completed': 'success',
    'in_progress': 'primary',
    'pending': 'info'
  }
  return map[status] || 'info'
}

const getStageStatusText = (status: string) => {
  const map: Record<string, string> = {
    'completed': '已完成',
    'in_progress': '进行中',
    'pending': '待开始'
  }
  return map[status] || status
}

const getStageDuration = (stage: Stage) => {
  if (!stage.endDate) return '进行中'
  const start = new Date(stage.startDate)
  const end = new Date(stage.endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return `${days} 天`
}

const handleWellChange = async () => {
  if (selectedWellId.value) {
    selectedWell.value = wellList.value.find(w => w.id === selectedWellId.value) || null
    await loadLifecycleData()
  }
}

const selectStage = (stage: Stage) => {
  selectedStage.value = stage
  activeTab.value = 'metrics'
  setTimeout(() => initTrendChart(), 100)
}

const loadWellList = async () => {
  wellList.value = [
    { id: 1, wellCode: 'A-001', wellName: 'A-01井', blockName: '胜利油田', status: '生产中' },
    { id: 2, wellCode: 'B-003', wellName: 'B-03井', blockName: '胜利油田', status: '钻井中' },
    { id: 3, wellCode: 'C-002', wellName: 'C-02井', blockName: '胜利油田', status: '生产中' }
  ]
  selectedWellId.value = 1
  selectedWell.value = wellList.value[0]
}

const loadLifecycleData = async () => {
  lifecycleStages.value = [
    {
      id: 'exploration',
      name: '勘探规划',
      status: 'completed',
      startDate: '2023-01-15',
      endDate: '2023-03-20',
      manager: '张工程师',
      progress: 100,
      metrics: [
        { name: '物探面积', value: '150 km²', icon: 'Compass', color: '#3b82f6' },
        { name: '预测储量', value: '500 万吨', icon: 'DataLine', color: '#8b5cf6' },
        { name: '探井数量', value: '5 口', icon: 'Position', color: '#22c55e' }
      ],
      events: [
        { id: 'e1', title: '三维地震勘探启动', description: '完成三维地震数据采集工作', time: '2023-01-20', type: 'primary', color: '#3b82f6' },
        { id: 'e2', title: '储量评估完成', description: '完成石油储量评估报告', time: '2023-02-28', type: 'success', color: '#22c55e' },
        { id: 'e3', title: '井位设计评审通过', description: '井位设计方案通过专家评审', time: '2023-03-15', type: 'success', color: '#22c55e' }
      ],
      documents: [
        { name: '三维地震勘探报告.pdf', type: 'PDF', size: '15.2 MB', uploadTime: '2023-02-15' },
        { name: '储量评估报告.docx', type: 'Word', size: '8.5 MB', uploadTime: '2023-03-01' },
        { name: '井位设计图纸.dwg', type: 'CAD', size: '3.2 MB', uploadTime: '2023-03-18' }
      ]
    },
    {
      id: 'drilling',
      name: '钻井施工',
      status: 'completed',
      startDate: '2023-04-01',
      endDate: '2023-07-15',
      manager: '李工程师',
      progress: 100,
      metrics: [
        { name: '钻井深度', value: '3,500 m', icon: 'TrendCharts', color: '#f59e0b' },
        { name: '钻井周期', value: '105 天', icon: 'Clock', color: '#ef4444' },
        { name: '机械钻速', value: '8.5 m/h', icon: 'Odometer', color: '#06b6d4' }
      ],
      events: [
        { id: 'd1', title: '开钻典礼', description: '正式开始钻井作业', time: '2023-04-01', type: 'primary', color: '#3b82f6' },
        { id: 'd2', title: '二开完成', description: '完成第二开钻井作业', time: '2023-05-10', type: 'success', color: '#22c55e' },
        { id: 'd3', title: '完钻井深达到设计', description: '顺利钻达设计井深3500米', time: '2023-07-10', type: 'success', color: '#22c55e' }
      ],
      documents: [
        { name: '钻井工程设计.pdf', type: 'PDF', size: '12.8 MB', uploadTime: '2023-03-25' },
        { name: '钻井日报汇总.xlsx', type: 'Excel', size: '4.2 MB', uploadTime: '2023-07-16' },
        { name: '完井报告.pdf', type: 'PDF', size: '18.5 MB', uploadTime: '2023-07-20' }
      ]
    },
    {
      id: 'completion',
      name: '完井测试',
      status: 'completed',
      startDate: '2023-07-20',
      endDate: '2023-09-10',
      manager: '王工程师',
      progress: 100,
      metrics: [
        { name: '测试层数', value: '8 层', icon: 'CopyDocument', color: '#3b82f6' },
        { name: '日产油量', value: '120 吨', icon: 'TrendCharts', color: '#22c55e' },
        { name: '地层压力', value: '35.2 MPa', icon: 'DataAnalysis', color: '#8b5cf6' }
      ],
      events: [
        { id: 'c1', title: '固井作业完成', description: '完成油层套管固井作业', time: '2023-07-25', type: 'success', color: '#22c55e' },
        { id: 'c2', title: '射孔作业完成', description: '成功射开目的层段', time: '2023-08-05', type: 'success', color: '#22c55e' },
        { id: 'c3', title: '试油成果达标', description: '试油产量达到预期目标', time: '2023-09-05', type: 'success', color: '#22c55e' }
      ],
      documents: [
        { name: '完井测试方案.pdf', type: 'PDF', size: '6.3 MB', uploadTime: '2023-07-18' },
        { name: '试油成果报告.pdf', type: 'PDF', size: '9.8 MB', uploadTime: '2023-09-12' }
      ]
    },
    {
      id: 'production',
      name: '生产运营',
      status: 'in_progress',
      startDate: '2023-09-15',
      manager: '赵工程师',
      progress: 45,
      metrics: [
        { name: '累计产油', value: '15,680 吨', icon: 'TrendCharts', color: '#22c55e' },
        { name: '累计产气', value: '850 万方', icon: 'Wind', color: '#f59e0b' },
        { name: '生产时率', value: '98.5%', icon: 'Clock', color: '#3b82f6' }
      ],
      events: [
        { id: 'p1', title: '投产成功', description: '正式投入生产运营', time: '2023-09-15', type: 'primary', color: '#3b82f6' },
        { id: 'p2', title: '首次措施作业', description: '完成首次压裂增产措施', time: '2024-01-20', type: 'warning', color: '#f59e0b' },
        { id: 'p3', title: '产量稳产达标', description: '连续3个月产量稳定', time: '2024-03-01', type: 'success', color: '#22c55e' }
      ],
      documents: [
        { name: '生产运行日报.xlsx', type: 'Excel', size: '2.5 MB', uploadTime: '2024-05-10' },
        { name: '油井工况分析报告.pdf', type: 'PDF', size: '5.8 MB', uploadTime: '2024-04-15' }
      ]
    },
    {
      id: 'maintenance',
      name: '修井作业',
      status: 'pending',
      startDate: '2026-06-01',
      manager: '待分配',
      progress: 0,
      metrics: [
        { name: '计划作业次数', value: '3 次', icon: 'Tools', color: '#64748b' },
        { name: '预计周期', value: '15 天', icon: 'Clock', color: '#64748b' },
        { name: '预算费用', value: '500 万', icon: 'Money', color: '#64748b' }
      ],
      events: [],
      documents: []
    },
    {
      id: 'abandonment',
      name: '废弃处置',
      status: 'pending',
      startDate: '2033-01-01',
      manager: '待分配',
      progress: 0,
      metrics: [
        { name: '预计年限', value: '10 年', icon: 'Clock', color: '#64748b' },
        { name: '环保等级', value: '一级', icon: 'Warning', color: '#64748b' },
        { name: '残值回收', value: '80%', icon: 'Coin', color: '#64748b' }
      ],
      events: [],
      documents: []
    }
  ]
  
  selectedStage.value = lifecycleStages.value[3]
  initCharts()
}

const initTrendChart = () => {
  if (!trendChart.value || !selectedStage.value) return
  
  const chart = echarts.init(trendChart.value)
  
  const chartData: any = {
    exploration: {
      xData: ['1月', '2月', '3月'],
      series: [
        { name: '地震覆盖面积', data: [50, 120, 150], color: '#3b82f6' },
        { name: '发现圈闭', data: [2, 5, 8], color: '#8b5cf6' }
      ]
    },
    drilling: {
      xData: ['4月', '5月', '6月', '7月'],
      series: [
        { name: '钻井进尺', data: [800, 1800, 2800, 3500], color: '#f59e0b' },
        { name: '机械钻速', data: [7.2, 8.5, 9.1, 8.8], color: '#ef4444' }
      ]
    },
    completion: {
      xData: ['7月下旬', '8月', '9月上旬'],
      series: [
        { name: '测试层数', data: [2, 5, 8], color: '#3b82f6' },
        { name: '单层产量', data: [8, 15, 15], color: '#22c55e' }
      ]
    },
    production: {
      xData: ['9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月'],
      series: [
        { name: '日产油量', data: [115, 118, 122, 120, 118, 125, 122, 120, 118], color: '#22c55e' },
        { name: '日产水量', data: [45, 48, 52, 50, 48, 45, 42, 40, 38], color: '#06b6d4' }
      ]
    }
  }
  
  const data = chartData[selectedStage.value.id] || chartData.production
  
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: data.series.map((s: any) => s.name) },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: data.xData },
    yAxis: { type: 'value' },
    series: data.series.map((s: any) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      data: s.data,
      itemStyle: { color: s.color }
    }))
  })
  
  window.addEventListener('resize', () => chart.resize())
}

const initDurationChart = () => {
  if (!durationChart.value) return
  
  const chart = echarts.init(durationChart.value)
  
  chart.setOption({
    title: { text: '各阶段周期对比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: lifecycleStages.value.map(s => s.name), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value', name: '天数' },
    series: [{
      type: 'bar',
      data: lifecycleStages.value.map(s => {
        if (!s.endDate) return 80
        const start = new Date(s.startDate)
        const end = new Date(s.endDate)
        return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }),
      itemStyle: {
        color: (params: any) => {
          const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#06b6d4', '#64748b']
          return colors[params.dataIndex]
        }
      }
    }]
  })
  
  window.addEventListener('resize', () => chart.resize())
}

const initCostChart = () => {
  if (!costChart.value) return
  
  const chart = echarts.init(costChart.value)
  
  chart.setOption({
    title: { text: '各阶段费用占比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: 'bold' }
      },
      labelLine: { show: false },
      data: [
        { value: 200, name: '勘探规划', itemStyle: { color: '#3b82f6' } },
        { value: 1200, name: '钻井施工', itemStyle: { color: '#8b5cf6' } },
        { value: 300, name: '完井测试', itemStyle: { color: '#f59e0b' } },
        { value: 800, name: '生产运营', itemStyle: { color: '#22c55e' } },
        { value: 150, name: '修井作业', itemStyle: { color: '#06b6d4' } },
        { value: 50, name: '废弃处置', itemStyle: { color: '#64748b' } }
      ]
    }]
  })
  
  window.addEventListener('resize', () => chart.resize())
}

const initCharts = () => {
  initTrendChart()
  initDurationChart()
  initCostChart()
}

onMounted(async () => {
  await loadWellList()
  await loadLifecycleData()
})
</script>

<style scoped lang="scss">
.lifecycle-container {
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: #1e293b;
}

.well-select-card {
  .well-selector {
    display: flex;
    align-items: center;
    gap: 20px;
    
    .well-info {
      display: flex;
      align-items: center;
      gap: 15px;
      
      .well-code {
        color: #64748b;
        font-size: 14px;
      }
      
      .well-block {
        color: #64748b;
        font-size: 14px;
      }
    }
  }
}

.timeline-card {
  .timeline-container {
    padding: 40px 20px;
    
    .timeline-track {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      
      .timeline-progress {
        position: absolute;
        top: 19px;
        left: 4%;
        height: 4px;
        background: linear-gradient(90deg, #3b82f6, #22c55e);
        border-radius: 2px;
        transition: width 0.5s ease;
        z-index: 1;
      }
      
      .timeline-node {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        z-index: 2;
        transition: transform 0.2s;
        
        &:hover {
          transform: scale(1.05);
        }
        
        .node-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e2e8f0;
          color: #94a3b8;
          border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: all 0.3s;
          
          &.active, &.current {
            background: #22c55e;
            color: #fff;
          }
          
          &.current {
            background: #3b82f6;
            animation: pulse 2s infinite;
          }
        }
        
        &.active .node-icon {
          background: #22c55e;
          color: #fff;
        }
        
        &.current .node-icon {
          background: #3b82f6;
          color: #fff;
        }
        
        .node-content {
          margin-top: 12px;
          text-align: center;
          
          .node-name {
            font-size: 14px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 4px;
          }
          
          .node-date {
            font-size: 12px;
            color: #64748b;
          }
        }
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
}

.stage-list-card {
  height: 100%;
  
  .stage-nav {
    .stage-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 8px;
      
      &:hover {
        background: #f1f5f9;
      }
      
      &.active {
        background: #eff6ff;
        
        .stage-name {
          color: #3b82f6;
        }
        
        .stage-arrow {
          color: #3b82f6;
        }
      }
      
      .stage-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        
        &.completed {
          background: #22c55e;
        }
        
        &.in_progress {
          background: #3b82f6;
        }
        
        &.pending {
          background: #94a3b8;
        }
      }
      
      .stage-info {
        flex: 1;
        
        .stage-name {
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          margin-bottom: 2px;
        }
        
        .stage-duration {
          font-size: 12px;
          color: #64748b;
        }
      }
      
      .stage-arrow {
        color: #94a3b8;
      }
    }
  }
}

.stage-detail-card {
  .info-group {
    padding: 16px;
    background: #f8fafc;
    border-radius: 8px;
    
    .info-label {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 6px;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 500;
      color: #1e293b;
    }
  }
  
  .metric-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    
    .metric-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 22px;
    }
    
    .metric-content {
      flex: 1;
      
      .metric-value {
        font-size: 20px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 2px;
      }
      
      .metric-name {
        font-size: 13px;
        color: #64748b;
      }
    }
  }
}

.chart-container {
  width: 100%;
  height: 300px;
}

.mt-20 {
  margin-top: 20px;
}

.mb-20 {
  margin-bottom: 20px;
}

.comparison-card {
  .chart-container {
    height: 280px;
  }
}
</style>

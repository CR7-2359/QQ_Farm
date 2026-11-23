<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'

const props = defineProps<{
  show: boolean
  editData?: any
}>()

const emit = defineEmits(['close', 'saved'])

const activeTab = ref<'qr' | 'wechat' | 'manual'>('qr')
const loading = ref(false)
const qrData = ref<{ image?: string, code: string, qrcode?: string, url?: string } | null>(null)
const qrStatus = ref('')
const errorMessage = ref('')
const wechatQr = ref<{ id: string, image: string } | null>(null)
const wechatLoading = ref(false)
const wechatStatus = ref('')
let qqRequest = 0
let wechatRequest = 0
let checkingWechatId = ''

const form = reactive({
  name: '',
  code: '',
  platform: 'qq',
})

const { pause: stopQRCheck, resume: startQRCheck } = useIntervalFn(async () => {
  const current = qrData.value
  if (!current)
    return
  try {
    const res = await api.post('/api/qr/check', { code: current.code })
    if (activeTab.value !== 'qr' || current !== qrData.value || !props.show)
      return
    if (res.data.ok) {
      const status = res.data.data.status
      if (status === 'OK') {
        // Login success
        stopQRCheck()
        qrData.value = null
        qrStatus.value = '登录成功'
        // Auto fill form and submit
        const { uin, code: authCode, nickname } = res.data.data

        // Use name from form if provided, otherwise default
        let accName = form.name.trim()
        if (!accName) {
          // 优先使用 nickname，其次使用 uin
          accName = nickname || (uin ? String(uin) : '扫码账号')
        }

        // We need to add account with this data
        await addAccount({
          id: props.editData?.id,
          uin,
          code: authCode,
          loginType: 'qr',
          name: props.editData ? (props.editData.name || accName) : accName,
          platform: 'qq',
        })
      }
      else if (status === 'Used') {
        qrStatus.value = '二维码已失效' // Consistent text
        stopQRCheck()
      }
      else if (status === 'Wait') {
        qrStatus.value = '等待扫码'
      }
      else {
        qrStatus.value = `错误: ${res.data.data.error}`
      }
    }
  }
  catch (e) {
    console.error(e)
  }
}, 1000, { immediate: false })

// QR Code Logic
async function loadQRCode() {
  if (activeTab.value !== 'qr')
    return
  loading.value = true
  const request = ++qqRequest
  stopQRCheck()
  qrData.value = null
  qrStatus.value = '正在获取二维码'
  errorMessage.value = ''
  try {
    const res = await api.post('/api/qr/create')
    if (request !== qqRequest)
      return
    if (res.data.ok) {
      qrData.value = res.data.data
      qrStatus.value = '请使用手机QQ扫码'
      startQRCheck()
    }
    else {
      qrStatus.value = `获取失败: ${res.data.error}`
    }
  }
  catch (e) {
    if (request === qqRequest)
      qrStatus.value = '获取失败'
    console.error(e)
  }
  finally {
    if (request === qqRequest)
      loading.value = false
  }
}

function cancelWechatSession(id: string) {
  void api.post('/api/qr/wechat/cancel', { id }).catch(() => {})
}

const { pause: stopWechatCheck, resume: startWechatCheck } = useIntervalFn(async () => {
  const id = wechatQr.value?.id
  if (!id || checkingWechatId === id)
    return

  checkingWechatId = id
  try {
    const { data } = await api.post('/api/qr/wechat/check', { id }, { timeout: 60000 })
    if (wechatQr.value?.id !== id)
      return
    const status = data.data?.status
    if (status === 'scanned') {
      wechatStatus.value = '已扫码，请在手机微信中确认'
    }
    else if (status === 'pending') {
      wechatStatus.value = '请使用手机微信扫码'
    }
    else if (status === 'retrying') {
      wechatStatus.value = '扫码状态暂时无法查询，正在重试'
    }
    else if (status === 'complete') {
      wechatQr.value = null
      emit('saved')
      close()
    }
    else {
      wechatQr.value = null
      stopWechatCheck()
      wechatStatus.value = data.data?.error || data.error || '二维码已失效，请刷新后重试'
    }
  }
  catch (error: any) {
    if (wechatQr.value?.id === id) {
      clearWechatQRCode()
      wechatStatus.value = error.response?.data?.error || '微信扫码状态查询失败，请刷新后重试'
    }
  }
  finally {
    if (checkingWechatId === id)
      checkingWechatId = ''
  }
}, 2000, { immediate: false })

function clearWechatQRCode() {
  wechatRequest++
  stopWechatCheck()
  if (wechatQr.value)
    cancelWechatSession(wechatQr.value.id)
  wechatQr.value = null
  wechatLoading.value = false
}

async function loadWechatQRCode() {
  clearWechatQRCode()
  const request = wechatRequest
  wechatLoading.value = true
  wechatStatus.value = '正在获取微信二维码'
  try {
    const { data } = await api.post('/api/qr/wechat/create', {
      accountId: props.editData?.id,
      name: form.name,
    }, { timeout: 25000 })
    if (request !== wechatRequest) {
      if (data.ok)
        cancelWechatSession(data.data.id)
      return
    }
    if (data.ok) {
      wechatQr.value = data.data
      wechatStatus.value = '请使用手机微信扫码'
      startWechatCheck()
    }
    else {
      wechatStatus.value = data.error || '获取微信二维码失败'
    }
  }
  catch (error: any) {
    if (request === wechatRequest)
      wechatStatus.value = error.response?.data?.error || '获取微信二维码失败，请重试'
  }
  finally {
    if (request === wechatRequest)
      wechatLoading.value = false
  }
}

function selectTab(tab: typeof activeTab.value) {
  if (activeTab.value === 'qr')
    loading.value = false
  qqRequest++
  stopQRCheck()
  qrData.value = null
  clearWechatQRCode()
  errorMessage.value = ''
  activeTab.value = tab
  if (tab === 'qr')
    void loadQRCode()
  else if (tab === 'wechat')
    void loadWechatQRCode()
}

const isMobile = computed(() => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
const manualNameHint = computed(() => form.platform === 'qq'
  ? '留空备注名时，会在保存后自动同步游戏名称。'
  : '微信小程序保留原逻辑，留空时将使用默认备注名。')
const manualNamePlaceholder = computed(() => form.platform === 'qq'
  ? '留空自动同步游戏名称'
  : '留空默认账号名')

function openQRCodeLoginUrl() {
  if (!qrData.value?.url)
    return

  const url = qrData.value.url
  if (!isMobile.value) {
    window.open(url, '_blank')
    return
  }

  // Mobile Deep Link logic
  try {
    const b64 = btoa(decodeURIComponent(encodeURIComponent(url)))
    const qqDeepLink = `mqqapi://forward/url?url_prefix=${encodeURIComponent(b64)}&version=1&src_type=web`
    window.location.href = qqDeepLink
  }
  catch (e) {
    console.error('打开二维码登录链接失败:', e)
    window.location.href = url
  }
}

async function addAccount(data: any) {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await api.post('/api/accounts', data)
    if (res.data.ok) {
      emit('saved')
      close()
    }
    else {
      errorMessage.value = `保存失败: ${res.data.error}`
    }
  }
  catch (e: any) {
    errorMessage.value = `保存失败: ${e.response?.data?.error || e.message}`
  }
  finally {
    loading.value = false
  }
}

async function submitManual() {
  errorMessage.value = ''
  if (props.editData?.wechatQrBound && !form.code && form.name.trim() && form.name !== props.editData.name) {
    await addAccount({ id: props.editData.id, name: form.name.trim() })
    return
  }
  if (!form.code) {
    errorMessage.value = '请输入Code 或 进行扫码'
    return
  }

  if (!form.name && props.editData) {
    errorMessage.value = '请输入名称'
    return
  }

  let code = form.code.trim()
  // Try to extract code from URL if present
  const match = code.match(/[?&]code=([^&]+)/i)
  if (match && match[1]) {
    code = decodeURIComponent(match[1])
    form.code = code // Update UI
  }

  // 检查是否仅修改了备注
  let payload = {}
  if (props.editData) {
    // 编辑模式：检查是否只修改了备注
    const onlyNameChanged = form.name !== props.editData.name
      && form.code === (props.editData.code || '')
      && form.platform === (props.editData.platform || 'qq')

    if (onlyNameChanged) {
      // 仅修改了备注，只发送 id 和 name
      payload = {
        id: props.editData.id,
        name: form.name,
      }
    }
    else {
      // 修改了其他字段，发送完整 payload
      payload = {
        id: props.editData.id,
        name: form.name,
        code,
        platform: form.platform,
        loginType: 'manual',
      }
    }
  }
  else {
    // 新增模式，发送完整 payload
    payload = {
      name: form.name,
      code,
      platform: form.platform,
      loginType: 'manual',
    }
  }

  await addAccount(payload)
}

function close() {
  qqRequest++
  stopQRCheck()
  clearWechatQRCode()
  emit('close')
}

onBeforeUnmount(clearWechatQRCode)

watch(() => props.show, (newVal) => {
  if (newVal) {
    errorMessage.value = ''
    if (props.editData) {
      form.name = props.editData.name
      form.code = props.editData.code || ''
      form.platform = props.editData.platform || 'qq'
      selectTab(form.platform === 'wx' ? (props.editData.wechatQrBound ? 'wechat' : 'manual') : 'qr')
    }
    else {
      // Add mode: Default to QR
      form.name = ''
      form.code = ''
      form.platform = 'qq'
      selectTab('qr')
    }
  }
  else {
    // Reset when closed
    qqRequest++
    stopQRCheck()
    clearWechatQRCode()
    loading.value = false
    qrData.value = null
    qrStatus.value = ''
  }
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="max-w-md w-full overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
      <div class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 class="text-lg font-semibold">
          {{ editData ? '编辑账号' : '添加账号' }}
        </h3>
        <BaseButton variant="ghost" class="!p-1" @click="close">
          <div class="i-carbon-close text-xl" />
        </BaseButton>
      </div>

      <div class="p-4">
        <div v-if="errorMessage" class="mb-4 rounded bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {{ errorMessage }}
        </div>
        <!-- Tabs -->
        <div class="mb-4 flex border-b border-gray-200 dark:border-gray-700">
          <button
            v-if="!editData?.wechatQrBound"
            class="flex-1 py-2 text-center font-medium"
            :class="activeTab === 'qr' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'"
            @click="selectTab('qr')"
          >
            QQ扫码
          </button>
          <button
            v-if="!editData || editData.platform === 'wx'"
            class="flex-1 py-2 text-center font-medium"
            :class="activeTab === 'wechat' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'"
            @click="selectTab('wechat')"
          >
            微信扫码
          </button>
          <button
            class="flex-1 py-2 text-center font-medium"
            :class="activeTab === 'manual' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'"
            @click="selectTab('manual')"
          >
            手动填码
          </button>
        </div>

        <!-- QR Tab -->
        <div v-if="activeTab === 'qr'" class="flex flex-col items-center justify-center py-4 space-y-4">
          <div class="w-full text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              扫码默认使用QQ昵称
            </p>
          </div>

          <div v-if="qrData && (qrData.image || qrData.qrcode)" class="border rounded bg-white p-2">
            <img :src="qrData.image ? (qrData.image.startsWith('data:') ? qrData.image : `data:image/png;base64,${qrData.image}`) : qrData.qrcode" class="h-48 w-48">
          </div>
          <div v-else class="h-48 w-48 flex items-center justify-center rounded bg-gray-100 text-gray-400 dark:bg-gray-700">
            <div v-if="loading" i-svg-spinners-90-ring-with-bg class="text-3xl" />
            <span v-else>二维码已过期</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ qrStatus }}
          </p>
          <div class="flex gap-2">
            <BaseButton variant="text" size="sm" @click="loadQRCode">
              刷新二维码
            </BaseButton>
            <BaseButton
              v-if="qrData?.url"
              variant="text"
              size="sm"
              class="text-blue-600 md:hidden"
              @click="openQRCodeLoginUrl"
            >
              跳转QQ登录
            </BaseButton>
          </div>
        </div>

        <div v-if="activeTab === 'wechat'" class="flex flex-col items-center justify-center py-4 space-y-4">
          <div v-if="wechatQr" class="border rounded bg-white p-2">
            <img :src="wechatQr.image" alt="微信登录二维码" class="h-48 w-48">
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400" role="status">
            {{ wechatStatus }}
          </p>
          <BaseButton variant="text" size="sm" :loading="wechatLoading" @click="loadWechatQRCode">
            刷新二维码
          </BaseButton>
        </div>

        <!-- Manual Tab -->
        <div v-if="activeTab === 'manual'" class="space-y-4">
          <div class="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            {{ manualNameHint }}
          </div>

          <BaseInput
            v-model="form.name"
            label="备注名称"
            :placeholder="manualNamePlaceholder"
          />

          <BaseTextarea
            v-model="form.code"
            label="Code"
            placeholder="请输入登录 Code"
            :rows="3"
          />

          <BaseSelect
            v-if="!editData"
            v-model="form.platform"
            label="平台"
            :options="[
              { label: 'QQ小程序', value: 'qq' },
              { label: '微信小程序', value: 'wx' },
            ]"
          />

          <div class="flex justify-end gap-2 pt-4">
            <BaseButton
              variant="outline"
              @click="close"
            >
              取消
            </BaseButton>
            <BaseButton
              variant="primary"
              :loading="loading"
              @click="submitManual"
            >
              {{ editData ? '保存' : '添加' }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<template>
    <a-modal :open="visible" title="入库" :confirm-loading="loading" :mask-closable="false" width="720px" ok-text="提交入库"
        cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
        <a-form ref="formRef" :model="form" layout="vertical">
            <a-form-item>
                <a-radio-group v-model:value="mode" button-style="solid">
                    <a-radio-button value="single">单条入库</a-radio-button>
                    <a-radio-button value="batch">批量入库</a-radio-button>
                </a-radio-group>
            </a-form-item>

            <!-- 单条入库：零件 / 规格 / 数量 同一行 -->
            <template v-if="mode === 'single'">
                <a-row :gutter="12">
                    <a-col :span="showSpecSelect ? 9 : 12">
                        <a-form-item label="零件" name="item_id" :rules="[{ required: true, message: '请选择零件' }]">
                            <a-select v-model:value="form.item_id" placeholder="请选择零件" show-search
                                :filter-option="filterOption" :loading="itemsLoading" :options="itemOptions"
                                @change="handleSingleItemChange" />
                        </a-form-item>
                    </a-col>

                    <a-col v-if="showSpecSelect" :span="7">
                        <a-form-item label="规格" name="spec_id" :rules="[{ required: true, message: '请选择规格' }]">
                            <a-select v-model:value="form.spec_id" placeholder="请选择规格" :options="singleSpecOptions" />
                        </a-form-item>
                    </a-col>

                    <a-col :span="showSpecSelect ? 8 : 12">
                        <a-form-item label="数量" name="quantity"
                            :rules="[{ required: true, message: '请输入数量' }, { type: 'number', min: 1, message: '数量必须大于0' }]">
                            <a-input-number v-model:value="form.quantity" placeholder="数量" :min="1" :precision="0"
                                style="width: 100%" />
                        </a-form-item>
                    </a-col>
                </a-row>
            </template>

            <!-- 批量入库：动态行 -->
            <template v-else>
                <div class="batch-header">
                    <span class="batch-label">入库明细</span>
                    <a-button type="link" size="small" @click="addRow">
                        <PlusOutlined />
                        添加一行
                    </a-button>
                </div>

                <div v-for="(row, idx) in batchRows" :key="idx" class="batch-row">
                    <a-select class="row-item" :value="row.item_id" placeholder="选择零件" show-search
                        :filter-option="filterOption" :options="itemOptions"
                        @change="(v: string) => handleRowItemChange(idx, v)" />

                    <a-select v-if="needsSpec(row.item_id)" class="row-spec" :value="row.spec_id" placeholder="规格"
                        :options="specOptionsFor(row.item_id)" @change="(v: string) => (row.spec_id = v)" />

                    <a-input-number class="row-qty" :value="row.quantity" placeholder="数量" :min="1" :precision="0"
                        @change="(v: number | null) => (row.quantity = v ?? 1)" />

                    <a-button class="row-del" type="link" danger :disabled="batchRows.length === 1"
                        @click="removeRow(idx)">
                        <DeleteOutlined />
                    </a-button>
                </div>
            </template>

            <a-row :gutter="12">
                <a-col :span="12">
                    <a-form-item label="入库日期" name="date" :rules="[{ required: true, message: '请选择入库日期' }]">
                        <a-date-picker v-model:value="form.date" placeholder="请选择日期" style="width: 100%"
                            :format="'YYYY-MM-DD'" />
                    </a-form-item>
                </a-col>
            </a-row>

            <a-form-item label="入库照片" name="photo_id">
                <a-upload v-model:file-list="fileList" :before-upload="beforeUpload" :custom-request="handleUpload"
                    :max-count="1" list-type="picture-card" :disabled="uploading">
                    <div v-if="fileList.length < 1 && !uploading">
                        <plus-outlined />
                        <div style="margin-top: 8px">上传照片</div>
                    </div>
                </a-upload>
            </a-form-item>

            <a-form-item label="备注" name="remark">
                <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选，本批次共用）" :rows="3" :maxlength="500"
                    show-count />
            </a-form-item>
        </a-form>
    </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import dayjs, { type Dayjs } from 'dayjs'
import { inventoryApi, fileApi } from '@/api/inventory'
import type { InventoryItem } from '@/api/inventory'

interface Props {
    visible: boolean
}
const props = defineProps<Props>()

interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
}
const emit = defineEmits<Emits>()

const formRef = ref()
const loading = ref(false)
const itemsLoading = ref(false)
const uploading = ref(false)

const mode = ref<'single' | 'batch'>('single')
const items = ref<InventoryItem[]>([])
const fileList = ref<any[]>([])

const form = reactive({
    item_id: '',
    spec_id: '',
    quantity: 1 as number,
    date: dayjs() as Dayjs,
    photo_id: '',
    remark: ''
})

interface BatchRow {
    item_id: string
    spec_id: string
    quantity: number
}
const batchRows = ref<BatchRow[]>([{ item_id: '', spec_id: '', quantity: 1 }])

// ---- 选项 ----
const itemOptions = computed(() =>
    items.value.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }))
)

const filterOption = (input: string, option: { label: string }) =>
    option.label.toLowerCase().includes(input.toLowerCase())

function specOptionsFor(itemId: string) {
    const item = items.value.find((i) => i.item_id === itemId)
    if (!item?.specs) return []
    return item.specs.map((s) => ({
        label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
        value: s.spec_id
    }))
}

function needsSpec(itemId: string) {
    const item = items.value.find((i) => i.item_id === itemId)
    if (!item?.specs?.length) return false
    return !(item.specs.length === 1 && item.specs[0]?.spec === '')
}

// ---- 单条 ----
const singleItem = computed(() => items.value.find((i) => i.item_id === form.item_id))

const showSpecSelect = computed(() => {
    const item = singleItem.value
    if (!item?.specs?.length) return false
    return !(item.specs.length === 1 && item.specs[0]?.spec === '')
})

const singleSpecOptions = computed(() => specOptionsFor(form.item_id))

const handleSingleItemChange = () => {
    form.spec_id = ''
    const defaultSpec = singleItem.value?.specs?.[0]
    if (singleItem.value?.specs?.length === 1 && defaultSpec?.spec === '') {
        form.spec_id = defaultSpec.spec_id
    }
}

// ---- 批量 ----
const addRow = () => {
    batchRows.value.push({ item_id: '', spec_id: '', quantity: 1 })
}

const removeRow = (idx: number) => {
    batchRows.value.splice(idx, 1)
}

const handleRowItemChange = (idx: number, value: string) => {
    const row = batchRows.value[idx]
    if (!row) return
    row.item_id = value
    row.spec_id = ''
    const item = items.value.find((i) => i.item_id === value)
    const defaultSpec = item?.specs?.[0]
    if (item?.specs?.length === 1 && defaultSpec?.spec === '') {
        row.spec_id = defaultSpec.spec_id
    }
}

// ---- 数据加载 ----
const loadItems = async () => {
    itemsLoading.value = true
    try {
        const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 })
        if (res.result === 0) {
            items.value = res.datas.items
        }
    } catch (error) {
        console.error('加载零件列表失败:', error)
    } finally {
        itemsLoading.value = false
    }
}

// ---- 照片上传 ----
const beforeUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
        message.error('只能上传图片文件')
        return false
    }
    if (file.size / 1024 / 1024 >= 5) {
        message.error('图片大小不能超过5MB')
        return false
    }
    return true
}

const handleUpload = async (options: any) => {
    const { file } = options
    uploading.value = true
    try {
        const data = await fileApi.uploadFile(file)
        form.photo_id = data.relation_id
        message.success('照片上传成功')
    } catch (error) {
        console.error('照片上传失败:', error)
        message.error('照片上传失败')
        fileList.value = []
    } finally {
        uploading.value = false
    }
}

// ---- 校验 ----
const validateBatch = (): string | null => {
    const rows = batchRows.value
    if (rows.length === 0) return '请至少添加一条入库明细'
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue
        if (!row.item_id) return `第 ${i + 1} 行未选择零件`
        if (needsSpec(row.item_id) && !row.spec_id) return `第 ${i + 1} 行未选择规格`
        if (!row.quantity || row.quantity < 1) return `第 ${i + 1} 行数量无效`
    }
    // (item_id, spec_id) 不可重复
    const seen = new Set<string>()
    for (const row of rows) {
        const key = `${row.item_id}|${row.spec_id}`
        if (seen.has(key)) return '入库列表存在重复的(零件+规格)'
        seen.add(key)
    }
    return null
}

// ---- 提交 ----
const handleSubmit = async () => {
    const dateStr = form.date.format('YYYY-MM-DD')

    if (mode.value === 'single') {
        try {
            await formRef.value?.validate()
        } catch {
            return
        }
        loading.value = true
        try {
            const res = await inventoryApi.stockIn({
                item_id: form.item_id,
                spec_id: form.spec_id,
                quantity: form.quantity,
                date: dateStr,
                photo_id: form.photo_id,
                remark: form.remark || undefined
            })
            if (res.result === 0) {
                message.success('入库成功')
                emit('update:visible', false)
                emit('success')
            } else {
                message.error(res.msg || '入库失败')
            }
        } catch (error) {
            console.error('入库失败:', error)
        } finally {
            loading.value = false
        }
        return
    }

    // 批量
    const err = validateBatch()
    if (err) {
        message.warning(err)
        return
    }
    loading.value = true
    try {
        const res = await inventoryApi.stockInBatch({
            items: batchRows.value.map((r) => ({
                item_id: r.item_id,
                spec_id: r.spec_id,
                quantity: r.quantity
            })),
            date: dateStr,
            photo_id: form.photo_id,
            remark: form.remark || undefined
        })
        if (res.result === 0) {
            message.success('批量入库成功')
            emit('update:visible', false)
            emit('success')
        } else {
            message.error(res.msg || '入库失败')
        }
    } catch (error) {
        console.error('批量入库失败:', error)
    } finally {
        loading.value = false
    }
}

const handleCancel = () => {
    emit('update:visible', false)
}

const resetForm = () => {
    mode.value = 'single'
    form.item_id = ''
    form.spec_id = ''
    form.quantity = 1
    form.date = dayjs()
    form.photo_id = ''
    form.remark = ''
    batchRows.value = [{ item_id: '', spec_id: '', quantity: 1 }]
    fileList.value = []
    formRef.value?.clearValidate()
}

watch(
    () => props.visible,
    (val) => {
        if (val) {
            resetForm()
            loadItems()
        }
    }
)
</script>

<style scoped>
.batch-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}

.batch-label {
    font-size: 14px;
    font-weight: 500;
    color: #52525b;
}

.batch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.row-item {
    flex: 1;
    min-width: 0;
}

.row-spec {
    width: 190px;
    flex-shrink: 0;
}

.row-qty {
    width: 110px;
    flex-shrink: 0;
}

.row-del {
    flex-shrink: 0;
    padding: 0 8px;
}
</style>

<template>
  <a-modal :open="open" :title="isEdit ? '修改支出费用单' : '新建支出费用单'" :confirm-loading="loading" :mask-closable="false"
    width="1200px" ok-text="提交" cancel-text="取消" @ok="handleSubmit" @cancel="handleCancel">
    <a-form ref="formRef" :model="form" layout="vertical">
      <!-- 费用类型:编辑时锁定不允许修改 -->
      <a-form-item label="费用类型" name="expense_type" :rules="[{ required: true, message: '请选择费用类型' }]">
        <a-radio-group v-model:value="form.expense_type" button-style="solid" :disabled="isEdit">
          <a-radio-button :value="ExpenseType.WITH_INVOICE">有发票采购</a-radio-button>
          <a-radio-button :value="ExpenseType.WITHOUT_INVOICE">无发票支出</a-radio-button>
        </a-radio-group>
      </a-form-item>

      <!-- 基本信息 -->
      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item label="费用名称" name="expense_title">
            <a-input v-model:value="form.expense_title" placeholder="请输入费用名称（可选）" :maxlength="100" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="支出金额" name="amount" :rules="amountRules">
            <a-input-number v-model:value="form.amount" placeholder="支出金额" :min="0" :precision="2"
              style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="支出日期" name="expense_date" :rules="[{ required: true, message: '请选择支出日期' }]">
            <a-date-picker v-model:value="form.expense_date" placeholder="请选择日期" style="width: 100%"
              :format="'YYYY-MM-DD'" :allow-clear="false" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="支出分类" name="category">
            <a-select v-model:value="form.category" placeholder="请选择分类" allow-clear :options="categoryOptions" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item label="收款方/对方名称" name="payee">
            <a-input v-model:value="form.payee" placeholder="请输入收款方（可选）" :maxlength="100" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="付款方式" name="payment_method">
            <a-select v-model:value="form.payment_method" placeholder="请选择付款方式" allow-clear
              :options="paymentMethodOptions" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="采购来源渠道" name="channel">
            <a-select v-model:value="form.channel" placeholder="请选择渠道" allow-clear :options="channelOptions" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="电商订单号" name="order_no">
            <a-input v-model:value="form.order_no" placeholder="淘宝/京东等平台订单号（可选）" :maxlength="50" />
          </a-form-item>
        </a-col>
      </a-row>

      <!-- 关联发票(仅类型1-有发票采购) -->
      <template v-if="form.expense_type === ExpenseType.WITH_INVOICE">
        <a-form-item label="关联发票">
          <!-- 编辑时展示已绑定的发票摘要 -->
          <a-alert v-if="boundInvoiceNumber && !newInvoice" type="success" show-icon class="invoice-bound">
            <template #message>
              已关联发票:{{ boundInvoiceNumber }}
              <span v-if="detailInvoice?.sub_type_desc">({{ detailInvoice.sub_type_desc }})</span>
              <a v-if="detailInvoice?.invoice_url" :href="detailInvoice.invoice_url" target="_blank"
                class="invoice-link">
                查看原文件
              </a>
              <a-button type="link" size="small" @click="openInvoiceUpload">
                换绑发票
              </a-button>
            </template>
          </a-alert>

          <!-- 本次识别待关联的发票摘要 -->
          <a-alert v-if="newInvoice" type="info" show-icon closable class="invoice-bound" @close="clearNewInvoice">
            <template #message>
              识别成功:{{ newInvoice.invoice_number }}
              <span v-if="newInvoice.sub_type_desc">({{ newInvoice.sub_type_desc }})</span>
              <span v-if="newInvoice.total_amount"> ¥{{ newInvoice.total_amount }}</span>
              <a-tag v-if="newInvoice.is_duplicate" color="orange" class="invoice-duplicate-tag">已存在</a-tag>
            </template>
          </a-alert>

          <!-- 上传入口:未绑定时展示,已绑定时通过上方「换绑发票」进入 -->
          <a-button v-if="!boundInvoiceNumber || newInvoice" @click="openInvoiceUpload">
            <UploadOutlined />
            {{ newInvoice ? '重新上传识别' : '上传发票识别(单个)' }}
          </a-button>
        </a-form-item>
      </template>

      <!-- 备注 -->
      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" placeholder="请输入备注（可选）" :rows="2" :maxlength="500" show-count />
      </a-form-item>

      <!-- 采购明细 -->
      <div class="batch-header">
        <span class="batch-label">采购明细（每行选择类型/零件/规格，行金额 = 数量 × 单价）</span>
        <a-space>
          <a-button type="link" size="small" :disabled="!itemsTotal" @click="fillAmountFromItems">
            按明细合计填充金额({{ itemsTotal }})
          </a-button>
          <a-button type="link" size="small" @click="addItemRow">
            <PlusOutlined />
            添加一行
          </a-button>
        </a-space>
      </div>

      <div class="items-head">
        <span class="col-type">一级类型</span>
        <span class="col-type-child">二级类型</span>
        <span class="col-item">零件</span>
        <span class="col-spec">规格</span>
        <span class="col-qty">数量</span>
        <span class="col-price">单价</span>
        <span class="col-amount">小计</span>
        <span class="col-remark">备注</span>
        <span class="col-del"></span>
      </div>

      <div v-for="(row, idx) in itemRows" :key="idx" class="batch-row">
        <a-select class="col-type" :value="row.parentTypeId" placeholder="一级类型" allow-clear :loading="typesLoading"
          @change="(v: string) => handleRowParentTypeChange(idx, v)">
          <a-select-option v-for="t in parentTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select class="col-type-child" :value="row.childTypeId" placeholder="二级类型" allow-clear :loading="typesLoading"
          @change="(v: string) => handleRowChildTypeChange(idx, v)">
          <a-select-option v-for="t in row.childTypes" :key="t.type_id" :value="t.type_id">
            {{ t.type_name }}
          </a-select-option>
        </a-select>

        <a-select class="col-item" :value="row.item_id" placeholder="选择零件" show-search :filter-option="filterOption"
          :loading="itemsLoading" :options="getFilteredItemOptions(row)"
          @change="(v: string) => handleRowItemChange(idx, v)" />

        <a-select v-if="needsSpec(row)" class="col-spec" :value="row.spec_id" placeholder="规格"
          :options="specOptionsFor(row)" @change="(v: string) => handleRowSpecChange(idx, v)" />
        <span v-else class="col-spec spec-empty">默认规格</span>

        <a-input-number class="col-qty" :value="row.quantity" placeholder="数量" :min="1" :precision="0"
          @change="(v: number | null) => (row.quantity = v ?? 1)" />

        <a-input-number class="col-price" :value="row.price" placeholder="单价" :min="0" :precision="2"
          @change="(v: number | null) => (row.price = v)" />

        <span class="col-amount amount-text">{{ rowAmount(row) || '-' }}</span>

        <a-input class="col-remark" :value="row.remark" placeholder="备注" :maxlength="500"
          @change="(e: Event) => (row.remark = (e.target as HTMLInputElement).value)" />

        <a-button class="col-del" type="link" danger :disabled="itemRows.length === 1" @click="removeItemRow(idx)">
          <DeleteOutlined />
        </a-button>
      </div>
    </a-form>

    <!-- 单个发票识别弹窗(与发票列表的单个识别保持一致,性质固定实开) -->
    <InvoiceUploadModal
      v-model:open="invoiceUploadOpen"
      mode="single"
      :fixed-nature="InvoiceNature.ACTUAL"
      @uploaded="handleInvoiceUploaded"
    />
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 支出费用单新建/编辑弹窗
 * - 单弹窗按费用类型动态展示:类型1-有发票采购可上传发票识别入库(选填),类型2-无发票支出不传发票
 * - 采购明细行交互与入库界面(StockInModal)保持一致:类型筛选 → 零件搜索 → 规格联动 → 数量/单价
 * - 编辑时经 /saleshub/expense/detail 回显完整数据,换绑发票走 update 传入新 invoice_id
 */
import { computed, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons-vue';
import dayjs, { type Dayjs } from 'dayjs';
import { inventoryApi } from '@/api/inventory';
import { expenseApi } from '@/api/expense';
import { useAuthStore } from '@/stores/auth';
import InvoiceUploadModal from '@/components/invoice/InvoiceUploadModal.vue';
import type { InventoryItem, ItemTypeNode } from '@/types/inventory';
import { InvoiceNature } from '@/types/invoice';
import type { InvoiceBrief, InvoiceUploadResult } from '@/types/invoice';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CHANNEL_LABELS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  ExpenseType,
} from '@/types/expense';
import type { Expense, ExpenseDetail, ExpenseDetailItem } from '@/types/expense';

interface Props {
  /** 弹窗可见性(v-model:open) */
  open: boolean;
  /** 编辑目标列表行,null 表示新建 */
  expense: Expense | null;
}

interface Emits {
  (e: 'update:open', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const authStore = useAuthStore();

const formRef = ref();
const loading = ref(false);

// ============ 表单状态 ============
const form = ref({
  expense_type: ExpenseType.WITH_INVOICE as number,
  expense_title: '',
  amount: null as number | null,
  expense_date: dayjs() as Dayjs | null,
  category: undefined as number | undefined,
  payee: '',
  payment_method: undefined as number | undefined,
  channel: undefined as number | undefined,
  order_no: '',
  remark: '',
});

/** 是否编辑模式 */
const isEdit = computed(() => !!props.expense);

/** 金额校验规则:必填且大于 0,最多两位小数(由输入组件 precision 保证) */
const amountRules = [
  { required: true, message: '请输入支出金额' },
  {
    validator: (_rule: unknown, value: number | null) => {
      if (value === null || value === undefined) return Promise.resolve();
      if (value <= 0) return Promise.reject('支出金额必须大于0');
      return Promise.resolve();
    },
  },
];

// 枚举下拉选项
const categoryOptions = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const channelOptions = Object.entries(EXPENSE_CHANNEL_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));
const paymentMethodOptions = Object.entries(EXPENSE_PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  label,
  value: Number(value),
}));

// ============ 发票上传(类型1,复用单个发票识别弹窗) ============
/** 单个发票识别弹窗可见性 */
const invoiceUploadOpen = ref(false);
/** 本次识别入库的发票(新建时待提交,编辑时待换绑) */
const newInvoice = ref<InvoiceBrief | null>(null);
/** 编辑回显的费用单详情(含已绑发票摘要) */
const detailInvoice = ref<ExpenseDetail | null>(null);

/** 已绑定的发票号码(编辑态从详情回显) */
const boundInvoiceNumber = computed(() => {
  const detail = detailInvoice.value;
  return detail ? detail.invoice_number : null;
});

/** 打开单个发票识别弹窗 */
const openInvoiceUpload = () => {
  invoiceUploadOpen.value = true;
};

/**
 * 单个发票识别完成回调:选取新入库/已存在的第一张作为待关联发票
 * 发票性质固定实开,发票用途在识别弹窗内选择
 */
const handleInvoiceUploaded = (result: InvoiceUploadResult) => {
  const brief = result.invoices[0] || result.existed[0];
  if (!brief) {
    return;
  }
  newInvoice.value = brief;
  message.success(brief.is_duplicate ? '发票已存在,已选用该发票' : '发票识别入库成功');
};

/** 清除本次识别结果(重新选择) */
const clearNewInvoice = () => {
  newInvoice.value = null;
};

// ============ 采购明细(交互与 StockInModal 批量模式一致) ============
/** 零件/规格选项引用数据 */
const typesLoading = ref(false);
const allTypes = ref<ItemTypeNode[]>([]);
const parentTypes = ref<ItemTypeNode[]>([]);
const itemsLoading = ref(false);
/** 全量零件(内嵌规格列表,前端筛选) */
const allItems = ref<InventoryItem[]>([]);

/** 加载零件类型树(用于明细行类型筛选) */
const loadTypes = async () => {
  typesLoading.value = true;
  try {
    const res = await inventoryApi.listItemTypes();
    allTypes.value = (res.datas || res) as ItemTypeNode[];
    parentTypes.value = allTypes.value;
  } catch {
    allTypes.value = [];
    parentTypes.value = [];
  } finally {
    typesLoading.value = false;
  }
};

/** 加载全量零件(一次拉取,前端搜索/筛选) */
const loadAllItems = async () => {
  itemsLoading.value = true;
  try {
    const res = await inventoryApi.listItems({ pageIndex: 1, pageSize: 1000 });
    allItems.value = res.datas.items || [];
  } catch {
    allItems.value = [];
  } finally {
    itemsLoading.value = false;
  }
};

/** 明细行本地结构 */
interface ItemRow {
  parentTypeId: string | undefined;
  childTypeId: string | undefined;
  childTypes: ItemTypeNode[];
  item_id: string;
  spec_id: string;
  quantity: number;
  price: number | null;
  remark: string;
}

const itemRows = ref<ItemRow[]>([]);

function createEmptyRow(): ItemRow {
  return {
    parentTypeId: undefined,
    childTypeId: undefined,
    childTypes: [],
    item_id: '',
    spec_id: '',
    quantity: 1,
    price: null,
    remark: '',
  };
}

const addItemRow = () => {
  itemRows.value.push(createEmptyRow());
};

const removeItemRow = (idx: number) => {
  itemRows.value.splice(idx, 1);
};

/** 零件下拉搜索过滤(按 label 模糊匹配) */
const filterOption = (input: string, option: { label: string }) =>
  option.label.toLowerCase().includes(input.toLowerCase());

/** 按行内选择的类型过滤零件选项 */
const getFilteredItemOptions = (row: ItemRow) => {
  const typeId = row.childTypeId || row.parentTypeId;
  let items = allItems.value;
  if (typeId) {
    items = items.filter((item) => {
      if (item.type_id === typeId) return true;
      const parent = allTypes.value.find((t) => t.type_id === typeId);
      if (parent?.children?.some((c) => c.type_id === item.type_id)) return true;
      return false;
    });
  }
  return items.map((i) => ({ label: `${i.name} (${i.code})`, value: i.item_id }));
};

/** 行内零件对象(未选中时为 undefined) */
const rowItem = (row: ItemRow) => allItems.value.find((i) => i.item_id === row.item_id);

/** 该行零件是否需要选择规格(单一空规格视为默认规格) */
function needsSpec(row: ItemRow) {
  const specs = rowItem(row)?.specs;
  if (!specs?.length) return false;
  return !(specs.length === 1 && specs[0]?.spec === '');
}

/** 行内规格下拉选项 */
function specOptionsFor(row: ItemRow) {
  const specs = rowItem(row)?.specs || [];
  return specs.map((s) => ({
    label: `${s.spec || '默认'} (库存: ${s.current_stock})`,
    value: s.spec_id,
  }));
}

const handleRowParentTypeChange = (idx: number, value: string | undefined) => {
  const row = itemRows.value[idx];
  if (!row) return;
  row.parentTypeId = value;
  row.childTypeId = undefined;
  row.item_id = '';
  row.spec_id = '';
  row.price = null;
  if (value) {
    const parent = allTypes.value.find((t) => t.type_id === value);
    row.childTypes = parent?.children || [];
  } else {
    row.childTypes = [];
  }
};

const handleRowChildTypeChange = (idx: number, value: string | undefined) => {
  const row = itemRows.value[idx];
  if (!row) return;
  row.childTypeId = value;
  row.item_id = '';
  row.spec_id = '';
  row.price = null;
};

/** 选择零件后重置规格/单价;单一空规格自动选中默认规格 */
const handleRowItemChange = (idx: number, value: string) => {
  const row = itemRows.value[idx];
  if (!row) return;
  row.item_id = value;
  row.spec_id = '';
  row.price = null;
  const specs = rowItem(row)?.specs;
  const defaultSpec = specs?.[0];
  if (specs?.length === 1 && defaultSpec?.spec === '') {
    row.spec_id = defaultSpec.spec_id;
    fillPriceFromSpec(row);
  }
};

/** 选择规格后带出参考单价(单价未手填时) */
const handleRowSpecChange = (idx: number, value: string) => {
  const row = itemRows.value[idx];
  if (!row) return;
  row.spec_id = value;
  fillPriceFromSpec(row);
};

/** 用规格参考价填充行单价 */
const fillPriceFromSpec = (row: ItemRow) => {
  const spec = rowItem(row)?.specs?.find((s) => s.spec_id === row.spec_id);
  if (spec && spec.price !== null && spec.price !== undefined && spec.price > 0 && !row.price) {
    row.price = spec.price;
  }
};

/** 行小计 = 数量 × 单价(保留两位小数) */
const rowAmount = (row: ItemRow): number | null => {
  if (!row.quantity || row.price === null || row.price === undefined) return null;
  return Math.round(row.quantity * row.price * 100) / 100;
};

/** 明细合计(用于金额填充与汇总展示) */
const itemsTotal = computed(() => {
  let total = 0;
  let hasAny = false;
  for (const row of itemRows.value) {
    const amount = rowAmount(row);
    if (amount !== null) {
      total += amount;
      hasAny = true;
    }
  }
  return hasAny ? Math.round(total * 100) / 100 : null;
});

/** 用明细合计回填支出金额 */
const fillAmountFromItems = () => {
  if (itemsTotal.value) {
    form.value.amount = itemsTotal.value;
  }
};

/** 行是否完全未填写(未选零件/规格/单价且无备注),采购明细为可选项,空行在提交时忽略 */
const isRowEmpty = (row: ItemRow) =>
  !row.item_id && !row.spec_id && row.price === null && !row.remark;

/** 过滤掉空行后的有效明细行 */
const effectiveRows = computed(() => itemRows.value.filter((row) => !isRowEmpty(row)));

/** 明细行前端校验:必选/数量/单价/去重,返回错误提示或 null */
const validateItemRows = (rows: ItemRow[]): string | null => {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (!row.item_id) return `明细第 ${i + 1} 行未选择零件`;
    if (needsSpec(row) && !row.spec_id) return `明细第 ${i + 1} 行未选择规格`;
    if (!row.quantity || row.quantity < 1) return `明细第 ${i + 1} 行数量无效`;
    if (row.price === null || row.price === undefined || row.price < 0) return `明细第 ${i + 1} 行单价无效`;
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.item_id}|${row.spec_id}`;
    if (seen.has(key)) return '采购明细存在重复的(零件+规格)';
    seen.add(key);
  }
  return null;
};

/** 明细行转提交结构 */
const buildItemsPayload = (rows: ItemRow[]) =>
  rows.map((row) => ({
    item_id: row.item_id,
    spec_id: row.spec_id,
    quantity: row.quantity,
    price: row.price as number,
    remark: row.remark || undefined,
  }));

// ============ 编辑回显 ============

/** 详情明细行转本地行结构(带出零件所属类型便于筛选) */
const mapDetailRow = (detail: ExpenseDetailItem): ItemRow => {
  const item = allItems.value.find((i) => i.item_id === detail.item_id);
  const row = createEmptyRow();
  if (item) {
    row.parentTypeId = allTypes.value.find((t) => t.children?.some((c) => c.type_id === item.type_id))?.type_id;
    row.childTypeId = item.type_id;
    row.childTypes = allTypes.value.find((t) => t.type_id === row.parentTypeId)?.children || [];
  }
  row.item_id = detail.item_id;
  row.spec_id = detail.spec_id;
  row.quantity = detail.quantity;
  row.price = Number(detail.price);
  row.remark = detail.remark || '';
  return row;
};

// ============ 提交 ============
const handleSubmit = async () => {
  if (!form.value.expense_date) {
    message.warning('请选择支出日期');
    return;
  }
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  // 采购明细为可选项:空行自动忽略,仅校验已填写内容的行
  const rows = effectiveRows.value;
  const hasItems = rows.length > 0;
  if (hasItems) {
    const err = validateItemRows(rows);
    if (err) {
      message.warning(err);
      return;
    }
  }

  // 关联发票为选填:本次上传识别的新发票优先,其次为编辑时已绑定的发票
  const invoiceId = newInvoice.value?.invoice_id || (isEdit.value ? detailInvoice.value?.invoice_id : undefined);

  const dateStr = form.value.expense_date.format('YYYY-MM-DD');
  const common = {
    expense_title: form.value.expense_title || undefined,
    amount: form.value.amount as number,
    expense_date: dateStr,
    channel: form.value.channel,
    order_no: form.value.order_no || undefined,
    category: form.value.category,
    payee: form.value.payee || undefined,
    payment_method: form.value.payment_method,
    remark: form.value.remark || undefined,
    items: hasItems ? buildItemsPayload(rows) : undefined,
  };

  loading.value = true;
  try {
    if (isEdit.value && props.expense) {
      // 修改:费用类型/编号不可改;换绑发票时 update 传入新 invoice_id
      const payload = {
        expense_id: props.expense.expense_id,
        ...common,
        invoice_id: invoiceId || undefined,
      };
      const res = await expenseApi.update(payload);
      if (res.result === 0) {
        message.success('修改成功');
        emit('update:open', false);
        emit('success');
      }
    } else {
      const userId = authStore.user?.user_id;
      if (!userId) {
        message.error('用户信息缺失,请重新登录后再试');
        return;
      }
      const res = await expenseApi.create({
        expense_type: form.value.expense_type,
        user_id: userId,
        ...common,
        // 类型2-无发票支出不传发票
        invoice_id: form.value.expense_type === ExpenseType.WITH_INVOICE ? invoiceId || undefined : undefined,
      });
      if (res.result === 0) {
        message.success(`新建成功,费用单编号:${res.datas.expense_no}`);
        emit('update:open', false);
        emit('success');
      }
    }
  } catch {
    // 失败已由全局拦截器提示
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  emit('update:open', false);
};

// ============ 打开时初始化 ============
const resetForm = () => {
  form.value = {
    expense_type: ExpenseType.WITH_INVOICE,
    expense_title: '',
    amount: null,
    expense_date: dayjs(),
    category: undefined,
    payee: '',
    payment_method: undefined,
    channel: undefined,
    order_no: '',
    remark: '',
  };
  itemRows.value = [];
  newInvoice.value = null;
  detailInvoice.value = null;
  invoiceUploadOpen.value = false;
  formRef.value?.clearValidate();
};

watch(
  () => props.open,
  async (val) => {
    if (!val) return;
    resetForm();
    loadTypes();
    loadAllItems();
    if (props.expense) {
      // 编辑:加载详情回显(明细行的类型筛选依赖零件/类型数据,稍后映射)
      try {
        const res = await expenseApi.detail(props.expense.expense_id);
        const detail = res.datas;
        detailInvoice.value = detail;
        form.value.expense_title = detail.expense_title || '';
        form.value.amount = Number(detail.amount);
        form.value.expense_date = dayjs(detail.expense_date.slice(0, 10));
        form.value.category = detail.category ?? undefined;
        form.value.payee = detail.payee || '';
        form.value.payment_method = detail.payment_method ?? undefined;
        form.value.channel = detail.channel ?? undefined;
        form.value.order_no = detail.order_no || '';
        form.value.remark = detail.remark || '';
        // 等基础数据就绪后映射明细行,保证类型/零件回显正确
        if (allItems.value.length === 0) {
          await loadAllItems();
        }
        if (allTypes.value.length === 0) {
          await loadTypes();
        }
        itemRows.value = (detail.items || []).map(mapDetailRow);
      } catch {
        // 详情加载失败由拦截器提示,关闭弹窗避免提交脏数据
        emit('update:open', false);
      }
    } else {
      addItemRow();
    }
  },
);
</script>

<style scoped lang="scss">
.invoice-bound {
  margin-bottom: 8px;
}

.invoice-link {
  margin: 0 8px;
}

.invoice-upload-area {
  margin-top: 4px;
}

.invoice-duplicate-tag {
  margin-left: 8px;
}

.amount-text {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

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

/* 明细行表头与数据行共用栅格 */
.items-head,
.batch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.items-head {
  font-size: 12px;
  color: #71717a;
}

.col-type {
  width: 150px;
  flex-shrink: 0;
}

.col-type-child {
  width: 120px;
  flex-shrink: 0;
}

.col-item {
  flex: 1;
  min-width: 0;
}

.col-spec {
  width: 190px;
  flex-shrink: 0;
}

.spec-empty {
  color: #a1a1aa;
  font-size: 12px;
}

.col-qty {
  width: 80px;
  flex-shrink: 0;
}

.col-price {
  width: 100px;
  flex-shrink: 0;
}

.col-amount {
  width: 70px;
  flex-shrink: 0;
  text-align: right;
}

.col-remark {
  width: 130px;
  flex-shrink: 0;
}

.col-del {
  flex-shrink: 0;
  padding: 0 8px;
}
</style>

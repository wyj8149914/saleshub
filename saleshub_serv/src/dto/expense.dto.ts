import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { PageDto } from './base.dto';

/** 支出费用单金额上限(NUMERIC(12,2) 最大 9999999999.99) */
export const EXPENSE_MAX_AMOUNT = 9999999999.99;

/**
 * 采购明细行输入DTO(仅费用类型1-有发票采购使用)
 *
 * 行金额(quantity*price)由查询计算,不落库
 */
export class ExpenseItemInputDto {
    /** 库存零件ID(inventory_item.item_id) */
    @IsString()
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    /** 库存规格ID(inventory_item_spec.spec_id) */
    @IsString()
    @IsNotEmpty({ message: '规格ID不能为空' })
    spec_id: string;

    /** 采购数量,正整数 */
    @Type(() => Number)
    @IsInt({ message: '采购数量必须为整数' })
    @Min(1, { message: '采购数量必须大于0' })
    quantity: number;

    /** 采购单价,最多两位小数 */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: '采购单价最多两位小数' })
    @Min(0, { message: '采购单价不能为负数' })
    price: number;

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;
}

/**
 * 新建支出费用单请求DTO(POST /expense/create)
 *
 * 费用类型1-有发票采购:必须关联发票(invoice_id)、采购来源渠道(channel)、采购明细(items),
 * 发票通过已有 /invoice/upload 上传识别后回填其ID
 * 费用类型2-无发票支出:不关联发票与明细,记录金额/分类/收款方/付款方式
 */
export class CreateExpenseDto {
    /** 费用类型:1-有发票采购,2-无发票支出 */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '费用类型只能为1-有发票采购或2-无发票支出' })
    expense_type: number;

    /** 费用名称(可选) */
    @IsString()
    @MaxLength(100, { message: '费用名称长度不能超过100' })
    @IsOptional()
    expense_title?: string;

    /** 创建人用户ID */
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    /** 支出金额,最多两位小数 */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: '支出金额最多两位小数' })
    @Min(0, { message: '支出金额不能为负数' })
    amount: number;

    /** 支出日期,格式 YYYY-MM-DD */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '支出日期格式必须为YYYY-MM-DD' })
    expense_date: string;

    /** 关联发票ID(类型1必填,发票经 /invoice/upload 识别后回填;类型2不能传) */
    @IsString()
    @IsOptional()
    invoice_id?: string;

    /** 采购来源渠道:1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他(类型1必填) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5, 99], {
        message: '采购来源渠道只能为1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他',
    })
    @IsOptional()
    channel?: number;

    /** 电商订单号(淘宝/京东等平台订单,线下采购可不传) */
    @IsString()
    @MaxLength(50, { message: '电商订单号长度不能超过50' })
    @IsOptional()
    order_no?: string;

    /** 支出分类:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他(可选) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5, 6, 7], {
        message:
            '支出分类只能为1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他',
    })
    @IsOptional()
    category?: number;

    /** 收款方/对方名称(无发票线下付款场景常用,可选) */
    @IsString()
    @MaxLength(100, { message: '收款方长度不能超过100' })
    @IsOptional()
    payee?: string;

    /** 付款方式:1-现金,2-微信,3-支付宝,4-银行转账,5-其他(可选) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5], { message: '付款方式只能为1-现金,2-微信,3-支付宝,4-银行转账,5-其他' })
    @IsOptional()
    payment_method?: number;

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;

    /** 采购明细行列表(类型1必填,1~100行;类型2不能传) */
    @IsArray({ message: '采购明细必须为数组' })
    @ArrayMinSize(1, { message: '采购明细不能为空' })
    @ArrayMaxSize(100, { message: '采购明细最多100行' })
    @ValidateNested({ each: true, message: '采购明细行参数错误' })
    @Type(() => ExpenseItemInputDto)
    @IsOptional()
    items?: ExpenseItemInputDto[];
}

/**
 * 修改支出费用单请求DTO(POST /expense/update)
 *
 * 费用类型与费用单编号不允许修改;全部字段可选,仅更新传入的字段;
 * 类型1传入 items 时整批替换采购明细(旧行置为停用,新行重新写入)
 */
export class UpdateExpenseDto {
    /** 支出费用单ID */
    @IsString()
    @IsNotEmpty({ message: '费用单ID不能为空' })
    expense_id: string;

    /** 费用名称(可选) */
    @IsString()
    @MaxLength(100, { message: '费用名称长度不能超过100' })
    @IsOptional()
    expense_title?: string;

    /** 支出金额,最多两位小数(可选) */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: '支出金额最多两位小数' })
    @Min(0, { message: '支出金额不能为负数' })
    @IsOptional()
    amount?: number;

    /** 支出日期,格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '支出日期格式必须为YYYY-MM-DD' })
    @IsOptional()
    expense_date?: string;

    /** 关联发票ID(可选,类型1专用;重新关联走 /expense/bindInvoice 亦可) */
    @IsString()
    @IsOptional()
    invoice_id?: string;

    /** 采购来源渠道:1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他(可选) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5, 99], {
        message: '采购来源渠道只能为1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他',
    })
    @IsOptional()
    channel?: number;

    /** 电商订单号(淘宝/京东等平台订单,线下采购可不传) */
    @IsString()
    @MaxLength(50, { message: '电商订单号长度不能超过50' })
    @IsOptional()
    order_no?: string;

    /** 支出分类:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他(可选) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5, 6, 7], {
        message:
            '支出分类只能为1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他',
    })
    @IsOptional()
    category?: number;

    /** 收款方/对方名称(可选) */
    @IsString()
    @MaxLength(100, { message: '收款方长度不能超过100' })
    @IsOptional()
    payee?: string;

    /** 付款方式:1-现金,2-微信,3-支付宝,4-银行转账,5-其他(可选) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5], { message: '付款方式只能为1-现金,2-微信,3-支付宝,4-银行转账,5-其他' })
    @IsOptional()
    payment_method?: number;

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;

    /** 采购明细行列表(可选,类型1专用,传入时整批替换,1~100行) */
    @IsArray({ message: '采购明细必须为数组' })
    @ArrayMinSize(1, { message: '采购明细不能为空' })
    @ArrayMaxSize(100, { message: '采购明细最多100行' })
    @ValidateNested({ each: true, message: '采购明细行参数错误' })
    @Type(() => ExpenseItemInputDto)
    @IsOptional()
    items?: ExpenseItemInputDto[];
}

/**
 * 支出费用单列表查询DTO(GET /expense/list,Query 参数)
 *
 * 只查正常状态(status=1)费用单;筛选条件均可选
 */
export class ListExpenseDto extends PageDto {
    /** 费用类型:1-有发票采购,2-无发票支出(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '费用类型只能为1-有发票采购或2-无发票支出' })
    @IsOptional()
    expense_type: number;

    /** 采购来源渠道:1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5, 99], {
        message: '采购来源渠道只能为1-淘宝,2-京东,3-拼多多,4-抖音,5-线下,99-其他',
    })
    @IsOptional()
    channel: number;

    /** 支出分类:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5, 6, 7], {
        message:
            '支出分类只能为1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费,6-软件服务费,7-其他',
    })
    @IsOptional()
    category: number;

    /** 付款方式:1-现金,2-微信,3-支付宝,4-银行转账,5-其他(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5], { message: '付款方式只能为1-现金,2-微信,3-支付宝,4-银行转账,5-其他' })
    @IsOptional()
    payment_method: number;

    /** 支出日期起(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '支出日期起格式必须为YYYY-MM-DD' })
    @IsOptional()
    start_date: string;

    /** 支出日期止(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '支出日期止格式必须为YYYY-MM-DD' })
    @IsOptional()
    end_date: string;

    /** 关键字,对费用单编号/收款方模糊匹配(可选) */
    @IsString()
    @MaxLength(100, { message: '关键字长度不能超过100' })
    @IsOptional()
    keyword: string;
}

/**
 * 支出费用单详情请求DTO(GET /expense/detail,Query 参数)
 */
export class ExpenseIdDto {
    @IsString()
    @IsNotEmpty({ message: '费用单ID不能为空' })
    expense_id: string;
}

/**
 * 支出费用单关联发票请求DTO(POST /expense/bindInvoice)
 *
 * 上传发票复用已有 /invoice/upload 识别入库,拿到 invoice_id 后调本接口回填;
 * 一张发票只能被一个费用单关联(1:1),重复关联同一发票幂等返回成功
 */
export class BindInvoiceDto {
    /** 支出费用单ID */
    @IsString()
    @IsNotEmpty({ message: '费用单ID不能为空' })
    expense_id: string;

    /** 关联发票ID(/invoice/upload 返回的发票主键) */
    @IsString()
    @IsNotEmpty({ message: '发票ID不能为空' })
    invoice_id: string;
}

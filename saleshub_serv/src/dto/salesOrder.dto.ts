import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    Min,
} from 'class-validator';
import { PageDto } from './base.dto';

/** 销售订单金额上限(NUMERIC(12,2) 最大 9999999999.99) */
export const ORDER_MAX_AMOUNT = 9999999999.99;

/**
 * 新建销售订单请求DTO(POST /order/create)
 *
 * 仅记整单信息(客户/联系方式/金额/交货日期),不拆产品明细行;
 * 订单编号 XS+6位递增数字 由服务端生成,pay_status 初始为 1-未收款,
 * order_status 初始为 1-待交货
 */
export class CreateOrderDto {
    /** 创建人用户ID */
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    /** 订单名称 */
    @IsString()
    @IsNotEmpty({ message: '订单名称不能为空' })
    @MaxLength(100, { message: '订单名称长度不能超过100' })
    order_title: string;

    /** 客户名称 */
    @IsString()
    @IsNotEmpty({ message: '客户名称不能为空' })
    @MaxLength(100, { message: '客户名称长度不能超过100' })
    customer_name: string;

    /** 客户联系方式 */
    @IsString()
    @IsNotEmpty({ message: '客户联系方式不能为空' })
    @MaxLength(20, { message: '客户联系方式长度不能超过20' })
    customer_phone: string;

    /** 收货地址(可选) */
    @IsString()
    @MaxLength(255, { message: '收货地址长度不能超过255' })
    @IsOptional()
    address?: string;

    /** 订单金额,最多两位小数 */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: '订单金额最多两位小数' })
    @Min(0, { message: '订单金额不能为负数' })
    amount: number;

    /** 交货日期,格式 YYYY-MM-DD */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '交货日期格式必须为YYYY-MM-DD' })
    delivery_date: string;

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;

    /** 合同文件ID(可选,文件经 /file/upload 上传后回填 minio_file.relation_id) */
    @IsString()
    @IsOptional()
    contract_file_id?: string;
}

/**
 * 修改销售订单请求DTO(POST /order/update)
 *
 * 仅可修改基本信息(客户/联系方式/金额/交货日期/备注/地址/合同文件);
 * 订单编号与创建人不可改;交货状态与已收金额走单独接口(/order/updateStatus、/order/receive);
 * 全部业务字段可选,仅更新传入的字段;修改订单金额时按已收金额重新推导收款状态
 */
export class UpdateOrderDto {
    /** 销售订单ID */
    @IsString()
    @IsNotEmpty({ message: '订单ID不能为空' })
    order_id: string;

    /** 订单名称(可选) */
    @IsString()
    @MaxLength(100, { message: '订单名称长度不能超过100' })
    @IsOptional()
    order_title?: string;

    /** 客户名称(可选) */
    @IsString()
    @MaxLength(100, { message: '客户名称长度不能超过100' })
    @IsOptional()
    customer_name?: string;

    /** 客户联系方式(可选) */
    @IsString()
    @MaxLength(20, { message: '客户联系方式长度不能超过20' })
    @IsOptional()
    customer_phone?: string;

    /** 收货地址(可选) */
    @IsString()
    @MaxLength(255, { message: '收货地址长度不能超过255' })
    @IsOptional()
    address?: string;

    /** 订单金额,最多两位小数(可选;修改后按已收金额重新推导收款状态) */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: '订单金额最多两位小数' })
    @Min(0, { message: '订单金额不能为负数' })
    @IsOptional()
    amount?: number;

    /** 交货日期,格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '交货日期格式必须为YYYY-MM-DD' })
    @IsOptional()
    delivery_date?: string;

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;

    /** 合同文件ID(可选) */
    @IsString()
    @IsOptional()
    contract_file_id?: string;
}

/**
 * 销售订单列表查询DTO(GET /order/list,Query 参数)
 *
 * 只查正常状态(status=1)订单;筛选条件均可选
 */
export class ListOrderDto extends PageDto {
    /** 订单状态:1-待交货,2-已交货,3-已完成,4-已取消(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4], { message: '订单状态只能为1-待交货,2-已交货,3-已完成,4-已取消' })
    @IsOptional()
    order_status: number;

    /** 收款状态:1-未收款,2-部分收款,3-已收款(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3], { message: '收款状态只能为1-未收款,2-部分收款,3-已收款' })
    @IsOptional()
    pay_status: number;

    /** 交货日期起(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '交货日期起格式必须为YYYY-MM-DD' })
    @IsOptional()
    start_date: string;

    /** 交货日期止(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '交货日期止格式必须为YYYY-MM-DD' })
    @IsOptional()
    end_date: string;

    /** 关键字,对订单编号/客户名称模糊匹配(可选) */
    @IsString()
    @MaxLength(100, { message: '关键字长度不能超过100' })
    @IsOptional()
    keyword: string;
}

/**
 * 销售订单详情请求DTO(GET /order/detail,Query 参数)
 */
export class OrderIdDto {
    /** 销售订单ID */
    @IsString()
    @IsNotEmpty({ message: '订单ID不能为空' })
    order_id: string;
}

/**
 * 销售订单收款请求DTO(POST /order/receive)
 *
 * 传本次收款金额,服务端累加到已收金额;
 * 累加后不得超过订单金额;pay_status 由已收/订单金额自动推导落库
 */
export class ReceiveOrderDto {
    /** 销售订单ID */
    @IsString()
    @IsNotEmpty({ message: '订单ID不能为空' })
    order_id: string;

    /** 本次收款金额,最多两位小数,必须大于0 */
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 }, { message: '收款金额最多两位小数' })
    @Min(0.01, { message: '收款金额必须大于0' })
    received_amount: number;
}

/**
 * 销售订单状态变更请求DTO(POST /order/updateStatus)
 *
 * 已取消(4)为终态不可再变更,其余状态可自由设置
 */
export class UpdateOrderStatusDto {
    /** 销售订单ID */
    @IsString()
    @IsNotEmpty({ message: '订单ID不能为空' })
    order_id: string;

    /** 目标订单状态:1-待交货,2-已交货,3-已完成,4-已取消 */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4], { message: '订单状态只能为1-待交货,2-已交货,3-已完成,4-已取消' })
    order_status: number;
}

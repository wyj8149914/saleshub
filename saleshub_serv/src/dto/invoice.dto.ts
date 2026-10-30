import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator';
import { PageDto } from './base.dto';

/**
 * 发票OCR识别请求DTO
 */
export class InvoiceOcrDto {
    @IsString()
    @IsNotEmpty({ message: '文件ID不能为空' })
    file_id: string;

    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    @IsString()
    @IsOptional()
    biz_type?: string;

    @IsString()
    @IsOptional()
    biz_id?: string;

    @IsString()
    @IsOptional()
    tag?: string;

    /** 发票性质:1-实开,2-进项抵扣(可选,不传则入库留空) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '发票性质只能为1-实开或2-进项抵扣' })
    @IsOptional()
    invoice_nature: number;

    /** 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费(可选,不传则入库留空) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5], {
        message: '发票用途只能为1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费',
    })
    @IsOptional()
    invoice_purpose: number;
}

/**
 * 发票上传识别请求DTO(单文件/批量上传共用,multipart 表单文本字段)
 *
 * 发票性质与发票用途均必填,所有上传文件共用同一组业务参数
 */
export class InvoiceUploadDto {
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    @IsString()
    @IsOptional()
    tag?: string;

    @IsString()
    @IsOptional()
    biz_type?: string;

    @IsString()
    @IsOptional()
    biz_id?: string;

    /** 发票性质:1-实开,2-进项抵扣 */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '发票性质只能为1-实开或2-进项抵扣' })
    invoice_nature: number;

    /** 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费 */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5], {
        message: '发票用途只能为1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费',
    })
    invoice_purpose: number;
}

/**
 * 发票列表查询DTO(GET /invoice/list,Query 参数)
 *
 * 不按用户过滤,查询全部正常状态发票;筛选条件均可选
 */
export class ListInvoiceDto extends PageDto {
    /** 发票性质:1-实开,2-进项抵扣(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '发票性质只能为1-实开或2-进项抵扣' })
    @IsOptional()
    invoice_nature: number;

    /** 发票用途:1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3, 4, 5], {
        message: '发票用途只能为1-办公资产费,2-差旅费,3-成本费,4-接待费,5-快递费',
    })
    @IsOptional()
    invoice_purpose: number;

    /** 开票日期起(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '开票日期起格式必须为YYYY-MM-DD' })
    @IsOptional()
    start_date: string;

    /** 开票日期止(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '开票日期止格式必须为YYYY-MM-DD' })
    @IsOptional()
    end_date: string;

    /** 关键字,对发票号码/销售方名称/购买方名称模糊匹配(可选) */
    @IsString()
    @MaxLength(100, { message: '关键字长度不能超过100' })
    @IsOptional()
    keyword: string;

    /** 标签,对标签模糊匹配(可选) */
    @IsString()
    @MaxLength(50, { message: '标签长度不能超过50' })
    @IsOptional()
    tag: string;

    /** 是否报税:1-未报税,2-已报税(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '报税状态只能为1-未报税或2-已报税' })
    @IsOptional()
    is_tax_filed: number;
}

/**
 * 发票批量报税请求DTO(POST /invoice/taxFile)
 *
 * 列表多选发票后批量设置报税状态;取消报税时同时清空报税时间与操作人
 */
export class TaxFileInvoiceDto {
    /** 发票ID列表(1~200个) */
    @IsArray()
    @ArrayMinSize(1, { message: '发票ID列表不能为空' })
    @ArrayMaxSize(200, { message: '单次最多操作200张发票' })
    @IsString({ each: true })
    @IsNotEmpty({ each: true, message: '发票ID不能为空字符串' })
    invoice_ids: string[];

    /** 目标报税状态:1-未报税(取消报税),2-已报税 */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '报税状态只能为1-未报税或2-已报税' })
    is_tax_filed: number;

    /** 操作人用户ID */
    @IsString()
    @IsNotEmpty({ message: '操作人用户ID不能为空' })
    user_id: string;
}

/**
 * 发票详情请求DTO(GET /invoice/detail,Query 参数)
 */
export class InvoiceIdDto {
    @IsString()
    @IsNotEmpty({ message: '发票ID不能为空' })
    invoice_id: string;
}

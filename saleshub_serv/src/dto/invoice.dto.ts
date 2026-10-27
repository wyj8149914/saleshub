import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

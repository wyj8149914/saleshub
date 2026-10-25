import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}

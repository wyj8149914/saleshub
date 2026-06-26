import { Type } from 'class-transformer';
import {
    IsNotEmpty, IsOptional, IsInt, Min, MaxLength, IsArray, ValidateNested, Matches,
} from 'class-validator';
import { PageDto } from './base.dto';

export class StockInDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '入库规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '入库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '入库数量必须是整数' })
    @Min(1, { message: '入库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '入库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '入库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(32, { message: '照片ID长度不能超过32' })
    photo_id: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockInItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '入库规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '入库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '入库数量必须是整数' })
    @Min(1, { message: '入库数量不能小于1' })
    quantity: number;
}

export class StockInBatchDto {
    @IsArray({ message: '入库零件列表必须是数组' })
    @IsNotEmpty({ message: '入库零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockInItemEntryDto)
    items: StockInItemEntryDto[];

    @IsNotEmpty({ message: '入库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '入库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(32, { message: '照片ID长度不能超过32' })
    photo_id: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockOutDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '出库规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '出库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '出库数量必须是整数' })
    @Min(1, { message: '出库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '出库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '出库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockOutItemEntryDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '出库规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '出库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '出库数量必须是整数' })
    @Min(1, { message: '出库数量不能小于1' })
    quantity: number;
}

export class StockOutBatchDto {
    @IsArray({ message: '出库零件列表必须是数组' })
    @IsNotEmpty({ message: '出库零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockOutItemEntryDto)
    items: StockOutItemEntryDto[];

    @IsNotEmpty({ message: '出库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '出库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockOutByProductDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsNotEmpty({ message: '出库产品数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '出库产品数量必须是整数' })
    @Min(1, { message: '出库产品数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '出库日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '出库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockCheckSpecDto {
    @IsNotEmpty({ message: '盘点规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '盘点后库存不能为空' })
    @Type(() => Number)
    @IsInt({ message: '盘点后库存必须是整数' })
    @Min(0, { message: '盘点后库存不能小于0' })
    after_stock: number;
}

export class StockCheckDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsArray({ message: '盘点规格列表必须是数组' })
    @IsNotEmpty({ message: '盘点规格列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => StockCheckSpecDto)
    specs: StockCheckSpecDto[];

    @IsNotEmpty({ message: '盘点日期不能为空' })
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '盘点日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class ListStockHistoryDto extends PageDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsOptional()
    spec_id?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '开始日期格式不正确' })
    start_date?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '结束日期格式不正确' })
    end_date?: string;
}

export class ListStockInRecordsDto extends PageDto {
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '开始日期格式不正确' })
    start_date?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '结束日期格式不正确' })
    end_date?: string;

    @IsOptional()
    @MaxLength(32, { message: '零件ID长度不能超过32' })
    item_id?: string;

    @IsOptional()
    @MaxLength(32, { message: '规格ID长度不能超过32' })
    spec_id?: string;

    @IsOptional()
    @MaxLength(50, { message: '记录编号长度不能超过50' })
    record_no?: string;
}

export class ListStockOutRecordsDto extends PageDto {
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '开始日期格式不正确' })
    start_date?: string;

    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '结束日期格式不正确' })
    end_date?: string;

    @IsOptional()
    @MaxLength(32, { message: '零件ID长度不能超过32' })
    item_id?: string;

    @IsOptional()
    @MaxLength(32, { message: '规格ID长度不能超过32' })
    spec_id?: string;

    @IsOptional()
    @MaxLength(50, { message: '记录编号长度不能超过50' })
    record_no?: string;
}

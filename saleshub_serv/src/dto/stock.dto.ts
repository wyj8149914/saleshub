import { Type } from 'class-transformer';
import {
    IsNotEmpty,
    IsOptional,
    IsInt,
    Min,
    IsDateString,
    MaxLength,
    IsArray,
    ValidateNested,
    IsString,
} from 'class-validator';
import { PageDto } from './base.dto';

export class StockInDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '入库规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

    @IsNotEmpty({ message: '入库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '入库数量必须是整数' })
    @Min(1, { message: '入库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '入库日期不能为空' })
    @IsDateString({}, { message: '入库日期格式不正确' })
    date: string;

    @IsNotEmpty({ message: '照片ID不能为空' })
    @MaxLength(32, { message: '照片ID长度不能超过32' })
    photo_id: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockOutDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '出库规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

    @IsNotEmpty({ message: '出库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '出库数量必须是整数' })
    @Min(1, { message: '出库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '出库日期不能为空' })
    @IsDateString({}, { message: '出库日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockCheckSpecDto {
    @IsNotEmpty({ message: '盘点规格不能为空(零件无规格时传空串)' })
    @IsString()
    @MaxLength(100, { message: '规格长度不能超过100' })
    spec: string;

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
    @IsDateString({}, { message: '盘点日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class ListStockHistoryDto extends PageDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;

    @IsOptional()
    @IsDateString({}, { message: '开始日期格式不正确' })
    start_date?: string;

    @IsOptional()
    @IsDateString({}, { message: '结束日期格式不正确' })
    end_date?: string;
}

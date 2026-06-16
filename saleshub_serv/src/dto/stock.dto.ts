import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsInt, Min, IsDateString, MaxLength } from 'class-validator';
import { PageDto } from './base.dto';

export class StockInDto {
    @IsNotEmpty({ message: '库存件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '入库数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '入库数量必须是整数' })
    @Min(1, { message: '入库数量不能小于1' })
    quantity: number;

    @IsNotEmpty({ message: '入库日期不能为空' })
    @IsDateString({}, { message: '入库日期格式不正确' })
    date: string;

    @IsNotEmpty({ message: '照片URL不能为空' })
    @MaxLength(500, { message: '照片URL长度不能超过500' })
    photo_url: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class StockOutDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsNotEmpty({ message: '库存件ID不能为空' })
    item_id: string;

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

export class StockCheckDto {
    @IsNotEmpty({ message: '库存件ID不能为空' })
    item_id: string;

    @IsNotEmpty({ message: '盘点后库存不能为空' })
    @Type(() => Number)
    @IsInt({ message: '盘点后库存必须是整数' })
    @Min(0, { message: '盘点后库存不能小于0' })
    after_stock: number;

    @IsNotEmpty({ message: '盘点日期不能为空' })
    @IsDateString({}, { message: '盘点日期格式不正确' })
    date: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class ListStockHistoryDto extends PageDto {
    @IsNotEmpty({ message: '库存件ID不能为空' })
    item_id: string;

    @IsOptional()
    @IsDateString({}, { message: '开始日期格式不正确' })
    start_date?: string;

    @IsOptional()
    @IsDateString({}, { message: '结束日期格式不正确' })
    end_date?: string;
}

import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, MaxLength, IsInt, Min, IsIn } from 'class-validator';
import { PageDto } from './base.dto';

export class CreateWarehouseDto {
    @IsNotEmpty({ message: '仓库名称不能为空' })
    @MaxLength(100, { message: '仓库名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(200, { message: '位置长度不能超过200' })
    location?: string;
}

export class UpdateWarehouseDto {
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '仓库名称不能为空' })
    @MaxLength(100, { message: '仓库名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(200, { message: '位置长度不能超过200' })
    location?: string;
}

export class DeleteWarehouseDto {
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
}

export class ListWarehouseDto extends PageDto {
    @IsOptional()
    @IsIn([1, 2], { message: '状态必须是1-正常,2-停用' })
    @Type(() => Number)
    status?: number;
}

export class WarehouseIdDto {
    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;
}

export class AssignSpecWarehouseDto {
    @IsNotEmpty({ message: '规格ID不能为空' })
    spec_id: string;

    @IsNotEmpty({ message: '仓库ID不能为空' })
    warehouse_id: string;

    @IsNotEmpty({ message: '分配数量不能为空' })
    @Type(() => Number)
    @IsInt({ message: '分配数量必须是整数' })
    @Min(1, { message: '分配数量不能小于1' })
    quantity: number;
}

export class ListSpecWarehouseStockDto {
    @IsNotEmpty({ message: '规格ID不能为空' })
    spec_id: string;
}

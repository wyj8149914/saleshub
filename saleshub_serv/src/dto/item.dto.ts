import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsArray, MaxLength, IsIn, IsInt, Min, IsNumber, ValidateNested } from 'class-validator';
import { PageDto } from './base.dto';

export class ItemSpecDto {
    @IsNotEmpty({ message: '规格值不能为空' })
    @MaxLength(100, { message: '规格值长度不能超过100' })
    spec: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: '价格必须是数字' })
    @Min(0, { message: '价格不能小于0' })
    price?: number;
}

export class CreateInventoryItemDto {
    @IsNotEmpty({ message: '类型ID不能为空' })
    type_id: string;

    @IsNotEmpty({ message: '名称不能为空' })
    @MaxLength(100, { message: '名称长度不能超过100' })
    name: string;

    @IsOptional()
    @IsArray({ message: '规格必须是数组' })
    @ValidateNested({ each: true })
    @Type(() => ItemSpecDto)
    specs: ItemSpecDto[];

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0, { message: '预警库存不能小于0' })
    warnStock: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '是否定制必须是1-否,2-是' })
    is_custom?: number;

    @IsOptional()
    @MaxLength(32, { message: '图片ID长度不能超过32' })
    image_id?: string;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class UpdateInventoryItemDto extends CreateInventoryItemDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;
}

export class ListInventoryItemDto extends PageDto {
    @IsOptional()
    type_id?: string;

    @IsOptional()
    name: string;

    @IsOptional()
    code: string;

    @IsOptional()
    @Type(() => Number)
    @IsIn([1, 2], { message: '是否预警必须是1-正常,2-库存预警' })
    isWarning: number;

    @IsOptional()
    @Type(() => Number)
    @IsIn([1, 2], { message: '是否定制必须是1-否,2-是' })
    is_custom?: number;
}

export class ItemIdDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;
}

export class CreateItemTypeDto {
    @IsOptional()
    parent_id?: string;

    @MaxLength(100, { message: '类型名称最多100个字符' })
    type_name: string;

    @IsOptional()
    @IsInt({ message: '排序号必须是整数' })
    sort_order?: number;

    @IsOptional()
    remark?: string;
}

export class UpdateItemTypeDto {
    @IsNotEmpty({ message: '类型ID不能为空' })
    type_id: string;

    @IsNotEmpty({ message: '类型名称不能为空' })
    type_name: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '排序号必须是整数' })
    sort_order?: number;

    @IsOptional()
    remark?: string;
}

export class DeleteItemTypeDto {
    @IsNotEmpty({ message: '类型ID不能为空' })
    type_id: string;
}

export class ListItemTypeDto {
    @IsOptional()
    parent_id?: string;
}

import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, MaxLength, IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { PageDto } from './base.dto';

export class CreateProductDto {
    @IsNotEmpty({ message: '名称不能为空' })
    @MaxLength(100, { message: '名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(500, { message: '描述长度不能超过500' })
    description?: string;
}

export class UpdateProductDto extends CreateProductDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}

export class ListProductDto extends PageDto {
    @IsOptional()
    name: string;

    @IsOptional()
    code: string;
}

export class ProductIdDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}

export class ProductItemEntryDto {
    @IsNotEmpty({ message: '库存件ID不能为空' })
    item_id: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: '单台数量不能小于1' })
    quantity_per_product?: number;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class SetProductItemsDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsArray({ message: '库存件列表必须是数组' })
    @IsNotEmpty({ message: '库存件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => ProductItemEntryDto)
    items: ProductItemEntryDto[];
}

export class ProductItemIdDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}

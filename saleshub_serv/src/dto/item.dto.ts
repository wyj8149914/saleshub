import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsArray, IsNumber, MaxLength, IsIn, IsInt, Min } from 'class-validator';
import { PageDto } from './base.dto';

export class CreateInventoryItemDto {
    @IsNotEmpty({ message: '类型不能为空' })
    @IsIn(['device', 'common'], { message: '类型必须是device或common' })
    type: string;

    @IsNotEmpty({ message: '名称不能为空' })
    @MaxLength(100, { message: '名称长度不能超过100' })
    name: string;

    @IsOptional()
    @IsArray()
    specs: string[];

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1, { message: '预警库存不能小于1' })
    warnStock: number;
}

export class UpdateInventoryItemDto extends CreateInventoryItemDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;
}

export class ListInventoryItemDto extends PageDto {
    @IsOptional()
    @IsIn(['device', 'common'], { message: '类型必须是device或common' })
    type: string;

    @IsOptional()
    name: string;

    @IsOptional()
    code: string;

    @IsOptional()
    @Type(() => Number)
    @IsIn([1, 2], { message: '是否预警必须是1-正常,2-库存预警' })
    isWarning: number;
}

export class ItemIdDto {
    @IsNotEmpty({ message: '零件ID不能为空' })
    item_id: string;
}
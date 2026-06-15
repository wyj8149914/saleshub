import { IsEnum, IsNotEmpty, IsString, IsOptional, IsArray, IsNumber, MaxLength } from 'class-validator';
import { ItemType } from '../../../entity/inventory/inventory-item.entity';

export class CreateInventoryItemDto {
  @IsEnum(ItemType)
  @IsNotEmpty()
  type: ItemType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specs?: string[];

  @IsNumber()
  @IsOptional()
  warnStock?: number;
}

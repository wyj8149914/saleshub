import { Expose } from 'class-transformer';
import { ItemType } from '../../../entity/inventory/inventory-item.entity';

export class ProductResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  description: string;

  @Expose()
  createdAt: Date;
}

export class InventoryItemResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: ItemType;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  productId: string;

  @Expose()
  productName: string;

  @Expose()
  specs: string[];

  @Expose()
  currentStock: number;

  @Expose()
  warnStock: number;

  @Expose()
  isWarning: boolean;

  @Expose()
  createdAt: Date;
}

export class StockHistoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: 'in' | 'out' | 'check';

  @Expose()
  itemId: string;

  @Expose()
  itemName: string;

  @Expose()
  quantity: number;

  @Expose()
  date: Date;

  @Expose()
  remark: string;

  @Expose()
  createdAt: Date;

  @Expose()
  beforeStock: number;

  @Expose()
  afterStock: number;
}

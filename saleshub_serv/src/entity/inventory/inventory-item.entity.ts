import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export enum ItemType {
  DEVICE = 'device',
  COMMON = 'common'
}

@Entity({ schema: 'inventory', name: 'inventory_items' })
export class InventoryItem {
  @PrimaryColumn({ name: 'item_id', type: 'varchar', length: 32 })
  itemId: string;

  @Column({
    type: 'enum',
    enum: ItemType,
    comment: '类型：device-设备件，common-常用件'
  })
  type: ItemType;

  @Column({ type: 'varchar', length: 100, comment: '名称' })
  name: string;

  @Column({ type: 'varchar', length: 50, comment: '编码' })
  code: string;

  @Column({ type: 'varchar', length: 32, nullable: true, comment: '关联产品ID（仅设备件）' })
  productId: string;

  @Column({ type: 'text', array: true, nullable: true, comment: '规格选项（仅常用件）' })
  specs: string[];

  @Column({ type: 'int', default: 0, comment: '当前库存' })
  currentStock: number;

  @Column({ type: 'int', default: 10, comment: '预警阈值' })
  warnStock: number;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne('Product', { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: any;
}

import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

/**
 * 入库记录实体
 */
@Entity({ schema: 'inventory', name: 'stock_in_records' })
export class StockInRecord {
  @PrimaryColumn({ name: 'in_record_id', type: 'varchar', length: 32 })
  inRecordId: string;

  @Column({ name: 'item_id', type: 'varchar', length: 32, comment: '库存件ID' })
  itemId: string;

  @Column({ type: 'int', comment: '入库数量' })
  quantity: number;

  @Column({ type: 'date', comment: '入库日期' })
  date: Date;

  @Column({ name: 'photo_url', type: 'varchar', length: 500, nullable: true, comment: '照片URL' })
  photoUrl: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne('InventoryItem')
  @JoinColumn({ name: 'item_id' })
  inventoryItem: any;
}

/**
 * 出库记录实体
 */
@Entity({ schema: 'inventory', name: 'stock_out_records' })
export class StockOutRecord {
  @PrimaryColumn({ name: 'out_record_id', type: 'varchar', length: 32 })
  outRecordId: string;

  @Column({ name: 'product_id', type: 'varchar', length: 32, comment: '产品ID' })
  productId: string;

  @Column({ name: 'item_id', type: 'varchar', length: 32, comment: '库存件ID' })
  itemId: string;

  @Column({ type: 'int', comment: '出库数量' })
  quantity: number;

  @Column({ type: 'date', comment: '出库日期' })
  date: Date;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne('Product')
  @JoinColumn({ name: 'product_id' })
  product: any;

  @ManyToOne('InventoryItem')
  @JoinColumn({ name: 'item_id' })
  inventoryItem: any;
}

/**
 * 盘点记录实体
 */
@Entity({ schema: 'inventory', name: 'inventory_checks' })
export class InventoryCheck {
  @PrimaryColumn({ name: 'check_id', type: 'varchar', length: 32 })
  checkId: string;

  @Column({ name: 'item_id', type: 'varchar', length: 32, comment: '库存件ID' })
  itemId: string;

  @Column({ name: 'before_stock', type: 'int', comment: '盘点前库存' })
  beforeStock: number;

  @Column({ name: 'after_stock', type: 'int', comment: '盘点后库存' })
  afterStock: number;

  @Column({ type: 'date', comment: '盘点日期' })
  date: Date;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne('InventoryItem')
  @JoinColumn({ name: 'item_id' })
  inventoryItem: any;
}

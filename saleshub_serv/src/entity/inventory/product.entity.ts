import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToMany } from 'typeorm';

@Entity({ schema: 'inventory', name: 'products' })
export class Product {
  @PrimaryColumn({ name: 'product_id', type: 'varchar', length: 32 })
  productId: string;

  @Column({ type: 'varchar', length: 100, comment: '产品名称' })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true, comment: '产品编码，唯一标识' })
  code: string;

  @Column({ type: 'text', nullable: true, comment: '产品描述' })
  description: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ type: 'timestamp', comment: '创建时间' })
  createdAt: Date;

  @OneToMany('InventoryItem', 'product')
  inventoryItems: any[];
}

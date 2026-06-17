import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'inventory', name: 'product' })
export class Product {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    product_id: string;

    @Column({ type: 'varchar', length: 100, comment: '产品名称' })
    name: string;

    @Column({ type: 'varchar', length: 50, unique: true, comment: '产品编码，唯一标识' })
    code: string;

    @Column({ type: 'text', nullable: true, comment: '产品描述' })
    description: string;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

@Entity({ schema: 'inventory', name: 'inventory_item' })
export class InventoryItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    item_id: string;

    @Column({ type: 'varchar', length: 10, comment: '类型：device-设备件，common-常用件' })
    type: string;

    @Column({ type: 'varchar', length: 100, comment: '名称' })
    name: string;

    @Column({ type: 'varchar', length: 50, comment: '编码' })
    code: string;

    @Column({ type: 'text', array: true, nullable: true, comment: '规格选项（仅常用件）' })
    specs: string[];

    @Column({ type: 'int', default: 0, comment: '当前库存' })
    current_stock: number;

    @Column({ type: 'int', default: 10, comment: '预警阈值' })
    warn_stock: number;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

@Entity({ schema: 'inventory', name: 'product_item' })
export class ProductItem {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    relation_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 32, comment: '库存件ID' })
    item_id: string;

    @Column({ type: 'int', default: 1, comment: '单台产品所需数量' })
    quantity_per_product: number;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string | null;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

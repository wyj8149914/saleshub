import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * 入库记录实体
 */
@Entity({ schema: 'inventory', name: 'stock_in_record' })
export class StockInRecord {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    record_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, default: '', comment: '入库规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', comment: '入库数量' })
    quantity: number;

    @Column({ type: 'date', comment: '入库日期' })
    date: Date;

    @Column({ type: 'varchar', length: 32, nullable: true, comment: '入库照片 file.relation_id' })
    photo_id: string;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'varchar', length: 50, comment: '记录编号' })
    record_no: string;
}

/**
 * 出库记录实体
 */
@Entity({ schema: 'inventory', name: 'stock_out_record' })
export class StockOutRecord {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    record_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, default: '', comment: '出库规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', comment: '出库数量' })
    quantity: number;

    @Column({ type: 'date', comment: '出库日期' })
    date: Date;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'varchar', length: 50, comment: '记录编号' })
    record_no: string;
}

/**
 * 盘点记录实体
 */
@Entity({ schema: 'inventory', name: 'inventory_check' })
export class InventoryCheck {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    check_id: string;

    @Column({ type: 'varchar', length: 32, comment: '零件ID' })
    item_id: string;

    @Column({ type: 'varchar', length: 100, default: '', comment: '盘点规格,空串为默认 SKU' })
    spec: string;

    @Column({ type: 'int', comment: '盘点前库存' })
    before_stock: number;

    @Column({ type: 'int', comment: '盘点后库存' })
    after_stock: number;

    @Column({ type: 'date', comment: '盘点日期' })
    date: Date;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;
}

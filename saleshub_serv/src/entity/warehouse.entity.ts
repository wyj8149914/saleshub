import { Entity, Column, PrimaryColumn, Unique } from 'typeorm';

/**
 * 仓库实体
 */
@Entity({ schema: 'inventory', name: 'warehouse' })
export class Warehouse {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    warehouse_id: string;

    @Column({ type: 'varchar', length: 100, comment: '仓库名称' })
    name: string;

    @Column({ type: 'varchar', length: 200, nullable: true, comment: '位置' })
    location: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', nullable: true, comment: '修改时间' })
    update_time: Date;
}

/**
 * 库存明细实体-规格在各仓库的库存
 */
@Entity({ schema: 'inventory', name: 'item_spec_warehouse' })
@Unique('uk_spec_warehouse', ['spec_id', 'warehouse_id'])
export class InventoryItemSpecWarehouse {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    id: string;

    @Column({ type: 'varchar', length: 32, comment: '规格ID' })
    spec_id: string;

    @Column({ type: 'varchar', length: 32, comment: '仓库ID' })
    warehouse_id: string;

    @Column({ type: 'int', default: 0, comment: '该规格在该仓库的库存数量' })
    current_stock: number;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', nullable: true, comment: '修改时间' })
    update_time: Date;
}

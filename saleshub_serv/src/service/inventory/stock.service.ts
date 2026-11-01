import {
    Product,
    InventoryItem,
    InventoryItemSpec,
    ProductItem,
} from '../../entity/product.entity';
import {
    StockInRecord,
    StockOutRecord,
    InventoryCheck,
    StockHistory,
} from '../../entity/stock.entity';
import { Warehouse, InventoryItemSpecWarehouse } from '../../entity/warehouse.entity';
import {
    StockInDto,
    StockOutDto,
    StockOutBatchDto,
    StockOutByProductDto,
    StockCheckDto,
    ListStockHistoryDto,
    StockInBatchDto,
    ListStockInRecordsDto,
    ListStockOutRecordsDto,
    ListStockCheckRecordsDto,
    StockCheckBatchDto,
    RevertStockInDto,
    RevertStockOutDto,
} from '../../dto/stock.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import { MinioFile } from '../../entity/file.entity';
import { generateFileUrl } from '../../config/minio.config';

interface StockItem {
    warehouse_id?: string;
    item_id: string;
    spec_id: string;
    quantity: number;
}

interface CheckItem {
    item_id: string;
    spec_id: string;
    after_stock: number;
}

export class StockService {
    private productRepository = AppDataSource.getRepository(Product);
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private stockInRepository = AppDataSource.getRepository(StockInRecord);
    private stockOutRepository = AppDataSource.getRepository(StockOutRecord);
    private inventoryCheckRepository = AppDataSource.getRepository(InventoryCheck);
    private stockHistoryRepository = AppDataSource.getRepository(StockHistory);
    private warehouseRepository = AppDataSource.getRepository(Warehouse);
    private specWarehouseRepository = AppDataSource.getRepository(InventoryItemSpecWarehouse);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 入库操作(按零件单个入库)
     */
    async stockIn(dto: StockInDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { item_id: dto.item_id, spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                this.logger.error(`零件 ${dto.item_id} 不存在规格 ${dto.spec_id}`);
                return { result: 1, msg: '零件不存在规格' };
            }

            // 校验仓库（可选）
            if (dto.warehouse_id) {
                const warehouse = await this.warehouseRepository.findOne({
                    where: { warehouse_id: dto.warehouse_id, status: 1 },
                });
                if (!warehouse) {
                    return { result: 1, msg: '仓库不存在' };
                }
            }

            const recordNo = await this.generateStockInRecordNo();
            const now = new Date();
            const record = new StockInRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec_id = dto.spec_id;
            if (dto.warehouse_id) {
                record.warehouse_id = dto.warehouse_id;
            }
            record.quantity = dto.quantity;
            record.before_stock = spec.current_stock;
            record.after_stock = spec.current_stock + dto.quantity;
            record.date = new Date(dto.date);
            if (dto.photo_id) {
                record.photo_id = dto.photo_id;
            }
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.create_time = now;

            const newStock = spec.current_stock + dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockInRecord, record);

                // 如果指定了仓库，更新或创建库存明细
                if (dto.warehouse_id) {
                    let specWarehouse = await manager.findOne(InventoryItemSpecWarehouse, {
                        where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
                    });
                    if (specWarehouse) {
                        specWarehouse.current_stock += dto.quantity;
                        specWarehouse.update_time = now;
                        await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                    } else {
                        specWarehouse = new InventoryItemSpecWarehouse();
                        specWarehouse.id = v7().replace(/-/g, '');
                        specWarehouse.spec_id = dto.spec_id;
                        specWarehouse.warehouse_id = dto.warehouse_id;
                        specWarehouse.current_stock = dto.quantity;
                        specWarehouse.status = 1;
                        specWarehouse.create_time = now;
                        await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                    }
                }

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: spec.spec_id },
                    { current_stock: newStock, update_time: now }
                );
            });

            return { result: 0, msg: '入库成功' };
        } catch (error) {
            this.logger.error('入库失败:', error);
            return { result: 1, msg: '入库失败' };
        }
    }

    /**
     * 批量入库
     */
    async stockInBatch(dto: StockInBatchDto) {
        try {
            const itemSpecs: StockItem[] = dto.items.map((it) => ({
                item_id: it.item_id,
                spec_id: it.spec_id,
                quantity: it.quantity,
            }));
            const validated = await this.validateStockInItems(itemSpecs);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            // 校验仓库（可选）
            if (dto.warehouse_id) {
                const warehouse = await this.warehouseRepository.findOne({
                    where: { warehouse_id: dto.warehouse_id, status: 1 },
                });
                if (!warehouse) {
                    return { result: 1, msg: '仓库不存在' };
                }
            }

            await this.executeStockIn(
                itemSpecs,
                dto.date,
                dto.warehouse_id,
                dto.photo_id,
                dto.remark
            );
            return { result: 0, msg: '入库成功' };
        } catch (error) {
            this.logger.error('批量入库失败:', error);
            return { result: 1, msg: '入库失败' };
        }
    }

    /**
     * 出库操作(按零件单个出库)
     */
    async stockOut(dto: StockOutDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }
            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { item_id: dto.item_id, spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                this.logger.error(`零件 ${dto.item_id} 不存在规格 ${dto.spec_id}`);
                return { result: 1, msg: `零件不存在规格` };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 校验该仓库中该规格库存
            const specWarehouse = await this.specWarehouseRepository.findOne({
                where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!specWarehouse || specWarehouse.current_stock < dto.quantity) {
                const currentStock = specWarehouse?.current_stock || 0;
                return {
                    result: 1,
                    msg: `该仓库规格库存不足(当前 ${currentStock}, 需要 ${dto.quantity})`,
                };
            }

            const recordNo = await this.generateStockOutRecordNo();
            const now = new Date();
            const record = new StockOutRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec_id = dto.spec_id;
            record.warehouse_id = dto.warehouse_id;
            record.quantity = dto.quantity;
            record.before_stock = spec.current_stock;
            record.after_stock = spec.current_stock - dto.quantity;
            record.date = new Date(dto.date);
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.status = 1;
            record.create_time = now;

            const newStock = spec.current_stock - dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockOutRecord, record);

                // 更新库存明细
                specWarehouse.current_stock -= dto.quantity;
                specWarehouse.update_time = now;
                await manager.save(InventoryItemSpecWarehouse, specWarehouse);

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: dto.spec_id },
                    { current_stock: newStock, update_time: now }
                );
            });

            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }

    /**
     * 按零件批量出库(同一 record_no)
     */
    async stockOutBatch(dto: StockOutBatchDto) {
        try {
            const itemSpecs: StockItem[] = dto.items.map((it) => ({
                item_id: it.item_id,
                spec_id: it.spec_id,
                quantity: it.quantity,
                warehouse_id: it.warehouse_id,
            }));

            const validated = await this.validateStockOutItems(itemSpecs);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            await this.executeStockOut(itemSpecs, dto.date, dto.remark);
            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('批量出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }

    /**
     * 按产品出库(按 BOM 扣减,同一 record_no)
     * 出库数量 = 产品台数 quantity × BOM quantity_per_product
     */
    async stockOutByProduct(dto: StockOutByProductDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            const bomRows = await this.productItemRepository
                .createQueryBuilder('pi')
                .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id AND i.status = 1')
                .select([
                    'pi.item_id AS item_id',
                    'pi.spec_id AS spec_id',
                    'pi.quantity_per_product AS quantity_per_product',
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .getRawMany();

            if (bomRows.length === 0) {
                return { result: 1, msg: '产品未配置零件' };
            }

            const itemSpecs: StockItem[] = bomRows.map(
                (row: {
                    item_id: string;
                    spec_id: string;
                    quantity_per_product: number;
                    warehouse_id: string;
                }) => ({
                    item_id: row.item_id,
                    spec_id: row.spec_id,
                    quantity: Number(row.quantity_per_product) * dto.quantity,
                    warehouse_id: row.warehouse_id,
                })
            );

            const validated = await this.validateStockOutItems(itemSpecs);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            await this.executeStockOut(itemSpecs, dto.date, dto.remark);
            return { result: 0, msg: '出库成功' };
        } catch (error) {
            this.logger.error('按产品出库失败:', error);
            return { result: 1, msg: '出库失败' };
        }
    }

    /**
     * 查询零件历史记录(入库、出库、盘点)
     */
    async listHistory(dto: ListStockHistoryDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            const queryBuilder = this.stockHistoryRepository
                .createQueryBuilder('rec')
                .leftJoin(InventoryItem, 'item', 'item.item_id = rec.item_id AND item.status = 1')
                .leftJoin(
                    InventoryItemSpec,
                    'spec',
                    'spec.spec_id = rec.spec_id AND spec.status = 1'
                )
                .select([
                    'rec.id AS id',
                    'rec.type AS type',
                    'item.name AS item_name',
                    'spec.spec AS spec',
                    'rec.quantity AS quantity',
                    'rec.before_stock AS before_stock',
                    'rec.after_stock AS after_stock',
                    "to_char(rec.date, 'YYYY-MM-DD') AS date",
                    'rec.remark AS remark',
                    "to_char(rec.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('rec.status = :status', { status: 1 });

            if (dto.item_id) {
                queryBuilder.andWhere('rec.item_id = :itemId', { itemId: dto.item_id });
            }
            if (dto.start_date) {
                queryBuilder.andWhere("rec.date >= to_date(:startDate, 'YYYY-MM-DD')", {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                queryBuilder.andWhere(
                    "rec.date <= to_date(:endDate, 'YYYY-MM-DD') + Interval '1 day'",
                    {
                        endDate: dto.end_date,
                    }
                );
            }
            if (dto.spec_id) {
                queryBuilder.andWhere('rec.spec_id = :specId', { specId: dto.spec_id });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('rec.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询历史记录失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询入库记录列表
     */
    async listStockInRecords(dto: ListStockInRecordsDto) {
        try {
            const queryBuilder = this.stockInRepository
                .createQueryBuilder('rec')
                .leftJoin(InventoryItem, 'item', 'item.item_id = rec.item_id AND item.status = 1')
                .leftJoin(
                    InventoryItemSpec,
                    'spec',
                    'spec.spec_id = rec.spec_id AND spec.status = 1'
                )
                .leftJoin(
                    Warehouse,
                    'warehouse',
                    'warehouse.warehouse_id = rec.warehouse_id AND warehouse.status = 1'
                )
                .leftJoin(MinioFile, 'file', 'file.relation_id = rec.photo_id')
                .select([
                    'rec.record_id AS record_id',
                    'rec.record_no AS record_no',
                    "COALESCE(warehouse.name, '未分配仓库') AS warehouse_name",
                    "to_char(rec.date, 'YYYY-MM-DD') AS date",
                    'rec.quantity AS quantity',
                    'rec.remark AS remark',
                    'rec.photo_id AS photo_id',
                    'file.object_name AS object_name',
                    'rec.before_stock AS before_stock',
                    'rec.after_stock AS after_stock',
                    'item.name AS item_name',
                    'spec.spec AS spec',
                    "to_char(rec.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('rec.status = :status', { status: 1 });

            if (dto.start_date) {
                queryBuilder.andWhere("rec.date >= to_date(:startDate, 'YYYY-MM-DD')", {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                queryBuilder.andWhere(
                    "rec.date <= to_date(:endDate, 'YYYY-MM-DD') + Interval '1 day'",
                    {
                        endDate: dto.end_date,
                    }
                );
            }
            if (dto.item_id) {
                queryBuilder.andWhere('rec.item_id = :itemId', { itemId: dto.item_id });
            }
            if (dto.spec_id) {
                queryBuilder.andWhere('rec.spec_id = :specId', { specId: dto.spec_id });
            }
            if (dto.record_no) {
                queryBuilder.andWhere('rec.record_no = :recordNo', { recordNo: dto.record_no });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('rec.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            for (const item of items) {
                item.photo_url = generateFileUrl(item.object_name ?? '');
                delete item.object_name;
            }

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询入库记录列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询出库记录列表
     */
    async listStockOutRecords(dto: ListStockOutRecordsDto) {
        try {
            const queryBuilder = this.stockOutRepository
                .createQueryBuilder('rec')
                .leftJoin(InventoryItem, 'item', 'item.item_id = rec.item_id AND item.status = 1')
                .leftJoin(
                    InventoryItemSpec,
                    'spec',
                    'spec.spec_id = rec.spec_id AND spec.status = 1'
                )
                .leftJoin(
                    Warehouse,
                    'warehouse',
                    'warehouse.warehouse_id = rec.warehouse_id AND warehouse.status = 1'
                )
                .select([
                    'rec.record_id AS record_id',
                    'rec.record_no AS record_no',
                    "COALESCE(warehouse.name, '未分配') AS warehouse_name",
                    "to_char(rec.date, 'YYYY-MM-DD') AS date",
                    'rec.quantity AS quantity',
                    'rec.remark AS remark',
                    'rec.before_stock AS before_stock',
                    'rec.after_stock AS after_stock',
                    'item.name AS item_name',
                    'spec.spec AS spec',
                    "to_char(rec.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('rec.status = :status', { status: 1 });

            if (dto.start_date) {
                queryBuilder.andWhere("rec.date >= to_date(:startDate, 'YYYY-MM-DD')", {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                queryBuilder.andWhere(
                    "rec.date <= to_date(:endDate, 'YYYY-MM-DD') + Interval '1 day'",
                    {
                        endDate: dto.end_date,
                    }
                );
            }
            if (dto.item_id) {
                queryBuilder.andWhere('rec.item_id = :itemId', { itemId: dto.item_id });
            }
            if (dto.spec_id) {
                queryBuilder.andWhere('rec.spec_id = :specId', { specId: dto.spec_id });
            }
            if (dto.record_no) {
                queryBuilder.andWhere('rec.record_no = :recordNo', { recordNo: dto.record_no });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('rec.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询出库记录列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 查询盘点记录列表
     */
    async listStockCheckRecords(dto: ListStockCheckRecordsDto) {
        try {
            const queryBuilder = this.inventoryCheckRepository
                .createQueryBuilder('rec')
                .leftJoin(InventoryItem, 'item', 'item.item_id = rec.item_id AND item.status = 1')
                .leftJoin(
                    InventoryItemSpec,
                    'spec',
                    'spec.spec_id = rec.spec_id AND spec.status = 1'
                )
                .select([
                    'rec.check_id AS check_id',
                    'rec.record_no AS record_no',
                    "to_char(rec.date, 'YYYY-MM-DD') AS date",
                    'rec.remark AS remark',
                    'rec.before_stock AS before_stock',
                    'rec.after_stock AS after_stock',
                    'item.name AS item_name',
                    'spec.spec AS spec',
                    "to_char(rec.create_time, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
                ])
                .where('rec.status = :status', { status: 1 });

            if (dto.start_date) {
                queryBuilder.andWhere("rec.date >= to_date(:startDate, 'YYYY-MM-DD')", {
                    startDate: dto.start_date,
                });
            }
            if (dto.end_date) {
                queryBuilder.andWhere(
                    "rec.date <= to_date(:endDate, 'YYYY-MM-DD') + Interval '1 day'",
                    {
                        endDate: dto.end_date,
                    }
                );
            }
            if (dto.item_id) {
                queryBuilder.andWhere('rec.item_id = :itemId', { itemId: dto.item_id });
            }
            if (dto.spec_id) {
                queryBuilder.andWhere('rec.spec_id = :specId', { specId: dto.spec_id });
            }
            if (dto.record_no) {
                queryBuilder.andWhere('rec.record_no = :recordNo', { recordNo: dto.record_no });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('rec.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询盘点记录列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 库存盘点(批量,事务内执行)
     */
    async stockCheck(dto: StockCheckDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }
            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在' };
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 获取该仓库该规格的库存
            let specWarehouse = await this.specWarehouseRepository.findOne({
                where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
            });
            const beforeStock = specWarehouse?.current_stock || 0;

            const recordNo = await this.generateStockCheckRecordNo();
            const now = new Date();
            const checkRecord = new InventoryCheck();
            checkRecord.check_id = v7().replace(/-/g, '');
            checkRecord.record_no = recordNo;
            checkRecord.item_id = dto.item_id;
            checkRecord.spec_id = spec.spec_id;
            checkRecord.warehouse_id = dto.warehouse_id;
            checkRecord.before_stock = beforeStock;
            checkRecord.after_stock = dto.after_stock;
            checkRecord.date = new Date(dto.date);
            if (dto.remark) {
                checkRecord.remark = dto.remark;
            }

            // 计算其他仓库的库存总和
            const otherWarehousesStock = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .select('COALESCE(SUM(sw.current_stock), 0)', 'total')
                .where(
                    'sw.spec_id = :specId AND sw.warehouse_id != :warehouseId AND sw.status = 1',
                    {
                        specId: dto.spec_id,
                        warehouseId: dto.warehouse_id,
                    }
                )
                .getRawOne();

            const otherStock = Number(otherWarehousesStock?.total || 0);
            const newTotalStock = otherStock + dto.after_stock;

            await this.inventoryCheckRepository.manager.transaction(async (manager) => {
                await manager.save(InventoryCheck, checkRecord);

                // 更新或创建库存明细
                if (specWarehouse) {
                    specWarehouse.current_stock = dto.after_stock;
                    specWarehouse.update_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                } else {
                    specWarehouse = new InventoryItemSpecWarehouse();
                    specWarehouse.id = v7().replace(/-/g, '');
                    specWarehouse.spec_id = dto.spec_id;
                    specWarehouse.warehouse_id = dto.warehouse_id;
                    specWarehouse.current_stock = dto.after_stock;
                    specWarehouse.status = 1;
                    specWarehouse.create_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                }

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: spec.spec_id },
                    {
                        current_stock: newTotalStock,
                        update_time: now,
                    }
                );
            });

            return { result: 0, msg: '盘点成功' };
        } catch (error) {
            this.logger.error('盘点失败:', error);
            return { result: 1, msg: '盘点失败' };
        }
    }

    /**
     * 批量盘点
     */
    async stockCheckBatch(dto: StockCheckBatchDto) {
        try {
            const checkItems: CheckItem[] = [];
            for (const itemEntry of dto.items) {
                checkItems.push({
                    item_id: itemEntry.item_id,
                    spec_id: itemEntry.spec_id,
                    after_stock: itemEntry.after_stock,
                });
            }

            // 校验仓库
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            const validated = await this.validateStockCheckItems(checkItems);
            if (!validated.ok) {
                return { result: 1, msg: validated.msg };
            }

            await this.executeStockCheck(checkItems, dto.date, dto.warehouse_id, dto.remark);
            return { result: 0, msg: '盘点成功' };
        } catch (error) {
            this.logger.error('批量盘点失败:', error);
            return { result: 1, msg: '盘点失败' };
        }
    }

    /**
     * 校验入库明细(零件、规格)
     */
    private async validateStockInItems(itemSpecs: StockItem[]) {
        const keys = itemSpecs.map((l) => `${l.item_id}||${l.spec_id}`);
        if (new Set(keys).size !== keys.length) {
            return { ok: false, msg: '入库列表存在重复的(零件+规格)' };
        }

        const itemIds = [...new Set(itemSpecs.map((l) => l.item_id))];
        const items = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .where('item.item_id IN (:...ids) AND item.status = :status', {
                ids: itemIds,
                status: 1,
            })
            .getMany();
        const itemMap = new Map(items.map((i) => [i.item_id, i]));
        if (items.length !== itemIds.length) {
            const missing = itemIds.filter((id) => !itemMap.has(id));
            this.logger.error(`零件不存在或已停用: ${missing.join(',')}`);
            return { ok: false, msg: `零件不存在或已停用: ${missing.join(',')}` };
        }

        const specIds = itemSpecs.map((l) => l.spec_id);
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specMap = new Map(specs.map((s) => [`${s.item_id}||${s.spec_id}`, s]));

        for (const itemSpec of itemSpecs) {
            const spec = specMap.get(`${itemSpec.item_id}||${itemSpec.spec_id}`);
            if (!spec) {
                this.logger.error(`零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}`);
                return {
                    ok: false,
                    msg: `零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}`,
                };
            }
        }

        return { ok: true, specMap };
    }

    /**
     * 执行入库(同一批次共用 record_no,事务原子)
     */
    private async executeStockIn(
        itemSpecs: StockItem[],
        date: string,
        warehouseId?: string,
        photoId?: string,
        remark?: string
    ) {
        const recordNo = await this.generateStockInRecordNo();
        const now = new Date();
        const inDate = new Date(date);
        const stockDelta = new Map<string, number>();

        for (const itemSpec of itemSpecs) {
            const prev = stockDelta.get(itemSpec.spec_id) ?? 0;
            stockDelta.set(itemSpec.spec_id, prev + itemSpec.quantity);
        }

        const specIds = [...stockDelta.keys()];
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specById = new Map(specs.map((s) => [s.spec_id, s]));

        // 获取该仓库的库存明细（仅当指定了仓库时）
        let specWarehouseBySpec = new Map<string, InventoryItemSpecWarehouse>();
        if (warehouseId) {
            const specWarehouses = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .where(
                    'sw.spec_id IN (:...specIds) AND sw.warehouse_id = :warehouseId AND sw.status = 1',
                    {
                        specIds,
                        warehouseId,
                    }
                )
                .getMany();
            specWarehouseBySpec = new Map(specWarehouses.map((sw) => [sw.spec_id, sw]));
        }

        await this.stockInRepository.manager.transaction(async (manager) => {
            for (const itemSpec of itemSpecs) {
                const spec = specById.get(itemSpec.spec_id);
                if (!spec) {
                    throw new Error(`规格 ${itemSpec.spec_id} 未找到`);
                }
                const record = new StockInRecord();
                record.record_id = v7().replace(/-/g, '');
                record.record_no = recordNo;
                record.item_id = itemSpec.item_id;
                record.spec_id = itemSpec.spec_id;
                if (warehouseId) {
                    record.warehouse_id = warehouseId;
                }
                record.quantity = itemSpec.quantity;
                record.before_stock = spec.current_stock;
                record.after_stock = spec.current_stock + itemSpec.quantity;
                record.date = inDate;
                if (photoId) {
                    record.photo_id = photoId;
                }
                if (remark) {
                    record.remark = remark;
                }
                record.create_time = now;
                await manager.save(StockInRecord, record);
            }

            // 如果指定了仓库，更新库存明细
            if (warehouseId) {
                for (const [specId, add] of stockDelta) {
                    const spec = specById.get(specId);
                    if (!spec) {
                        throw new Error(`规格 ${specId} 未找到`);
                    }

                    let specWarehouse = specWarehouseBySpec.get(specId);
                    if (specWarehouse) {
                        specWarehouse.current_stock += add;
                        specWarehouse.update_time = now;
                        await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                    } else {
                        specWarehouse = new InventoryItemSpecWarehouse();
                        specWarehouse.id = v7().replace(/-/g, '');
                        specWarehouse.spec_id = specId;
                        specWarehouse.warehouse_id = warehouseId;
                        specWarehouse.current_stock = add;
                        specWarehouse.status = 1;
                        specWarehouse.create_time = now;
                        await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                    }
                }
            }

            // 更新总库存
            for (const [specId, add] of stockDelta) {
                const spec = specById.get(specId);
                if (!spec) {
                    throw new Error(`规格 ${specId} 未找到`);
                }
                await manager.update(
                    InventoryItemSpec,
                    { spec_id: specId },
                    { current_stock: spec.current_stock + add, update_time: now }
                );
            }
        });
    }

    /**
     * 校验出库明细(设备件、BOM 关联、库存充足)
     */
    private async validateStockOutItems(itemSpecs: StockItem[]) {
        const keys = itemSpecs.map((l) => {
            if (l.warehouse_id) {
                // 如果指定仓库
                return `${l.item_id}||${l.spec_id}|${l.warehouse_id}`;
            }
            return `${l.item_id}||${l.spec_id}`;
        });
        if (new Set(keys).size !== keys.length) {
            return { ok: false, msg: '出库列表存在重复的(零件+规格)' };
        }

        const itemIds = [...new Set(itemSpecs.map((l) => l.item_id))];
        const items = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .where('item.item_id IN (:...ids) AND item.status = :status', {
                ids: itemIds,
                status: 1,
            })
            .getMany();
        const itemMap = new Map(items.map((i) => [i.item_id, i]));
        if (items.length !== itemIds.length) {
            const missing = itemIds.filter((id) => !itemMap.has(id));
            this.logger.error(`零件不存在或已停用: ${missing.join(',')}`);
            return { ok: false, msg: `零件不存在或已停用: ${missing.join(',')}` };
        }
        const warehouseIds = [
            ...new Set(itemSpecs.filter((l) => l.warehouse_id).map((l) => l.warehouse_id)),
        ];
        const warehouses = await this.warehouseRepository
            .createQueryBuilder('w')
            .where('w.warehouse_id IN (:...ids) AND w.status = :status', {
                ids: warehouseIds,
                status: 1,
            })
            .getMany();
        const warehouseMap = new Map(warehouses.map((w) => [w.warehouse_id, w]));
        if (warehouses.length !== warehouseIds.length) {
            const missing = warehouseIds.filter((id) => !warehouseMap.has(id!));
            this.logger.error(`仓库不存在或已停用: ${missing.join(',')}`);
            return { ok: false, msg: `仓库不存在或已停用: ${missing.join(',')}` };
        }

        // 查询规格信息
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...specIds) AND s.status = :status', {
                specIds: itemSpecs.map((l) => l.spec_id),
                status: 1,
            })
            .getMany();
        const specMap = new Map(specs.map((s) => [s.spec_id, s]));

        for (const itemSpec of itemSpecs) {
            const spec = specMap.get(itemSpec.spec_id);
            if (!spec) {
                this.logger.error(`零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}`);
                return {
                    ok: false,
                    msg: `零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}`,
                };
            }

            // 获取该仓库的库存明细
            const specQb = this.specWarehouseRepository
                .createQueryBuilder('sw')
                .where('sw.spec_id = :specId AND sw.status = 1', {
                    specId: itemSpec.spec_id,
                });
            if (itemSpec.warehouse_id) {
                specQb.andWhere('sw.warehouse_id = :warehouseId', {
                    warehouseId: itemSpec.warehouse_id,
                });
            }
            const specWarehouse = await specQb.getRawOne();

            if (!specWarehouse || Number(specWarehouse.current_stock) < itemSpec.quantity) {
                const currentStock = specWarehouse?.current_stock || 0;
                this.logger.error(
                    `该仓库规格 ${spec.spec} 库存不足(当前 ${currentStock},需要 ${itemSpec.quantity})`
                );
                return {
                    ok: false,
                    msg: `该仓库规格 ${spec.spec} 库存不足(当前 ${currentStock},需要 ${itemSpec.quantity})`,
                };
            }
        }

        return { ok: true };
    }

    /**
     * 执行出库(同一批次共用 record_no,事务原子)
     */
    private async executeStockOut(itemSpecs: StockItem[], date: string, remark?: string) {
        const recordNo = await this.generateStockOutRecordNo();
        const now = new Date();
        const outDate = new Date(date);
        const stockDelta = new Map<string, number>();

        // 同一规格合并一条数据,方便计算该规格总库存
        for (const itemSpec of itemSpecs) {
            const prev = stockDelta.get(itemSpec.spec_id) ?? 0;
            stockDelta.set(itemSpec.spec_id, prev + itemSpec.quantity);
        }

        // 查询规格信息,并将数据转为Map,key为spec_id,value为具体的规格
        const specIds = [...stockDelta.keys()];
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specMap = new Map(specs.map((s) => [s.spec_id, s]));

        await this.stockOutRepository.manager.transaction(async (manager) => {
            for (const itemSpec of itemSpecs) {
                const spec = specMap.get(itemSpec.spec_id);
                if (!spec) {
                    throw new Error(`规格 ${itemSpec.spec_id} 未找到`);
                }
                // 获取该仓库的库存明细
                const specQb = this.specWarehouseRepository
                    .createQueryBuilder('sw')
                    .where('sw.spec_id = :specId AND sw.status = 1', { specId: itemSpec.spec_id });

                if (itemSpec.warehouse_id) {
                    specQb.andWhere('sw.warehouse_id = :warehouseId', {
                        warehouseId: itemSpec.warehouse_id,
                    });
                }
                const specWarehouse = await specQb.getOne();
                console.log('specWarehouse', specWarehouse);
                if (!specWarehouse) {
                    throw new Error(`规格 ${itemSpec.spec_id} 在该仓库无库存`);
                }

                const record = new StockOutRecord();
                record.record_id = v7().replace(/-/g, '');
                record.record_no = recordNo;
                record.item_id = itemSpec.item_id;
                record.spec_id = itemSpec.spec_id;
                if (itemSpec.warehouse_id) {
                    record.warehouse_id = itemSpec.warehouse_id;
                }
                record.quantity = itemSpec.quantity;
                record.before_stock = spec.current_stock;
                record.after_stock = spec.current_stock - itemSpec.quantity;
                record.date = outDate;
                if (remark) {
                    record.remark = remark;
                }
                record.status = 1;
                record.create_time = now;
                await manager.save(StockOutRecord, record);

                // 更新仓库库存,如果指定了仓库ID,那么更新仓库库存
                if (itemSpec.warehouse_id) {
                    console.log(specWarehouse.current_stock, itemSpec.quantity);
                    await manager.update(
                        InventoryItemSpecWarehouse,
                        { spec_id: itemSpec.spec_id, warehouse_id: itemSpec.warehouse_id },
                        {
                            current_stock: specWarehouse.current_stock - itemSpec.quantity,
                            update_time: now,
                        }
                    );
                }
            }

            // 一次性更新总库存,多个规格合为一次更新总库存
            for (const [specId, deduct] of stockDelta) {
                const spec = specMap.get(specId);
                if (!spec) {
                    throw new Error(`规格 ${specId} 未找到`);
                }
                await manager.update(
                    InventoryItemSpec,
                    { spec_id: specId },
                    { current_stock: spec.current_stock - deduct, update_time: now }
                );
            }
        });
    }

    private async generateStockInRecordNo() {
        const result = await this.stockInRepository
            .createQueryBuilder('record')
            .select('MAX(SUBSTRING(record.record_no, 3)::INTEGER)', 'maxNum')
            .where('record.record_no ~ :pattern', { pattern: '^SI[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('入库记录编号已达上限');
        }
        return `SI${String(nextNum).padStart(6, '0')}`;
    }

    private async generateStockOutRecordNo() {
        const result = await this.stockOutRepository
            .createQueryBuilder('record')
            .select('MAX(SUBSTRING(record.record_no, 3)::INTEGER)', 'maxNum')
            .where('record.record_no ~ :pattern', { pattern: '^SO[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('出库记录编号已达上限');
        }
        return `SO${String(nextNum).padStart(6, '0')}`;
    }

    private async generateStockCheckRecordNo() {
        const result = await this.inventoryCheckRepository
            .createQueryBuilder('record')
            .select('MAX(SUBSTRING(record.record_no, 3)::INTEGER)', 'maxNum')
            .where('record.record_no ~ :pattern', { pattern: '^SC[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('盘点记录编号已达上限');
        }
        return `SC${String(nextNum).padStart(6, '0')}`;
    }

    /**
     * 校验盘点明细(零件、规格)
     */
    private async validateStockCheckItems(checkItems: CheckItem[]) {
        const keys = checkItems.map((l) => `${l.item_id}||${l.spec_id}`);
        if (new Set(keys).size !== keys.length) {
            return { ok: false, msg: '盘点列表存在重复的(零件+规格)' };
        }

        const itemIds = [...new Set(checkItems.map((l) => l.item_id))];
        const items = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .where('item.item_id IN (:...ids) AND item.status = :status', {
                ids: itemIds,
                status: 1,
            })
            .getMany();
        const itemMap = new Map(items.map((i) => [i.item_id, i]));
        if (items.length !== itemIds.length) {
            const missing = itemIds.filter((id) => !itemMap.has(id));
            this.logger.error(`零件不存在或已停用: ${missing.join(',')}`);
            return { ok: false, msg: `零件不存在或已停用: ${missing.join(',')}` };
        }

        const specIds = checkItems.map((l) => l.spec_id);
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specMap = new Map(specs.map((s) => [`${s.item_id}||${s.spec_id}`, s]));

        for (const checkItem of checkItems) {
            const spec = specMap.get(`${checkItem.item_id}||${checkItem.spec_id}`);
            if (!spec) {
                this.logger.error(`零件 ${checkItem.item_id} 不存在规格 ${checkItem.spec_id}`);
                return {
                    ok: false,
                    msg: `零件 ${checkItem.item_id} 不存在规格 ${checkItem.spec_id}`,
                };
            }
        }

        return { ok: true, specMap };
    }

    /**
     * 执行盘点(事务原子)
     */
    private async executeStockCheck(
        checkItems: CheckItem[],
        date: string,
        warehouseId: string,
        remark?: string
    ) {
        const specIds = checkItems.map((l) => l.spec_id);
        const specs = await this.inventoryItemSpecRepository
            .createQueryBuilder('s')
            .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
            .getMany();
        const specById = new Map(specs.map((s) => [s.spec_id, s]));

        // 获取该仓库的库存明细
        const specWarehouses = await this.specWarehouseRepository
            .createQueryBuilder('sw')
            .where(
                'sw.spec_id IN (:...specIds) AND sw.warehouse_id = :warehouseId AND sw.status = 1',
                {
                    specIds,
                    warehouseId,
                }
            )
            .getMany();
        const specWarehouseBySpec = new Map(specWarehouses.map((sw) => [sw.spec_id, sw]));

        const now = new Date();
        const checkDate = new Date(date);
        const recordNo = await this.generateStockCheckRecordNo();

        await this.inventoryCheckRepository.manager.transaction(async (manager) => {
            for (const checkItem of checkItems) {
                const spec = specById.get(checkItem.spec_id);
                if (!spec) {
                    throw new Error(`规格 ${checkItem.spec_id} 未找到`);
                }

                let specWarehouse = specWarehouseBySpec.get(checkItem.spec_id);
                const beforeStock = specWarehouse?.current_stock || 0;

                // 计算其他仓库的库存总和
                const otherWarehousesStock = await this.specWarehouseRepository
                    .createQueryBuilder('sw')
                    .select('COALESCE(SUM(sw.current_stock), 0)', 'total')
                    .where(
                        'sw.spec_id = :specId AND sw.warehouse_id != :warehouseId AND sw.status = 1',
                        {
                            specId: checkItem.spec_id,
                            warehouseId,
                        }
                    )
                    .getRawOne();

                const otherStock = Number(otherWarehousesStock?.total || 0);
                const newTotalStock = otherStock + checkItem.after_stock;

                const checkRecord = new InventoryCheck();
                checkRecord.check_id = v7().replace(/-/g, '');
                checkRecord.record_no = recordNo;
                checkRecord.item_id = checkItem.item_id;
                checkRecord.spec_id = spec.spec_id;
                checkRecord.warehouse_id = warehouseId;
                checkRecord.before_stock = beforeStock;
                checkRecord.after_stock = checkItem.after_stock;
                checkRecord.date = checkDate;
                if (remark) {
                    checkRecord.remark = remark;
                }

                await manager.save(InventoryCheck, checkRecord);

                // 更新或创建库存明细
                if (specWarehouse) {
                    specWarehouse.current_stock = checkItem.after_stock;
                    specWarehouse.update_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                } else {
                    specWarehouse = new InventoryItemSpecWarehouse();
                    specWarehouse.id = v7().replace(/-/g, '');
                    specWarehouse.spec_id = checkItem.spec_id;
                    specWarehouse.warehouse_id = warehouseId;
                    specWarehouse.current_stock = checkItem.after_stock;
                    specWarehouse.status = 1;
                    specWarehouse.create_time = now;
                    await manager.save(InventoryItemSpecWarehouse, specWarehouse);
                }

                await manager.update(
                    InventoryItemSpec,
                    { spec_id: spec.spec_id },
                    { current_stock: newTotalStock, update_time: now }
                );
            }
        });
    }

    /**
     * 撤销入库记录
     */
    async revertStockIn(dto: RevertStockInDto) {
        try {
            const record = await this.stockInRepository.findOne({
                where: { record_id: dto.record_id, status: 1 },
            });
            if (!record) {
                return { result: 1, msg: '入库记录不存在' };
            }

            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: record.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在或已停用' };
            }
            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { spec_id: record.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在或已停用' };
            }

            // 检查库存：撤销后库存 = 当前库存 - 入库数量
            const newStock = spec.current_stock - record.quantity;
            if (newStock < 0) {
                return {
                    result: 1,
                    msg: `撤销后库存不足，当前库存 ${spec.current_stock}，入库数量 ${record.quantity}`,
                };
            }

            const now = new Date();
            const remark = record.remark ? `${record.remark} (撤销入库记录)` : '撤销入库记录';
            await this.stockInRepository.manager.transaction(async (manager) => {
                await manager.update(
                    StockInRecord,
                    { record_id: dto.record_id },
                    { status: 2, update_time: now, remark: remark }
                );
                await manager.update(
                    InventoryItemSpec,
                    { spec_id: record.spec_id },
                    { current_stock: newStock, update_time: now }
                );
            });

            this.logger.info(
                `撤销入库记录 ${record.record_no}，库存从 ${spec.current_stock} 回退到 ${newStock}`
            );
            return { result: 0, msg: '撤销成功' };
        } catch (error) {
            this.logger.error('撤销入库记录失败:', error);
            return { result: 1, msg: '撤销失败' };
        }
    }

    /**
     * 撤销出库记录
     */
    async revertStockOut(dto: RevertStockOutDto) {
        try {
            const record = await this.stockOutRepository.findOne({
                where: { record_id: dto.record_id, status: 1 },
            });
            if (!record) {
                return { result: 1, msg: '出库记录不存在' };
            }

            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: record.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在或已停用' };
            }
            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { spec_id: record.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在或已停用' };
            }

            // 出库撤销：库存增加，无需检查限制
            const newStock = spec.current_stock + record.quantity;

            const now = new Date();
            const remark = record.remark ? `${record.remark} (撤销出库记录)` : '撤销出库记录';
            await this.stockOutRepository.manager.transaction(async (manager) => {
                await manager.update(
                    StockOutRecord,
                    { record_id: dto.record_id },
                    { status: 2, update_time: now, remark: remark }
                );
                await manager.update(
                    InventoryItemSpec,
                    { spec_id: record.spec_id },
                    { current_stock: newStock, update_time: now }
                );
            });

            this.logger.info(
                `撤销出库记录 ${record.record_no}，库存从 ${spec.current_stock} 恢复到 ${newStock}`
            );
            return { result: 0, msg: '撤销成功' };
        } catch (error) {
            this.logger.error('撤销出库记录失败:', error);
            return { result: 1, msg: '撤销失败' };
        }
    }
}

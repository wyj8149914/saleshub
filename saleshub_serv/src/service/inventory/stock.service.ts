import { Product, InventoryItem, InventoryItemSpec, ProductItem } from '../../entity/product.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/stock.entity';
import {
    StockInDto,
    StockOutDto,
    StockOutBatchDto,
    StockOutByProductDto,
    StockCheckDto,
    ListStockHistoryDto,
    StockInBatchDto,
} from '../../dto/stock.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

interface StockItem {
    item_id: string;
    spec_id: string;
    quantity: number;
}

export class StockService {
    private productRepository = AppDataSource.getRepository(Product);
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private stockInRepository = AppDataSource.getRepository(StockInRecord);
    private stockOutRepository = AppDataSource.getRepository(StockOutRecord);
    private inventoryCheckRepository = AppDataSource.getRepository(InventoryCheck);
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

            const recordNo = await this.generateStockInRecordNo();
            const now = new Date();
            const record = new StockInRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec_id = dto.spec_id;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            record.photo_id = dto.photo_id;
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.create_time = now;

            const newStock = spec.current_stock + dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockInRecord, record);
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

            await this.executeStockIn(itemSpecs, dto.date, dto.remark);
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

            if (spec.current_stock < dto.quantity) {
                return {
                    result: 1,
                    msg: `规格 ${dto.spec_id} 库存不足(当前 ${spec.current_stock},需要 ${dto.quantity})`,
                };
            }

            const recordNo = await this.generateStockOutRecordNo();
            const now = new Date();
            const record = new StockOutRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec_id = dto.spec_id;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.status = 1;
            record.create_time = now;

            const newStock = spec.current_stock - dto.quantity;
            await this.inventoryItemSpecRepository.manager.transaction(async (manager) => {
                await manager.save(StockOutRecord, record);
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

            const bomRows = await this.productItemRepository
                .createQueryBuilder('pi')
                .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id AND i.status = 1')
                .select([
                    'pi.item_id AS item_id',
                    'pi.spec_id AS spec_id',
                    'pi.quantity_per_product AS quantity_per_product'
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .getRawMany();

            if (bomRows.length === 0) {
                return { result: 1, msg: '产品未配置零件' };
            }

            const itemSpecs: StockItem[] = bomRows.map((row: {
                item_id: string;
                spec_id: string;
                quantity_per_product: number;
            }) => ({
                item_id: row.item_id,
                spec_id: row.spec_id,
                quantity: Number(row.quantity_per_product) * dto.quantity,
            }));

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

            let dateCondition = '';
            const params: Record<string, unknown> = { itemId: dto.item_id, status: 1 };

            if (dto.start_date) {
                dateCondition += ' AND date >= :startDate';
                params.startDate = new Date(dto.start_date);
            }
            if (dto.end_date) {
                dateCondition += ' AND date <= :endDate';
                params.endDate = new Date(dto.end_date);
            }

            const inRecords = await this.stockInRepository
                .createQueryBuilder('rec')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const outRecords = await this.stockOutRepository
                .createQueryBuilder('rec')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const checkRecords = await this.inventoryCheckRepository
                .createQueryBuilder('rec')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const mergedRecords = [
                ...inRecords.map((r: StockInRecord) => ({ ...r, id: r.record_id, type: 'in' as const })),
                ...outRecords.map((r: StockOutRecord) => ({ ...r, id: r.record_id, type: 'out' as const })),
                ...checkRecords.map((r: InventoryCheck) => ({ ...r, id: r.check_id, type: 'check' as const })),
            ];
            mergedRecords.sort((a, b) => b.create_time.getTime() - a.create_time.getTime());

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = mergedRecords.length;
            const items = mergedRecords.slice(start, start + dto.pageSize);

            return { result: 0, msg: 'success', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询历史记录失败:', error);
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

            const specIds = dto.specs.map((s) => s.spec_id);
            const dedup = new Set(specIds);
            if (dedup.size !== specIds.length) {
                return { result: 1, msg: '盘点规格列表存在重复' };
            }

            const specs = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .where('s.item_id = :itemId AND s.status = :status AND s.spec_id IN (:...specIds)', {
                    itemId: dto.item_id,
                    status: 1,
                    specIds,
                })
                .getMany();
            if (specs.length !== specIds.length) {
                const found = new Set(specs.map((s) => s.spec_id));
                const missing = specIds.filter((id) => !found.has(id));
                return { result: 1, msg: `零件不存在规格: ${missing.join(',')}` };
            }
            const specMap = new Map(specs.map((s) => [s.spec_id, s]));

            const now = new Date();
            const checkDate = new Date(dto.date);

            await this.inventoryCheckRepository.manager.transaction(async (manager) => {
                for (const input of dto.specs) {
                    const target = specMap.get(input.spec_id);
                    if (!target) {
                        throw new Error(`规格 ${input.spec_id} 未找到`);
                    }
                    const before = target.current_stock;
                    const checkRecord = new InventoryCheck();
                    checkRecord.check_id = v7().replace(/-/g, '');
                    checkRecord.item_id = dto.item_id;
                    checkRecord.spec = target.spec;
                    checkRecord.before_stock = before;
                    checkRecord.after_stock = input.after_stock;
                    checkRecord.date = checkDate;
                    if (dto.remark) {
                        checkRecord.remark = dto.remark;
                    }
                    checkRecord.status = 1;
                    checkRecord.create_time = now;
                    await manager.save(InventoryCheck, checkRecord);
                    await manager.update(
                        InventoryItemSpec,
                        { spec_id: target.spec_id },
                        { current_stock: input.after_stock, update_time: now }
                    );
                }
            });

            return { result: 0, msg: '盘点成功' };
        } catch (error) {
            this.logger.error('盘点失败:', error);
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
            .where('item.item_id IN (:...ids) AND item.status = :status', { ids: itemIds, status: 1 })
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
                return { ok: false, msg: `零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}` };
            }
        }

        return { ok: true, specMap };
    }

    /**
     * 执行入库(同一批次共用 record_no,事务原子)
     */
    private async executeStockIn(itemSpecs: StockItem[], date: string, remark?: string) {
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

        await this.stockInRepository.manager.transaction(async (manager) => {
            for (const itemSpec of itemSpecs) {
                const record = new StockInRecord();
                record.record_id = v7().replace(/-/g, '');
                record.record_no = recordNo;
                record.item_id = itemSpec.item_id;
                record.spec_id = itemSpec.spec_id;
                record.quantity = itemSpec.quantity;
                record.date = inDate;
                if (remark) {
                    record.remark = remark;
                }
                record.create_time = now;
                await manager.save(StockInRecord, record);
            }

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
        const keys = itemSpecs.map((l) => `${l.item_id}||${l.spec_id}`);
        if (new Set(keys).size !== keys.length) {
            return { ok: false, msg: '出库列表存在重复的(零件+规格)' };
        }

        const itemIds = [...new Set(itemSpecs.map((l) => l.item_id))];
        const items = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .where('item.item_id IN (:...ids) AND item.status = :status', { ids: itemIds, status: 1 })
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
                return { ok: false, msg: `零件 ${itemSpec.item_id} 不存在规格 ${itemSpec.spec_id}` };
            }
            if (spec.current_stock < itemSpec.quantity) {
                this.logger.error(`规格 ${itemSpec.spec_id} 库存不足(当前 ${spec.current_stock},需要 ${itemSpec.quantity})`);
                return {
                    ok: false,
                    msg: `规格 ${itemSpec.spec_id} 库存不足(当前 ${spec.current_stock},需要 ${itemSpec.quantity})`,
                };
            }
        }

        return { ok: true, specMap };
    }

    /**
     * 执行出库(同一批次共用 record_no,事务原子)
     */
    private async executeStockOut(itemSpecs: StockItem[], date: string, remark?: string) {
        const recordNo = await this.generateStockOutRecordNo();
        const now = new Date();
        const outDate = new Date(date);
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

        await this.stockOutRepository.manager.transaction(async (manager) => {
            for (const itemSpec of itemSpecs) {
                const record = new StockOutRecord();
                record.record_id = v7().replace(/-/g, '');
                record.record_no = recordNo;
                record.item_id = itemSpec.item_id;
                record.spec_id = itemSpec.spec_id;
                record.quantity = itemSpec.quantity;
                record.date = outDate;
                if (remark) {
                    record.remark = remark;
                }
                record.create_time = now;
                await manager.save(StockOutRecord, record);
            }

            for (const [specId, deduct] of stockDelta) {
                const spec = specById.get(specId);
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
            .select("MAX(SUBSTRING(record.record_no, 3)::INTEGER)", 'maxNum')
            .where("record.record_no ~ :pattern", { pattern: '^SI[0-9]{6}$' })
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
            .select("MAX(SUBSTRING(record.record_no, 3)::INTEGER)", 'maxNum')
            .where("record.record_no ~ :pattern", { pattern: '^SO[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('出库记录编号已达上限');
        }
        return `SO${String(nextNum).padStart(6, '0')}`;
    }
}

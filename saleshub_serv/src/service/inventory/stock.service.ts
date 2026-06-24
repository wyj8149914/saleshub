import { InventoryItem, InventoryItemSpec, ProductItem } from '../../entity/product.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/stock.entity';
import { StockInDto, StockOutDto, StockCheckDto, ListStockHistoryDto } from '../../dto/stock.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class StockService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private stockInRepository = AppDataSource.getRepository(StockInRecord);
    private stockOutRepository = AppDataSource.getRepository(StockOutRecord);
    private inventoryCheckRepository = AppDataSource.getRepository(InventoryCheck);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 入库操作
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
                where: { item_id: dto.item_id, spec: dto.spec, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: `零件不存在规格 "${dto.spec}"` };
            }

            const recordNo = await this.generateStockInRecordNo();
            const now = new Date();
            const record = new StockInRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.spec = dto.spec;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            record.photo_id = dto.photo_id;
            if (dto.remark) {
                record.remark = dto.remark;
            }
            record.status = 1;
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
     * 出库操作
     */
    async stockOut(dto: StockOutDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            if (item.type !== 'device') {
                return { result: 1, msg: '只有设备件可以出库' };
            }

            const spec = await this.inventoryItemSpecRepository.findOne({
                where: { item_id: dto.item_id, spec: dto.spec, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: `零件不存在规格 "${dto.spec}"` };
            }

            const rel = await this.productItemRepository.findOne({
                where: {
                    product_id: dto.product_id,
                    item_id: dto.item_id,
                    spec_id: spec.spec_id,
                    status: 1,
                },
            });
            if (!rel) {
                return { result: 1, msg: '该零件+规格未关联到此产品' };
            }

            if (spec.current_stock < dto.quantity) {
                return {
                    result: 1,
                    msg: `规格 "${dto.spec}" 库存不足(当前 ${spec.current_stock},需要 ${dto.quantity})`,
                };
            }

            const recordNo = await this.generateStockOutRecordNo();
            const now = new Date();
            const record = new StockOutRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.product_id = dto.product_id;
            record.item_id = dto.item_id;
            record.spec = dto.spec;
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
                    { spec_id: spec.spec_id },
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

            const specValues = dto.specs.map((s) => s.spec);
            const dedup = new Set(specValues);
            if (dedup.size !== specValues.length) {
                return { result: 1, msg: '盘点规格列表存在重复' };
            }

            const specs = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .where('s.item_id = :itemId AND s.status = :status AND s.spec IN (:...specValues)', {
                    itemId: dto.item_id,
                    status: 1,
                    specValues,
                })
                .getMany();
            if (specs.length !== specValues.length) {
                const found = new Set(specs.map((s) => s.spec));
                const missing = specValues.filter((v) => !found.has(v));
                return { result: 1, msg: `零件不存在规格: ${missing.join(',')}` };
            }
            const specMap = new Map(specs.map((s) => [s.spec, s]));

            const now = new Date();
            const checkDate = new Date(dto.date);

            await this.inventoryCheckRepository.manager.transaction(async (manager) => {
                for (const input of dto.specs) {
                    const target = specMap.get(input.spec);
                    if (!target) {
                        throw new Error(`规格 "${input.spec}" 未找到`);
                    }
                    const before = target.current_stock;
                    const checkRecord = new InventoryCheck();
                    checkRecord.check_id = v7().replace(/-/g, '');
                    checkRecord.item_id = dto.item_id;
                    checkRecord.spec = input.spec;
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
     * 生成入库记录编号:SI + 6位递增数字(如 SI000001)
     */
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

    /**
     * 生成出库记录编号:SO + 6位递增数字(如 SO000001)
     */
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

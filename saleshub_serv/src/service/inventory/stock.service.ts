import { InventoryItem, ProductItem } from '../../entity/product.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/stock.entity';
import { StockInDto, StockOutDto, StockCheckDto, ListStockHistoryDto } from '../../dto/stock.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class StockService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
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
                return { result: 1, msg: '零件不存在', alg: '', datas: null };
            }

            const recordNo = await this.generateStockInRecordNo();
            const record = new StockInRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.item_id = dto.item_id;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            record.photo_url = dto.photo_url;
            if (dto.remark) {
                record.remark = dto.remark;
            }

            const saved = await this.stockInRepository.save(record);
            const afterStock = item.current_stock + dto.quantity;
            await this.inventoryItemRepository.update(
                { item_id: dto.item_id },
                { current_stock: afterStock }
            );

            return {
                result: 0,
                msg: '入库成功',
                alg: '',
                datas: { record_id: saved.record_id, after_stock: afterStock },
            };
        } catch (error) {
            this.logger.error('入库失败:', error);
            return { result: 1, msg: '入库失败', alg: '', datas: null };
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
                return { result: 1, msg: '零件不存在', alg: '', datas: null };
            }

            if (item.type !== 'device') {
                return { result: 1, msg: '只有设备件可以出库', alg: '', datas: null };
            }

            const rel = await this.productItemRepository.findOne({
                where: { product_id: dto.product_id, item_id: dto.item_id, status: 1 },
            });
            if (!rel) {
                return { result: 1, msg: '该零件未关联到此产品', alg: '', datas: null };
            }

            const recordNo = await this.generateStockOutRecordNo();
            const record = new StockOutRecord();
            record.record_id = v7().replace(/-/g, '');
            record.record_no = recordNo;
            record.product_id = dto.product_id;
            record.item_id = dto.item_id;
            record.quantity = dto.quantity;
            record.date = new Date(dto.date);
            if (dto.remark) {
                record.remark = dto.remark;
            }

            const saved = await this.stockOutRepository.save(record);
            const afterStock = item.current_stock - dto.quantity;
            await this.inventoryItemRepository.update(
                { item_id: dto.item_id },
                { current_stock: afterStock }
            );

            return {
                result: 0,
                msg: '出库成功',
                alg: '',
                datas: { record_id: saved.record_id, after_stock: afterStock },
            };
        } catch (error) {
            this.logger.error('出库失败:', error);
            return { result: 1, msg: '出库失败', alg: '', datas: null };
        }
    }

    /**
     * 查询零件历史记录（入库、出库、盘点）
     */
    async listHistory(dto: ListStockHistoryDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在', alg: '', datas: null };
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
                .createQueryBuilder('in')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const outRecords = await this.stockOutRepository
                .createQueryBuilder('out')
                .where('item_id = :itemId AND status = :status' + dateCondition, params)
                .orderBy('create_time', 'DESC')
                .getMany();

            const checkRecords = await this.inventoryCheckRepository
                .createQueryBuilder('check')
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

            return { result: 0, msg: 'success', alg: '', datas: { total, items } };
        } catch (error) {
            this.logger.error('查询历史记录失败:', error);
            return { result: 1, msg: '查询失败', alg: '', datas: null };
        }
    }

    /**
     * 库存盘点
     */
    async stockCheck(dto: StockCheckDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在', alg: '', datas: null };
            }

            const beforeStock = item.current_stock;
            const record = new InventoryCheck();
            record.check_id = v7().replace(/-/g, '');
            record.item_id = dto.item_id;
            record.before_stock = beforeStock;
            record.after_stock = dto.after_stock;
            record.date = new Date(dto.date);
            if (dto.remark) {
                record.remark = dto.remark;
            }

            const saved = await this.inventoryCheckRepository.save(record);
            await this.inventoryItemRepository.update(
                { item_id: dto.item_id },
                { current_stock: dto.after_stock }
            );

            return {
                result: 0,
                msg: '盘点成功',
                alg: '',
                datas: { check_id: saved.check_id, before_stock: beforeStock, after_stock: dto.after_stock },
            };
        } catch (error) {
            this.logger.error('盘点失败:', error);
            return { result: 1, msg: '盘点失败', alg: '', datas: null };
        }
    }

    /**
     * 生成入库记录编号：SI + 6位递增数字（如 SI000001）
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
     * 生成出库记录编号：SO + 6位递增数字（如 SO000001）
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

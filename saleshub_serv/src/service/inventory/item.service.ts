import { InventoryItem, InventoryItemSpec, ProductItem } from '../../entity/product.entity';
import { CreateInventoryItemDto, ItemIdDto, ListInventoryItemDto, UpdateInventoryItemDto } from '../../dto/item.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import { generateFileUrl } from '../../config/minio.config';

export class InventoryItemService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 创建零件
     */
    async create(dto: CreateInventoryItemDto) {
        try {
            const code = await this.generateItemCode();
            const itemId = v7().replace(/-/g, '');
            const now = new Date();

            const item = new InventoryItem();
            item.item_id = itemId;
            item.code = code;
            item.type = dto.type;
            item.name = dto.name;
            if (dto.warnStock) {
                item.warn_stock = dto.warnStock;
            }
            if (dto.image_id) {
                item.image_id = dto.image_id;
            }

            const specs = this.normalizeSpecs(dto.specs);
            const specRows: InventoryItemSpec[] = specs.map((spec) => {
                const row = new InventoryItemSpec();
                row.spec_id = v7().replace(/-/g, '');
                row.item_id = itemId;
                row.spec = spec;
                return row;
            });

            await this.inventoryItemRepository.manager.transaction(async (manager) => {
                await manager.save(InventoryItem, item);
                await manager.save(InventoryItemSpec, specRows);
            });

            return { result: 0, msg: '创建成功', datas: { item_id: itemId } };
        } catch (error) {
            this.logger.error('创建零件失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 查询所有正常状态的零件
     */
    async list(dto: ListInventoryItemDto) {
        try {
            const queryBuilder = this.inventoryItemRepository
                .createQueryBuilder('item')
                .select([
                    'item.item_id AS item_id',
                    'item.type AS type',
                    'item.name AS name',
                    'item.code AS code',
                    'item.warn_stock AS warn_stock',
                    'item.image_id AS image_id',
                ])
                .where('item.status = :status', { status: 1 });

            if (dto.type) {
                queryBuilder.andWhere('item.type = :type', { type: dto.type });
            }
            if (dto.name) {
                queryBuilder.andWhere('item.name LIKE :name', { name: `%${dto.name}%` });
            }
            if (dto.code) {
                queryBuilder.andWhere('item.code = :code', { code: dto.code });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('item.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            const itemIds = items.map((it: any) => it.item_id);
            const specRows =
                itemIds.length > 0
                    ? await this.inventoryItemSpecRepository
                        .createQueryBuilder('s')
                        .select([
                            's.spec_id AS spec_id',
                            's.item_id AS item_id',
                            's.spec AS spec',
                            's.current_stock AS current_stock',
                        ])
                        .where('s.item_id IN (:...ids) AND s.status = :status', { ids: itemIds, status: 1 })
                        .getRawMany()
                    : [];

            const specMap = new Map<string, any[]>();
            for (const row of specRows) {
                if (!specMap.has(row.item_id)) specMap.set(row.item_id, []);
                specMap.get(row.item_id)?.push({ spec: row.spec, current_stock: Number(row.current_stock) });
            }

            const datas = items.map((it: any) => ({
                item_id: it.item_id,
                type: it.type,
                name: it.name,
                code: it.code,
                warn_stock: it.warn_stock,
                image_id: it.image_id,
                total_stock: Number(it.total_stock),
                specs: specMap.get(it.item_id) || [],
                image_url: generateFileUrl(it.image_id ?? ''),
            }));

            return { result: 0, msg: 'success', datas: { total, items: datas } };
        } catch (error) {
            this.logger.error('查询零件列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 更新零件信息
     * - dto.specs 为 undefined: 规格不变(仅更新其他字段)
     * - dto.specs 为 [](空数组): 清空所有规格,改为默认 SKU(需所有现存规格库存为 0)
     * - dto.specs 为非空数组: 同步为该列表(新增/保留/删除)
     */
    async update(dto: UpdateInventoryItemDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            item.type = dto.type;
            item.name = dto.name;
            if (dto.warnStock) {
                item.warn_stock = dto.warnStock;
            }
            if (dto.image_id !== undefined) {
                item.image_id = dto.image_id;
            }
            item.update_time = new Date();

            // 规格未传则保持不变,只更新零件主表
            if (dto.specs === undefined) {
                await this.inventoryItemRepository.save(item);
                return { result: 0, msg: '更新成功' };
            }

            const existingSpecs = await this.inventoryItemSpecRepository.find({
                where: { item_id: dto.item_id, status: 1 },
            });
            const newSpecs = this.normalizeSpecs(dto.specs);
            const existingSpecValues = new Set(existingSpecs.map((s) => s.spec));
            const newSpecSet = new Set(newSpecs);

            const toRemove = existingSpecs.filter((s) => !newSpecSet.has(s.spec));
            const toAdd = newSpecs.filter((spec) => !existingSpecValues.has(spec));

            for (const s of toRemove) {
                if (s.current_stock !== 0) {
                    return { result: 1, msg: `规格 "${s.spec}" 库存非零,不能删除` };
                }
            }

            const now = new Date();
            const addRows: InventoryItemSpec[] = toAdd.map((spec) => {
                const row = new InventoryItemSpec();
                row.spec_id = v7().replace(/-/g, '');
                row.item_id = dto.item_id;
                row.spec = spec;
                row.create_time = now;
                row.update_time = now;
                return row;
            });

            await this.inventoryItemRepository.manager.transaction(async (manager) => {
                await manager.save(InventoryItem, item);
                if (toRemove.length > 0) {
                    await manager.update(
                        InventoryItemSpec,
                        toRemove.map((s) => s.spec_id),
                        { status: 2, update_time: now }
                    );
                }
                if (addRows.length > 0) {
                    await manager.save(InventoryItemSpec, addRows);
                }
            });

            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新零件失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 软删除零件(设置状态为2)
     */
    async delete(dto: ItemIdDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            const productItems = await this.productItemRepository.find({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (productItems.length > 0) {
                return { result: 1, msg: '零件有产品使用,不能删除' };
            }

            const specs = await this.inventoryItemSpecRepository.find({
                where: { item_id: dto.item_id, status: 1 },
            });
            const nonZero = specs.find((s) => s.current_stock !== 0);
            if (nonZero) {
                return { result: 1, msg: `规格 "${nonZero.spec}" 库存非零,不能删除` };
            }

            const now = new Date();
            await this.inventoryItemRepository.manager.transaction(async (manager) => {
                await manager.update(
                    InventoryItem,
                    { item_id: dto.item_id },
                    { status: 2, update_time: now }
                );
                await manager.update(
                    InventoryItemSpec,
                    { item_id: dto.item_id, status: 1 },
                    { status: 2, update_time: now }
                );
            });

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除零件失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 规格标准化:undefined/空数组 → [''](默认 SKU);去重
     */
    private normalizeSpecs(specs: string[] | undefined): string[] {
        if (!specs || specs.length === 0) {
            return [''];
        }
        const seen = new Set<string>();
        const out: string[] = [];
        for (const s of specs) {
            if (!seen.has(s)) {
                seen.add(s);
                out.push(s);
            }
        }
        return out;
    }

    /**
     * 生成零件编码:IT + 6位递增数字(如 IT000001)
     */
    private async generateItemCode() {
        const result = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .select("MAX(SUBSTRING(item.code, 3)::INTEGER)", 'maxNum')
            .where("item.code ~ :pattern", { pattern: '^IT[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('零件编码已达上限');
        }
        return `IT${String(nextNum).padStart(6, '0')}`;
    }
}

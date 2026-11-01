import { InventoryItem, InventoryItemSpec, ProductItem } from '../../entity/product.entity';
import { ItemType } from '../../entity/product.entity';
import {
    CreateInventoryItemDto,
    ItemIdDto,
    ListInventoryItemDto,
    UpdateInventoryItemDto,
} from '../../dto/item.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import { generateFileUrl } from '../../config/minio.config';
import { MinioFile } from '../../entity/file.entity';
import { Not } from 'typeorm';
import { InventoryItemSpecWarehouse } from '../../entity/warehouse.entity';

/** 零件列表原始行(getRawMany,含类型与图片联查字段) */
interface ItemListRawRow {
    item_id: string;
    type_id: string;
    type_name: string | null;
    parent_type_name: string | null;
    name: string | null;
    code: string | null;
    warn_stock: number | null;
    image_id: string | null;
    remark: string | null;
    is_custom: number;
    image_object_name: string | null;
}

/** 规格原始行(getRawMany) */
interface SpecRawRow {
    spec_id: string;
    item_id: string;
    spec: string | null;
    price: string | null;
    current_stock: number | null;
}

/** 规格摘要(列表组装用,current_stock 已转为数值) */
interface SpecSummary {
    spec_id: string;
    spec: string | null;
    price: string | null;
    current_stock: number;
}

/** 规格-仓库分配库存原始行(getRawMany) */
interface SpecWarehouseRawRow {
    spec_id: string;
    warehouse_id: string;
    warehouse_stock: number | null;
}

export class InventoryItemService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private itemTypeRepository = AppDataSource.getRepository(ItemType);
    private specWarehouseRepository = AppDataSource.getRepository(InventoryItemSpecWarehouse);
    private logger = getLogger('SALESHUB_SERV');

    /**
     * 创建零件
     */
    async create(dto: CreateInventoryItemDto) {
        try {
            // 查询是否已有同名零件
            const existing = await this.inventoryItemRepository.findOne({
                where: { name: dto.name, status: 1, type_id: dto.type_id },
            });
            if (existing) {
                return { result: 1, msg: '零件名称已存在' };
            }

            // 验证 type_id 存在且状态正常
            const itemType = await this.itemTypeRepository.findOne({
                where: { type_id: dto.type_id, status: 1 },
            });
            if (!itemType) {
                return { result: 1, msg: '类型不存在' };
            }

            const code = await this.generateItemCode();
            const itemId = v7().replace(/-/g, '');

            const item = new InventoryItem();
            item.item_id = itemId;
            item.code = code;
            item.type_id = dto.type_id;
            item.name = dto.name;
            if (dto.warnStock !== null && dto.warnStock !== undefined) {
                item.warn_stock = dto.warnStock;
            }
            if (dto.image_id) {
                item.image_id = dto.image_id;
            }
            if (dto.remark !== undefined) {
                item.remark = dto.remark;
            }
            if (dto.is_custom !== undefined) {
                item.is_custom = dto.is_custom;
            }

            const specs = this.normalizeSpecs(dto.specs);
            const specRows: InventoryItemSpec[] = specs.map((specData) => {
                const row = new InventoryItemSpec();
                row.spec_id = v7().replace(/-/g, '');
                row.item_id = itemId;
                row.spec = specData.spec;
                if (specData.price !== undefined) {
                    row.price = specData.price;
                }
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
                .leftJoin(MinioFile, 'file', 'file.relation_id = item.image_id')
                .leftJoin(ItemType, 'type', 'type.type_id = item.type_id')
                .leftJoin(ItemType, 'pt', 'pt.type_id = type.parent_id')
                .select([
                    'item.item_id AS item_id',
                    'item.type_id AS type_id',
                    'type.type_name AS type_name',
                    'pt.type_name AS parent_type_name',
                    'item.name AS name',
                    'item.code AS code',
                    'item.warn_stock AS warn_stock',
                    'item.image_id AS image_id',
                    'item.remark AS remark',
                    'item.is_custom AS is_custom',
                    'file.object_name AS image_object_name',
                ])
                .where('item.status = :status', { status: 1 });

            if (dto.type_id) {
                queryBuilder.andWhere('item.type_id = :type_id', { type_id: dto.type_id });
            }
            if (dto.name) {
                queryBuilder.andWhere('item.name LIKE :name', { name: `%${dto.name}%` });
            }
            if (dto.code) {
                queryBuilder.andWhere('item.code = :code', { code: dto.code });
            }
            if (dto.is_custom) {
                queryBuilder.andWhere('item.is_custom = :is_custom', { is_custom: dto.is_custom });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder
                .orderBy('item.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany<ItemListRawRow>();

            const itemIds = items.map((it) => it.item_id);
            const specRows: SpecRawRow[] =
                itemIds.length > 0
                    ? await this.inventoryItemSpecRepository
                          .createQueryBuilder('s')
                          .select([
                              's.spec_id AS spec_id',
                              's.item_id AS item_id',
                              's.spec AS spec',
                              's.price AS price',
                              's.current_stock AS current_stock',
                          ])
                          .where('s.item_id IN (:...ids) AND s.status = :status', {
                              ids: itemIds,
                              status: 1,
                          })
                          .getRawMany<SpecRawRow>()
                    : [];

            const specMap = new Map<string, SpecSummary[]>();
            for (const row of specRows) {
                if (!specMap.has(row.item_id)) {
                    specMap.set(row.item_id, []);
                }
                specMap.get(row.item_id)?.push({
                    spec_id: row.spec_id,
                    spec: row.spec,
                    price: row.price,
                    current_stock: Number(row.current_stock),
                });
            }

            const datas = items.map((it) => {
                // 构建完整类型名称
                let type_full_name = it.type_name;
                if (it.parent_type_name) {
                    type_full_name = `${it.parent_type_name} > ${it.type_name}`;
                }

                return {
                    item_id: it.item_id,
                    type_id: it.type_id,
                    type_name: it.type_name,
                    type_full_name,
                    name: it.name,
                    code: it.code,
                    warn_stock: it.warn_stock,
                    image_id: it.image_id,
                    is_custom: it.is_custom,
                    specs: specMap.get(it.item_id) || [],
                    remark: it.remark,
                    image_url: generateFileUrl(it.image_object_name ?? ''),
                };
            });

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
     * - dto.specs 为非空数组: 按 spec_id 同步规格列表(新增/修改/删除)
     *   - 传了 spec_id: 修改对应已有规格(支持改名/改价)
     *   - 未传 spec_id: 新增规格
     *   - 已有规格中 spec_id 未出现在列表中的: 删除(需库存为 0)
     */
    async update(dto: UpdateInventoryItemDto) {
        try {
            // 查询是否已有同名零件
            const existing = await this.inventoryItemRepository.findOne({
                where: {
                    name: dto.name,
                    item_id: Not(dto.item_id),
                    status: 1,
                    type_id: dto.type_id,
                },
            });
            if (existing) {
                return { result: 1, msg: '零件名称已存在' };
            }

            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            // 验证 type_id 存在且状态正常
            if (dto.type_id) {
                const itemType = await this.itemTypeRepository.findOne({
                    where: { type_id: dto.type_id, status: 1 },
                });
                if (!itemType) {
                    return { result: 1, msg: '类型不存在' };
                }
                item.type_id = dto.type_id;
            }

            item.name = dto.name;
            if (dto.warnStock !== null && dto.warnStock !== undefined) {
                item.warn_stock = dto.warnStock;
            }
            if (dto.image_id !== undefined) {
                item.image_id = dto.image_id;
            }
            if (dto.remark !== undefined) {
                item.remark = dto.remark;
            }
            if (dto.is_custom !== undefined) {
                item.is_custom = dto.is_custom;
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
            const newSpecsData = this.normalizeSpecs(dto.specs);
            // 已有规格按 spec_id 索引,用于修改时匹配
            const existingSpecMap = new Map(existingSpecs.map((s) => [s.spec_id, s]));

            // 按 spec_id 区分新增与修改:传了 spec_id 表示修改已有规格,未传表示新增
            const toAddData = newSpecsData.filter((s) => !s.spec_id);
            const toUpdateData = newSpecsData.filter((s) => s.spec_id);
            const passedSpecIds = new Set(toUpdateData.map((s) => s.spec_id as string));

            // 需要删除的规格:已有规格中 spec_id 未出现在传入列表中
            const toRemove = existingSpecs.filter((s) => !passedSpecIds.has(s.spec_id));
            for (const s of toRemove) {
                if (s.current_stock !== 0) {
                    return { result: 1, msg: `规格 "${s.spec}" 库存非零,不能删除` };
                }
            }
            // 修改前校验:传入的 spec_id 必须对应当前零件的已有规格
            for (const s of toUpdateData) {
                if (!existingSpecMap.has(s.spec_id as string)) {
                    return { result: 1, msg: `规格 "${s.spec}" 不存在,不能修改` };
                }
            }

            const now = new Date();
            const addRows: InventoryItemSpec[] = toAddData.map((specData) => {
                const row = new InventoryItemSpec();
                row.spec_id = v7().replace(/-/g, '');
                row.item_id = dto.item_id;
                row.spec = specData.spec;
                if (specData.price !== undefined) {
                    row.price = specData.price;
                }
                row.create_time = now;
                row.update_time = now;
                return row;
            });

            // 收集需要修改的字段(仅更新发生变化的字段)
            const toUpdateEntries: {
                spec_id: string;
                fields: { spec?: string; price?: number };
            }[] = [];
            for (const specData of toUpdateData) {
                const existing = existingSpecMap.get(specData.spec_id as string)!;
                const fields: { spec?: string; price?: number } = {};
                if (specData.spec !== existing.spec) {
                    fields.spec = specData.spec;
                }
                if (specData.price !== undefined && specData.price !== existing.price) {
                    fields.price = specData.price;
                }
                if (Object.keys(fields).length > 0) {
                    toUpdateEntries.push({ spec_id: specData.spec_id as string, fields });
                }
            }

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
                if (toUpdateEntries.length > 0) {
                    for (const entry of toUpdateEntries) {
                        await manager.update(
                            InventoryItemSpec,
                            { spec_id: entry.spec_id },
                            { ...entry.fields, update_time: now }
                        );
                    }
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
     * 规格标准化:undefined/空数组 → [{spec:''}](默认 SKU);去重
     * - 传了 spec_id 的按 spec_id 去重(用于修改已有规格)
     * - 未传 spec_id 的按 spec 名称去重(用于新增规格)
     */
    private normalizeSpecs(
        specs?: { spec: string; price?: number; spec_id?: string }[]
    ): { spec: string; price?: number; spec_id?: string }[] {
        if (!specs || specs.length === 0) {
            return [{ spec: '' }];
        }
        const seenIds = new Set<string>();
        const seenSpecs = new Set<string>();
        const out: { spec: string; price?: number; spec_id?: string }[] = [];
        for (const s of specs) {
            if (s.spec_id) {
                if (!seenIds.has(s.spec_id)) {
                    seenIds.add(s.spec_id);
                    out.push(s);
                }
            } else if (!seenSpecs.has(s.spec)) {
                seenSpecs.add(s.spec);
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
            .select('MAX(SUBSTRING(item.code, 3)::INTEGER)', 'maxNum')
            .where('item.code ~ :pattern', { pattern: '^IT[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('零件编码已达上限');
        }
        return `IT${String(nextNum).padStart(6, '0')}`;
    }

    /**
     * 查询零件各规格的已分配/未分配库存信息
     * 用于前端懒加载展示规格分配库存
     */
    async listSpecAllocations(dto: ItemIdDto) {
        try {
            // 校验零件存在
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });
            if (!item) {
                return { result: 1, msg: '零件不存在' };
            }

            // 查询该零件的所有规格
            const specs = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .select([
                    's.spec_id AS spec_id',
                    's.item_id AS item_id',
                    's.spec AS spec',
                    's.price AS price',
                    's.current_stock AS current_stock',
                ])
                .where('s.item_id = :itemId AND s.status = :status', {
                    itemId: dto.item_id,
                    status: 1,
                })
                .orderBy('s.create_time', 'ASC')
                .getRawMany<SpecRawRow>();

            if (specs.length === 0) {
                return { result: 0, msg: 'success', datas: [] };
            }

            const specIds = specs.map((s) => s.spec_id);

            // 查询各规格在各仓库的已分配库存
            const warehouseStocks = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .select([
                    'sw.spec_id AS spec_id',
                    'sw.warehouse_id AS warehouse_id',
                    'sw.current_stock AS warehouse_stock',
                ])
                .where('sw.spec_id IN (:...specIds) AND sw.status = 1', { specIds })
                .getRawMany<SpecWarehouseRawRow>();

            // 按规格分组汇总已分配库存
            const allocatedStockMap = new Map<string, number>();
            for (const ws of warehouseStocks) {
                const current = allocatedStockMap.get(ws.spec_id) || 0;
                allocatedStockMap.set(ws.spec_id, current + (ws.warehouse_stock || 0));
            }

            // 组装返回数据
            const datas = specs.map((spec) => {
                const allocatedStock = allocatedStockMap.get(spec.spec_id) || 0;
                const unallocatedStock = (spec.current_stock ?? 0) - allocatedStock;

                return {
                    spec_id: spec.spec_id,
                    item_id: spec.item_id,
                    spec: spec.spec,
                    price: spec.price,
                    current_stock: Number(spec.current_stock),
                    allocated_stock: allocatedStock,
                    unallocated_stock: unallocatedStock,
                };
            });

            return { result: 0, msg: 'success', datas };
        } catch (error) {
            this.logger.error('查询零件规格分配库存失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }
}

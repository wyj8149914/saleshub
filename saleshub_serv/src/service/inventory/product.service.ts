import { EntityManager, Not } from 'typeorm';
import { Product, ProductItem, InventoryItem, InventoryItemSpec, ItemType, ProductModule } from '../../entity/product.entity';
import { MinioFile } from '../../entity/file.entity';
import {
    CreateProductDto, ProductIdDto, ListProductDto, UpdateProductDto, SetProductItemsDto,
    CreateModuleDto, UpdateModuleDto, ListModuleDto, ModuleIdDto, SetModuleItemsDto,
} from '../../dto/product.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import { generateFileUrl } from '../../config/minio.config';

export class ProductService {
    private productRepository = AppDataSource.getRepository(Product);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private inventoryItemSpecRepository = AppDataSource.getRepository(InventoryItemSpec);
    private productModuleRepository = AppDataSource.getRepository(ProductModule);
    private logger = getLogger('SALESHUB_SERV');

    /**
     * 创建产品
     */
    async create(dto: CreateProductDto) {
        try {
            // 查询是否已有同名产品
            const existing = await this.productRepository.findOne({
                where: { name: dto.name, status: 1 },
            });
            if (existing) {
                return { result: 1, msg: '产品名称已存在' };
            }

            const code = await this.generateProductCode();
            const productId = v7().replace(/-/g, '');
            const now = new Date();

            const product = new Product();
            product.product_id = productId;
            product.code = code;
            product.name = dto.name;
            if (dto.description) {
                product.description = dto.description;
            }
            if (dto.image_id) {
                product.image_id = dto.image_id;
            }
            if (dto.price !== undefined) {
                product.price = dto.price;
            }
            if (dto.remark !== undefined) {
                product.remark = dto.remark;
            }
            product.status = 1;
            product.create_time = now;
            product.update_time = now;

            const saved = await this.productRepository.save(product);
            return { result: 0, msg: '创建成功', datas: { product_id: saved.product_id } };
        } catch (error) {
            this.logger.error('创建产品失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 查询所有正常状态的产品
     */
    async list(dto: ListProductDto) {
        try {
            const queryBuilder = this.productRepository.createQueryBuilder('product')
                .leftJoin(MinioFile, 'file', 'file.relation_id = product.image_id')
                .select([
                    'product.product_id AS product_id',
                    'product.name AS name',
                    'product.code AS code',
                    'product.description AS description',
                    'product.image_id AS image_id',
                    'product.price AS price',
                    'product.remark AS remark',
                    'file.object_name AS image_object_name',
                ])
                .where('product.status = :status', { status: 1 });

            if (dto.name) {
                queryBuilder.andWhere('product.name LIKE :name', { name: `%${dto.name}%` });
            }
            if (dto.code) {
                queryBuilder.andWhere('product.code = :code', { code: dto.code });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const products = await queryBuilder
                .orderBy('product.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            // 查询产品图片
            products.forEach((product) => {
                product.image_url = generateFileUrl(product.image_object_name ?? '');
            });

            return { result: 0, msg: 'success', datas: { total, items: products } };
        } catch (error) {
            this.logger.error('查询产品列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 更新产品信息
     */
    async update(dto: UpdateProductDto) {
        try {
            // 查询是否已有同名产品
            const existing = await this.productRepository.findOne({
                where: { name: dto.name, product_id: Not(dto.product_id), status: 1 },
            });
            if (existing) {
                return { result: 1, msg: '产品名称已存在' };
            }

            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            product.name = dto.name;
            if (dto.description !== undefined) {
                product.description = dto.description;
            }
            if (dto.image_id !== undefined) {
                product.image_id = dto.image_id;
            }
            if (dto.price !== undefined) {
                product.price = dto.price;
            }
            if (dto.remark !== undefined) {
                product.remark = dto.remark;
            }
            product.update_time = new Date();

            await this.productRepository.save(product);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新产品失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 软删除产品(设置状态为2)
     */
    async delete(dto: ProductIdDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            const now = new Date();
            await this.productRepository.manager.transaction(async (manager) => {
                await manager.update(
                    Product,
                    { product_id: dto.product_id },
                    { status: 2, update_time: now }
                );
                await manager.update(
                    ProductItem,
                    { product_id: dto.product_id, status: 1 },
                    { status: 2, update_time: now }
                );
            });

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除产品失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 设置产品零件(全量覆盖语义)
     * 传入 product_id 与完整 item 列表(含 spec_id),使产品的有效关联(status=1)等于列表
     */
    async setProductItems(dto: SetProductItemsDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            // 检查产品是否已有模块
            const moduleCount = await this.productModuleRepository.count({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (moduleCount > 0) {
                return { result: 1, msg: '该产品已使用模块方式管理零件，无法直接关联零件' };
            }

            if (dto.items.length === 0) {
                await this.productItemRepository.update({ product_id: dto.product_id }, { status: 2, update_time: new Date() });
                return { result: 0, msg: '设置成功' };
            }

            // 去重校验:(item_id, spec_id) 必须唯一
            const keys = dto.items.map((it) => `${it.item_id}||${it.spec_id}`);
            const dedup = new Set(keys);
            if (dedup.size !== keys.length) {
                return { result: 1, msg: '零件列表存在重复的(零件+规格)' };
            }

            const itemIds = [...new Set(dto.items.map((it) => it.item_id))];
            const items = await this.inventoryItemRepository
                .createQueryBuilder('item')
                .where('item.item_id IN (:...ids) AND item.status = :status', { ids: itemIds, status: 1 })
                .getMany();
            if (items.length !== itemIds.length) {
                const found = new Set(items.map((i: InventoryItem) => i.item_id));
                const missing = itemIds.filter((id) => !found.has(id));
                return { result: 1, msg: `零件不存在或已停用: ${missing.join(',')}` };
            }

            const specIds = dto.items.map((it) => it.spec_id);
            const specRows = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .where('s.spec_id IN (:...ids) AND s.status = :status', { ids: specIds, status: 1 })
                .getMany();
            const specMap = new Map(specRows.map((s) => [s.spec_id, s]));
            for (const it of dto.items) {
                const specRow = specMap.get(it.spec_id);
                if (!specRow) {
                    return { result: 1, msg: `规格不存在或已停用: ${it.spec_id}` };
                }
                if (specRow.item_id !== it.item_id) {
                    return { result: 1, msg: `规格 ${it.spec_id} 不属于零件 ${it.item_id}` };
                }
            }

            const now = new Date();
            const productItems: ProductItem[] = dto.items.map((it) => {
                const pi = new ProductItem();
                pi.relation_id = v7().replace(/-/g, '');
                pi.product_id = dto.product_id;
                pi.item_id = it.item_id;
                pi.module_id = null as any;  // 确保直接关联时 module_id 为空
                pi.quantity_per_product = it.quantity_per_product ?? 1;
                pi.spec_id = it.spec_id;
                pi.remark = it.remark ?? null;
                pi.status = 1;
                pi.create_time = now;
                pi.update_time = now;
                return pi;
            });

            await this.productItemRepository.manager.transaction(async (manager: EntityManager) => {
                await manager.update(ProductItem, { product_id: dto.product_id }, { status: 2, update_time: now });
                await manager.save(ProductItem, productItems);
            });

            return { result: 0, msg: '设置成功' };
        } catch (error) {
            this.logger.error('设置产品零件失败:', error);
            return { result: 1, msg: '设置失败' };
        }
    }

    /**
     * 查询产品的零件列表(含模块分组信息)
     */
    async getProductItems(dto: ProductIdDto) {
        try {
            const mode = await this.getProductItemMode(dto.product_id);

            if (mode === 'module') {
                // 模块方式：返回模块列表及每个模块下的零件
                const modules = await this.productModuleRepository
                    .createQueryBuilder('m')
                    .where('m.product_id = :productId AND m.status = :status', {
                        productId: dto.product_id,
                        status: 1,
                    })
                    .orderBy('m.sort_order', 'ASC')
                    .addOrderBy('m.create_time', 'ASC')
                    .getMany();

                const moduleIds = modules.map((m) => m.module_id);
                let allItems: any[] = [];

                if (moduleIds.length > 0) {
                    allItems = await this.productItemRepository
                        .createQueryBuilder('pi')
                        .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                        .leftJoin(InventoryItemSpec, 's', 's.spec_id = pi.spec_id AND s.status = 1')
                        .leftJoin(ItemType, 't', 't.type_id = i.type_id')
                        .select([
                            'pi.relation_id AS relation_id',
                            'pi.product_id AS product_id',
                            'pi.module_id AS module_id',
                            'pi.item_id AS item_id',
                            'pi.quantity_per_product AS quantity_per_product',
                            'pi.spec_id AS spec_id',
                            's.spec AS spec',
                            'pi.remark AS remark',
                            'i.name AS item_name',
                            'i.code AS item_code',
                            'i.type_id AS type_id',
                            't.type_name AS type_name',
                            'i.warn_stock AS warn_stock',
                            's.current_stock AS current_stock',
                        ])
                        .where('pi.module_id IN (:...moduleIds) AND pi.status = :status', {
                            moduleIds,
                            status: 1,
                        })
                        .orderBy('pi.create_time', 'DESC')
                        .getRawMany();
                }

                // 按模块分组
                const modulesWithItems = modules.map((m) => ({
                    module_id: m.module_id,
                    name: m.name,
                    sort_order: m.sort_order,
                    remark: m.remark,
                    items: allItems.filter((item) => item.module_id === m.module_id),
                }));

                return {
                    result: 0,
                    msg: 'success',
                    datas: {
                        use_module: true,
                        modules: modulesWithItems,
                    },
                };
            } else {
                // 直接关联方式：返回零件列表
                const rows = await this.productItemRepository
                    .createQueryBuilder('pi')
                    .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                    .leftJoin(
                        InventoryItemSpec,
                        's',
                        's.spec_id = pi.spec_id AND s.status = 1'
                    )
                    .leftJoin(ItemType, 't', 't.type_id = i.type_id')
                    .select([
                        'pi.relation_id AS relation_id',
                        'pi.product_id AS product_id',
                        'pi.module_id AS module_id',
                        'pi.item_id AS item_id',
                        'pi.quantity_per_product AS quantity_per_product',
                        'pi.spec_id AS spec_id',
                        's.spec AS spec',
                        'pi.remark AS remark',
                        'i.name AS item_name',
                        'i.code AS item_code',
                        'i.type_id AS type_id',
                        't.type_name AS type_name',
                        'i.warn_stock AS warn_stock',
                        's.current_stock AS current_stock',
                    ])
                    .where(
                        'pi.product_id = :productId AND pi.status = :status AND pi.module_id IS NULL',
                        {
                            productId: dto.product_id,
                            status: 1,
                        }
                    )
                    .orderBy('pi.create_time', 'DESC')
                    .getRawMany();

                return {
                    result: 0,
                    msg: 'success',
                    datas: {
                        use_module: false,
                        items: rows,
                    },
                };
            }
        } catch (error) {
            this.logger.error('查询产品零件失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 检查产品的零件关联模式
     * @returns 'module' - 使用模块方式, 'direct' - 直接关联方式, 'none' - 未选择
     */
    private async getProductItemMode(productId: string): Promise<'module' | 'direct' | 'none'> {
        // 检查是否有模块
        const moduleCount = await this.productModuleRepository.count({
            where: { product_id: productId, status: 1 },
        });
        if (moduleCount > 0) {
            return 'module';
        }

        // 检查是否有直接关联的零件
        const directItemCount = await this.productItemRepository.count({
            where: { product_id: productId, status: 1, module_id: null as any },
        });
        if (directItemCount > 0) {
            return 'direct';
        }

        return 'none';
    }

    /**
     * 创建模块
     */
    async createModule(dto: CreateModuleDto) {
        try {
            // 检查产品是否存在
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            // 检查产品是否已有直接关联的零件
            const mode = await this.getProductItemMode(dto.product_id);
            if (mode === 'direct') {
                return { result: 1, msg: '该产品已直接关联零件，无法创建模块' };
            }

            // 检查模块名称是否重复
            const existing = await this.productModuleRepository.findOne({
                where: { product_id: dto.product_id, name: dto.name, status: 1 },
            });
            if (existing) {
                return { result: 1, msg: '模块名称已存在' };
            }

            const moduleId = v7().replace(/-/g, '');
            const now = new Date();

            const module = new ProductModule();
            module.module_id = moduleId;
            module.product_id = dto.product_id;
            module.name = dto.name;
            if (dto.sort_order !== undefined) {
                module.sort_order = dto.sort_order;
            }
            if (dto.remark) {
                module.remark = dto.remark;
            }
            module.status = 1;
            module.create_time = now;
            module.update_time = now;

            await this.productModuleRepository.save(module);
            return { result: 0, msg: '创建成功', datas: { module_id: moduleId } };
        } catch (error) {
            this.logger.error('创建模块失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 查询产品的模块列表
     */
    async listModule(dto: ListModuleDto) {
        try {
            const modules = await this.productModuleRepository
                .createQueryBuilder('m')
                .select([
                    'm.module_id AS module_id',
                    'm.name AS name',
                    'm.sort_order AS sort_order',
                    'm.remark AS remark',
                ])
                .where('m.product_id = :productId AND m.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .orderBy('m.sort_order', 'ASC')
                .addOrderBy('m.create_time', 'ASC')
                .getRawMany();

            return { result: 0, msg: 'success', datas: modules };
        } catch (error) {
            this.logger.error('查询模块列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 更新模块信息
     */
    async updateModule(dto: UpdateModuleDto) {
        try {
            const module = await this.productModuleRepository.findOne({
                where: { module_id: dto.module_id, status: 1 },
            });
            if (!module) {
                return { result: 1, msg: '模块不存在' };
            }

            // 如果修改名称，检查是否重复
            if (dto.name && dto.name !== module.name) {
                const existing = await this.productModuleRepository.findOne({
                    where: {
                        product_id: module.product_id,
                        name: dto.name,
                        status: 1,
                    },
                });
                if (existing) {
                    return { result: 1, msg: '模块名称已存在' };
                }
                module.name = dto.name;
            }

            if (dto.sort_order !== undefined) {
                module.sort_order = dto.sort_order;
            }
            if (dto.remark !== undefined) {
                module.remark = dto.remark;
            }
            module.update_time = new Date();

            await this.productModuleRepository.save(module);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新模块失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 删除模块
     */
    async deleteModule(dto: ModuleIdDto) {
        try {
            const module = await this.productModuleRepository.findOne({
                where: { module_id: dto.module_id },
            });
            if (!module) {
                return { result: 1, msg: '模块不存在' };
            }

            // 检查模块下是否有零件
            const itemCount = await this.productItemRepository.count({
                where: { module_id: dto.module_id, status: 1 },
            });
            if (itemCount > 0) {
                return { result: 1, msg: '模块下存在零件，无法删除' };
            }

            const now = new Date();
            await this.productModuleRepository.update(
                { module_id: dto.module_id },
                { status: 2, update_time: now }
            );

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除模块失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 设置模块的零件列表(全量覆盖语义)
     */
    async setModuleItems(dto: SetModuleItemsDto) {
        try {
            const module = await this.productModuleRepository.findOne({
                where: { module_id: dto.module_id, status: 1 },
            });
            if (!module) {
                return { result: 1, msg: '模块不存在' };
            }

            if (dto.items.length === 0) {
                await this.productItemRepository.update({ module_id: dto.module_id }, { status: 2, update_time: new Date() });
                return { result: 0, msg: '设置成功' };
            }

            // 去重校验:(item_id, spec_id) 必须唯一
            const keys = dto.items.map((it) => `${it.item_id}||${it.spec_id}`);
            const dedup = new Set(keys);
            if (dedup.size !== keys.length) {
                return { result: 1, msg: '零件列表存在重复的(零件+规格)' };
            }

            // 校验零件是否存在
            const itemIds = [...new Set(dto.items.map((it) => it.item_id))];
            const items = await this.inventoryItemRepository
                .createQueryBuilder('item')
                .where('item.item_id IN (:...ids) AND item.status = :status', {
                    ids: itemIds,
                    status: 1,
                })
                .getMany();
            if (items.length !== itemIds.length) {
                const found = new Set(items.map((i: InventoryItem) => i.item_id));
                const missing = itemIds.filter((id) => !found.has(id));
                return { result: 1, msg: `零件不存在或已停用: ${missing.join(',')}` };
            }

            // 校验规格
            const specIds = dto.items.map((it) => it.spec_id);
            const specRows = await this.inventoryItemSpecRepository
                .createQueryBuilder('s')
                .where('s.spec_id IN (:...ids) AND s.status = :status', {
                    ids: specIds,
                    status: 1,
                })
                .getMany();
            const specMap = new Map(specRows.map((s) => [s.spec_id, s]));
            for (const it of dto.items) {
                const specRow = specMap.get(it.spec_id);
                if (!specRow) {
                    return { result: 1, msg: `规格不存在或已停用: ${it.spec_id}` };
                }
                if (specRow.item_id !== it.item_id) {
                    return {
                        result: 1,
                        msg: `规格 ${it.spec_id} 不属于零件 ${it.item_id}`,
                    };
                }
            }

            const now = new Date();
            const productItems: ProductItem[] = dto.items.map((it) => {
                const pi = new ProductItem();
                pi.relation_id = v7().replace(/-/g, '');
                pi.product_id = module.product_id;
                pi.item_id = it.item_id;
                pi.module_id = dto.module_id;
                pi.quantity_per_product = it.quantity_per_product ?? 1;
                pi.spec_id = it.spec_id;
                pi.remark = it.remark ?? null;
                pi.status = 1;
                pi.create_time = now;
                pi.update_time = now;
                return pi;
            });

            await this.productItemRepository.manager.transaction(
                async (manager: EntityManager) => {
                    await manager.update(
                        ProductItem,
                        { module_id: dto.module_id },
                        { status: 2, update_time: now }
                    );
                    await manager.save(ProductItem, productItems);
                }
            );

            return { result: 0, msg: '设置成功' };
        } catch (error) {
            this.logger.error('设置模块零件失败:', error);
            return { result: 1, msg: '设置失败' };
        }
    }

    /**
     * 查询模块的零件列表
     */
    async getModuleItems(dto: ModuleIdDto) {
        try {
            const module = await this.productModuleRepository.findOne({
                where: { module_id: dto.module_id, status: 1 },
            });
            if (!module) {
                return { result: 1, msg: '模块不存在' };
            }

            const rows = await this.productItemRepository
                .createQueryBuilder('pi')
                .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                .leftJoin(
                    InventoryItemSpec,
                    's',
                    's.spec_id = pi.spec_id AND s.status = 1'
                )
                .leftJoin(ItemType, 't', 't.type_id = i.type_id')
                .select([
                    'pi.relation_id AS relation_id',
                    'pi.product_id AS product_id',
                    'pi.module_id AS module_id',
                    'pi.item_id AS item_id',
                    'pi.quantity_per_product AS quantity_per_product',
                    'pi.spec_id AS spec_id',
                    's.spec AS spec',
                    'pi.remark AS remark',
                    'i.name AS item_name',
                    'i.code AS item_code',
                    'i.type_id AS type_id',
                    't.type_name AS type_name',
                    'i.warn_stock AS warn_stock',
                    's.current_stock AS current_stock',
                ])
                .where('pi.module_id = :moduleId AND pi.status = :status', {
                    moduleId: dto.module_id,
                    status: 1,
                })
                .orderBy('pi.create_time', 'DESC')
                .getRawMany();

            return { result: 0, msg: 'success', datas: { items: rows } };
        } catch (error) {
            this.logger.error('查询模块零件失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    async getProductDetail(dto: ProductIdDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
                select: ['product_id', 'name', 'code', 'description', 'image_id', 'price', 'remark'],
            });
            if (!product) {
                return { result: 1, msg: '产品不存在' };
            }

            const modules = await this.productModuleRepository.find({
                where: { product_id: dto.product_id, status: 1 },
                select: ['module_id', 'name', 'sort_order', 'remark'],
                order: { sort_order: 'ASC' },
            });

            const items = await this.productItemRepository.createQueryBuilder('pi')
                .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                .leftJoin(InventoryItemSpec, 's', 's.spec_id = pi.spec_id AND s.status = 1')
                .select([
                    'pi.item_id AS item_id',
                    'pi.spec_id AS spec_id',
                    's.spec AS spec',
                    's.price AS price',
                    's.current_stock AS current_stock',
                    'pi.module_id AS module_id',
                    'i.name AS item_name',
                    'i.code AS item_code',
                    'pi.quantity_per_product AS quantity_per_product',
                    'pi.remark AS remark',
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .orderBy('pi.create_time', 'DESC')
                .getRawMany();

            // 关联模式,合并数据
            let mode = 'none', returnData: Record<string, any> = { product }
            if (modules.length > 0) {
                // 如果是模块,将零件放到对应的模块下
                mode = 'module';
                const moduleMap = new Map();
                items.forEach((item) => {
                    if (moduleMap.has(item.module_id)) {
                        moduleMap.get(item.module_id).push(item);
                    } else {
                        moduleMap.set(item.module_id, [item]);
                    }
                });
                modules.forEach((m: any) => {
                    m.items = moduleMap.get(m.module_id) || [];
                });
                returnData.modules = modules;
                returnData.mode = mode;
            } else if (items.length > 0) {
                mode = 'direct';
                returnData.items = items;
                returnData.mode = mode;
            } else {
                mode = 'none';
                returnData.mode = mode;
            }

            return { result: 0, msg: 'success', datas: returnData };

        } catch (error) {
            this.logger.error('查询产品详情失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 生成产品编码:PR + 6位递增数字(如 PR000001)
     */
    private async generateProductCode() {
        const result = await this.productRepository
            .createQueryBuilder('product')
            .select("MAX(SUBSTRING(product.code, 3)::INTEGER)", 'maxNum')
            .where("product.code ~ :pattern", { pattern: '^PR[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;
        if (nextNum > 999999) {
            throw new Error('产品编码已达上限');
        }
        return `PR${String(nextNum).padStart(6, '0')}`;
    }
}

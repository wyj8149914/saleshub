import { EntityManager } from 'typeorm';
import { Product, ProductItem, InventoryItem, InventoryItemSpec } from '../../entity/product.entity';
import { MinioFile } from '../../entity/file.entity';
import {
    CreateProductDto, ProductIdDto, ListProductDto, UpdateProductDto, SetProductItemsDto,
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
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 创建产品
     */
    async create(dto: CreateProductDto) {
        try {
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
     * 查询产品的零件列表(含零件详情与规格库存)
     */
    async getProductItems(dto: ProductIdDto) {
        try {
            const rows = await this.productItemRepository
                .createQueryBuilder('pi')
                .leftJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                .leftJoin(InventoryItemSpec, 's', 's.spec_id = pi.spec_id AND s.status = 1')
                .select([
                    'pi.relation_id AS relation_id',
                    'pi.product_id AS product_id',
                    'pi.item_id AS item_id',
                    'pi.quantity_per_product AS quantity_per_product',
                    'pi.spec_id AS spec_id',
                    's.spec AS spec',
                    'pi.remark AS remark',
                    'i.name AS item_name',
                    'i.code AS item_code',
                    'i.type AS item_type',
                    'i.warn_stock AS warn_stock',
                    's.current_stock AS current_stock',
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .orderBy('pi.create_time', 'DESC')
                .getRawMany();

            return { result: 0, msg: 'success', datas: { items: rows } };
        } catch (error) {
            this.logger.error('查询产品零件失败:', error);
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

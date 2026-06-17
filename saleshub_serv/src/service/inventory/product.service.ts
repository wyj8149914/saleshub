import { EntityManager } from 'typeorm';
import { Product, ProductItem, InventoryItem } from '../../entity/product.entity';
import {
    CreateProductDto,
    ProductIdDto,
    ListProductDto,
    UpdateProductDto,
    SetProductItemsDto,
    ProductItemIdDto,
} from '../../dto/product.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class ProductService {
    private productRepository = AppDataSource.getRepository(Product);
    private productItemRepository = AppDataSource.getRepository(ProductItem);
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 创建产品
     */
    async create(dto: CreateProductDto) {
        try {
            const code = await this.generateProductCode();

            const product = new Product();
            product.product_id = v7().replace(/-/g, '');
            product.code = code;
            product.name = dto.name;
            if (dto.description) {
                product.description = dto.description;
            }

            const saved = await this.productRepository.save(product);
            return { result: 0, msg: '创建成功', alg: '', datas: { product_id: saved.product_id } };
        } catch (error) {
            this.logger.error('创建产品失败:', error);
            return { result: 1, msg: '创建失败', alg: '', datas: null };
        }
    }

    /**
     * 查询所有正常状态的产品
     */
    async list(dto: ListProductDto) {
        try {
            const queryBuilder = this.productRepository.createQueryBuilder('product')
                .select([
                    'product.product_id as product_id',
                    'product.name as name',
                    'product.code as code',
                    'product.description as description',
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
            const products = await queryBuilder.orderBy('product.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', alg: '', datas: { total, items: products } };
        } catch (error) {
            this.logger.error('查询产品列表失败:', error);
            return { result: 1, msg: '查询失败', alg: '', datas: null };
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
                return { result: 1, msg: '产品不存在', alg: '', datas: null };
            }

            product.name = dto.name;
            if (dto.description) {
                product.description = dto.description;
            }

            await this.productRepository.save(product);
            return { result: 0, msg: '更新成功', alg: '', datas: {} };
        } catch (error) {
            this.logger.error('更新产品失败:', error);
            return { result: 1, msg: '更新失败', alg: '', datas: null };
        }
    }

    /**
     * 软删除产品（设置状态为2）
     */
    async delete(dto: ProductIdDto) {
        try {
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在', alg: '', datas: null };
            }

            await this.productRepository.update({ product_id: dto.product_id }, { status: 2 });
            return { result: 0, msg: '删除成功', alg: '', datas: { product_id: dto.product_id } };
        } catch (error) {
            this.logger.error('删除产品失败:', error);
            return { result: 1, msg: '删除失败', alg: '', datas: null };
        }
    }

    /**
     * 设置产品零件(全量覆盖语义)
     * 传入 product_id 与完整 item 列表,使产品的有效关联(status=1)等于列表
     */
    async setProductItems(dto: SetProductItemsDto) {
        try {
            // 1. 校验产品存在
            const product = await this.productRepository.findOne({
                where: { product_id: dto.product_id, status: 1 },
            });
            if (!product) {
                return { result: 1, msg: '产品不存在', alg: '', datas: null };
            }

            // 2. 校验 item_id 唯一性
            const itemIds = dto.items.map((it) => it.item_id);
            const dedup = new Set(itemIds);
            if (dedup.size !== itemIds.length) {
                return { result: 1, msg: '零件列表存在重复项', alg: '', datas: null };
            }

            // 3. 校验零件存在且正常
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
                return {
                    result: 1,
                    msg: `零件不存在或已停用: ${missing.join(',')}`,
                    alg: '',
                    datas: null,
                };
            }

            let productItems: ProductItem[] = [];
            for (const item of dto.items) {
                const productItem = new ProductItem();
                productItem.relation_id = v7().replace(/-/g, '');
                productItem.product_id = dto.product_id;
                productItem.item_id = item.item_id;
                productItem.quantity_per_product = 1;
                productItem.remark = item.remark ?? null;
                productItems.push(productItem);
            }

            // 6. 事务执行
            await this.productItemRepository.manager.transaction(async (manager: EntityManager) => {
                await manager.update(ProductItem, { product_id: dto.product_id }, { status: 2 });
                await manager.save(ProductItem, productItems);
            });

            return { result: 0, msg: '设置成功', alg: '', datas: {}, };
        } catch (error) {
            this.logger.error('设置产品零件失败:', error);
            return { result: 1, msg: '设置失败', alg: '', datas: null };
        }
    }

    /**
     * 查询产品的零件列表(含零件详情)
     */
    async getProductItems(dto: ProductIdDto) {
        try {
            const rows = await this.productItemRepository.createQueryBuilder('pi')
                .innerJoin(InventoryItem, 'i', 'i.item_id = pi.item_id')
                .select([
                    'pi.relation_id AS relation_id',
                    'pi.product_id AS product_id',
                    'pi.item_id AS item_id',
                    'pi.quantity_per_product AS quantity_per_product',
                    'pi.remark AS remark',
                    'i.name AS item_name',
                    'i.code AS item_code',
                    'i.type AS item_type',
                    'i.current_stock AS current_stock',
                    'i.warn_stock AS warn_stock',
                ])
                .where('pi.product_id = :productId AND pi.status = :status', {
                    productId: dto.product_id,
                    status: 1,
                })
                .orderBy('pi.create_time', 'DESC')
                .getRawMany();

            return { result: 0, msg: 'success', alg: '', datas: { items: rows } };
        } catch (error) {
            this.logger.error('查询产品零件失败:', error);
            return { result: 1, msg: '查询失败', alg: '', datas: null };
        }
    }

    /**
     * 生成产品编码：PR + 6位递增数字（如 PR000001）
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

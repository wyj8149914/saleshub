import { InventoryItem } from '../../entity/product.entity';
import { CreateInventoryItemDto, ItemIdDto, ListInventoryItemDto, UpdateInventoryItemDto } from '../../dto/item.dto';
import { AppDataSource } from '../data.source';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';

export class InventoryItemService {
    private inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    private logger = getLogger('INVENTORY_SERV');

    /**
     * 创建库存件
     */
    async create(dto: CreateInventoryItemDto) {
        try {
            const code = await this.generateItemCode();

            const item = new InventoryItem();
            item.item_id = v7().replace(/-/g, '');
            item.code = code;
            item.type = dto.type;
            item.name = dto.name;
            if (dto.specs && dto.specs.length > 0) {
                item.specs = dto.specs;
            }
            if (dto.warnStock) {
                item.warn_stock = dto.warnStock;
            }

            const saved = await this.inventoryItemRepository.save(item);
            return { result: 0, msg: '创建成功', alg: '', datas: { item_id: saved.item_id } };
        } catch (error) {
            this.logger.error('创建库存件失败:', error);
            return { result: 1, msg: '创建失败', alg: '', datas: null };
        }
    }

    /**
     * 查询所有正常状态的库存件
     */
    async list(dto: ListInventoryItemDto) {
        try {
            const queryBuilder = this.inventoryItemRepository.createQueryBuilder('item')
                .select([
                    'item.item_id as item_id',
                    'item.type as type',
                    'item.name as name',
                    'item.code as code',
                    'item.specs as specs',
                    'item.current_stock as current_stock',
                    'item.warn_stock as warn_stock',
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
            if (dto.isWarning === 1) {
                queryBuilder.andWhere('item.current_stock > item.warn_stock');
            } else if (dto.isWarning === 2) {
                queryBuilder.andWhere('item.current_stock <= item.warn_stock');
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const items = await queryBuilder.orderBy('item.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            const datas = items.map((item: any) => ({
                ...item,
                isWarning: item.current_stock <= item.warn_stock,
            }));
            return { result: 0, msg: 'success', alg: '', datas: { total, items: datas }, };
        } catch (error) {
            this.logger.error('查询库存件列表失败:', error);
            return { result: 1, msg: '查询失败', alg: '', datas: null, };
        }
    }

    /**
     * 更新库存件信息
     */
    async update(dto: UpdateInventoryItemDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id, status: 1 },
            });

            if (!item) {
                return { result: 1, msg: '库存件不存在', alg: '', datas: null };
            }

            item.type = dto.type;
            item.name = dto.name;
            if (dto.specs && dto.specs.length > 0) {
                item.specs = dto.specs;
            }
            if (dto.warnStock) {
                item.warn_stock = dto.warnStock;
            }

            await this.inventoryItemRepository.save(item);
            return { result: 0, msg: '更新成功', alg: '', datas: {} };
        } catch (error) {
            this.logger.error('更新库存件失败:', error);
            return { result: 1, msg: '更新失败', alg: '', datas: null, };
        }
    }

    /**
     * 软删除库存件（设置状态为2）
     */
    async delete(dto: ItemIdDto) {
        try {
            const item = await this.inventoryItemRepository.findOne({
                where: { item_id: dto.item_id },
            });

            // 判断是否有产品使用该库存件
            // to-do

            if (!item) {
                return { result: 1, msg: '库存件不存在', alg: '', datas: null, };
            }

            await this.inventoryItemRepository.update({ item_id: dto.item_id }, { status: 2 });
            return { result: 0, msg: '删除成功', alg: '', datas: { item_id: dto.item_id }, };
        } catch (error) {
            this.logger.error('删除库存件失败:', error);
            return { result: 1, msg: '删除失败', alg: '', datas: null, };
        }
    }

    /**
     * 生成库存件编码：IT + 6位递增数字（如 IT000001）
     */
    private async generateItemCode() {
        const result = await this.inventoryItemRepository
            .createQueryBuilder('item')
            .select("MAX(SUBSTRING(item.code, 3)::INTEGER)", 'maxNum')
            .where("item.code ~ :pattern", { pattern: '^IT[0-9]{6}$' })
            .getRawOne();

        const nextNum = (Number(result?.maxNum) || 0) + 1;

        if (nextNum > 999999) {
            throw new Error('库存件编码已达上限');
        }

        return `IT${String(nextNum).padStart(6, '0')}`;
    }
}

import { AppDataSource } from '../../config/database.config';
import { ItemType } from '../../entity/product.entity';
import {
    CreateItemTypeDto,
    UpdateItemTypeDto,
    DeleteItemTypeDto,
    ListItemTypeDto,
} from '../../dto/item.dto';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import { InventoryItem } from '../../entity/product.entity';
import { Not } from 'typeorm';
import { arrayToTree } from '../../utils/util';

export interface ItemTypeTree {
    type_id: string;
    type_name: string;
    sort_order: number;
    remark: string;
    children?: ItemTypeTree[];
}

export class ItemTypeService {
    private itemTypeRepo = AppDataSource.getRepository(ItemType);
    private inventoryItemRepo = AppDataSource.getRepository(InventoryItem);
    private logger = getLogger('SALESHUB_SERV');

    /**
     * 创建类型
     */
    async create(dto: CreateItemTypeDto) {
        try {
            // 如果有 parent_id，验证父类型存在且状态正常
            if (dto.parent_id) {
                const parent = await this.itemTypeRepo.findOne({
                    where: { type_id: dto.parent_id },
                });
                if (!parent) {
                    return { result: 1, msg: '父类型不存在' };
                }
                if (parent.status !== 1) {
                    return { result: 1, msg: '父类型已停用' };
                }
                // 检查父类型是否是二级类型（不支持三级）
                if (parent.parent_id) {
                    return { result: 1, msg: '不支持创建三级类型' };
                }
            }

            const existingType = await this.itemTypeRepo.findOne({
                where: { type_name: dto.type_name },
            });
            if (existingType) {
                return { result: 1, msg: '类型名称已存在' };
            }

            // 创建类型
            const typeId = v7().replace(/-/g, '');
            const itemType = new ItemType();
            itemType.type_id = typeId;
            if (dto.parent_id) {
                itemType.parent_id = dto.parent_id;
            }
            itemType.type_name = dto.type_name;
            itemType.sort_order = dto.sort_order || 0;
            if (dto.remark) {
                itemType.remark = dto.remark;
            }

            await this.itemTypeRepo.save(itemType);
            this.logger.info(`创建类型成功: ${typeId} - ${dto.type_name}`);
            return { result: 0, msg: '创建成功', alg: '', datas: { type_id: typeId } };
        } catch (error) {
            this.logger.error(`创建类型失败: ${error}`);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 更新类型
     */
    async update(dto: UpdateItemTypeDto) {
        try {
            // 如果有 parent_id，验证父类型存在且状态正常
            if (dto.parent_id) {
                const parent = await this.itemTypeRepo.findOne({
                    where: { type_id: dto.parent_id },
                });
                if (!parent) {
                    return { result: 1, msg: '父类型不存在' };
                }
                if (parent.status !== 1) {
                    return { result: 1, msg: '父类型已停用' };
                }
                // 检查父类型是否是二级类型（不支持三级）
                if (parent.parent_id) {
                    return { result: 1, msg: '不支持创建三级类型' };
                }
            }

            const itemType = await this.itemTypeRepo.findOne({
                where: { type_id: dto.type_id, status: 1 },
            });
            if (!itemType) {
                return { result: 1, msg: '类型不存在' };
            }

            // 检查类型名称是否重复
            const existingType = await this.itemTypeRepo.findOne({
                where: { type_name: dto.type_name, type_id: Not(dto.type_id) },
            });
            if (existingType) {
                return { result: 1, msg: '类型名称已存在' };
            }

            itemType.type_name = dto.type_name;
            if (dto.sort_order) {
                itemType.sort_order = dto.sort_order;
            }
            if (dto.remark) {
                itemType.remark = dto.remark;
            }
            if (dto.parent_id) {
                itemType.parent_id = dto.parent_id;
            }
            itemType.update_time = new Date();

            await this.itemTypeRepo.save(itemType);
            this.logger.info(`更新类型成功: ${dto.type_id}`);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error(`更新类型失败: ${error}`);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 删除类型（软删除，改为停用状态）
     */
    async delete(dto: DeleteItemTypeDto) {
        try {
            const itemType = await this.itemTypeRepo.findOne({
                where: { type_id: dto.type_id, status: 1 },
            });
            if (!itemType) {
                return { result: 1, msg: '类型不存在' };
            }

            // 检查类型是否被使用
            const isInUse = await this.isTypeInUse(dto.type_id);
            if (isInUse) {
                return { result: 1, msg: '类型已被使用，无法删除' };
            }

            // 如果是一级类型，检查子类型是否被使用
            if (!itemType.parent_id) {
                const childTypes = await this.itemTypeRepo.find({
                    where: { parent_id: dto.type_id, status: 1 },
                });
                for (const child of childTypes) {
                    const childInUse = await this.isTypeInUse(child.type_id);
                    if (childInUse) {
                        return { result: 1, msg: '子类型已被使用，无法删除' };
                    }
                }
                // 停用所有子类型
                if (childTypes.length > 0) {
                    await this.itemTypeRepo.update(
                        { parent_id: dto.type_id },
                        { status: 2, update_time: new Date() }
                    );
                }
            }

            // 停用类型
            itemType.status = 2;
            itemType.update_time = new Date();
            await this.itemTypeRepo.save(itemType);
            this.logger.info(`删除类型成功: ${dto.type_id}`);
            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error(`删除类型失败: ${error}`);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 查询类型列表
     */
    async list(dto: ListItemTypeDto) {
        try {
            const queryBuilder = this.itemTypeRepo
                .createQueryBuilder('type')
                .leftJoin(ItemType, 'parentType', 'parentType.type_id = type.parent_id')
                .select([
                    'type.type_id AS type_id',
                    'type.type_name AS type_name',
                    'type.sort_order AS sort_order',
                    'type.remark AS remark',
                    'parentType.type_name AS parent_type_name',
                    'parentType.type_id AS parent_type_id',
                ])
                .where('type.status = :status', { status: 1 });

            // 如果有 parent_id，查询该父级下的子类型
            if (dto.parent_id) {
                queryBuilder.andWhere('type.parent_id = :parentId', { parentId: dto.parent_id });
            }
            const types = await queryBuilder.orderBy('type.sort_order', 'ASC').getRawMany();

            // 将数据转为树形结构
            const tree = arrayToTree(types, 'type_id', 'parent_type_id', 'children');

            return { result: 0, msg: '查询成功', datas: tree };
        } catch (error) {
            this.logger.error(`查询类型列表失败: ${error}`);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 检查类型是否被零件使用
     */
    private async isTypeInUse(typeId: string): Promise<boolean> {
        const count = await this.inventoryItemRepo.count({
            where: { type_id: typeId, status: 1 },
        });
        return count > 0;
    }
}

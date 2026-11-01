import { Warehouse, InventoryItemSpecWarehouse } from '../../entity/warehouse.entity';
import { InventoryItemSpec } from '../../entity/product.entity';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { v7 } from 'uuid';
import {
    CreateWarehouseDto,
    UpdateWarehouseDto,
    DeleteWarehouseDto,
    ListWarehouseDto,
    AssignSpecWarehouseDto,
    ListSpecWarehouseStockDto,
} from '../../dto/warehouse.dto';

export class WarehouseService {
    private warehouseRepository = AppDataSource.getRepository(Warehouse);
    private specWarehouseRepository = AppDataSource.getRepository(InventoryItemSpecWarehouse);
    private specRepository = AppDataSource.getRepository(InventoryItemSpec);
    private logger = getLogger('WAREHOUSE_SERV');

    /**
     * 创建仓库
     */
    async create(dto: CreateWarehouseDto) {
        try {
            const warehouse = new Warehouse();
            warehouse.warehouse_id = v7().replace(/-/g, '');
            warehouse.name = dto.name;
            if (dto.location) {
                warehouse.location = dto.location;
            }

            await this.warehouseRepository.save(warehouse);
            return { result: 0, msg: '创建成功' };
        } catch (error) {
            this.logger.error('创建仓库失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 更新仓库
     */
    async update(dto: UpdateWarehouseDto) {
        try {
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            warehouse.name = dto.name;
            if (dto.location !== undefined) {
                warehouse.location = dto.location;
            }
            warehouse.update_time = new Date();

            await this.warehouseRepository.save(warehouse);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新仓库失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 删除仓库(软删除)
     */
    async delete(dto: DeleteWarehouseDto) {
        try {
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 检查是否存在库存明细
            const hasStock = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .where('sw.warehouse_id = :warehouseId AND sw.current_stock > 0', {
                    warehouseId: dto.warehouse_id,
                })
                .getCount();

            if (hasStock > 0) {
                return { result: 1, msg: '该仓库存在库存，无法删除' };
            }

            warehouse.status = 2;
            warehouse.update_time = new Date();
            await this.warehouseRepository.save(warehouse);

            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除仓库失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    /**
     * 查询仓库列表
     */
    async list(dto: ListWarehouseDto) {
        try {
            const queryBuilder = this.warehouseRepository
                .createQueryBuilder('w')
                .select([
                    'w.warehouse_id AS warehouse_id',
                    'w.name AS name',
                    'w.location AS location',
                ])
                .where('w.status = 1');
            if (dto.name) {
                queryBuilder.andWhere('w.name LIKE :name', { name: `%${dto.name}%` });
            }
            const items = await queryBuilder.getRawMany();

            return { result: 0, msg: 'success', datas: items };
        } catch (error) {
            this.logger.error('查询仓库列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 分配零件规格到仓库(用于历史数据初始化)
     */
    async assignSpecWarehouse(dto: AssignSpecWarehouseDto) {
        try {
            // 校验规格存在
            const spec = await this.specRepository.findOne({
                where: { spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在' };
            }

            // 校验仓库存在
            const warehouse = await this.warehouseRepository.findOne({
                where: { warehouse_id: dto.warehouse_id, status: 1 },
            });
            if (!warehouse) {
                return { result: 1, msg: '仓库不存在' };
            }

            // 校验分配数量不超过总库存
            if (dto.quantity > spec.current_stock) {
                return {
                    result: 1,
                    msg: `分配数量(${dto.quantity})超过该规格总库存(${spec.current_stock})`,
                };
            }

            // 查询该规格已分配的总数量
            const assignedTotal = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .select('COALESCE(SUM(sw.current_stock), 0)', 'total')
                .where('sw.spec_id = :specId AND sw.status = 1', { specId: dto.spec_id })
                .getRawOne();

            const assigned = Number(assignedTotal?.total || 0);
            const available = spec.current_stock - assigned;

            if (dto.quantity > available) {
                return {
                    result: 1,
                    msg: `可分配数量不足(总库存:${spec.current_stock}, 已分配:${assigned}, 可分配:${available})`,
                };
            }

            // 查询是否已存在该规格在该仓库的记录
            let specWarehouse = await this.specWarehouseRepository.findOne({
                where: { spec_id: dto.spec_id, warehouse_id: dto.warehouse_id, status: 1 },
            });

            const now = new Date();
            if (specWarehouse) {
                // 累加库存
                specWarehouse.current_stock += dto.quantity;
                specWarehouse.update_time = now;
                await this.specWarehouseRepository.save(specWarehouse);
            } else {
                // 新建记录
                specWarehouse = new InventoryItemSpecWarehouse();
                specWarehouse.id = v7().replace(/-/g, '');
                specWarehouse.spec_id = dto.spec_id;
                specWarehouse.warehouse_id = dto.warehouse_id;
                specWarehouse.current_stock = dto.quantity;
                specWarehouse.status = 1;
                specWarehouse.create_time = now;
                await this.specWarehouseRepository.save(specWarehouse);
            }

            return { result: 0, msg: '分配成功' };
        } catch (error) {
            this.logger.error('分配零件仓库失败:', error);
            return { result: 1, msg: '分配失败' };
        }
    }

    /**
     * 查询规格在各仓库的库存分布
     */
    async listSpecWarehouseStock(dto: ListSpecWarehouseStockDto) {
        try {
            const spec = await this.specRepository.findOne({
                where: { spec_id: dto.spec_id, status: 1 },
            });
            if (!spec) {
                return { result: 1, msg: '规格不存在' };
            }

            const items = await this.specWarehouseRepository
                .createQueryBuilder('sw')
                .leftJoin(Warehouse, 'w', 'w.warehouse_id = sw.warehouse_id')
                .select([
                    'sw.id AS id',
                    'sw.warehouse_id AS warehouse_id',
                    'w.name AS warehouse_name',
                    'w.location AS warehouse_location',
                    'sw.current_stock AS current_stock',
                ])
                .where('sw.spec_id = :specId AND sw.status = 1', { specId: dto.spec_id })
                .orderBy('sw.create_time', 'ASC')
                .getRawMany();

            // 计算已分配的库存总和
            const assignedTotal = items.reduce(
                (sum: number, item: { current_stock: number | null }) =>
                    sum + (item.current_stock || 0),
                0
            );

            // 计算未分配库存
            const unassignedStock = spec.current_stock - assignedTotal;
            if (unassignedStock > 0) {
                items.push({
                    id: null,
                    warehouse_id: null,
                    warehouse_name: '未分配仓库',
                    warehouse_location: null,
                    current_stock: unassignedStock,
                });
            }

            return { result: 0, msg: 'success', datas: items };
        } catch (error) {
            this.logger.error('查询规格库存分布失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }
}

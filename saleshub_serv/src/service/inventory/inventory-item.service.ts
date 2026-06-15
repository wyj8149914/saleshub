import { Repository } from 'typeorm';
import { InventoryItem } from '../../entity/inventory/inventory-item.entity';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from '../../dto/request/inventory/inventory-item.dto';
import { AppDataSource } from '../data.source';
import { getLogger } from '../utils/logger';

export class InventoryItemService {
  private inventoryItemRepository: Repository<InventoryItem>;
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
  }

  /**
   * 创建库存件
   * @param dto 创建库存件DTO
   * @returns {result: 0, msg: '创建成功', datas: saved}
   */
  async create(dto: CreateInventoryItemDto) {
    try {
      // 检查编码是否已存在
      const existingItem = await this.inventoryItemRepository.findOne({
        where: { code: dto.code, status: 1 },
      });

      if (existingItem) {
        return {
          result: 1,
          msg: '库存件编码已存在',
          alg: '',
          datas: null,
        };
      }

      // 创建新库存件
      const inventoryItem = this.inventoryItemRepository.create({
        ...dto,
        currentStock: 0,
        warnStock: dto.warnStock || 10,
        status: 1,
      });

      const saved = await this.inventoryItemRepository.save(inventoryItem);
      this.logger.info('创建库存件成功:', saved);

      return {
        result: 0,
        msg: '创建成功',
        alg: '',
        datas: saved,
      };
    } catch (error) {
      this.logger.error('创建库存件失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 查询所有正常状态的库存件
   * @param type 类型过滤（可选）
   * @param productId 产品ID过滤（可选）
   * @returns {result: 0, msg: 'success', datas: items with productName and isWarning}
   */
  async findAll(type?: string, productId?: string) {
    try {
      const queryBuilder = this.inventoryItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .where('item.status = :status', { status: 1 });

      if (type) {
        queryBuilder.andWhere('item.type = :type', { type });
      }

      if (productId) {
        queryBuilder.andWhere('item.productId = :productId', { productId });
      }

      const items = await queryBuilder.orderBy('item.createdAt', 'DESC').getMany();

      // 映射结果，添加 productName 和 isWarning
      const datas = items.map((item) => ({
        ...item,
        productName: item.product?.name || null,
        isWarning: item.currentStock <= item.warnStock,
      }));

      this.logger.info('查询库存件列表成功, 数量:', datas.length);

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas,
      };
    } catch (error) {
      this.logger.error('查询库存件列表失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 查询所有预警库存件（当前库存 <= 预警阈值）
   * @returns {result: 0, msg: 'success', datas: warning items with productName}
   */
  async findWarnings() {
    try {
      const queryBuilder = this.inventoryItemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .where('item.status = :status', { status: 1 })
        .andWhere('item.currentStock <= item.warnStock');

      const items = await queryBuilder.orderBy('item.currentStock', 'ASC').getMany();

      // 映射结果，添加 productName
      const datas = items.map((item) => ({
        ...item,
        productName: item.product?.name || null,
      }));

      this.logger.info('查询预警库存件成功, 数量:', datas.length);

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas,
      };
    } catch (error) {
      this.logger.error('查询预警库存件失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 根据ID查询单个库存件
   * @param id 库存件ID
   * @returns {result: 0, msg: 'success', datas: item with productName}
   */
  async findOne(id: string) {
    try {
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: id },
        relations: ['product'],
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      // 添加 productName
      const datas = {
        ...item,
        productName: item.product?.name || null,
      };

      this.logger.info('查询库存件详情成功:', datas);

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas,
      };
    } catch (error) {
      this.logger.error('查询库存件详情失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 更新库存件信息
   * @param id 库存件ID
   * @param dto 更新库存件DTO
   * @returns 更新结果
   */
  async update(id: string, dto: UpdateInventoryItemDto) {
    try {
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: id },
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      // 如果更新了编码，检查新编码是否与其他库存件冲突
      if (dto.code && dto.code !== item.code) {
        const existingItem = await this.inventoryItemRepository.findOne({
          where: { code: dto.code, status: 1 },
        });

        if (existingItem && existingItem.itemId !== id) {
          return {
            result: 1,
            msg: '库存件编码已被使用',
            alg: '',
            datas: null,
          };
        }
      }

      // 更新库存件信息
      await this.inventoryItemRepository.update({ itemId: id }, dto);
      const updated = await this.inventoryItemRepository.findOne({
        where: { itemId: id },
        relations: ['product'],
      });

      this.logger.info('更新库存件成功:', updated);

      // 添加 productName
      const datas = updated
        ? {
            ...updated,
            productName: updated.product?.name || null,
          }
        : null;

      return {
        result: 0,
        msg: '更新成功',
        alg: '',
        datas,
      };
    } catch (error) {
      this.logger.error('更新库存件失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 软删除库存件（设置状态为2）
   * @param id 库存件ID
   * @returns 删除结果
   */
  async remove(id: string) {
    try {
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: id },
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      // 软删除：设置状态为2
      await this.inventoryItemRepository.update({ itemId: id }, { status: 2 });

      this.logger.info('删除库存件成功, 库存件ID:', id);

      return {
        result: 0,
        msg: '删除成功',
        alg: '',
        datas: { itemId: id },
      };
    } catch (error) {
      this.logger.error('删除库存件失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 更新库存件状态
   * @param id 库存件ID
   * @param status 状态值（1-正常，2-停用）
   * @returns 更新结果
   */
  async updateStatus(id: string, status: number) {
    try {
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: id },
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      await this.inventoryItemRepository.update({ itemId: id }, { status });
      const updated = await this.inventoryItemRepository.findOne({
        where: { itemId: id },
        relations: ['product'],
      });

      this.logger.info('更新库存件状态成功, 库存件ID:', id, '新状态:', status);

      // 添加 productName
      const datas = updated
        ? {
            ...updated,
            productName: updated.product?.name || null,
          }
        : null;

      return {
        result: 0,
        msg: '状态更新成功',
        alg: '',
        datas,
      };
    } catch (error) {
      this.logger.error('更新库存件状态失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }
}

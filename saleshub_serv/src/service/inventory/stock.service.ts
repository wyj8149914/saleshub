import { Repository } from 'typeorm';
import { InventoryItem, ItemType } from '../../entity/inventory/inventory-item.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/inventory/stock.entity';
import { StockInDto, StockOutDto, InventoryCheckDto } from '../../dto/request/inventory/stock.dto';
import { AppDataSource } from '../data.source';
import { getLogger } from '../utils/logger';

export class StockService {
  private inventoryItemRepository: Repository<InventoryItem>;
  private stockInRepository: Repository<StockInRecord>;
  private stockOutRepository: Repository<StockOutRecord>;
  private inventoryCheckRepository: Repository<InventoryCheck>;
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.inventoryItemRepository = AppDataSource.getRepository(InventoryItem);
    this.stockInRepository = AppDataSource.getRepository(StockInRecord);
    this.stockOutRepository = AppDataSource.getRepository(StockOutRecord);
    this.inventoryCheckRepository = AppDataSource.getRepository(InventoryCheck);
  }

  /**
   * 入库操作
   * @param dto 入库DTO
   * @returns {result: 0, msg: 'success', alg: '', datas: {record, afterStock}}
   */
  async stockIn(dto: StockInDto) {
    try {
      // 查找库存件
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: dto.itemId, status: 1 },
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      // 生成入库记录ID
      const inRecordId = this.generateId();

      // 创建入库记录
      const stockInRecord = this.stockInRepository.create({
        inRecordId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        date: new Date(dto.date),
        photoUrl: dto.photoUrl,
        remark: dto.remark || null,
        status: 1,
      });

      const savedRecord = await this.stockInRepository.save(stockInRecord);

      // 更新库存件当前库存
      const afterStock = item.currentStock + dto.quantity;
      await this.inventoryItemRepository.update(
        { itemId: dto.itemId },
        { currentStock: afterStock }
      );

      this.logger.info('入库成功:', { itemId: dto.itemId, quantity: dto.quantity, afterStock });

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: {
          record: savedRecord,
          afterStock,
        },
      };
    } catch (error) {
      this.logger.error('入库失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 出库操作
   * @param dto 出库DTO
   * @returns {result: 0, msg: 'success', alg: '', datas: {record, afterStock}}
   */
  async stockOut(dto: StockOutDto) {
    try {
      // 查找库存件
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: dto.itemId, status: 1 },
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

      // 验证库存件类型必须为 device
      if (item.type !== ItemType.DEVICE) {
        return {
          result: 1,
          msg: '只有设备件可以出库',
          alg: '',
          datas: null,
        };
      }

      // 验证 productId 是否匹配
      if (item.productId !== dto.productId) {
        return {
          result: 1,
          msg: '产品ID不匹配',
          alg: '',
          datas: null,
        };
      }

      // 生成出库记录ID
      const outRecordId = this.generateId();

      // 创建出库记录
      const stockOutRecord = this.stockOutRepository.create({
        outRecordId,
        productId: dto.productId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        date: new Date(dto.date),
        remark: dto.remark || null,
        status: 1,
      });

      const savedRecord = await this.stockOutRepository.save(stockOutRecord);

      // 更新库存件当前库存（允许负库存）
      const afterStock = item.currentStock - dto.quantity;
      await this.inventoryItemRepository.update(
        { itemId: dto.itemId },
        { currentStock: afterStock }
      );

      this.logger.info('出库成功:', { itemId: dto.itemId, quantity: dto.quantity, afterStock });

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: {
          record: savedRecord,
          afterStock,
        },
      };
    } catch (error) {
      this.logger.error('出库失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 获取库存件历史记录
   * @param itemId 库存件ID
   * @param startDate 开始日期（可选）
   * @param endDate 结束日期（可选）
   * @returns {result: 0, msg: 'success', alg: '', datas: merged history records}
   */
  async getHistory(itemId: string, startDate?: string, endDate?: string) {
    try {
      // 验证库存件是否存在
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId, status: 1 },
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      // 构建日期条件
      let dateCondition = '';
      const params: any = { itemId, status: 1 };

      if (startDate) {
        dateCondition += ' AND date >= :startDate';
        params.startDate = new Date(startDate);
      }

      if (endDate) {
        dateCondition += ' AND date <= :endDate';
        params.endDate = new Date(endDate);
      }

      // 查询入库记录
      const inRecords = await this.stockInRepository
        .createQueryBuilder('in')
        .where('item_id = :itemId AND status = :status' + dateCondition, params)
        .orderBy('created_at', 'DESC')
        .getMany();

      // 查询出库记录
      const outRecords = await this.stockOutRepository
        .createQueryBuilder('out')
        .where('item_id = :itemId AND status = :status' + dateCondition, params)
        .orderBy('created_at', 'DESC')
        .getMany();

      // 查询盘点记录
      const checkRecords = await this.inventoryCheckRepository
        .createQueryBuilder('check')
        .where('item_id = :itemId AND status = :status' + dateCondition, params)
        .orderBy('created_at', 'DESC')
        .getMany();

      // 合并记录并添加类型字段
      const mergedRecords = [
        ...inRecords.map((record) => ({
          ...record,
          id: record.inRecordId,
          type: 'in' as const,
        })),
        ...outRecords.map((record) => ({
          ...record,
          id: record.outRecordId,
          type: 'out' as const,
        })),
        ...checkRecords.map((record) => ({
          ...record,
          id: record.checkId,
          type: 'check' as const,
        })),
      ];

      // 按创建时间倒序排序
      mergedRecords.sort((a, b) => {
        const aTime = a.createdAt.getTime();
        const bTime = b.createdAt.getTime();
        return bTime - aTime;
      });

      this.logger.info('查询历史记录成功, 数量:', mergedRecords.length);

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: mergedRecords,
      };
    } catch (error) {
      this.logger.error('查询历史记录失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 库存盘点
   * @param dto 盘点DTO
   * @returns {result: 0, msg: 'success', alg: '', datas: {record, beforeStock, afterStock}}
   */
  async inventoryCheck(dto: InventoryCheckDto) {
    try {
      // 查找库存件
      const item = await this.inventoryItemRepository.findOne({
        where: { itemId: dto.itemId, status: 1 },
      });

      if (!item) {
        return {
          result: 1,
          msg: '库存件不存在',
          alg: '',
          datas: null,
        };
      }

      // 记录盘点前库存
      const beforeStock = item.currentStock;

      // 生成盘点记录ID
      const checkId = this.generateId();

      // 创建盘点记录
      const inventoryCheck = this.inventoryCheckRepository.create({
        checkId,
        itemId: dto.itemId,
        beforeStock,
        afterStock: dto.afterStock,
        date: new Date(dto.date),
        remark: dto.remark || null,
        status: 1,
      });

      const savedRecord = await this.inventoryCheckRepository.save(inventoryCheck);

      // 更新库存件当前库存为盘点后库存
      await this.inventoryItemRepository.update(
        { itemId: dto.itemId },
        { currentStock: dto.afterStock }
      );

      this.logger.info('盘点成功:', {
        itemId: dto.itemId,
        beforeStock,
        afterStock: dto.afterStock
      });

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: {
          record: savedRecord,
          beforeStock,
          afterStock: dto.afterStock,
        },
      };
    } catch (error) {
      this.logger.error('盘点失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 生成32位ID
   * @returns 32位随机ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 6);
  }
}

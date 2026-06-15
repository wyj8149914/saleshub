import { Repository } from 'typeorm';
import { Product } from '../../entity/inventory/product.entity';
import { CreateProductDto, UpdateProductDto } from '../../dto/request/inventory/product.dto';
import { AppDataSource } from '../data.source';
import { getLogger } from '../utils/logger';

export class ProductService {
  private productRepository: Repository<Product>;
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.productRepository = AppDataSource.getRepository(Product);
  }

  /**
   * 创建产品
   * @param dto 创建产品DTO
   * @returns {result: 0, msg: '创建成功', datas: saved}
   */
  async create(dto: CreateProductDto) {
    try {
      // 检查产品编码是否已存在
      const existingProduct = await this.productRepository.findOne({
        where: { code: dto.code, status: 1 },
      });

      if (existingProduct) {
        return {
          result: 1,
          msg: '产品编码已存在',
          alg: '',
          datas: null,
        };
      }

      // 创建新产品
      const product = this.productRepository.create({
        ...dto,
        status: 1,
      });

      const saved = await this.productRepository.save(product);
      this.logger.info('创建产品成功:', saved);

      return {
        result: 0,
        msg: '创建成功',
        alg: '',
        datas: saved,
      };
    } catch (error) {
      this.logger.error('创建产品失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 查询所有正常状态的产品
   * @returns {result: 0, msg: 'success', datas: products}
   */
  async findAll() {
    try {
      const products = await this.productRepository.find({
        where: { status: 1 },
        order: { createdAt: 'DESC' },
      });

      this.logger.info('查询产品列表成功, 数量:', products.length);

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: products,
      };
    } catch (error) {
      this.logger.error('查询产品列表失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 根据ID查询单个产品
   * @param id 产品ID
   * @returns {result: 0, msg: 'success', datas: product} 或错误信息
   */
  async findOne(id: string) {
    try {
      const product = await this.productRepository.findOne({
        where: { productId: id },
        relations: ['inventoryItems'],
      });

      if (!product) {
        return {
          result: 1,
          msg: '产品不存在',
          alg: '',
          datas: null,
        };
      }

      this.logger.info('查询产品详情成功:', product);

      return {
        result: 0,
        msg: 'success',
        alg: '',
        datas: product,
      };
    } catch (error) {
      this.logger.error('查询产品详情失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 更新产品信息
   * @param id 产品ID
   * @param dto 更新产品DTO
   * @returns 更新结果
   */
  async update(id: string, dto: UpdateProductDto) {
    try {
      const product = await this.productRepository.findOne({
        where: { productId: id },
      });

      if (!product) {
        return {
          result: 1,
          msg: '产品不存在',
          alg: '',
          datas: null,
        };
      }

      // 如果更新了编码，检查新编码是否与其他产品冲突
      if (dto.code && dto.code !== product.code) {
        const existingProduct = await this.productRepository.findOne({
          where: { code: dto.code, status: 1 },
        });

        if (existingProduct && existingProduct.productId !== id) {
          return {
            result: 1,
            msg: '产品编码已被使用',
            alg: '',
            datas: null,
          };
        }
      }

      // 更新产品信息
      await this.productRepository.update({ productId: id }, dto);
      const updated = await this.productRepository.findOne({
        where: { productId: id },
      });

      this.logger.info('更新产品成功:', updated);

      return {
        result: 0,
        msg: '更新成功',
        alg: '',
        datas: updated,
      };
    } catch (error) {
      this.logger.error('更新产品失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 软删除产品（设置状态为2）
   * @param id 产品ID
   * @returns 删除结果
   */
  async remove(id: string) {
    try {
      const product = await this.productRepository.findOne({
        where: { productId: id },
      });

      if (!product) {
        return {
          result: 1,
          msg: '产品不存在',
          alg: '',
          datas: null,
        };
      }

      // 软删除：设置状态为2
      await this.productRepository.update({ productId: id }, { status: 2 });

      this.logger.info('删除产品成功, 产品ID:', id);

      return {
        result: 0,
        msg: '删除成功',
        alg: '',
        datas: { productId: id },
      };
    } catch (error) {
      this.logger.error('删除产品失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }

  /**
   * 更新产品状态
   * @param id 产品ID
   * @param status 状态值（1-正常，2-停用）
   * @returns 更新结果
   */
  async updateStatus(id: string, status: number) {
    try {
      const product = await this.productRepository.findOne({
        where: { productId: id },
      });

      if (!product) {
        return {
          result: 1,
          msg: '产品不存在',
          alg: '',
          datas: null,
        };
      }

      await this.productRepository.update({ productId: id }, { status });
      const updated = await this.productRepository.findOne({
        where: { productId: id },
      });

      this.logger.info('更新产品状态成功, 产品ID:', id, '新状态:', status);

      return {
        result: 0,
        msg: '状态更新成功',
        alg: '',
        datas: updated,
      };
    } catch (error) {
      this.logger.error('更新产品状态失败:', error);
      return {
        result: 1,
        msg: 'operation failed',
        alg: '',
        datas: null,
      };
    }
  }
}

# 库存管理系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 构建完整的库存管理系统，包括产品管理、零件管理、入库/出库/盘点功能、库存预警和历史记录。

**架构：** 前后端分离架构。后端采用 TypeScript + Express + TypeORM + PostgreSQL + MinIO，遵循分层架构（Entity → DTO → Service → Routes）。前端采用 Vue3 + TypeScript + Ant Design Vue。

**技术栈：**
- 后端：TypeScript, Express, TypeORM, PostgreSQL, MinIO, class-validator
- 前端：Vue3, TypeScript, Ant Design Vue, Axios, Pinia

---

## 文件结构

### 后端文件结构
```
saleshub_serv/src/
├── entity/inventory/
│   ├── product.entity.ts
│   ├── inventory-item.entity.ts
│   └── stock.entity.ts           # 合并 StockInRecord, StockOutRecord, InventoryCheck
├── dto/request/inventory/
│   ├── product.dto.ts            # 合并 CreateProductDto, UpdateProductDto
│   ├── inventory-item.dto.ts     # 合并 CreateInventoryItemDto, UpdateInventoryItemDto
│   └── stock.dto.ts              # 合并 StockInDto, StockOutDto, InventoryCheckDto
├── dto/response/inventory/
│   └── response.dto.ts           # 合并所有响应 DTO
├── service/inventory/
│   ├── product.service.ts
│   ├── inventory-item.service.ts
│   ├── stock.service.ts
│   └── file.service.ts
├── routes/inventory/
│   ├── product.route.ts
│   ├── inventory-item.route.ts
│   ├── stock.route.ts
│   └── file.route.ts
└── utils/
    └── minio.util.ts
```

### 前端文件结构
```
saleshub_web/src/
├── api/inventory.ts
├── views/inventory/
│   ├── ProductList.vue
│   ├── InventoryList.vue
│   ├── StockIn.vue
│   ├── StockOut.vue
│   ├── StockHistory.vue
│   ├── StockWarning.vue
│   └── InventoryCheck.vue
├── components/inventory/
│   ├── ProductForm.vue
│   ├── InventoryItemForm.vue
│   └── SpecEditor.vue
└── types/inventory.ts
```

---

## 后端实施任务

### Task 1: 创建数据库实体 - Product

**Files:**
- Create: `saleshub_serv/src/entity/inventory/product.entity.ts`

- [ ] **Step 1: 创建 Product 实体**

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

@Entity({ schema: 'inventory', name: 'products' })
export class Product {
  @PrimaryColumn({ name: 'product_id', type: 'varchar', length: 32 })
  productId: string;

  @Column({ type: 'varchar', length: 100, comment: '产品名称' })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true, comment: '产品编码' })
  code: string;

  @Column({ type: 'text', nullable: true, comment: '产品描述' })
  description: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @OneToMany(() => InventoryItem, (item) => item.product)
  inventoryItems: InventoryItem[];
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 2: 创建数据库实体 - InventoryItem

**Files:**
- Create: `saleshub_serv/src/entity/inventory/inventory-item.entity.ts`

- [ ] **Step 1: 创建 InventoryItem 实体**

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

export enum ItemType {
  DEVICE = 'device',
  COMMON = 'common'
}

@Entity({ schema: 'inventory', name: 'inventory_items' })
export class InventoryItem {
  @PrimaryColumn({ name: 'item_id', type: 'varchar', length: 32 })
  itemId: string;

  @Column({
    type: 'enum',
    enum: ItemType,
    comment: '类型：device-设备件，common-常用件'
  })
  type: ItemType;

  @Column({ type: 'varchar', length: 100, comment: '名称' })
  name: string;

  @Column({ type: 'varchar', length: 50, comment: '编码' })
  code: string;

  @Column({ type: 'varchar', length: 32, nullable: true, comment: '关联产品ID（仅设备件）' })
  productId: string;

  @Column({ type: 'text', array: true, nullable: true, comment: '规格选项（仅常用件）' })
  specs: string[];

  @Column({ type: 'int', default: 0, comment: '当前库存' })
  currentStock: number;

  @Column({ type: 'int', default: 10, comment: '预警阈值' })
  warnStock: number;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => Product, (product) => product.inventoryItems, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 3: 创建数据库实体 - Stock（合并所有库存记录实体）

**Files:**
- Create: `saleshub_serv/src/entity/inventory/stock.entity.ts`

- [ ] **Step 1: 创建 Stock 实体文件（包含所有库存记录实体）**

```typescript
import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Product } from './product.entity';

// 入库记录实体
@Entity({ schema: 'inventory', name: 'stock_in_records' })
export class StockInRecord {
  @PrimaryColumn({ name: 'in_record_id', type: 'varchar', length: 32 })
  inRecordId: string;

  @Column({ type: 'varchar', length: 32, comment: '零件ID' })
  itemId: string;

  @Column({ type: 'int', comment: '入库数量' })
  quantity: number;

  @Column({ type: 'date', comment: '入库日期' })
  date: Date;

  @Column({ type: 'varchar', length: 500, comment: '照片URL' })
  photoUrl: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;
}

// 出库记录实体
@Entity({ schema: 'inventory', name: 'stock_out_records' })
export class StockOutRecord {
  @PrimaryColumn({ name: 'out_record_id', type: 'varchar', length: 32 })
  outRecordId: string;

  @Column({ type: 'varchar', length: 32, comment: '产品ID' })
  productId: string;

  @Column({ type: 'varchar', length: 32, comment: '零件ID' })
  itemId: string;

  @Column({ type: 'int', comment: '出库数量' })
  quantity: number;

  @Column({ type: 'date', comment: '出库日期' })
  date: Date;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;
}

// 盘点记录实体
@Entity({ schema: 'inventory', name: 'inventory_checks' })
export class InventoryCheck {
  @PrimaryColumn({ name: 'check_id', type: 'varchar', length: 32 })
  checkId: string;

  @Column({ type: 'varchar', length: 32, comment: '零件ID' })
  itemId: string;

  @Column({ type: 'int', comment: '盘点前库存' })
  beforeStock: number;

  @Column({ type: 'int', comment: '盘点后库存' })
  afterStock: number;

  @Column({ type: 'date', comment: '盘点日期' })
  date: Date;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
  status: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 4: 创建请求 DTO - ProductDto（合并创建和更新DTO）

**Files:**
- Create: `saleshub_serv/src/dto/request/inventory/product.dto.ts`

- [ ] **Step 1: 创建 ProductDto**

```typescript
import { IsString, IsNotEmpty, IsOptional, IsNumber, MaxLength, IsEnum, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateInventoryItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsNumber()
  @IsOptional()
  warnStock?: number;
}

// 更新状态DTO（通用）
export class UpdateStatusDto {
  @IsNumber()
  @Min(1)
  @Max(2)
  @IsNotEmpty()
  status: number; // 1-正常，2-停用
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 5: 创建请求 DTO - InventoryItemDto

**Files:**
- Create: `saleshub_serv/src/dto/request/inventory/inventory-item.dto.ts`

- [ ] **Step 1: 创建 InventoryItemDto**

```typescript
import { IsString, IsNotEmpty, IsEnum, IsArray, IsOptional, IsNumber, MaxLength } from 'class-validator';
import { ItemType } from '../../../entity/inventory/inventory-item.entity';

export class CreateInventoryItemDto {
  @IsEnum(ItemType)
  @IsNotEmpty()
  type: ItemType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specs?: string[];

  @IsNumber()
  @IsOptional()
  warnStock?: number;
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 6: 创建请求 DTO - StockDto（合并所有库存操作DTO）

**Files:**
- Create: `saleshub_serv/src/dto/request/inventory/stock.dto.ts`

- [ ] **Step 1: 创建 StockDto**

```typescript
import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, IsUUID } from 'class-validator';

// 入库DTO
export class StockInDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  photoUrl: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

// 出库DTO
export class StockOutDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

// 盘点DTO
export class InventoryCheckDto {
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  afterStock: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  remark?: string;
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 7: 创建响应 DTO（合并所有响应DTO）

**Files:**
- Create: `saleshub_serv/src/dto/response/inventory/response.dto.ts`

- [ ] **Step 1: 创建响应 DTO**

```typescript
import { Expose } from 'class-transformer';
import { ItemType } from '../../../entity/inventory/inventory-item.entity';

// 产品响应DTO
export class ProductResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  description: string;

  @Expose()
  createdAt: Date;
}

// 零件响应DTO
export class InventoryItemResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: ItemType;

  @Expose()
  name: string;

  @Expose()
  code: string;

  @Expose()
  productId: string;

  @Expose()
  productName: string;

  @Expose()
  specs: string[];

  @Expose()
  currentStock: number;

  @Expose()
  warnStock: number;

  @Expose()
  isWarning: boolean;

  @Expose()
  createdAt: Date;
}

// 库存历史响应DTO
export class StockHistoryResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: 'in' | 'out' | 'check';

  @Expose()
  itemId: string;

  @Expose()
  itemName: string;

  @Expose()
  quantity: number;

  @Expose()
  date: Date;

  @Expose()
  remark: string;

  @Expose()
  createdAt: Date;

  @Expose()
  beforeStock?: number;

  @Expose()
  afterStock?: number;
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 8: 创建 ProductService

**Files:**
- Create: `saleshub_serv/src/service/inventory/product.service.ts`

- [ ] **Step 1: 创建 ProductService**

```typescript
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/data-source';
import { Product } from '../../entity/inventory/product.entity';
import { CreateProductDto, UpdateProductDto } from '../../dto/request/inventory/product.dto';
import { getLogger } from '../../utils/logger.util';

export class ProductService {
  private productRepository: Repository<Product>;
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.productRepository = AppDataSource.getRepository(Product);
  }

  async create(dto: CreateProductDto) {
    try {
      const existing = await this.productRepository.findOne({
        where: { code: dto.code }
      });
      if (existing) {
        return { result: 1, msg: '产品编码已存在', alg: '', datas: null };
      }

      const product = this.productRepository.create(dto);
      const saved = await this.productRepository.save(product);
      this.logger.info('创建产品成功:', saved.id);

      return { result: 0, msg: '创建成功', alg: '', datas: saved };
    } catch (error) {
      this.logger.error('创建产品失败:', error);
      return { result: 1, msg: '创建失败', alg: '', datas: null };
    }
  }

  async findAll() {
    try {
      const products = await this.productRepository.find({
        where: { status: 1 },
        order: { createdAt: 'DESC' }
      });
      return { result: 0, msg: 'success', alg: '', datas: products };
    } catch (error) {
      this.logger.error('查询产品列表失败:', error);
      return { result: 1, msg: '查询失败', alg: '', datas: [] };
    }
  }

  async findOne(id: string) {
    try {
      const product = await this.productRepository.findOne({
        where: { productId: id },
        relations: ['inventoryItems']
      });
      if (!product) {
        return { result: 1, msg: '产品不存在', alg: '', datas: null };
      }
      return { result: 0, msg: 'success', alg: '', datas: product };
    } catch (error) {
      this.logger.error('查询产品失败:', error);
      return { result: 1, msg: '查询失败', alg: '', datas: null };
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      const product = await this.productRepository.findOne({ where: { productId: id } });
      if (!product) {
        return { result: 1, msg: '产品不存在', alg: '', datas: null };
      }

      if (dto.code && dto.code !== product.code) {
        const existing = await this.productRepository.findOne({
          where: { code: dto.code }
        });
        if (existing) {
          return { result: 1, msg: '产品编码已存在', alg: '', datas: null };
        }
      }

      Object.assign(product, dto);
      const updated = await this.productRepository.save(product);
      this.logger.info('更新产品成功:', id);

      return { result: 0, msg: '更新成功', alg: '', datas: updated };
    } catch (error) {
      this.logger.error('更新产品失败:', error);
      return { result: 1, msg: '更新失败', alg: '', datas: null };
    }
  }

  async remove(id: string) {
    try {
      const product = await this.productRepository.findOne({ where: { productId: id } });
      if (!product) {
        return { result: 1, msg: '产品不存在', alg: '', datas: null };
      }

      // 软删除
      product.status = 2;
      await this.productRepository.save(product);
      this.logger.info('删除产品成功:', id);

      return { result: 0, msg: '删除成功', alg: '', datas: null };
    } catch (error) {
      this.logger.error('删除产品失败:', error);
      return { result: 1, msg: '删除失败', alg: '', datas: null };
    }
  }

  async updateStatus(id: string, status: number) {
    try {
      const product = await this.productRepository.findOne({ where: { productId: id } });
      if (!product) {
        return { result: 1, msg: '产品不存在', alg: '', datas: null };
      }

      product.status = status;
      await this.productRepository.save(product);
      this.logger.info('更新产品状态成功:', id, 'status:', status);

      return { result: 0, msg: '更新成功', alg: '', datas: product };
    } catch (error) {
      this.logger.error('更新产品状态失败:', error);
      return { result: 1, msg: '更新失败', alg: '', datas: null };
    }
  }
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 9: 创建 InventoryItemService

**Files:**
- Create: `saleshub_serv/src/service/inventory/inventory-item.service.ts`

- [ ] **Step 1: 创建 InventoryItemService**

```typescript
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/data-source';
import { InventoryItem, ItemType } from '../../entity/inventory/inventory-item.entity';
import { CreateInventoryItemDto } from '../../dto/request/inventory/inventory-item.dto';
import { UpdateInventoryItemDto } from '../../dto/request/inventory/product.dto';
import { getLogger } from '../../utils/logger.util';

export class InventoryItemService {
  private itemRepository: Repository<InventoryItem>;
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.itemRepository = AppDataSource.getRepository(InventoryItem);
  }

  async create(dto: CreateInventoryItemDto) {
    try {
      const existing = await this.itemRepository.findOne({
        where: { code: dto.code }
      });
      if (existing) {
        return { result: 1, msg: '编码已存在', alg: '', datas: null };
      }

      const item = this.itemRepository.create({
        ...dto,
        currentStock: 0,
        warnStock: dto.warnStock || 10
      });
      const saved = await this.itemRepository.save(item);
      this.logger.info('创建零件成功:', saved.id);

      return { result: 0, msg: '创建成功', alg: '', datas: saved };
    } catch (error) {
      this.logger.error('创建零件失败:', error);
      return { result: 1, msg: '创建失败', alg: '', datas: null };
    }
  }

  async findAll(type?: ItemType, productId?: string) {
    try {
      const queryBuilder = this.itemRepository.createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .where('item.status = :status', { status: 1 });

      if (type) {
        queryBuilder.andWhere('item.type = :type', { type });
      }

      if (productId) {
        queryBuilder.andWhere('item.productId = :productId', { productId });
      }

      const items = await queryBuilder
        .orderBy('item.createdAt', 'DESC')
        .getMany();

      const result = items.map(item => ({
        ...item,
        productName: item.product?.name || null,
        isWarning: item.currentStock <= item.warnStock
      }));

      return { result: 0, msg: 'success', alg: '', datas: result };
    } catch (error) {
      this.logger.error('查询零件列表失败:', error);
      return { result: 1, msg: '查询失败', alg: '', datas: [] };
    }
  }

  async findWarnings() {
    try {
      const items = await this.itemRepository.createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .where('item.currentStock <= item.warnStock')
        .orderBy('item.currentStock', 'ASC')
        .getMany();

      const result = items.map(item => ({
        ...item,
        productName: item.product?.name || null
      }));

      return { result: 0, msg: 'success', alg: '', datas: result };
    } catch (error) {
      this.logger.error('查询预警列表失败:', error);
      return { result: 1, msg: '查询失败', alg: '', datas: [] };
    }
  }

  async findOne(id: string) {
    try {
      const item = await this.itemRepository.createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .where('item.itemId = :id', { id })
        .getOne();

      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      const result = {
        ...item,
        productName: item.product?.name || null
      };

      return { result: 0, msg: 'success', alg: '', datas: result };
    } catch (error) {
      this.logger.error('查询零件失败:', error);
      return { result: 1, msg: '查询失败', alg: '', datas: null };
    }
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    try {
      const item = await this.itemRepository.findOne({ where: { itemId: id } });
      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      if (dto.code && dto.code !== item.code) {
        const existing = await this.itemRepository.findOne({
          where: { code: dto.code }
        });
        if (existing) {
          return { result: 1, msg: '编码已存在', alg: '', datas: null };
        }
      }

      Object.assign(item, dto);
      const updated = await this.itemRepository.save(item);
      this.logger.info('更新零件成功:', id);

      return { result: 0, msg: '更新成功', alg: '', datas: updated };
    } catch (error) {
      this.logger.error('更新零件失败:', error);
      return { result: 1, msg: '更新失败', alg: '', datas: null };
    }
  }

  async remove(id: string) {
    try {
      const item = await this.itemRepository.findOne({ where: { itemId: id } });
      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      // 软删除
      item.status = 2;
      await this.itemRepository.save(item);
      this.logger.info('删除零件成功:', id);

      return { result: 0, msg: '删除成功', alg: '', datas: null };
    } catch (error) {
      this.logger.error('删除零件失败:', error);
      return { result: 1, msg: '删除失败', alg: '', datas: null };
    }
  }

  async updateStatus(id: string, status: number) {
    try {
      const item = await this.itemRepository.findOne({ where: { itemId: id } });
      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      item.status = status;
      await this.itemRepository.save(item);
      this.logger.info('更新零件状态成功:', id, 'status:', status);

      return { result: 0, msg: '更新成功', alg: '', datas: item };
    } catch (error) {
      this.logger.error('更新零件状态失败:', error);
      return { result: 1, msg: '更新失败', alg: '', datas: null };
    }
  }
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 10: 创建 StockService

**Files:**
- Create: `saleshub_serv/src/service/inventory/stock.service.ts`

- [ ] **Step 1: 创建 StockService**

```typescript
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/data-source';
import { InventoryItem } from '../../entity/inventory/inventory-item.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../../entity/inventory/stock.entity';
import { StockInDto, StockOutDto, InventoryCheckDto } from '../../dto/request/inventory/stock.dto';
import { getLogger } from '../../utils/logger.util';

export class StockService {
  private itemRepository: Repository<InventoryItem>;
  private stockInRepository: Repository<StockInRecord>;
  private stockOutRepository: Repository<StockOutRecord>;
  private checkRepository: Repository<InventoryCheck>;
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.itemRepository = AppDataSource.getRepository(InventoryItem);
    this.stockInRepository = AppDataSource.getRepository(StockInRecord);
    this.stockOutRepository = AppDataSource.getRepository(StockOutRecord);
    this.checkRepository = AppDataSource.getRepository(InventoryCheck);
  }

  async stockIn(dto: StockInDto) {
    try {
      const item = await this.itemRepository.findOne({ where: { id: dto.itemId } });
      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      const record = this.stockInRepository.create(dto);
      await this.stockInRepository.save(record);

      item.currentStock += dto.quantity;
      await this.itemRepository.save(item);

      this.logger.info('入库成功:', dto.itemId, '数量:', dto.quantity);

      return { result: 0, msg: '入库成功', alg: '', datas: { ...record, afterStock: item.currentStock } };
    } catch (error) {
      this.logger.error('入库失败:', error);
      return { result: 1, msg: '入库失败', alg: '', datas: null };
    }
  }

  async stockOut(dto: StockOutDto) {
    try {
      const item = await this.itemRepository.findOne({
        where: { id: dto.itemId, productId: dto.productId }
      });

      if (!item) {
        return { result: 1, msg: '设备件不存在或不属于该产品', alg: '', datas: null };
      }

      if (item.type !== 'device') {
        return { result: 1, msg: '只能出库设备件', alg: '', datas: null };
      }

      const record = this.stockOutRepository.create(dto);
      await this.stockOutRepository.save(record);

      item.currentStock -= dto.quantity;
      await this.itemRepository.save(item);

      this.logger.info('出库成功:', dto.itemId, '数量:', dto.quantity);

      return { result: 0, msg: '出库成功', alg: '', datas: { ...record, afterStock: item.currentStock } };
    } catch (error) {
      this.logger.error('出库失败:', error);
      return { result: 1, msg: '出库失败', alg: '', datas: null };
    }
  }

  async getHistory(itemId: string, startDate?: string, endDate?: string) {
    try {
      const item = await this.itemRepository.findOne({ where: { itemId: itemId } });
      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      const inRecords = await this.stockInRepository.find({
        where: { itemId },
        order: { createdAt: 'DESC' }
      });

      const outRecords = await this.stockOutRepository.find({
        where: { itemId },
        order: { createdAt: 'DESC' }
      });

      const checkRecords = await this.checkRepository.find({
        where: { itemId },
        order: { createdAt: 'DESC' }
      });

      const history = [
        ...inRecords.map(r => ({ ...r, type: 'in', itemName: item.name })),
        ...outRecords.map(r => ({ ...r, type: 'out', itemName: item.name })),
        ...checkRecords.map(r => ({ ...r, type: 'check', itemName: item.name }))
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { result: 0, msg: 'success', alg: '', datas: history };
    } catch (error) {
      this.logger.error('查询历史记录失败:', error);
      return { result: 1, msg: '查询失败', alg: '', datas: [] };
    }
  }

  async inventoryCheck(dto: InventoryCheckDto) {
    try {
      const item = await this.itemRepository.findOne({ where: { itemId: dto.itemId } });
      if (!item) {
        return { result: 1, msg: '零件不存在', alg: '', datas: null };
      }

      const beforeStock = item.currentStock;
      const record = this.checkRepository.create({
        ...dto,
        beforeStock
      });

      await this.checkRepository.save(record);

      item.currentStock = dto.afterStock;
      await this.itemRepository.save(item);

      this.logger.info('盘点成功:', dto.itemId, '盘点前:', beforeStock, '盘点后:', dto.afterStock);

      return { result: 0, msg: '盘点成功', alg: '', datas: record };
    } catch (error) {
      this.logger.error('盘点失败:', error);
      return { result: 1, msg: '盘点失败', alg: '', datas: null };
    }
  }
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 11: 创建 FileService (MinIO上传)

**Files:**
- Create: `saleshub_serv/src/service/inventory/file.service.ts`

- [ ] **Step 1: 创建 FileService**

```typescript
import { Express } from 'express';
import * as Minio from 'minio';
import { getLogger } from '../../utils/logger.util';
import { v4 as uuidv4 } from 'uuid';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
});

const BUCKET_NAME = 'inventory-photos';

export class FileService {
  private logger = getLogger('INVENTORY_SERV');

  constructor() {
    this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await minioClient.bucketExists(BUCKET_NAME);
      if (!exists) {
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
        this.logger.info('创建MinIO桶:', BUCKET_NAME);
      }
    } catch (error) {
      this.logger.error('MinIO桶检查失败:', error);
    }
  }

  async uploadPhoto(file: Express.Multer.File): Promise<{ url: string; error?: string }> {
    try {
      const fileName = `${uuidv4()}-${file.originalname}`;
      await minioClient.putObject(BUCKET_NAME, fileName, file.buffer);

      const url = `${minioClient.protocol}//${minioClient.host}:${minioClient.port}/${BUCKET_NAME}/${fileName}`;
      this.logger.info('文件上传成功:', fileName);

      return { url };
    } catch (error) {
      this.logger.error('文件上传失败:', error);
      return { url: '', error: '上传失败' };
    }
  }

  async deletePhoto(photoUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fileName = photoUrl.split(`/${BUCKET_NAME}/`)[1];
      if (!fileName) {
        return { success: false, error: '无效的URL' };
      }

      await minioClient.removeObject(BUCKET_NAME, fileName);
      this.logger.info('文件删除成功:', fileName);

      return { success: true };
    } catch (error) {
      this.logger.error('文件删除失败:', error);
      return { success: false, error: '删除失败' };
    }
  }
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 12: 创建产品路由

**Files:**
- Create: `saleshub_serv/src/routes/inventory/product.route.ts`

- [ ] **Step 1: 创建产品路由**

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { validationMiddleware, asyncHandler } from '../../middleware';
import { plainToInstance } from 'class-transformer';
import { CreateProductDto, UpdateProductDto, UpdateStatusDto } from '../../dto/request/inventory/product.dto';
import { productService } from '../../service/inventory';

const router = Router();

router.get<{}, any>('/',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await productService.findAll();
    res.locals.datas = result;
    next();
  })
);

router.post<{}, any>('/',
  validationMiddleware(CreateProductDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(CreateProductDto, req.body);
    const result = await productService.create(dto);
    res.locals.datas = result;
    next();
  })
);

router.get<{}, any>('/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await productService.findOne(req.params.id);
    res.locals.datas = result;
    next();
  })
);

router.put<{}, any>('/:id',
  validationMiddleware(UpdateProductDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(UpdateProductDto, req.body);
    const result = await productService.update(req.params.id, dto);
    res.locals.datas = result;
    next();
  })
);

router.delete<{}, any>('/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await productService.remove(req.params.id);
    res.locals.datas = result;
    next();
  })
);

router.post<{}, any>('/:id/status',
  validationMiddleware(UpdateStatusDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(UpdateStatusDto, req.body);
    const result = await productService.updateStatus(req.params.id, dto.status);
    res.locals.datas = result;
    next();
  })
);

export default router;
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 13: 创建零件路由

**Files:**
- Create: `saleshub_serv/src/routes/inventory/inventory-item.route.ts`

- [ ] **Step 1: 创建零件路由**

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { validationMiddleware, asyncHandler } from '../../middleware';
import { plainToInstance } from 'class-transformer';
import { CreateInventoryItemDto } from '../../dto/request/inventory/inventory-item.dto';
import { UpdateInventoryItemDto, UpdateStatusDto } from '../../dto/request/inventory/product.dto';
import { inventoryItemService } from '../../service/inventory';

const router = Router();

router.get<{}, any>('/',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { type, productId } = req.query;
    const result = await inventoryItemService.findAll(
      type as any,
      productId as string
    );
    res.locals.datas = result;
    next();
  })
);

router.get<{}, any>('/warnings',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await inventoryItemService.findWarnings();
    res.locals.datas = result;
    next();
  })
);

router.post<{}, any>('/',
  validationMiddleware(CreateInventoryItemDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(CreateInventoryItemDto, req.body);
    const result = await inventoryItemService.create(dto);
    res.locals.datas = result;
    next();
  })
);

router.get<{}, any>('/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await inventoryItemService.findOne(req.params.id);
    res.locals.datas = result;
    next();
  })
);

router.put<{}, any>('/:id',
  validationMiddleware(UpdateInventoryItemDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(UpdateInventoryItemDto, req.body);
    const result = await inventoryItemService.update(req.params.id, dto);
    res.locals.datas = result;
    next();
  })
);

router.delete<{}, any>('/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const result = await inventoryItemService.remove(req.params.id);
    res.locals.datas = result;
    next();
  })
);

router.post<{}, any>('/:id/status',
  validationMiddleware(UpdateStatusDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(UpdateStatusDto, req.body);
    const result = await inventoryItemService.updateStatus(req.params.id, dto.status);
    res.locals.datas = result;
    next();
  })
);

export default router;
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 14: 创建库存操作路由

**Files:**
- Create: `saleshub_serv/src/routes/inventory/stock.route.ts`

- [ ] **Step 1: 创建库存操作路由**

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { validationMiddleware, asyncHandler } from '../../middleware';
import { plainToInstance } from 'class-transformer';
import { StockInDto, StockOutDto, InventoryCheckDto } from '../../dto/request/inventory/stock.dto';
import { stockService } from '../../service/inventory';

const router = Router();

router.post<{}, any>('/in',
  validationMiddleware(StockInDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(StockInDto, req.body);
    const result = await stockService.stockIn(dto);
    res.locals.datas = result;
    next();
  })
);

router.post<{}, any>('/out',
  validationMiddleware(StockOutDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(StockOutDto, req.body);
    const result = await stockService.stockOut(dto);
    res.locals.datas = result;
    next();
  })
);

router.get<{}, any>('/history',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { itemId, startDate, endDate } = req.query;
    const result = await stockService.getHistory(
      itemId as string,
      startDate as string,
      endDate as string
    );
    res.locals.datas = result;
    next();
  })
);

router.post<{}, any>('/check',
  validationMiddleware(InventoryCheckDto),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const dto = plainToInstance(InventoryCheckDto, req.body);
    const result = await stockService.inventoryCheck(dto);
    res.locals.datas = result;
    next();
  })
);

export default router;
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 15: 创建文件上传路由

**Files:**
- Create: `saleshub_serv/src/routes/inventory/file.route.ts`

- [ ] **Step 1: 创建文件上传路由**

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../middleware';
import { fileService } from '../../service/inventory';

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = Router();

router.post<{}, any>('/upload',
  upload.single('photo'),
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.locals.datas = { result: 1, msg: '请选择文件', alg: '', datas: null };
      next();
      return;
    }

    const result = await fileService.uploadPhoto(req.file);
    if (result.error) {
      res.locals.datas = { result: 1, msg: result.error, alg: '', datas: null };
    } else {
      res.locals.datas = { result: 0, msg: '上传成功', alg: '', datas: { url: result.url } };
    }
    next();
  })
);

export default router;
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 16: 创建服务导出文件

**Files:**
- Create: `saleshub_serv/src/service/inventory/index.ts`

- [ ] **Step 1: 创建服务导出文件**

```typescript
import { ProductService } from './product.service';
import { InventoryItemService } from './inventory-item.service';
import { StockService } from './stock.service';
import { FileService } from './file.service';

const productService = new ProductService();
const inventoryItemService = new InventoryItemService();
const stockService = new StockService();
const fileService = new FileService();

export {
  productService,
  inventoryItemService,
  stockService,
  fileService
};
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 17: 注册路由到主应用

**Files:**
- Modify: `saleshub_serv/src/app.ts`

- [ ] **Step 1: 在 app.ts 中注册库存路由**

在 app.ts 的路由注册部分添加：

```typescript
import productRouter from './routes/inventory/product.route';
import inventoryItemRouter from './routes/inventory/inventory-item.route';
import stockRouter from './routes/inventory/stock.route';
import fileRouter from './routes/inventory/file.route';

app.use('/api/product', productRouter);
app.use('/api/inventory', inventoryItemRouter);
app.use('/api/stock', stockRouter);
app.use('/api/file', fileRouter);
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件
Expected: 路由注册成功

---

## 前端实施任务

### Task 18: 创建前端类型定义

**Files:**
- Create: `saleshub_web/src/types/inventory.ts`

- [ ] **Step 1: 创建类型定义**

```typescript
export enum ItemType {
  DEVICE = 'device',
  COMMON = 'common'
}

export enum ItemStatus {
  NORMAL = 1,
  DISABLED = 2
}

export interface Product {
  productId: string;
  name: string;
  code: string;
  description: string;
  status: number;
  createdAt: Date;
}

export interface InventoryItem {
  itemId: string;
  type: ItemType;
  name: string;
  code: string;
  productId: string;
  productName: string;
  specs: string[];
  currentStock: number;
  warnStock: number;
  status: number;
  isWarning: boolean;
  createdAt: Date;
}

export interface StockInRecord {
  inRecordId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  date: Date;
  photoUrl: string;
  remark: string;
  afterStock?: number;
  createdAt: Date;
}

export interface StockOutRecord {
  outRecordId: string;
  productId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  date: Date;
  remark: string;
  afterStock?: number;
  createdAt: Date;
}

export interface InventoryCheck {
  checkId: string;
  itemId: string;
  itemName: string;
  beforeStock: number;
  afterStock: number;
  date: Date;
  remark: string;
  createdAt: Date;
}

export interface StockHistory = StockInRecord | StockOutRecord | InventoryCheck & { type: 'in' | 'out' | 'check' };

export interface ApiResponse<T = any> {
  result: number;
  msg: string;
  alg: string;
  datas: T;
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 19: 创建API服务

**Files:**
- Create: `saleshub_web/src/api/inventory.ts`

- [ ] **Step 1: 创建API服务**

```typescript
import axios from 'axios';
import type { ApiResponse, Product, InventoryItem, StockHistory } from '../types/inventory';
import type { ItemType } from '../types/inventory';

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL || 'http://localhost:3000'
});

export const inventoryApi = {
  // 产品管理
  async getProducts(): Promise<ApiResponse<Product[]>> {
    const { data } = await api.get<ApiResponse<Product[]>>('/api/product');
    return data;
  },

  async createProduct(product: Partial<Product>): Promise<ApiResponse<Product>> {
    const { data } = await api.post<ApiResponse<Product>>('/api/product', product);
    return data;
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<ApiResponse<Product>> {
    const { data } = await api.put<ApiResponse<Product>>(`/api/product/${id}`, product);
    return data;
  },

  async deleteProduct(id: string): Promise<ApiResponse<null>> {
    const { data } = await api.delete<ApiResponse<null>>(`/api/product/${id}`);
    return data;
  },

  async getProduct(id: string): Promise<ApiResponse<Product>> {
    const { data } = await api.get<ApiResponse<Product>>(`/api/product/${id}`);
    return data;
  },

  async updateProductStatus(id: string, status: number): Promise<ApiResponse<Product>> {
    const { data } = await api.post<ApiResponse<Product>>(`/api/product/${id}/status`, { status });
    return data;
  },

  // 零件管理
  async getInventoryItems(type?: ItemType, productId?: string): Promise<ApiResponse<InventoryItem[]>> {
    const { data } = await api.get<ApiResponse<InventoryItem[]>>('/api/inventory', {
      params: { type, productId }
    });
    return data;
  },

  async getWarnings(): Promise<ApiResponse<InventoryItem[]>> {
    const { data } = await api.get<ApiResponse<InventoryItem[]>>('/api/inventory/warnings');
    return data;
  },

  async createInventoryItem(item: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.post<ApiResponse<InventoryItem>>('/api/inventory', item);
    return data;
  },

  async updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.put<ApiResponse<InventoryItem>>(`/api/inventory/${id}`, item);
    return data;
  },

  async deleteInventoryItem(id: string): Promise<ApiResponse<null>> {
    const { data } = await api.delete<ApiResponse<null>>(`/api/inventory/${id}`);
    return data;
  },

  async getInventoryItem(id: string): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.get<ApiResponse<InventoryItem>>(`/api/inventory/${id}`);
    return data;
  },

  async updateInventoryItemStatus(id: string, status: number): Promise<ApiResponse<InventoryItem>> {
    const { data } = await api.post<ApiResponse<InventoryItem>>(`/api/inventory/${id}/status`, { status });
    return data;
  },

  // 库存操作
  async stockIn(data: { itemId: string; quantity: number; date: string; photoUrl: string; remark?: string }): Promise<ApiResponse<any>> {
    const response = await api.post<ApiResponse<any>>('/api/stock/in', data);
    return response.data;
  },

  async stockOut(data: { productId: string; itemId: string; quantity: number; date: string; remark?: string }): Promise<ApiResponse<any>> {
    const response = await api.post<ApiResponse<any>>('/api/stock/out', data);
    return response.data;
  },

  async getStockHistory(itemId: string, startDate?: string, endDate?: string): Promise<ApiResponse<StockHistory[]>> {
    const { data } = await api.get<ApiResponse<StockHistory[]>>('/api/stock/history', {
      params: { itemId, startDate, endDate }
    });
    return data;
  },

  async inventoryCheck(data: { itemId: string; afterStock: number; date: string; remark?: string }): Promise<ApiResponse<any>> {
    const response = await api.post<ApiResponse<any>>('/api/stock/check', data);
    return response.data;
  },

  // 文件上传
  async uploadPhoto(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await api.post<ApiResponse<{ url: string }>>('/api/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }
};
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 20: 创建产品列表页面

**Files:**
- Create: `saleshub_web/src/views/inventory/ProductList.vue`

- [ ] **Step 1: 创建产品列表页面**

```vue
<template>
  <a-card title="产品管理">
    <template #extra>
      <a-button type="primary" @click="showCreateModal">新建产品</a-button>
    </template>

    <a-table :columns="columns" :data-source="products" :loading="loading" row-key="productId">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? '正常' : '停用' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button type="link" size="small" @click="handleViewParts(record)">设备件</a-button>
            <a-button 
              type="link" 
              size="small" 
              @click="handleToggleStatus(record)"
            >
              {{ record.status === 1 ? '停用' : '启用' }}
            </a-button>
            <a-popconfirm title="确定删除？" @confirm="handleDelete(record.id)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <ProductForm
      v-model:visible="formVisible"
      :product="currentProduct"
      @success="loadProducts"
    />
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '../../api/inventory';
import type { Product } from '../../types/inventory';
import ProductForm from '../../components/inventory/ProductForm.vue';

const columns = [
  { title: '产品名称', dataIndex: 'name', key: 'name' },
  { title: '产品编码', dataIndex: 'code', key: 'code' },
  { title: '产品描述', dataIndex: 'description', key: 'description' },
  { title: '状态', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
  { title: '操作', key: 'action', width: 250 }
];

const products = ref<Product[]>([]);
const loading = ref(false);
const formVisible = ref(false);
const currentProduct = ref<Product | null>(null);

const loadProducts = async () => {
  loading.value = true;
  try {
    const response = await inventoryApi.getProducts();
    if (response.result === 0) {
      products.value = response.datas;
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('加载失败');
  } finally {
    loading.value = false;
  }
};

const showCreateModal = () => {
  currentProduct.value = null;
  formVisible.value = true;
};

const handleEdit = (product: Product) => {
  currentProduct.value = product;
  formVisible.value = true;
};

const handleDelete = async (id: string) => {
  try {
    const response = await inventoryApi.deleteProduct(id);
    if (response.result === 0) {
      message.success('删除成功');
      loadProducts();
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('删除失败');
  }
};

const handleViewParts = (product: Product) => {
  // 跳转到零件列表，筛选该产品的设备件
  // 这里可以路由跳转或传递事件
};

const handleToggleStatus = async (product: Product) => {
  const newStatus = product.status === 1 ? 2 : 1;
  try {
    const response = await inventoryApi.updateProductStatus(product.id, newStatus);
    if (response.result === 0) {
      message.success(newStatus === 1 ? '启用成功' : '停用成功');
      loadProducts();
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('操作失败');
  }
};

onMounted(() => {
  loadProducts();
});
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 21: 创建库存列表页面

**Files:**
- Create: `saleshub_web/src/views/inventory/InventoryList.vue`

- [ ] **Step 1: 创建库存列表页面**

```vue
<template>
  <a-card title="库存管理">
    <template #extra>
      <a-space>
        <a-select
          v-model:value="filterType"
          style="width: 120px"
          placeholder="类型筛选"
          allowClear
          @change="loadInventoryItems"
        >
          <a-select-option value="device">设备件</a-select-option>
          <a-select-option value="common">常用件</a-select-option>
        </a-select>
        <a-button type="primary" @click="showCreateModal">新建零件</a-button>
      </a-space>
    </template>

    <a-table :columns="columns" :data-source="items" :loading="loading" row-key="itemId">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="record.type === 'device' ? 'blue' : 'green'">
            {{ record.type === 'device' ? '设备件' : '常用件' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'specs'">
          <a-tag v-for="spec in record.specs" :key="spec">{{ spec }}</a-tag>
          <span v-if="!record.specs || record.specs.length === 0">-</span>
        </template>
        <template v-if="column.key === 'stock'">
          <span :style="{ color: record.isWarning ? 'red' : 'inherit' }">
            {{ record.currentStock }}
          </span>
          <span v-if="record.isWarning" style="color: red; margin-left: 8px">
            (预警: {{ record.warnStock }})
          </span>
        </template>
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'red'">
            {{ record.status === 1 ? '正常' : '停用' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button type="link" size="small" @click="handleViewHistory(record)">历史</a-button>
            <a-button type="link" size="small" @click="handleCheck(record)">盘点</a-button>
            <a-button 
              type="link" 
              size="small" 
              @click="handleToggleStatus(record)"
            >
              {{ record.status === 1 ? '停用' : '启用' }}
            </a-button>
            <a-popconfirm title="确定删除？" @confirm="handleDelete(record.id)">
              <a-button type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <InventoryItemForm
      v-model:visible="formVisible"
      :item="currentItem"
      @success="loadInventoryItems"
    />
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '../../api/inventory';
import type { InventoryItem, ItemType } from '../../types/inventory';
import InventoryItemForm from '../../components/inventory/InventoryItemForm.vue';

const columns = [
  { title: '类型', key: 'type', width: 100 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '关联产品', dataIndex: 'productName', key: 'productName' },
  { title: '规格选项', key: 'specs', width: 150 },
  { title: '当前库存', key: 'stock', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 250 }
];

const items = ref<InventoryItem[]>([]);
const loading = ref(false);
const formVisible = ref(false);
const currentItem = ref<InventoryItem | null>(null);
const filterType = ref<ItemType | null>(null);

const loadInventoryItems = async () => {
  loading.value = true;
  try {
    const response = await inventoryApi.getInventoryItems(filterType.value || undefined);
    if (response.result === 0) {
      items.value = response.datas;
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('加载失败');
  } finally {
    loading.value = false;
  }
};

const showCreateModal = () => {
  currentItem.value = null;
  formVisible.value = true;
};

const handleEdit = (item: InventoryItem) => {
  currentItem.value = item;
  formVisible.value = true;
};

const handleDelete = async (id: string) => {
  try {
    const response = await inventoryApi.deleteInventoryItem(id);
    if (response.result === 0) {
      message.success('删除成功');
      loadInventoryItems();
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('删除失败');
  }
};

const handleViewHistory = (item: InventoryItem) => {
  // 跳转到历史记录页面
};

const handleCheck = (item: InventoryItem) => {
  // 打开盘点对话框
};

const handleToggleStatus = async (item: InventoryItem) => {
  const newStatus = item.status === 1 ? 2 : 1;
  try {
    const response = await inventoryApi.updateInventoryItemStatus(item.id, newStatus);
    if (response.result === 0) {
      message.success(newStatus === 1 ? '启用成功' : '停用成功');
      loadInventoryItems();
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('操作失败');
  }
};

onMounted(() => {
  loadInventoryItems();
});
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 22: 创建入库页面

**Files:**
- Create: `saleshub_web/src/views/inventory/StockIn.vue`

- [ ] **Step 1: 创建入库页面**

```vue
<template>
  <a-card title="入库管理">
    <a-form :model="form" layout="vertical" @finish="handleSubmit">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="零件" name="itemId" :rules="[{ required: true, message: '请选择零件' }]">
            <a-select
              v-model:value="form.itemId"
              placeholder="选择零件"
              show-search
              :filter-option="filterOption"
            >
              <a-select-option v-for="item in inventoryItems" :key="item.id" :value="item.id">
                {{ item.name }} ({{ item.code }})
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="入库数量" name="quantity" :rules="[{ required: true, message: '请输入数量' }]">
            <a-input-number v-model:value="form.quantity" :min="1" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="入库日期" name="date" :rules="[{ required: true, message: '请选择日期' }]">
            <a-date-picker v-model:value="form.date" style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="上传照片" name="photoUrl" :rules="[{ required: true, message: '请上传照片' }]">
            <a-upload
              :before-upload="handleUpload"
              :show-upload-list="false"
              accept="image/*"
            >
              <a-button :loading="uploading">
                {{ uploading ? '上传中...' : '选择照片' }}
              </a-button>
            </a-upload>
            <div v-if="form.photoUrl" style="margin-top: 8px">
              <a-image :src="form.photoUrl" :width="200" />
            </div>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="4" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="submitting">确认入库</a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { inventoryApi } from '../../api/inventory';
import type { InventoryItem } from '../../types/inventory';

const form = ref({
  itemId: '',
  quantity: 1,
  date: dayjs(),
  photoUrl: '',
  remark: ''
});

const inventoryItems = ref<InventoryItem[]>([]);
const uploading = ref(false);
const submitting = ref(false);

const loadInventoryItems = async () => {
  try {
    const response = await inventoryApi.getInventoryItems();
    if (response.result === 0) {
      inventoryItems.value = response.datas;
    }
  } catch (error) {
    message.error('加载零件失败');
  }
};

const filterOption = (input: string, option: any) => {
  return option.children.toLowerCase().includes(input.toLowerCase());
};

const handleUpload = async (file: File) => {
  uploading.value = true;
  try {
    const response = await inventoryApi.uploadPhoto(file);
    if (response.result === 0) {
      form.value.photoUrl = response.datas.url;
      message.success('上传成功');
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('上传失败');
  } finally {
    uploading.value = false;
  }
  return false;
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    const response = await inventoryApi.stockIn({
      itemId: form.value.itemId,
      quantity: form.value.quantity,
      date: form.value.date.format('YYYY-MM-DD'),
      photoUrl: form.value.photoUrl,
      remark: form.value.remark
    });

    if (response.result === 0) {
      message.success('入库成功');
      handleReset();
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('入库失败');
  } finally {
    submitting.value = false;
  }
};

const handleReset = () => {
  form.value = {
    itemId: '',
    quantity: 1,
    date: dayjs(),
    photoUrl: '',
    remark: ''
  };
};

onMounted(() => {
  loadInventoryItems();
});
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 23: 创建出库页面

**Files:**
- Create: `saleshub_web/src/views/inventory/StockOut.vue`

- [ ] **Step 1: 创建出库页面**

```vue
<template>
  <a-card title="出库管理">
    <a-form :model="form" layout="vertical" @finish="handleSubmit">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="选择产品" name="productId" :rules="[{ required: true, message: '请选择产品' }]">
            <a-select
              v-model:value="form.productId"
              placeholder="选择产品"
              @change="handleProductChange"
            >
              <a-select-option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} ({{ product.code }})
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="选择设备件" name="itemId" :rules="[{ required: true, message: '请选择设备件' }]">
            <a-select
              v-model:value="form.itemId"
              placeholder="选择设备件"
              :disabled="!form.productId"
            >
              <a-select-option v-for="item in deviceItems" :key="item.id" :value="item.id">
                {{ item.name }} (库存: {{ item.currentStock }})
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="出库数量" name="quantity" :rules="[{ required: true, message: '请输入数量' }]">
            <a-input-number v-model:value="form.quantity" :min="1" style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="出库日期" name="date" :rules="[{ required: true, message: '请选择日期' }]">
            <a-date-picker v-model:value="form.date" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="16">
          <a-form-item label="备注" name="remark">
            <a-textarea v-model:value="form.remark" :rows="3" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit" :loading="submitting">确认出库</a-button>
          <a-button @click="handleReset">重置</a-button>
        </a-space>
      </a-form-item>
    </a-form>
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { inventoryApi } from '../../api/inventory';
import type { Product, InventoryItem, ItemType } from '../../types/inventory';

const form = ref({
  productId: '',
  itemId: '',
  quantity: 1,
  date: dayjs(),
  remark: ''
});

const products = ref<Product[]>([]);
const deviceItems = ref<InventoryItem[]>([]);
const submitting = ref(false);

const loadProducts = async () => {
  try {
    const response = await inventoryApi.getProducts();
    if (response.result === 0) {
      products.value = response.datas;
    }
  } catch (error) {
    message.error('加载产品失败');
  }
};

const handleProductChange = async (productId: string) => {
  form.value.itemId = '';
  try {
    const response = await inventoryApi.getInventoryItems('device' as ItemType, productId);
    if (response.result === 0) {
      deviceItems.value = response.datas;
    }
  } catch (error) {
    message.error('加载设备件失败');
  }
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    const response = await inventoryApi.stockOut({
      productId: form.value.productId,
      itemId: form.value.itemId,
      quantity: form.value.quantity,
      date: form.value.date.format('YYYY-MM-DD'),
      remark: form.value.remark
    });

    if (response.result === 0) {
      message.success('出库成功');
      handleReset();
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('出库失败');
  } finally {
    submitting.value = false;
  }
};

const handleReset = () => {
  form.value = {
    productId: '',
    itemId: '',
    quantity: 1,
    date: dayjs(),
    remark: ''
  };
  deviceItems.value = [];
};

onMounted(() => {
  loadProducts();
});
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 24: 创建库存历史页面

**Files:**
- Create: `saleshub_web/src/views/inventory/StockHistory.vue`

- [ ] **Step 1: 创建库存历史页面**

```vue
<template>
  <a-card title="库存历史">
    <template #extra>
      <a-select
        v-model:value="selectedItemId"
        style="width: 300px"
        placeholder="选择零件"
        show-search
        :filter-option="filterOption"
        @change="loadHistory"
      >
        <a-select-option v-for="item in inventoryItems" :key="item.id" :value="item.id">
          {{ item.name }} ({{ item.code }})
        </a-select-option>
      </a-select>
    </template>

    <a-table :columns="columns" :data-source="history" :loading="loading" row-key="itemId">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="getTypeColor(record.type)">
            {{ getTypeText(record.type) }}
          </a-tag>
        </template>
        <template v-if="column.key === 'quantity'">
          <span :style="{ color: record.type === 'out' ? 'red' : 'green' }">
            {{ record.type === 'out' ? '-' : '+' }}{{ record.quantity }}
          </span>
        </template>
        <template v-if="column.key === 'checkDiff'">
          <span v-if="record.type === 'check'" :style="{ color: record.afterStock - record.beforeStock < 0 ? 'red' : 'green' }">
            {{ record.beforeStock }} → {{ record.afterStock }}
            ({{ record.afterStock - record.beforeStock > 0 ? '+' : '' }}{{ record.afterStock - record.beforeStock }})
          </span>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '../../api/inventory';
import type { InventoryItem, StockHistory } from '../../types/inventory';

const columns = [
  { title: '操作类型', key: 'type', width: 100 },
  { title: '零件', dataIndex: 'itemName', key: 'itemName' },
  { title: '数量变化', key: 'quantity', width: 120 },
  { title: '盘点变化', key: 'checkDiff', width: 150 },
  { title: '日期', dataIndex: 'date', key: 'date' },
  { title: '备注', dataIndex: 'remark', key: 'remark' }
];

const inventoryItems = ref<InventoryItem[]>([]);
const history = ref<StockHistory[]>([]);
const selectedItemId = ref<string>('');
const loading = ref(false);

const loadInventoryItems = async () => {
  try {
    const response = await inventoryApi.getInventoryItems();
    if (response.result === 0) {
      inventoryItems.value = response.datas;
    }
  } catch (error) {
    message.error('加载零件失败');
  }
};

const loadHistory = async () => {
  if (!selectedItemId.value) return;

  loading.value = true;
  try {
    const response = await inventoryApi.getStockHistory(selectedItemId.value);
    if (response.result === 0) {
      history.value = response.datas;
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('加载历史失败');
  } finally {
    loading.value = false;
  }
};

const filterOption = (input: string, option: any) => {
  return option.children.toLowerCase().includes(input.toLowerCase());
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'in': return 'green';
    case 'out': return 'red';
    case 'check': return 'blue';
    default: return 'default';
  }
};

const getTypeText = (type: string) => {
  switch (type) {
    case 'in': return '入库';
    case 'out': return '出库';
    case 'check': return '盘点';
    default: return type;
  }
};

onMounted(() => {
  loadInventoryItems();
});
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 25: 创建库存预警页面

**Files:**
- Create: `saleshub_web/src/views/inventory/StockWarning.vue`

- [ ] **Step 1: 创建库存预警页面**

```vue
<template>
  <a-card title="库存预警">
    <a-alert
      message="库存预警提醒"
      description="以下零件当前库存低于或等于预警阈值，请及时补货"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
    />

    <a-table :columns="columns" :data-source="warnings" :loading="loading" row-key="itemId">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <a-tag :color="record.type === 'device' ? 'blue' : 'green'">
            {{ record.type === 'device' ? '设备件' : '常用件' }}
          </a-tag>
        </template>
        <template v-if="column.key === 'stock'">
          <a-progress
            :percent="getStockPercent(record)"
            :status="getStockPercent(record) <= 20 ? 'exception' : 'normal'"
            :format="() => `${record.currentStock} / ${record.warnStock}`"
          />
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '../../api/inventory';
import type { InventoryItem } from '../../types/inventory';

const columns = [
  { title: '类型', key: 'type', width: 100 },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '关联产品', dataIndex: 'productName', key: 'productName' },
  { title: '库存状态', key: 'stock', width: 200 }
];

const warnings = ref<InventoryItem[]>([]);
const loading = ref(false);

const loadWarnings = async () => {
  loading.value = true;
  try {
    const response = await inventoryApi.getWarnings();
    if (response.result === 0) {
      warnings.value = response.datas;
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('加载预警列表失败');
  } finally {
    loading.value = false;
  }
};

const getStockPercent = (item: InventoryItem) => {
  if (item.warnStock <= 0) return 0;
  return Math.round((item.currentStock / item.warnStock) * 100);
};

onMounted(() => {
  loadWarnings();
});
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 26: 创建盘点页面

**Files:**
- Create: `saleshub_web/src/views/inventory/InventoryCheck.vue`

- [ ] **Step 1: 创建盘点页面**

```vue
<template>
  <a-modal v-model:open="visible" title="库存盘点" @ok="handleSubmit" @cancel="handleCancel">
    <a-form :model="form" layout="vertical">
      <a-form-item label="选择零件">
        <a-select
          v-model:value="form.itemId"
          placeholder="选择零件"
          show-search
          :filter-option="filterOption"
          @change="handleItemChange"
        >
          <a-select-option v-for="item in inventoryItems" :key="item.id" :value="item.id">
            {{ item.name }} ({{ item.code }})
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item v-if="currentItem" label="当前库存">
        <a-input-number v-model:value="currentItem.currentStock" disabled style="width: 100%" />
      </a-form-item>

      <a-form-item label="实际库存" name="afterStock" :rules="[{ required: true, message: '请输入实际库存' }]">
        <a-input-number v-model:value="form.afterStock" :min="0" style="width: 100%" />
      </a-form-item>

      <a-form-item label="盘点日期" name="date" :rules="[{ required: true, message: '请选择日期' }]">
        <a-date-picker v-model:value="form.date" style="width: 100%" />
      </a-form-item>

      <a-form-item label="备注" name="remark">
        <a-textarea v-model:value="form.remark" :rows="3" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { inventoryApi } from '../../api/inventory';
import type { InventoryItem } from '../../types/inventory';

interface Props {
  visible: boolean;
  item?: InventoryItem | null;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
  itemId: '',
  afterStock: 0,
  date: dayjs(),
  remark: ''
});

const inventoryItems = ref<InventoryItem[]>([]);
const currentItem = ref<InventoryItem | null>(null);
const submitting = ref(false);

watch(() => props.visible, (newVal) => {
  if (newVal && props.item) {
    form.value.itemId = props.item.id;
    currentItem.value = props.item;
    loadInventoryItems();
  }
});

const loadInventoryItems = async () => {
  try {
    const response = await inventoryApi.getInventoryItems();
    if (response.result === 0) {
      inventoryItems.value = response.datas;
    }
  } catch (error) {
    message.error('加载零件失败');
  }
};

const handleItemChange = (itemId: string) => {
  currentItem.value = inventoryItems.value.find(item => item.id === itemId) || null;
};

const filterOption = (input: string, option: any) => {
  return option.children.toLowerCase().includes(input.toLowerCase());
};

const handleSubmit = async () => {
  submitting.value = true;
  try {
    const response = await inventoryApi.inventoryCheck({
      itemId: form.value.itemId,
      afterStock: form.value.afterStock,
      date: form.value.date.format('YYYY-MM-DD'),
      remark: form.value.remark
    });

    if (response.result === 0) {
      message.success('盘点成功');
      emit('success');
      emit('update:visible', false);
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('盘点失败');
  } finally {
    submitting.value = false;
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 27: 创建 ProductForm 组件

**Files:**
- Create: `saleshub_web/src/components/inventory/ProductForm.vue`

- [ ] **Step 1: 创建 ProductForm 组件**

```vue
<template>
  <a-modal
    :visible="visible"
    :title="isEdit ? '编辑产品' : '新建产品'"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="产品名称" name="name" :rules="[{ required: true, message: '请输入产品名称' }]">
        <a-input v-model:value="form.name" placeholder="请输入产品名称" />
      </a-form-item>

      <a-form-item label="产品编码" name="code" :rules="[{ required: true, message: '请输入产品编码' }]">
        <a-input v-model:value="form.code" placeholder="请输入产品编码" />
      </a-form-item>

      <a-form-item label="产品描述" name="description">
        <a-textarea v-model:value="form.description" :rows="4" placeholder="请输入产品描述" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '../../api/inventory';
import type { Product } from '../../types/inventory';

interface Props {
  visible: boolean;
  product?: Product | null;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
  name: '',
  code: '',
  description: ''
});

const isEdit = computed(() => !!props.product);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    if (props.product) {
      form.value = {
        name: props.product.name,
        code: props.product.code,
        description: props.product.description || ''
      };
    } else {
      form.value = { name: '', code: '', description: '' };
    }
  }
});

const handleSubmit = async () => {
  if (!form.value.name || !form.value.code) {
    message.error('请填写必填项');
    return;
  }

  try {
    let response;
    if (isEdit.value && props.product) {
      response = await inventoryApi.updateProduct(props.product.id, form.value);
    } else {
      response = await inventoryApi.createProduct(form.value);
    }

    if (response.result === 0) {
      message.success(isEdit.value ? '更新成功' : '创建成功');
      emit('success');
      emit('update:visible', false);
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('操作失败');
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 28: 创建 InventoryItemForm 组件

**Files:**
- Create: `saleshub_web/src/components/inventory/InventoryItemForm.vue`

- [ ] **Step 1: 创建 InventoryItemForm 组件**

```vue
<template>
  <a-modal
    :visible="visible"
    :title="isEdit ? '编辑零件' : '新建零件'"
    width="600px"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="类型" name="type" :rules="[{ required: true, message: '请选择类型' }]">
        <a-radio-group v-model:value="form.type">
          <a-radio value="device">设备件</a-radio>
          <a-radio value="common">常用件</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="名称" name="name" :rules="[{ required: true, message: '请输入名称' }]">
        <a-input v-model:value="form.name" placeholder="请输入名称" />
      </a-form-item>

      <a-form-item label="编码" name="code" :rules="[{ required: true, message: '请输入编码' }]">
        <a-input v-model:value="form.code" placeholder="请输入编码" />
      </a-form-item>

      <a-form-item v-if="form.type === 'device'" label="关联产品" name="productId" :rules="[{ required: true, message: '请选择产品' }]">
        <a-select v-model:value="form.productId" placeholder="选择产品">
          <a-select-option v-for="product in products" :key="product.id" :value="product.id">
            {{ product.name }} ({{ product.code }})
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item v-if="form.type === 'common'" label="规格选项" name="specs">
        <SpecEditor v-model:value="form.specs" />
      </a-form-item>

      <a-form-item label="预警库存" name="warnStock">
        <a-input-number v-model:value="form.warnStock" :min="0" style="width: 100%" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { message } from 'ant-design-vue';
import { inventoryApi } from '../../api/inventory';
import type { InventoryItem, Product } from '../../types/inventory';
import SpecEditor from './SpecEditor.vue';

interface Props {
  visible: boolean;
  item?: InventoryItem | null;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
  type: 'common' as 'device' | 'common',
  name: '',
  code: '',
  productId: '',
  specs: [] as string[],
  warnStock: 10
});

const products = ref<Product[]>([]);
const isEdit = computed(() => !!props.item);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    loadProducts();
    if (props.item) {
      form.value = {
        type: props.item.type,
        name: props.item.name,
        code: props.item.code,
        productId: props.item.productId || '',
        specs: props.item.specs || [],
        warnStock: props.item.warnStock
      };
    } else {
      form.value = { type: 'common', name: '', code: '', productId: '', specs: [], warnStock: 10 };
    }
  }
});

const loadProducts = async () => {
  try {
    const response = await inventoryApi.getProducts();
    if (response.result === 0) {
      products.value = response.datas;
    }
  } catch (error) {
    message.error('加载产品失败');
  }
};

const handleSubmit = async () => {
  if (!form.value.name || !form.value.code) {
    message.error('请填写必填项');
    return;
  }

  if (form.value.type === 'device' && !form.value.productId) {
    message.error('设备件必须关联产品');
    return;
  }

  try {
    let response;
    if (isEdit.value && props.item) {
      response = await inventoryApi.updateInventoryItem(props.item.id, form.value);
    } else {
      response = await inventoryApi.createInventoryItem(form.value);
    }

    if (response.result === 0) {
      message.success(isEdit.value ? '更新成功' : '创建成功');
      emit('success');
      emit('update:visible', false);
    } else {
      message.error(response.msg);
    }
  } catch (error) {
    message.error('操作失败');
  }
};

const handleCancel = () => {
  emit('update:visible', false);
};
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 29: 创建 SpecEditor 组件

**Files:**
- Create: `saleshub_web/src/components/inventory/SpecEditor.vue`

- [ ] **Step 1: 创建 SpecEditor 组件**

```vue
<template>
  <div>
    <a-space v-for="(spec, index) in specs" :key="index" style="display: flex; margin-bottom: 8px">
      <a-input
        v-model:value="specs[index]"
        placeholder="输入规格值"
        style="flex: 1"
      />
      <a-button type="link" danger @click="removeSpec(index)">删除</a-button>
    </a-space>
    <a-button type="dashed" block @click="addSpec">
      + 添加规格
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  value?: string[];
}

interface Emits {
  (e: 'update:value', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const specs = ref<string[]>(props.value || []);

watch(() => props.value, (newVal) => {
  if (newVal) {
    specs.value = [...newVal];
  }
});

watch(specs, (newVal) => {
  emit('update:value', newVal);
});

const addSpec = () => {
  specs.value.push('');
};

const removeSpec = (index: number) => {
  specs.value.splice(index, 1);
};
</script>
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 30: 配置前端路由

**Files:**
- Modify: `saleshub_web/src/router/index.ts`

- [ ] **Step 1: 添加库存管理路由**

在路由配置中添加：

```typescript
{
  path: '/inventory',
  name: 'Inventory',
  component: () => import('@/layouts/DefaultLayout.vue'),
  children: [
    {
      path: 'products',
      name: 'ProductList',
      component: () => import('@/views/inventory/ProductList.vue'),
      meta: { title: '产品管理' }
    },
    {
      path: 'items',
      name: 'InventoryList',
      component: () => import('@/views/inventory/InventoryList.vue'),
      meta: { title: '库存管理' }
    },
    {
      path: 'stock-in',
      name: 'StockIn',
      component: () => import('@/views/inventory/StockIn.vue'),
      meta: { title: '入库管理' }
    },
    {
      path: 'stock-out',
      name: 'StockOut',
      component: () => import('@/views/inventory/StockOut.vue'),
      meta: { title: '出库管理' }
    },
    {
      path: 'history',
      name: 'StockHistory',
      component: () => import('@/views/inventory/StockHistory.vue'),
      meta: { title: '库存历史' }
    },
    {
      path: 'warnings',
      name: 'StockWarning',
      component: () => import('@/views/inventory/StockWarning.vue'),
      meta: { title: '库存预警' }
    }
  ]
}
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件
Expected: 路由配置成功

---

### Task 31: 创建数据库迁移文件

**Files:**
- Create: `saleshub_serv/migrations/create-inventory-schema.sql`

- [ ] **Step 1: 创建数据库迁移SQL**

```sql
-- 创建 inventory schema
CREATE SCHEMA IF NOT EXISTS inventory;

-- 创建 products 表
CREATE TABLE IF NOT EXISTS inventory.products (
  product_id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  status INT DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 inventory_items 表
CREATE TABLE IF NOT EXISTS inventory.inventory_items (
  item_id VARCHAR(32) PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('device', 'common')),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  product_id VARCHAR(32) REFERENCES inventory.products(product_id) ON DELETE SET NULL,
  specs TEXT[] DEFAULT NULL,
  current_stock INT DEFAULT 0,
  warn_stock INT DEFAULT 10,
  status INT DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 stock_in_records 表
CREATE TABLE IF NOT EXISTS inventory.stock_in_records (
  in_record_id VARCHAR(32) PRIMARY KEY,
  item_id VARCHAR(32) NOT NULL REFERENCES inventory.inventory_items(item_id),
  quantity INT NOT NULL,
  date DATE NOT NULL,
  photo_url VARCHAR(500) NOT NULL,
  remark TEXT,
  status INT DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 stock_out_records 表
CREATE TABLE IF NOT EXISTS inventory.stock_out_records (
  out_record_id VARCHAR(32) PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL REFERENCES inventory.products(product_id),
  item_id VARCHAR(32) NOT NULL REFERENCES inventory.inventory_items(item_id),
  quantity INT NOT NULL,
  date DATE NOT NULL,
  remark TEXT,
  status INT DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 inventory_checks 表
CREATE TABLE IF NOT EXISTS inventory.inventory_checks (
  check_id VARCHAR(32) PRIMARY KEY,
  item_id VARCHAR(32) NOT NULL REFERENCES inventory.inventory_items(item_id),
  before_stock INT NOT NULL,
  after_stock INT NOT NULL,
  date DATE NOT NULL,
  remark TEXT,
  status INT DEFAULT 1 CHECK (status IN (1, 2)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON inventory.inventory_items(type);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON inventory.inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory.inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_products_status ON inventory.products(status);
CREATE INDEX IF NOT EXISTS idx_stock_in_records_item_id ON inventory.stock_in_records(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_records_item_id ON inventory.stock_out_records(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_records_product_id ON inventory.stock_out_records(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_checks_item_id ON inventory.inventory_checks(item_id);
```

- [ ] **Step 2: 保存文件**

Run: 手动保存文件到指定路径
Expected: 文件创建成功

---

### Task 32: 执行数据库迁移

**Files:**
- None

- [ ] **Step 1: 执行SQL迁移文件**

```bash
psql -h localhost -U your_user -d your_database -f saleshub_serv/migrations/create-inventory-schema.sql
```

Expected: 数据库表创建成功

- [ ] **Step 2: 验证表创建**

```sql
-- 检查表是否创建成功
SELECT table_name FROM information_schema.tables WHERE table_schema = 'inventory';
```

Expected: 显示 5 个表 (products, inventory_items, stock_in_records, stock_out_records, inventory_checks)

---

### Task 33: 安装后端依赖

**Files:**
- Modify: `saleshub_serv/package.json`

- [ ] **Step 1: 添加依赖到 package.json**

在 dependencies 中添加：

```json
{
  "minio": "^7.1.3",
  "multer": "^1.4.5-lts.1",
  "uuid": "^9.0.0"
}
```

在 devDependencies 中添加：

```json
{
  "@types/multer": "^1.4.7",
  "@types/uuid": "^9.0.0"
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd saleshub_serv && pnpm install
```

Expected: 依赖安装成功

---

### Task 34: 安装前端依赖

**Files:**
- Modify: `saleshub_web/package.json`

- [ ] **Step 1: 添加依赖到 package.json**

```json
{
  "dependencies": {
    "ant-design-vue": "^4.0.0",
    "axios": "^1.6.0",
    "dayjs": "^1.11.10",
    "pinia": "^2.1.7"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd saleshub_web && pnpm install
```

Expected: 依赖安装成功

---

### Task 35: 配置环境变量

**Files:**
- Create: `saleshub_web/.env.development`

- [ ] **Step 1: 创建前端环境变量文件**

```env
VUE_APP_API_URL=http://localhost:3000
```

- [ ] **Step 2: 创建后端环境变量文件**

在 `saleshub_serv/.env.development` 添加：

```env
# MinIO配置
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

Expected: 环境变量配置完成

---

## 完成检查清单

实施完成后，验证以下功能：

- [ ] 产品 CRUD 功能正常
- [ ] 零件 CRUD 功能正常
- [ ] 入库功能正常（含照片上传）
- [ ] 出库功能正常（关联产品）
- [ ] 库存历史查询正常
- [ ] 库存预警显示正常
- [ ] 盘点功能正常
- [ ] MinIO 照片上传和显示正常
- [ ] API 响应格式符合规范
- [ ] 前端页面无控制台错误
- [ ] 前后端数据格式一致

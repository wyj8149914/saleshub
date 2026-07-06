# 产品模块化零件管理实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现产品模块化零件管理功能，支持产品通过模块管理零件或直接关联零件，两种方式互斥。

**Architecture:** 新增 ProductModule 实体存储模块信息，扩展 ProductItem 实体新增 module_id 字段实现模块关联，业务层实现模式互斥校验。

**Tech Stack:** TypeScript, TypeORM, Express, PostgreSQL

---

## Task 1: 数据库迁移 - 创建 product_module 表

**Files:**
- Create: `scripts/migrations/20260706_add_product_module.sql`

- [ ] **Step 1: 编写迁移 SQL 脚本**

```sql
-- 创建 product_module 表
CREATE TABLE IF NOT EXISTS inventory.product_module (
    module_id VARCHAR(32) PRIMARY KEY,
    product_id VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    sort_order INT DEFAULT 0,
    remark TEXT,
    status INT DEFAULT 1,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 添加外键约束
ALTER TABLE inventory.product_module
ADD CONSTRAINT fk_product_module_product
FOREIGN KEY (product_id) REFERENCES inventory.product(product_id);

-- 添加索引
CREATE INDEX idx_product_module_product ON inventory.product_module(product_id);

-- 为 product_item 表新增 module_id 字段
ALTER TABLE inventory.product_item
ADD COLUMN IF NOT EXISTS module_id VARCHAR(32) NULL;

-- 添加外键约束
ALTER TABLE inventory.product_item
ADD CONSTRAINT fk_product_item_module
FOREIGN KEY (module_id) REFERENCES inventory.product_module(module_id);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_product_item_module ON inventory.product_item(module_id);

-- 添加注释
COMMENT ON TABLE inventory.product_module IS '产品模块表';
COMMENT ON COLUMN inventory.product_module.module_id IS '模块ID';
COMMENT ON COLUMN inventory.product_module.product_id IS '产品ID';
COMMENT ON COLUMN inventory.product_module.name IS '模块名称';
COMMENT ON COLUMN inventory.product_module.code IS '模块编码';
COMMENT ON COLUMN inventory.product_module.sort_order IS '排序号';
COMMENT ON COLUMN inventory.product_module.remark IS '备注';
COMMENT ON COLUMN inventory.product_module.status IS '状态:1-正常,2-停用';
COMMENT ON COLUMN inventory.product_item.module_id IS '所属模块ID，NULL表示产品直接关联';
```

- [ ] **Step 2: 执行迁移脚本**

运行: `psql -U <用户名> -d <数据库名> -f scripts/migrations/20260706_add_product_module.sql`

预期: 表创建成功，无错误

---

## Task 2: 新增 ProductModule 实体

**Files:**
- Modify: `src/entity/product.entity.ts`

- [ ] **Step 1: 在 product.entity.ts 中添加 ProductModule 实体**

在 `ItemType` 实体类定义之后，添加以下代码：

```typescript
@Entity({ schema: 'inventory', name: 'product_module' })
export class ProductModule {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    module_id: string;

    @Column({ type: 'varchar', length: 32, comment: '产品ID' })
    product_id: string;

    @Column({ type: 'varchar', length: 100, comment: '模块名称' })
    name: string;

    @Column({ type: 'varchar', length: 50, nullable: true, comment: '模块编码' })
    code: string;

    @Column({ type: 'int', default: 0, comment: '排序号' })
    sort_order: number;

    @Column({ type: 'text', nullable: true, comment: '备注' })
    remark: string;

    @Column({ type: 'int', default: 1, comment: '状态:1-正常,2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

- [ ] **Step 2: 修改 ProductItem 实体添加 module_id 字段**

在 `ProductItem` 实体类中，在 `product_id` 字段之后添加：

```typescript
@Column({ type: 'varchar', length: 32, nullable: true, comment: '所属模块ID，NULL表示产品直接关联' })
module_id: string;
```

- [ ] **Step 3: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 3: 新增模块相关 DTO

**Files:**
- Modify: `src/dto/product.dto.ts`

- [ ] **Step 1: 在 product.dto.ts 文件末尾添加模块相关 DTO**

```typescript
// ============ 模块管理 DTO ============

export class CreateModuleDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;

    @IsNotEmpty({ message: '模块名称不能为空' })
    @MaxLength(100, { message: '模块名称长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(50, { message: '模块编码长度不能超过50' })
    code?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '排序号必须是整数' })
    sort_order?: number;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class UpdateModuleDto {
    @IsNotEmpty({ message: '模块ID不能为空' })
    module_id: string;

    @IsOptional()
    @MaxLength(100, { message: '模块名称长度不能超过100' })
    name?: string;

    @IsOptional()
    @MaxLength(50, { message: '模块编码长度不能超过50' })
    code?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '排序号必须是整数' })
    sort_order?: number;

    @IsOptional()
    @MaxLength(500, { message: '备注长度不能超过500' })
    remark?: string;
}

export class ModuleIdDto {
    @IsNotEmpty({ message: '模块ID不能为空' })
    module_id: string;
}

export class ListModuleDto {
    @IsNotEmpty({ message: '产品ID不能为空' })
    product_id: string;
}

export class SetModuleItemsDto {
    @IsNotEmpty({ message: '模块ID不能为空' })
    module_id: string;

    @IsArray({ message: '零件列表必须是数组' })
    @IsNotEmpty({ message: '零件列表不能为空' })
    @ValidateNested({ each: true })
    @Type(() => ProductItemEntryDto)
    items: ProductItemEntryDto[];
}
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 4: ProductService - 新增 Repository 和辅助方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 导入 ProductModule 实体**

在文件顶部的导入语句中，修改 entity 导入：

```typescript
import { Product, ProductItem, InventoryItem, InventoryItemSpec, ItemType, ProductModule } from '../../entity/product.entity';
```

- [ ] **Step 2: 在 ProductService 类中添加 productModuleRepository**

在 `productItemRepository` 定义之后添加：

```typescript
private productModuleRepository = AppDataSource.getRepository(ProductModule);
```

- [ ] **Step 3: 添加私有辅助方法 - 检查产品关联模式**

在 `generateProductCode` 方法之前添加：

```typescript
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
```

- [ ] **Step 4: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 5: ProductService - 实现 createModule 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 ProductService 类中添加 createModule 方法**

在 `getProductItems` 方法之后、`generateProductCode` 方法之前添加：

```typescript
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
        if (dto.code) {
            module.code = dto.code;
        }
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
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 6: ProductService - 实现 listModule 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 createModule 方法之后添加 listModule 方法**

```typescript
/**
 * 查询产品的模块列表
 */
async listModule(dto: ListModuleDto) {
    try {
        const modules = await this.productModuleRepository
            .createQueryBuilder('m')
            .where('m.product_id = :productId AND m.status = :status', {
                productId: dto.product_id,
                status: 1,
            })
            .orderBy('m.sort_order', 'ASC')
            .addOrderBy('m.create_time', 'ASC')
            .getMany();

        return { result: 0, msg: 'success', datas: { items: modules } };
    } catch (error) {
        this.logger.error('查询模块列表失败:', error);
        return { result: 1, msg: '查询失败' };
    }
}
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 7: ProductService - 实现 updateModule 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 listModule 方法之后添加 updateModule 方法**

```typescript
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

        if (dto.code !== undefined) {
            module.code = dto.code;
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
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 8: ProductService - 实现 deleteModule 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 updateModule 方法之后添加 deleteModule 方法**

```typescript
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
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 9: ProductService - 实现 setModuleItems 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 deleteModule 方法之后添加 setModuleItems 方法**

```typescript
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
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 10: ProductService - 实现 getModuleItems 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 setModuleItems 方法之后添加 getModuleItems 方法**

```typescript
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
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 11: ProductService - 修改 setProductItems 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 在 setProductItems 方法中添加模式互斥校验**

找到 `setProductItems` 方法，在 `const product = await this.productRepository.findOne...` 之后，`if (!product)` 判断之后添加：

```typescript
// 检查产品是否已有模块
const moduleCount = await this.productModuleRepository.count({
    where: { product_id: dto.product_id, status: 1 },
});
if (moduleCount > 0) {
    return { result: 1, msg: '该产品已使用模块方式管理零件，无法直接关联零件' };
}
```

- [ ] **Step 2: 在创建 ProductItem 时确保 module_id 为 null**

找到 `const productItems: ProductItem[] = dto.items.map...` 部分，确保包含：

```typescript
pi.module_id = null as any;
```

完整的 map 函数应为：

```typescript
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
```

- [ ] **Step 3: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 12: ProductService - 修改 getProductItems 方法

**Files:**
- Modify: `src/service/inventory/product.service.ts`

- [ ] **Step 1: 重写 getProductItems 方法**

将现有的 `getProductItems` 方法替换为：

```typescript
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
                code: m.code,
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
```

- [ ] **Step 2: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 13: 新增模块路由

**Files:**
- Modify: `src/routes/inventory.route.ts`

- [ ] **Step 1: 更新 DTO 导入**

修改文件顶部的导入语句，添加新的 DTO：

```typescript
import {
    CreateProductDto, ProductIdDto, ListProductDto, UpdateProductDto, SetProductItemsDto, ProductItemIdDto,
    CreateModuleDto, UpdateModuleDto, ModuleIdDto, ListModuleDto, SetModuleItemsDto,
} from '../dto/product.dto';
```

- [ ] **Step 2: 在 listProductItems 路由之后添加模块路由**

在 `// 入库操作(单条)` 注释之前添加：

```typescript
// ============ 模块管理 ============

// 创建模块
router.post('/createModule',
    validationMiddleware(CreateModuleDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(CreateModuleDto, req.body);
        const result = await productService.createModule(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询模块列表
router.get('/listModule',
    validationMiddleware(ListModuleDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ListModuleDto, req.query);
        const result = await productService.listModule(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 更新模块
router.post('/updateModule',
    validationMiddleware(UpdateModuleDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(UpdateModuleDto, req.body);
        const result = await productService.updateModule(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 删除模块
router.post('/deleteModule',
    validationMiddleware(ModuleIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ModuleIdDto, req.body);
        const result = await productService.deleteModule(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 设置模块零件
router.post('/setModuleItems',
    validationMiddleware(SetModuleItemsDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(SetModuleItemsDto, req.body);
        const result = await productService.setModuleItems(dtoObj);
        res.locals.datas = result;
        next();
    })
);

// 查询模块零件列表
router.get('/listModuleItems',
    validationMiddleware(ModuleIdDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(ModuleIdDto, req.query);
        const result = await productService.getModuleItems(dtoObj);
        res.locals.datas = result;
        next();
    })
);
```

- [ ] **Step 3: 验证代码编译**

运行: `pnpm run typecheck`

预期: 无类型错误

---

## Task 14: 验证和测试

- [ ] **Step 1: 运行完整编译**

运行: `pnpm run build`

预期: 编译成功，无错误

- [ ] **Step 2: 运行 lint 检查**

运行: `pnpm run lint`

预期: 无 lint 错误（如有警告可忽略）

- [ ] **Step 3: 启动开发服务器进行手动测试**

运行: `pnpm run dev`

预期: 服务启动成功

- [ ] **Step 4: 手动测试接口**

使用 Postman 或 curl 测试以下接口：

1. 创建产品
2. 创建模块 - 验证成功
3. 再次创建模块 - 验证成功
4. 尝试直接设置零件 - 验证返回错误
5. 设置模块零件 - 验证成功
6. 查询产品零件 - 验证返回模块分组结构
7. 删除模块 - 验证模块下有零件时无法删除
8. 删除模块零件后删除模块 - 验证成功

---

## 变更文件汇总

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `scripts/migrations/20260706_add_product_module.sql` | 新增 | 数据库迁移脚本 |
| `src/entity/product.entity.ts` | 修改 | 新增 ProductModule 实体，ProductItem 新增 module_id 字段 |
| `src/dto/product.dto.ts` | 修改 | 新增模块相关 DTO |
| `src/service/inventory/product.service.ts` | 修改 | 新增模块管理方法，修改现有方法 |
| `src/routes/inventory.route.ts` | 修改 | 新增模块相关路由 |

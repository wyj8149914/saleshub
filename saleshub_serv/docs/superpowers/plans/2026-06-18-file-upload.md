# 文件上传功能重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 `file.service.ts`,上传时落库到 `inventory.file` 表,通过 hash 全局去重,业务表通过 `relation_id` 关联文件。

**Architecture:** 新增 `inventory.file` 表(PK=`relation_id` varchar(32),UNIQUE=`hash` varchar(64));上传时先按 hash 查 DB,命中即返回已有 relation_id(软删则激活),未命中则上传 MinIO + 插表;MinIO 对象名采用 hash 寻址(`<hash前2位>/<hash>.<ext>`);复用项目共享的 `minio.config.ts` 与 `appConfig`。

**Tech Stack:** TypeScript + TypeORM + Express + MinIO + PostgreSQL + class-validator。

**Note on TDD:** 本项目无测试框架(`package.json` 无 jest/vitest 配置,用户明确要求 YAGNI 不引入)。本计划用 `pnpm run typecheck` + `pnpm run lint` + 手工接口测试替代自动化测试。每个任务结尾必须通过 typecheck 才能提交。

**Spec:** `docs/superpowers/specs/2026-06-18-file-upload-design.md`

---

## 文件结构

### 新增

- `src/entity/file.entity.ts` — `File` 实体,对应 `inventory.file` 表
- `src/dto/file.dto.ts` — `DeleteFileDto`(URL/body 参数校验)

### 修改

- `src/service/file.service.ts` — 完全重写,复用 `minio.config.ts`、`appConfig`,新增 `upload()` 与 `deleteByRelationId()`
- `src/routes/file.route.ts` — 上传字段 `photo` → `file`;修正响应嵌套;新增删除路由
- `src/entity/stock.entity.ts:20-21` — `StockInRecord.photo_url` → `photo_id`
- `src/dto/stock.dto.ts:19-21` — `StockInDto.photo_url` → `photo_id`
- `src/service/inventory/stock.service.ts:35` — 赋值由 `dto.photo_url` → `record.photo_id`

---

## Task 1: 执行数据库迁移 SQL

**Files:** 无代码改动,仅 DB 操作

- [ ] **Step 1: 连接 PostgreSQL 执行迁移**

执行以下 SQL(项目无 TypeORM migration 目录,手工执行):

```sql
-- 1. 新建 file 表
CREATE TABLE inventory.file (
  relation_id   varchar(32)   PRIMARY KEY,
  hash          varchar(64)   NOT NULL UNIQUE,
  object_name   varchar(255)  NOT NULL,
  original_name varchar(255)  NOT NULL,
  mime_type     varchar(100)  NOT NULL,
  size          bigint        NOT NULL,
  bucket        varchar(50)   NOT NULL,
  status        int           NOT NULL DEFAULT 1,
  create_time   timestamp     NOT NULL,
  update_time   timestamp     NOT NULL
);

-- 2. stock_in_record 重命名 + 收窄类型
ALTER TABLE inventory.stock_in_record 
  RENAME COLUMN photo_url TO photo_id;
ALTER TABLE inventory.stock_in_record 
  ALTER COLUMN photo_id TYPE varchar(32) USING photo_id::varchar(32);
ALTER TABLE inventory.stock_in_record 
  ALTER COLUMN photo_id DROP DEFAULT;
COMMENT ON COLUMN inventory.stock_in_record.photo_id IS '入库照片 file.relation_id';
```

- [ ] **Step 2: 验证表结构**

执行:

```sql
\d inventory.file
\d inventory.stock_in_record
```

Expected:
- `inventory.file` 表存在,9 列,`relation_id` 是 PK,`hash` 是 UNIQUE
- `inventory.stock_in_record` 的 `photo_id` 列类型为 `varchar(32)`,无 `photo_url` 列

- [ ] **Step 3: 无代码改动,无需提交**

---

## Task 2: 新增 File 实体

**Files:**
- Create: `src/entity/file.entity.ts`

- [ ] **Step 1: 创建实体文件**

`src/entity/file.entity.ts` 完整内容:

```typescript
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'inventory', name: 'file' })
export class File {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    relation_id: string;

    @Column({ type: 'varchar', length: 64, unique: true, comment: 'SHA-256 hex' })
    hash: string;

    @Column({ type: 'varchar', length: 255, comment: 'MinIO 对象键' })
    object_name: string;

    @Column({ type: 'varchar', length: 255, comment: '原始文件名' })
    original_name: string;

    @Column({ type: 'varchar', length: 100, comment: 'MIME 类型' })
    mime_type: string;

    @Column({ type: 'bigint', comment: '文件字节数' })
    size: number;

    @Column({ type: 'varchar', length: 50, comment: 'MinIO bucket 名' })
    bucket: string;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS,无新增错误

- [ ] **Step 3: 提交**

```bash
git add src/entity/file.entity.ts
git commit -m "$(cat <<'EOF'
新增: File 实体对应 inventory.file 表

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 新增 DeleteFileDto

**Files:**
- Create: `src/dto/file.dto.ts`

- [ ] **Step 1: 创建 DTO 文件**

`src/dto/file.dto.ts` 完整内容:

```typescript
import { IsNotEmpty, MaxLength } from 'class-validator';

export class DeleteFileDto {
    @IsNotEmpty({ message: 'relation_id 不能为空' })
    @MaxLength(32, { message: 'relation_id 长度不能超过 32' })
    relation_id: string;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/dto/file.dto.ts
git commit -m "$(cat <<'EOF'
新增: DeleteFileDto 文件删除参数校验

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 重写 file.service.ts

**Files:**
- Modify: `src/service/file.service.ts`(完全重写)

- [ ] **Step 1: 完全替换 file.service.ts 内容**

`src/service/file.service.ts` 完整新内容:

```typescript
import * as crypto from 'crypto';
import path from 'path';
import { QueryFailedError } from 'typeorm';
import { v7 } from 'uuid';
import { AppDataSource } from '../config/database.config';
import { minioConfig, uploadFile, deleteFile, generateFileUrl } from '../config/minio.config';
import { File } from '../entity/file.entity';
import { getLogger } from '../utils/logger.util';

interface UploadFileInput {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}

interface UploadResult {
    result: number;
    msg: string;
    datas?: {
        relation_id: string;
        url: string;
        hash: string;
        is_duplicate: boolean;
    };
}

interface DeleteResult {
    result: number;
    msg: string;
}

class FileService {
    private fileRepository = AppDataSource.getRepository(File);
    private logger = getLogger('FILE_SERV');

    /**
     * 上传文件到 MinIO 并登记到 file 表
     * - hash 全局唯一,命中已有记录直接返回(软删则激活)
     * - 未命中:上传 MinIO + 插表;并发 UNIQUE 冲突时回查 + 清理对象补偿
     */
    async upload(file: UploadFileInput): Promise<UploadResult> {
        try {
            const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

            const existing = await this.fileRepository.findOne({ where: { hash } });
            if (existing) {
                if (existing.status === 2) {
                    existing.status = 1;
                    existing.update_time = new Date();
                    await this.fileRepository.save(existing);
                }
                return {
                    result: 0,
                    msg: '上传成功',
                    datas: {
                        relation_id: existing.relation_id,
                        url: generateFileUrl(existing.object_name),
                        hash,
                        is_duplicate: true,
                    },
                };
            }

            const ext = path.extname(file.originalname).slice(1);
            const objectName = `${hash.slice(0, 2)}/${hash}${ext ? '.' + ext : ''}`;
            const bucket = minioConfig.bucket;

            await uploadFile(bucket, objectName, file.buffer, { 'Content-Type': file.mimetype });

            const relationId = v7().replace(/-/g, '');
            const now = new Date();
            const entity = new File();
            entity.relation_id = relationId;
            entity.hash = hash;
            entity.object_name = objectName;
            entity.original_name = file.originalname;
            entity.mime_type = file.mimetype;
            entity.size = file.size;
            entity.bucket = bucket;
            entity.status = 1;
            entity.create_time = now;
            entity.update_time = now;

            try {
                await this.fileRepository.save(entity);
            } catch (error) {
                if (error instanceof QueryFailedError && this.isUniqueViolation(error)) {
                    const winner = await this.fileRepository.findOne({ where: { hash } });
                    if (winner) {
                        if (winner.status === 2) {
                            winner.status = 1;
                            winner.update_time = new Date();
                            await this.fileRepository.save(winner);
                        }
                        try {
                            await deleteFile(bucket, objectName);
                        } catch (cleanupError) {
                            this.logger.warn('清理重复上传对象失败:', cleanupError);
                        }
                        return {
                            result: 0,
                            msg: '上传成功',
                            datas: {
                                relation_id: winner.relation_id,
                                url: generateFileUrl(winner.object_name),
                                hash,
                                is_duplicate: true,
                            },
                        };
                    }
                }
                throw error;
            }

            this.logger.info('上传文件成功:', { relation_id: relationId, hash });

            return {
                result: 0,
                msg: '上传成功',
                datas: {
                    relation_id: relationId,
                    url: generateFileUrl(objectName),
                    hash,
                    is_duplicate: false,
                },
            };
        } catch (error) {
            this.logger.error('上传文件失败:', error);
            return { result: 1, msg: '上传失败' };
        }
    }

    /**
     * 软删文件(status=2),不动 MinIO 对象
     */
    async deleteByRelationId(relationId: string): Promise<DeleteResult> {
        try {
            const file = await this.fileRepository.findOne({ where: { relation_id: relationId } });
            if (!file || file.status === 2) {
                return { result: 1, msg: '文件不存在' };
            }
            file.status = 2;
            file.update_time = new Date();
            await this.fileRepository.save(file);
            this.logger.info('删除文件成功:', { relation_id: relationId });
            return { result: 0, msg: '删除成功' };
        } catch (error) {
            this.logger.error('删除文件失败:', error);
            return { result: 1, msg: '删除失败' };
        }
    }

    private isUniqueViolation(error: QueryFailedError): boolean {
        const driverErr = error as unknown as { code?: string };
        return driverErr.code === '23505';
    }
}

export const fileService = new FileService();
```

- [ ] **Step 2: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS

注意:若 `deleteFile` 与 `uploadFile` 在 `minio.config.ts` 中命名不一致,以实际导出为准(已确认两者都已导出)。

- [ ] **Step 3: lint 检查**

Run: `pnpm run lint src/service/file.service.ts`
Expected: PASS,无未使用导入

- [ ] **Step 4: 提交**

```bash
git add src/service/file.service.ts
git commit -m "$(cat <<'EOF'
重构: file.service 落库 + hash 全局去重 + relation_id 关联

## 主要变更

### 1. 复用项目共享配置
- 删除独立的 Minio.Client 初始化,改用 src/config/minio.config.ts 的 uploadFile/deleteFile/generateFileUrl
- 删除 process.env 直读,改用 minioConfig.bucket
- bucket 不再硬编码 'inventory-photos'

### 2. 上传流程落库
- 计算 SHA-256 hash 作为全局唯一键
- 命中已有 hash 直接返回现有 relation_id,不重复上传 MinIO
- 软删记录(status=2)重新上传时激活复用
- 并发兜底:UNIQUE 冲突时回查 + removeObject 补偿

### 3. 新增软删接口
- deleteByRelationId 仅 UPDATE status=2,不动 MinIO 对象
- 避免业务表悬空引用

### 4. 移除 alg 字段
- 全部响应对齐项目最新约定(result/msg/datas)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 改造 file.route.ts

**Files:**
- Modify: `src/routes/file.route.ts`(完全重写)

**说明(偏离 spec 的小调整):** spec 写的是 `DELETE /:relation_id`,但项目所有路由都是 POST + 命名操作(如 `updateUserStatus`),且 `validationMiddleware` 不校验 URL param。改为 `POST /delete` + body,与项目约定一致,且能复用 `DeleteFileDto` 校验。

- [ ] **Step 1: 完全替换 file.route.ts 内容**

`src/routes/file.route.ts` 完整新内容:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { plainToInstance } from 'class-transformer';
import { validationMiddleware } from '../middleware/paramsValidator';
import { asyncHandler } from '../middleware/errorHandler.middleware';
import { DeleteFileDto } from '../dto/file.dto';
import { fileService } from '../service/file.service';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
});

/**
 * POST /upload
 * 上传文件到 MinIO 并登记到 file 表
 */
router.post(
    '/upload',
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.file) {
            res.locals.datas = { result: 1, msg: '请选择要上传的文件' };
            next();
            return;
        }

        const result = await fileService.upload({
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });

        res.locals.datas = result;
        next();
    })
);

/**
 * POST /delete
 * 软删文件(status=2)
 */
router.post(
    '/delete',
    validationMiddleware(DeleteFileDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dto = plainToInstance(DeleteFileDto, req.body);
        const result = await fileService.deleteByRelationId(dto.relation_id);
        res.locals.datas = result;
        next();
    })
);

export default router;
```

- [ ] **Step 2: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: lint 检查**

Run: `pnpm run lint src/routes/file.route.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/routes/file.route.ts
git commit -m "$(cat <<'EOF'
重构: file 路由上传字段更名 + 新增删除接口

## 主要变更

### 1. 上传接口
- multer 字段名 photo 改为 file(支持任意类型)
- 修正响应嵌套 bug,直接 res.locals.datas = result

### 2. 新增删除接口
- POST /delete { relation_id } 软删文件
- 使用 DeleteFileDto 校验参数,与项目路由风格一致

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 业务表迁移 stock_in_record.photo_url → photo_id

**Files:**
- Modify: `src/entity/stock.entity.ts:20-21`
- Modify: `src/dto/stock.dto.ts:19-21`
- Modify: `src/service/inventory/stock.service.ts:35`

- [ ] **Step 1: 修改 StockInRecord 实体**

打开 `src/entity/stock.entity.ts`,定位到 `StockInRecord` 内(约第 20-21 行):

原代码:
```typescript
    @Column({ type: 'varchar', length: 500, nullable: true, comment: '照片URL' })
    photo_url: string;
```

改为:
```typescript
    @Column({ type: 'varchar', length: 32, nullable: true, comment: '入库照片 file.relation_id' })
    photo_id: string;
```

- [ ] **Step 2: 修改 StockInDto**

打开 `src/dto/stock.dto.ts`,定位到 `StockInDto` 内(约第 19-21 行):

原代码:
```typescript
    @IsNotEmpty({ message: '照片URL不能为空' })
    @MaxLength(500, { message: '照片URL长度不能超过500' })
    photo_url: string;
```

改为:
```typescript
    @IsNotEmpty({ message: '照片ID不能为空' })
    @MaxLength(32, { message: '照片ID长度不能超过32' })
    photo_id: string;
```

- [ ] **Step 3: 修改 StockService.stockIn 赋值**

打开 `src/service/inventory/stock.service.ts`,定位到第 35 行:

原代码:
```typescript
            record.photo_url = dto.photo_url;
```

改为:
```typescript
            record.photo_id = dto.photo_id;
```

- [ ] **Step 4: 类型检查**

Run: `pnpm run typecheck`
Expected: PASS,无 `photo_url` 残留引用

- [ ] **Step 5: lint 检查**

Run: `pnpm run lint`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/entity/stock.entity.ts src/dto/stock.dto.ts src/service/inventory/stock.service.ts
git commit -m "$(cat <<'EOF'
重构: stock_in_record.photo_url 改为 photo_id 关联 file 表

## 主要变更

### 1. 实体层
- StockInRecord.photo_url (varchar 500) → photo_id (varchar 32)
- 实际值是 file.relation_id

### 2. DTO 层
- StockInDto.photo_url → photo_id,校验长度由 500 改为 32

### 3. Service 层
- stockIn 方法赋值改为 record.photo_id = dto.photo_id

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 整体回归验证

**Files:** 无改动,仅验证

- [ ] **Step 1: 全量 typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 2: 全量 lint**

Run: `pnpm run lint`
Expected: PASS

- [ ] **Step 3: 启动 dev server**

Run: `pnpm run dev`
Expected: 服务正常启动,日志显示 MinIO bucket 初始化成功

- [ ] **Step 4: 手工测试上传 - 首次**

用 curl 或 Postman 调用:

```bash
curl -X POST http://localhost:3000/saleshub/file/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/test.jpg"
```

Expected:
- HTTP 200
- 响应 `datas.is_duplicate === false`
- 响应 `datas.relation_id` 是 32 字符字符串
- 响应 `datas.url` 可直接 GET 访问,返回文件内容
- 响应 `datas.hash` 是 64 字符 hex

- [ ] **Step 5: 手工测试上传 - 重复**

再次上传**同一个文件**:

```bash
curl -X POST http://localhost:3000/saleshub/file/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/test.jpg"
```

Expected:
- 响应 `datas.is_duplicate === true`
- 响应 `datas.relation_id` 与 Step 4 完全相同

- [ ] **Step 6: 手工测试软删**

```bash
curl -X POST http://localhost:3000/saleshub/file/delete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"relation_id":"<上一步拿到的 relation_id>"}'
```

Expected: 响应 `{ result: 0, msg: '删除成功' }`

DB 验证:

```sql
SELECT relation_id, status FROM inventory.file WHERE relation_id = '<...>';
```

Expected: `status = 2`

文件 URL 应**仍可访问**(软删不动 MinIO 对象)。

- [ ] **Step 7: 手工测试重复删除**

再调一次 Step 6 的删除接口。
Expected: `{ result: 1, msg: '文件不存在' }`

- [ ] **Step 8: 手工测试软删后重新上传**

再次上传同一文件(Step 4 的文件):
Expected:
- 响应 `datas.is_duplicate === true`
- 响应 `datas.relation_id` 与原 relation_id 相同(激活复用)

DB 验证:

```sql
SELECT relation_id, status FROM inventory.file WHERE relation_id = '<...>';
```

Expected: `status = 1`(已被激活)

- [ ] **Step 9: 手工测试入库流程联动**

调用入库接口,`photo_id` 字段填入前面拿到的 `relation_id`:

```bash
curl -X POST http://localhost:3000/saleshub/inventory/stockIn \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"<某零件ID>","quantity":10,"date":"2026-06-18","photo_id":"<relation_id>"}'
```

Expected: `{ result: 0, msg: '入库成功' }`

DB 验证:

```sql
SELECT photo_id FROM inventory.stock_in_record ORDER BY create_time DESC LIMIT 1;
```

Expected: `photo_id` 列值等于上传返回的 `relation_id`

- [ ] **Step 10: 验证完成,无需提交**

如果以上全部通过,功能完成。如有失败,回到对应任务修复后重新验证该步骤。

---

## 自审记录

完成所有任务后,实现者需对照下列检查项自查:

- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm run lint` 通过
- [ ] 没有残留的 `photo_url` 引用(grep 验证)
- [ ] 没有残留的 `alg` 字段在新增/重构代码中
- [ ] `file.service.ts` 不再使用 `process.env`(grep 验证)
- [ ] `file.service.ts` 不再 `new Minio.Client`(grep 验证)

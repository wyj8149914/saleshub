# 文件上传功能重构设计

## 背景

现有 `file.service.ts` 是简单的 MinIO 上传封装,存在以下问题:

1. 上传后不落库,无法追溯文件的来源、关联业务、原始信息
2. 独立 `new Minio.Client(...)` 初始化,绕过项目共享的 `src/config/minio.config.ts`
3. 直接读 `process.env`,违反 CLAUDE.md 中"统一通过 `appConfig` 访问"的约定
4. 返回结构包含 `alg` 字段,与项目最新约定(已全面移除 `alg`)不一致
5. 业务表 `stock_in_record.photo_url` 直接存 URL,无法表达"同一物理文件被多处引用"的关系

本设计将上传功能重构为:数据库登记 + 全局去重 + `relation_id` 关联业务表。

## 目标

- 上传成功后写入 `inventory.file` 表,记录 hash、MinIO 对象键、原始文件名等元信息
- hash 全局唯一,相同文件被多次上传时复用已有 MinIO 对象,**不新增数据库行**
- 业务表通过 `relation_id` 列引用文件,不再直存 URL
- 复用项目共享的 `minio.config.ts` 与 `appConfig`,符合 CLAUDE.md 规范
- 移除响应中的 `alg` 字段

## 非目标

- 不实现物理清理任务(MinIO 对象的真正删除)
- 不实现"秒传"前端预算 hash 模式(文件小、内网场景,不值得引入 Web Crypto)
- 不实现文件查询接口(`GET /file/:relation_id`),YAGNI
- 不做跨业务表的引用计数删除保护
- 不重构其他业务表(本轮仅迁移 `stock_in_record.photo_url`)

## 架构

### 数据模型

新表 `inventory.file`:

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `relation_id` | varchar(32) | PK | UUID v7(去横线),业务表通过此列引用 |
| `hash` | varchar(64) | UNIQUE NOT NULL | SHA-256 hex(64 字符) |
| `object_name` | varchar(255) | NOT NULL | MinIO 对象键,格式 `<hash前2位>/<hash>.<扩展名>` |
| `original_name` | varchar(255) | NOT NULL | 客户端上传时的原始文件名 |
| `mime_type` | varchar(100) | NOT NULL | 文件 MIME 类型 |
| `size` | bigint | NOT NULL | 文件字节数 |
| `bucket` | varchar(50) | NOT NULL | MinIO bucket 名 |
| `status` | int | NOT NULL DEFAULT 1 | 1-正常,2-停用(软删) |
| `create_time` | timestamp | NOT NULL | 创建时间 |
| `update_time` | timestamp | NOT NULL | 更新时间 |

设计要点:
- `relation_id` 作为 PK 同时也是业务表的引用列,命名与 `product_item.relation_id` 风格一致
- `hash` 既是 UNIQUE 约束也是逻辑去重键,二者合一
- **不存 `url` 列**:url 是 endpoint + bucket + object_name 的派生值,通过 `generateFileUrl(object_name)` 即时拼出;endpoint/bucket 变更不会污染历史记录
- MinIO 对象名采用 **hash 寻址**:`<hash前2位>/<hash>.<扩展名>`,DB 唯一约束 + MinIO 寻址双保险

### 业务表迁移

`stock_in_record.photo_url` → `photo_id`:
- 类型由 `varchar(500)` 收窄为 `varchar(32)`
- 实际值是 `file.relation_id`
- 其他业务表本轮不动

### 组件

**`src/entity/file.entity.ts`**(新增)
- TypeORM 实体,对应 `inventory.file` 表

**`src/service/file.service.ts`**(完全重写)
- 复用 `minio.config.ts` 的 `uploadFile`、`minioClient`、`generateFileUrl`
- 使用 `appConfig.minio.publicBucket`(不硬编码 `'inventory-photos'`)
- 使用 `getLogger('FILE_SERV')` 记日志
- 方法:
  - `upload(file: UploadFileInput): Promise<UploadResult>`
  - `deleteByRelationId(relation_id: string): Promise<DeleteResult>`
- 删除原有的 `getClient` / `getBucketName` / `deletePhoto` / `uploadPhoto`

**`src/dto/file.dto.ts`**(新增)
- `DeleteFileDto`:`relation_id` 字段 + 校验
- 上传接口无 DTO(multer 处理文件)

**`src/routes/file.route.ts`**(改造)
- 上传字段从 `photo` 改为 `file`
- 修正现有响应嵌套 bug(当前 `res.locals.datas` 嵌套了完整 result/msg/datas,会输出双层)
- 新增 `DELETE /:relation_id` 路由

### 数据流

**上传流程**:

```
client --multipart/form-data--> POST /saleshub/file/upload
  |
  v
file.route.ts (multer.single('file'))
  |
  v
FileService.upload({buffer, originalname, mimetype, size})
  |
  +-- 1. hash = sha256(buffer).hex()
  +-- 2. SELECT * FROM file WHERE hash = ?
  |     命中 -> 返回 { relation_id, url, hash, is_duplicate: true } (不查 MinIO, 不上传)
  +-- 3. ext = path.extname(originalname).slice(1)
  +-- 4. object_name = `${hash.slice(0,2)}/${hash}${ext ? '.' + ext : ''}`
  +-- 5. uploadFile(publicBucket, object_name, buffer, { 'Content-Type': mimetype })
  +-- 6. INSERT file 实体 (relation_id = v7().replace(/-/g,''))
  |     UNIQUE 冲突 -> 回查 hash, 删除刚上传的 MinIO 对象补偿, 返回已存在记录
  +-- 7. 返回 { relation_id, url: generateFileUrl(object_name), hash, is_duplicate: false }
```

**软删后重新上传**:hash 在表中存在但 `status=2`(软删)时,SELECT 仍能命中。处理策略:**激活原有记录**(UPDATE status=1, update_time=now),返回原 `relation_id` 与 `is_duplicate: true`。理由:hash UNIQUE 约束使重新 INSERT 不可能;复用 relation_id 让曾引用该文件的业务表自动恢复有效。

**删除流程**:

```
client --> DELETE /saleshub/file/:relation_id
  |
  v
FileService.deleteByRelationId(relation_id)
  |
  +-- 1. SELECT * FROM file WHERE relation_id = ?
  +-- 2. 不存在或 status=2 -> 返回 { result: 1, msg: '文件不存在' }
  +-- 3. UPDATE file SET status=2, update_time=now WHERE relation_id=?
  +-- 4. 返回 { result: 0, msg: '删除成功' }
```

### 接口契约

**`POST /saleshub/file/upload`**
- 请求:`multipart/form-data`,字段 `file`(单文件,任意类型)
- 响应:
  ```json
  {
    "result": 0,
    "msg": "上传成功",
    "datas": {
      "relation_id": "0196723...",
      "url": "http://.../bucket/01/0196723....jpg",
      "hash": "a3f5b2...",
      "is_duplicate": false
    }
  }
  ```
- 错误:文件为空 → `{ result: 1, msg: '请选择要上传的文件' }`;MinIO 异常 → `{ result: 1, msg: '上传失败' }`

**`DELETE /saleshub/file/:relation_id`**
- 响应:`{ result: 0, msg: '删除成功' }`
- 错误:`{ result: 1, msg: '文件不存在' }`

### 错误处理

遵循项目现有约定:
- Service 层捕获异常,返回 `{ result: 1, msg: '...' }`,不抛
- 路由层 `asyncHandler` 包装,自动传递到 `errorHandler`
- 上传时 MinIO 异常记录到日志,返回 `{ result: 1, msg: '上传失败' }`
- 上传后 DB INSERT 非 UNIQUE 异常(如连接断开):MinIO 对象可能孤立留存,**本轮不做自动清理**(YAGNI),返回 `{ result: 1, msg: '上传失败' }`;孤立对象可在后续物理清理任务中统一处理

### 并发兜底

并发上传同一文件的极少数情况下:
1. 请求 A 查 DB 未命中,开始上传 MinIO
2. 请求 B 同样未命中,开始上传同一对象(hash 寻址保证 object_name 相同,putObject 幂等)
3. A 先 INSERT 成功
4. B INSERT 时 UNIQUE(hash) 冲突
5. B 捕获冲突,**回查 hash 拿到 A 的记录**,删除自己刚上传的对象补偿(可选,因为对象相同 removeObject 幂等),返回 A 的记录

结果:DB 只有一行,MinIO 只有一个对象。

## 受影响代码清单

### 新增

- `src/entity/file.entity.ts`
- `src/dto/file.dto.ts`

### 修改

| 文件 | 改动 |
|---|---|
| `src/service/file.service.ts` | 完全重写,复用 `minio.config.ts`、`appConfig`,移除 `alg` 字段 |
| `src/routes/file.route.ts` | 上传字段 `photo` → `file`;修正响应嵌套 bug;新增 `DELETE /:relation_id` |
| `src/entity/stock.entity.ts` | `StockInRecord.photo_url` → `photo_id`,类型 `varchar(500)` → `varchar(32)` |
| `src/dto/stock.dto.ts` | `StockInDto.photo_url` → `photo_id`,校验调整 |
| `src/service/inventory/stock.service.ts` | `record.photo_url = dto.photo_url` → `record.photo_id = dto.photo_id` |

### 数据库迁移

项目无 TypeORM migration 目录,需要手工执行 SQL:

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

## 验证清单

项目无测试套件,验证靠手工 + 类型检查。

1. `pnpm run typecheck` 通过
2. `pnpm run lint` 通过
3. 启动 dev server,逐项验证:
   - 首次上传任一文件 → `is_duplicate: false`,返回 `relation_id` / `url` / `hash`,`url` 可访问
   - 同一文件再传 → `is_duplicate: true`,`relation_id` 与首次一致
   - 入库接口传 `photo_id = relation_id` 落库成功
   - 历史记录接口返回的入库记录字段是 `photo_id`(varchar 32)
   - 删除接口 `DELETE /file/:relation_id` → 行 `status` 变为 2,`url` 仍可访问
   - 重复删除 → 返回 `文件不存在`
4. 并发兜底:两个终端几乎同时上传同一文件 → DB 一行,MinIO 一个对象

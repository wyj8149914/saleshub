# Card Serv 后端代码规范

## 项目概述

TypeScript + Express + TypeORM + PostgreSQL 后端服务。

## 目录结构

```
src/
├── config/          # 配置文件（数据库、Redis、MinIO、环境变量等）
├── context/         # 请求上下文（Request Context）
├── dto/             # 数据传输对象
│   ├── request/     # 请求 DTO（使用 class-validator 验证）
│   └── response/    # 响应 DTO
├── entity/          # TypeORM 数据库实体
├── interfaces/      # TypeScript 接口和类型定义
├── middleware/      # Express 中间件（JWT、CORS、日志、错误处理等）
├── routes/          # 路由定义
├── service/         # 业务逻辑层（按模块分目录）
│   ├── auth/        # 认证服务
│   ├── card/        # 名片服务
│   ├── company/     # 企业服务
│   ├── mobile/      # 移动端服务
│   └── plan/        # 套餐服务
├── utils/           # 工具函数（JWT、日志、加密等）
├── app.ts           # Express 应用创建
└── server.ts        # 服务入口
```

## 编码规范

### TypeScript 配置

- Target: ES2020
- Module: CommonJS
- Strict: 启用
- 装饰器: 启用（支持 TypeORM）
- 输出目录: `dist/`

### 代码风格（Prettier）

- 引号: 单引号 `''`
- 分号: 必须
- 缩进: 2 空格
- 行宽: 100 字符
- 尾部逗号: ES5
- 换行: LF
- 箭头函数括号: 始终添加
- 代码需要加上必要的注释,方法需要有功能说明,复杂的业务逻辑需要详细的说明

### 命名规范

| 类型       | 命名规则                    | 示例                                 |
| ---------- | --------------------------- | ------------------------------------ |
| Entity     | PascalCase                  | `User`, `Card`                       |
| DTO        | PascalCase + 后缀 `Dto`     | `WxLoginDto`, `UpdateProfileDto`     |
| Service    | PascalCase + 后缀 `Service` | `UserService`, `CardService`         |
| Middleware | camelCase                   | `jwtValidator`, `requestLogger`      |
| 方法/函数  | camelCase                   | `login`, `updateUser`, `getCardById` |
| 常量       | camelCase 或 UPPER_CASE     | `appConfig`, `MAX_SIZE`              |
| 接口       | 大写 `I` 开头               | `IApiResponse`, `IJwtPayload`        |

### 导入顺序

1. Node.js 内置模块
2. 第三方 npm 包
3. 项目内部模块（使用相对路径 `../` 或 `../../`）

## 分层架构

### 1. Entity 层（数据库实体）

使用 TypeORM 装饰器定义数据库模型：

```typescript
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'card', name: 'users' })
export class User {
    @PrimaryColumn()
    id: string;

    @Column({ type: 'varchar', length: 20, nullable: true, comment: '手机号' })
    phone: string;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，0-禁用' })
    status: number;
}
```

### 2. DTO 层（数据传输对象）

使用 `class-validator` 进行验证：

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class WxLoginDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsOptional()
    openid?: string;
}
```

### 3. Service 层（业务逻辑）

- 每个 Service 管理自己的 Repository
- 使用 `getLogger` 记录日志
- 返回统一响应格式

```typescript
export class UserService {
    private userRepository = AppDataSource.getRepository(User);
    private logger = getLogger('CARD_SERV');

    async login(dto: WxLoginDto) {
        // 业务逻辑
        const user = await this.userRepository.findOne({ where: { id: dto.id } });
        this.logger.info('查询用户信息:', user);

        return { result: 0, msg: 'success', alg: '', datas: user };
    }
}
```

### 4. Routes 层（路由定义）

使用 `validationMiddleware` 验证参数，`asyncHandler` 包装异步：

```typescript
router.post<{}, MessageResponse>(
    '/login',
    validationMiddleware(WxLoginDto),
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(WxLoginDto, req.body);
        const result = await userService.login(dtoObj);
        res.locals.datas = result;
        next();
    })
);
```

### 5. Middleware 层（中间件）

- **paramsValidator**: DTO 验证
- **jwtValidator**: JWT 令牌验证
- **requestLogger**: 请求日志
- **errorHandler**: 全局错误处理
- **responseEncrypt**: 响应加密

## 统一响应格式

所有 API 返回统一格式：

```typescript
{
    result: 0,      // 0 表示成功，非 0 表示错误
    msg: 'success', // 消息描述
    alg: '',        // 算法标识（预留）
    datas: {}       // 数据内容
}
```

## Service 导出规范

每个模块的 `service/*/index.ts` 导出单例：

```typescript
const userService = new UserService();
const cardService = new CardService();

export { userService, cardService };
```

## 依赖注入

- Service 通过 `AppDataSource.getRepository` 获取 Repository
- 不使用构造函数注入，直接在类属性中初始化
- 配置通过 `appConfig` 全局导入

## 错误处理

- Service 层捕获异常并返回 `{ result: 1, msg: '错误信息' }`
- 路由层使用 `asyncHandler` 包装，自动传递错误给 `errorHandler`
- 避免在 Service 中抛出异常

## 日志规范

使用 `getLogger` 获取日志实例：

```typescript
import { getLogger } from '../utils/logger.util';

const logger = getLogger('CARD_SERV');
logger.info('信息日志');
logger.error('错误日志', error);
```

## 环境配置

- 开发环境: `.env.development`
- 生产环境: `.env.production`
- 通过 `src/config/env.config.ts` 导出 `appConfig`

## 常用命令

```bash
# 开发模式
pnpm run dev

# 构建
pnpm run build

# 类型检查
pnpm run typecheck

# 代码检查
pnpm run lint

# 格式化
pnpm run format

# 测试
pnpm run test
```

## 注意事项

1. **不要在代码中直接使用 `process.env`**，统一通过 `appConfig` 访问
2. **敏感数据加密存储**（如手机号），使用 `utils/util.ts` 中的加密函数
3. **所有新增接口必须定义 DTO** 并使用 `class-validator` 验证
4. **Service 方法必须有明确的返回类型**，不要返回 `any`
5. **数据库字段添加 `comment`** 描述用途

建议为新功能添加单元测试。

## Git Commit Conventions

### 提交消息格式规范

不要主动提交代码,本项目遵循结构化的Git提交消息格式,包含以下部分:

```
<类型>: <简短描述>

## 详细变更说明

### 1. <主要功能/模块名称>
- 具体变更1
- 具体变更2

### 2. <另一个功能/模块名称>
- 具体变更3
- 具体变更4

...

### N. 其他变更
- 代码清理/优化说明

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 提交类型 (Type)

使用中文类型标识,常见类型包括:

- **功能** (feat): 新功能
- **修改** (fix): Bug修复
- **重构** (refactor): 代码重构(不改变功能)
- **新增** (add): 添加新内容(文档/配置等)
- **删除** (remove): 删除功能或文件
- **优化** (optimize): 性能或代码优化
- **文档** (docs): 文档变更
- **测试** (test): 测试相关

### 提交消息编写规范

1. **第一行**: `<类型>: <简短描述>` (不超过50字)
    - 使用中文,简洁明确
    - 使用祈使句语气
    - 不包含句号

2. **详细说明**: 使用 `## 主要变更` 或 `## 详细变更说明` 开头
    - 按模块/功能分类
    - 每个变更使用 `-` 列表
    - 具体说明变更内容和原因

3. **Co-Authored-By**: 使用AI辅助开发时必须添加
    ```
    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
    ```

### 提交前检查清单

在执行 `git commit` 前,确保:

1. ✅ **代码已测试**: 新功能正常工作,无运行时错误
2. ✅ **无调试代码**: 移除所有 `console.log`, `debugger` 等
3. ✅ **代码格式**: 运行 `npm run lint` 确保代码风格一致
4. ✅ **敏感信息**: 不包含 `.env` 等敏感配置文件
5. ✅ **提交消息**: 使用完整格式,清晰描述变更内容

### 提交示例

**好的提交示例:**

```
功能: 网格工单系统新增区域用户支持及微信登录功能

## 主要变更

### 1. 网格工单系统优化
- 新增区域工单列表查询接口(/districtList),支持区域用户按权限查询辖区内工单
- 优化12345工单处理逻辑,支持通过community_id直接关联工单,不依赖grid_id

### 2. 区域用户微信登录支持
- DistrictUser实体新增open_id和union_id字段,支持微信登录绑定
- 微信登录接口(getGridBindInfo)新增区域用户登录支持

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**不好的提交示例:**

```
fix bug
update
feat
tmp
```

1. **不要自动提交**: 不要自动提交代码,只有明确说明提交代码时才提交
2. **不要自动推送**: 提交代码时不要使用 `git push`
3. **提交消息语言**:
    - 使用中文编写提交消息
    - 技术术语可以保留英文(如: JWT, TypeORM, API等)

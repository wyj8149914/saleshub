import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PageDto } from './base.dto';

/**
 * 登录日志列表查询DTO(GET /log/listLogin,Query 参数)
 */
export class ListLoginLogDto extends PageDto {
    /** 用户名,模糊匹配(可选) */
    @IsString()
    @MaxLength(50, { message: '用户名长度不能超过50' })
    @IsOptional()
    username: string;

    /** 登录结果:1-成功,2-失败(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '登录结果只能为1-成功或2-失败' })
    @IsOptional()
    result: number;

    /** 登录IP,模糊匹配(可选) */
    @IsString()
    @MaxLength(50, { message: 'IP长度不能超过50' })
    @IsOptional()
    ip: string;

    /** 登录时间起(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '登录时间起格式必须为YYYY-MM-DD' })
    @IsOptional()
    start_time: string;

    /** 登录时间止(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '登录时间止格式必须为YYYY-MM-DD' })
    @IsOptional()
    end_time: string;
}

/**
 * 操作日志列表查询DTO(GET /log/list,Query 参数)
 *
 * 仅管理员可查询,user_id 为请求者用户ID用于权限校验
 */
export class QueryOperationLogListDto extends PageDto {
    /** 请求者用户ID(用于校验管理员权限) */
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    /** 操作大类,如PRODUCT/INVOICE(可选,不传则不过滤) */
    @IsString()
    @MaxLength(32, { message: '操作大类长度不能超过32' })
    @IsOptional()
    operation_type: string;

    /** 操作代码,如create_product(可选,不传则不过滤) */
    @IsString()
    @MaxLength(64, { message: '操作代码长度不能超过64' })
    @IsOptional()
    operation_code: string;

    /** 操作人姓名,精确匹配(可选,不传则不过滤) */
    @IsString()
    @MaxLength(100, { message: '操作人姓名长度不能超过100' })
    @IsOptional()
    operator_name: string;

    /** 操作对象名称,精确匹配(可选,不传则不过滤) */
    @IsString()
    @MaxLength(200, { message: '对象名称长度不能超过200' })
    @IsOptional()
    target_name: string;

    /** 操作结果:1-成功,2-失败(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '操作结果只能为1-成功或2-失败' })
    @IsOptional()
    operation_result: number;

    /** 关键字,对操作说明/对象名称模糊匹配(可选) */
    @IsString()
    @MaxLength(100, { message: '关键字长度不能超过100' })
    @IsOptional()
    keyword: string;

    /** 操作时间起(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '操作时间起格式必须为YYYY-MM-DD' })
    @IsOptional()
    time_start: string;

    /** 操作时间止(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '操作时间止格式必须为YYYY-MM-DD' })
    @IsOptional()
    time_end: string;
}

/**
 * 操作日志详情查询DTO(GET /log/detail,Query 参数)
 *
 * 仅管理员可查询,user_id 为请求者用户ID用于权限校验
 */
export class QueryOperationLogDetailDto {
    /** 请求者用户ID(用于校验管理员权限) */
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    /** 日志ID */
    @IsString()
    @IsNotEmpty({ message: '日志ID不能为空' })
    log_id: string;
}

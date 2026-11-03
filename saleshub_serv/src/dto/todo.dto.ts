import { Type } from 'class-transformer';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { PageDto } from './base.dto';

/** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
export const TODO_PRIORITIES = [1, 2, 3, 4];

/**
 * 创建待办类型请求DTO(POST /todo/type/create)
 */
export class CreateTodoTypeDto {
    /** 创建人用户ID */
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    /** 类型名称,全局唯一 */
    @IsString()
    @IsNotEmpty({ message: '类型名称不能为空' })
    @MaxLength(50, { message: '类型名称长度不能超过50' })
    type_name: string;
}

/**
 * 待办类型列表查询DTO(GET /todo/type/list)
 */
export class ListTodoTypeDto {
    /** 关键字,对类型名称模糊匹配(可选) */
    @IsString()
    @MaxLength(50, { message: '关键字长度不能超过50' })
    @IsOptional()
    keyword?: string;
}

/**
 * 待办类型ID请求DTO(POST /todo/type/delete)
 */
export class TodoTypeIdDto {
    /** 待办类型ID */
    @IsString()
    @IsNotEmpty({ message: '类型ID不能为空' })
    type_id: string;
}

/**
 * 创建待办事项请求DTO(POST /todo/create)
 *
 * 执行人多选;附件为 minio_file.relation_id 列表;
 * 初始 is_completed=1-未完成,剩余天数由截止日期查询时计算
 */
export class CreateTodoDto {
    /** 待办事项名称 */
    @IsString()
    @IsNotEmpty({ message: '待办名称不能为空' })
    @MaxLength(100, { message: '待办名称长度不能超过100' })
    title: string;

    /** 待办类型ID(可选) */
    @IsString()
    @IsOptional()
    type_id?: string;

    /** 重要程度:1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急 */
    @Type(() => Number)
    @IsInt()
    @IsIn(TODO_PRIORITIES, {
        message: '重要程度只能为1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急',
    })
    priority: number;

    /** 截止日期,格式 YYYY-MM-DD */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '截止日期格式必须为YYYY-MM-DD' })
    deadline: string;

    /** 执行人用户ID列表(至少1个) */
    @IsArray()
    @ArrayMinSize(1, { message: '执行人至少选择1个' })
    @ArrayMaxSize(20, { message: '执行人最多选择20个' })
    @IsString({ each: true, message: '执行人ID必须是字符串' })
    executor_ids: string[];

    /** 附件relation_id列表(可选,每项为minio_file.relation_id) */
    @IsArray()
    @IsString({ each: true, message: '附件ID必须是字符串' })
    @IsOptional()
    attachments?: string[];

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;

    /** 创建人用户ID */
    @IsString()
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;
}

/**
 * 修改待办事项请求DTO(POST /todo/update)
 *
 * 全部业务字段可选,仅更新传入字段;传入 executor_ids 时整体替换执行人列表
 */
export class UpdateTodoDto {
    /** 待办事项ID */
    @IsString()
    @IsNotEmpty({ message: '待办ID不能为空' })
    todo_id: string;

    /** 待办事项名称(可选) */
    @IsString()
    @MaxLength(100, { message: '待办名称长度不能超过100' })
    @IsOptional()
    title?: string;

    /** 待办类型ID(可选) */
    @IsString()
    @IsOptional()
    type_id?: string;

    /** 重要程度(可选) */
    @Type(() => Number)
    @IsInt()
    @IsIn(TODO_PRIORITIES, {
        message: '重要程度只能为1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急',
    })
    @IsOptional()
    priority?: number;

    /** 截止日期,格式 YYYY-MM-DD(可选;直接修改截止日期不产生延期记录) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '截止日期格式必须为YYYY-MM-DD' })
    @IsOptional()
    deadline?: string;

    /** 执行人用户ID列表(可选,传入时整体替换,至少1个) */
    @IsArray()
    @ArrayMinSize(1, { message: '执行人至少选择1个' })
    @ArrayMaxSize(20, { message: '执行人最多选择20个' })
    @IsString({ each: true, message: '执行人ID必须是字符串' })
    @IsOptional()
    executor_ids?: string[];

    /** 附件relation_id列表(可选,传入时整体替换) */
    @IsArray()
    @IsString({ each: true, message: '附件ID必须是字符串' })
    @IsOptional()
    attachments?: string[];

    /** 备注(可选) */
    @IsString()
    @MaxLength(500, { message: '备注长度不能超过500' })
    @IsOptional()
    remark?: string;
}

/**
 * 待办事项列表查询DTO(GET /todo/list,Query 参数)
 *
 * 只查正常状态(status=1);筛选条件均可选
 */
export class ListTodoDto extends PageDto {
    /** 执行人用户ID(可选,传入时查询该用户的"我的待办") */
    @IsString()
    @IsOptional()
    executor_id?: string;

    /** 待办类型ID(可选,不传则不过滤) */
    @IsString()
    @IsOptional()
    type_id?: string;

    /** 重要程度(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn(TODO_PRIORITIES, {
        message: '重要程度只能为1-重要紧急,2-重要不紧急,3-不重要紧急,4-不重要不紧急',
    })
    @IsOptional()
    priority?: number;

    /** 是否完成:1-否,2-是(可选,不传则不过滤) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '是否完成只能为1-否,2-是' })
    @IsOptional()
    is_completed?: number;

    /** 截止日期起(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '截止日期起格式必须为YYYY-MM-DD' })
    @IsOptional()
    start_date?: string;

    /** 截止日期止(含),格式 YYYY-MM-DD(可选) */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '截止日期止格式必须为YYYY-MM-DD' })
    @IsOptional()
    end_date?: string;

    /** 关键字,对待办名称模糊匹配(可选) */
    @IsString()
    @MaxLength(100, { message: '关键字长度不能超过100' })
    @IsOptional()
    keyword?: string;

    /** 排序字段:1-截止日期,2-创建时间(可选,不传则默认1) */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2, 3], { message: '排序字段只能为1-创建时间, 2-截止日期, 3-紧急程度' })
    @IsOptional()
    sort?: number;
}

/**
 * 待办事项ID请求DTO(GET /todo/detail、POST /todo/delete)
 */
export class TodoIdDto {
    /** 待办事项ID */
    @IsString()
    @IsNotEmpty({ message: '待办ID不能为空' })
    todo_id: string;
}

/**
 * 待办完成状态变更请求DTO(POST /todo/complete)
 *
 * 标记完成时写入完成时间,取消完成时清空完成时间
 */
export class CompleteTodoDto {
    /** 待办事项ID */
    @IsString()
    @IsNotEmpty({ message: '待办ID不能为空' })
    todo_id: string;

    /** 是否完成:1-否,2-是 */
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '是否完成只能为1-否,2-是' })
    is_completed: number;
}

/**
 * 待办延期请求DTO(POST /todo/postpone)
 *
 * 更新 todo.deadline 的同时插入一条延期记录;新截止日期必须晚于当前截止日期
 */
export class PostponeTodoDto {
    /** 待办事项ID */
    @IsString()
    @IsNotEmpty({ message: '待办ID不能为空' })
    todo_id: string;

    /** 延期后截止日期,格式 YYYY-MM-DD,必须晚于当前截止日期 */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '延期后截止日期格式必须为YYYY-MM-DD' })
    new_deadline: string;

    /** 延期原因 */
    @IsString()
    @IsNotEmpty({ message: '延期原因不能为空' })
    @MinLength(2, { message: '延期原因至少2个字符' })
    @MaxLength(200, { message: '延期原因长度不能超过200' })
    reason: string;

    /** 延期操作人用户ID(处理人或管理员) */
    @IsString()
    @IsNotEmpty({ message: '操作人ID不能为空' })
    operator_id: string;
}

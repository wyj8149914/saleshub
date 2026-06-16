import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, MaxLength, IsIn, IsInt } from 'class-validator';
import { PageDto } from './base.dto';

export class LoginDto {
    @IsNotEmpty({ message: '用户名不能为空' })
    @MaxLength(50, { message: '用户名长度不能超过50' })
    username: string;

    @IsNotEmpty({ message: '密码不能为空' })
    @MaxLength(100, { message: '密码长度不能超过100' })
    password: string;
}

export class CreateUserDto {
    @IsNotEmpty({ message: '用户名不能为空' })
    @MaxLength(50, { message: '用户名长度不能超过50' })
    username: string;

    @IsNotEmpty({ message: '密码不能为空' })
    @MaxLength(100, { message: '密码长度不能超过100' })
    password: string;

    @IsNotEmpty({ message: '姓名不能为空' })
    @MaxLength(100, { message: '姓名长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(20, { message: '手机号长度不能超过20' })
    phone?: string;

    @IsOptional()
    @IsIn(['admin', 'user'], { message: '角色必须是admin或user' })
    role?: string;
}

export class UpdateUserDto {
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;

    @IsNotEmpty({ message: '姓名不能为空' })
    @MaxLength(100, { message: '姓名长度不能超过100' })
    name: string;

    @IsOptional()
    @MaxLength(20, { message: '手机号长度不能超过20' })
    phone?: string;

    @IsOptional()
    @IsIn(['admin', 'user'], { message: '角色必须是admin或user' })
    role?: string;
}

export class ListUserDto extends PageDto {
    @IsOptional()
    username: string;

    @IsOptional()
    name: string;

    @IsOptional()
    phone: string;

    @IsOptional()
    @IsIn(['admin', 'user'], { message: '角色必须是admin或user' })
    role: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '状态必须是1-正常或2-停用' })
    status: number;
}

export class UserIdDto {
    @IsNotEmpty({ message: '用户ID不能为空' })
    user_id: string;
}

export class UpdateUserStatusDto extends UserIdDto {
    @IsNotEmpty({ message: '状态不能为空' })
    @Type(() => Number)
    @IsInt()
    @IsIn([1, 2], { message: '状态必须是1-正常或2-停用' })
    status: number;
}

export class UpdateUserPasswordDto extends UserIdDto {
    @IsNotEmpty({ message: '密码不能为空' })
    @MaxLength(100, { message: '密码长度不能超过100' })
    password: string;
}

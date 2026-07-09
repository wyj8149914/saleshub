import { User } from '../../entity/user.entity';
import {
    LoginDto, CreateUserDto, ListUserDto, UpdateUserDto, UpdateUserStatusDto, UpdateUserPasswordDto,
} from '../../dto/user.dto';
import { AppDataSource } from '../../config/database.config';
import { getLogger } from '../../utils/logger.util';
import { hashPassword, validatePasswordStrength, verifyPassword } from '../../utils/util';
import { JwtUtil } from '../../utils/jwt.util';
import { v7 } from 'uuid';

export class UserService {
    private userRepository = AppDataSource.getRepository(User);
    private logger = getLogger('SALESHUB_SERV');

    /**
     * 用户登录
     */
    async login(dto: LoginDto) {
        try {
            const user = await this.userRepository.findOne({
                where: { username: dto.username },
            });
            if (!user) {
                return { result: 1, msg: '用户名或密码错误' };
            }

            if (user.status !== 1) {
                return { result: 1, msg: '账号已停用' };
            }

            const matched = await verifyPassword(dto.password, user.password_hash);
            if (!matched) {
                return { result: 1, msg: '用户名或密码错误' };
            }

            const payload = { sub: user.user_id };
            const token = JwtUtil.sign(payload);
            const refresh_token = JwtUtil.signRefreshToken(payload);

            await this.userRepository.update(
                { user_id: user.user_id },
                { last_login_time: new Date() }
            );

            return {
                result: 0,
                msg: '登录成功',
                datas: {
                    token,
                    refresh_token,
                    user_id: user.user_id,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                },
            };
        } catch (error) {
            this.logger.error('登录失败:', error);
            return { result: 1, msg: '登录失败' };
        }
    }

    /**
     * 创建用户
     */
    async create(dto: CreateUserDto) {
        try {
            const existing = await this.userRepository.findOne({
                where: { username: dto.username },
            });
            if (existing) {
                return { result: 1, msg: '用户名已存在' };
            }

            const strength = validatePasswordStrength(dto.password);
            if (!strength.ok) {
                return { result: 1, msg: strength.msg };
            }

            const user = new User();
            user.user_id = v7().replace(/-/g, '');
            user.username = dto.username;
            user.password_hash = await hashPassword(dto.password);
            user.name = dto.name;
            user.role = dto.role || 'user';
            if (dto.phone) {
                user.phone = dto.phone;
            }

            const saved = await this.userRepository.save(user);
            return { result: 0, msg: '创建成功', datas: { user_id: saved.user_id } };
        } catch (error) {
            this.logger.error('创建用户失败:', error);
            return { result: 1, msg: '创建失败' };
        }
    }

    /**
     * 查询用户列表
     */
    async list(dto: ListUserDto) {
        try {
            const queryBuilder = this.userRepository.createQueryBuilder('user')
                .select([
                    'user.user_id as user_id',
                    'user.username as username',
                    'user.name as name',
                    'user.phone as phone',
                    'user.role as role',
                    'user.status as status',
                    'to_char(user.last_login_time, \'YYYY-MM-DD HH24:MI:SS\') as last_login_time',
                    'to_char(user.create_time, \'YYYY-MM-DD HH24:MI:SS\') as create_time',
                ]);

            if (dto.username) {
                queryBuilder.andWhere('user.username LIKE :username', { username: `%${dto.username}%` });
            }
            if (dto.name) {
                queryBuilder.andWhere('user.name LIKE :name', { name: `%${dto.name}%` });
            }
            if (dto.phone) {
                queryBuilder.andWhere('user.phone LIKE :phone', { phone: `%${dto.phone}%` });
            }
            if (dto.role) {
                queryBuilder.andWhere('user.role = :role', { role: dto.role });
            }
            if (dto.status) {
                queryBuilder.andWhere('user.status = :status', { status: dto.status });
            }

            const start = (dto.pageIndex - 1) * dto.pageSize;
            const total = await queryBuilder.getCount();
            const users = await queryBuilder.orderBy('user.create_time', 'DESC')
                .limit(dto.pageSize)
                .offset(start)
                .getRawMany();

            return { result: 0, msg: 'success', datas: { total, items: users } };
        } catch (error) {
            this.logger.error('查询用户列表失败:', error);
            return { result: 1, msg: '查询失败' };
        }
    }

    /**
     * 更新用户信息
     */
    async update(dto: UpdateUserDto) {
        try {
            const user = await this.userRepository.findOne({
                where: { user_id: dto.user_id },
            });
            if (!user) {
                return { result: 1, msg: '用户不存在' };
            }

            user.name = dto.name;
            if (dto.phone !== undefined) {
                user.phone = dto.phone;
            }
            if (dto.role) {
                user.role = dto.role;
            }

            await this.userRepository.save(user);
            return { result: 0, msg: '更新成功' };
        } catch (error) {
            this.logger.error('更新用户失败:', error);
            return { result: 1, msg: '更新失败' };
        }
    }

    /**
     * 设置用户状态
     */
    async updateStatus(dto: UpdateUserStatusDto) {
        try {
            const user = await this.userRepository.findOne({
                where: { user_id: dto.user_id },
            });
            if (!user) {
                return { result: 1, msg: '用户不存在' };
            }

            await this.userRepository.update({ user_id: dto.user_id }, { status: dto.status });
            return { result: 0, msg: '状态更新成功' };
        } catch (error) {
            this.logger.error('更新用户状态失败:', error);
            return { result: 1, msg: '状态更新失败' };
        }
    }

    /**
     * 修改用户密码
     */
    async updatePassword(dto: UpdateUserPasswordDto) {
        try {
            const user = await this.userRepository.findOne({
                where: { user_id: dto.user_id },
            });
            if (!user) {
                return { result: 1, msg: '用户不存在' };
            }

            const strength = validatePasswordStrength(dto.password);
            if (!strength.ok) {
                return { result: 1, msg: strength.msg };
            }

            user.password_hash = await hashPassword(dto.password);
            await this.userRepository.save(user);
            return { result: 0, msg: '密码修改成功' };
        } catch (error) {
            this.logger.error('修改用户密码失败:', error);
            return { result: 1, msg: '密码修改失败' };
        }
    }
}

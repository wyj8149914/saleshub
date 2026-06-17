import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'auth', name: 'user' })
export class User {
    @PrimaryColumn({ type: 'varchar', length: 32 })
    user_id: string;

    @Column({ type: 'varchar', length: 50, unique: true, comment: '登录用户名' })
    username: string;

    @Column({ type: 'varchar', length: 255, comment: '密码哈希(bcrypt)' })
    password_hash: string;

    @Column({ type: 'varchar', length: 100, comment: '姓名/昵称' })
    name: string;

    @Column({ type: 'varchar', length: 20, nullable: true, comment: '手机号' })
    phone: string;

    @Column({ type: 'varchar', length: 20, default: 'user', comment: '角色：admin-管理员，user-普通用户' })
    role: string;

    @Column({ type: 'int', default: 1, comment: '状态：1-正常，2-停用' })
    status: number;

    @Column({ type: 'timestamp', nullable: true, comment: '最后登录时间' })
    last_login_time: Date;

    @Column({ type: 'timestamp', comment: '创建时间' })
    create_time: Date;

    @Column({ type: 'timestamp', comment: '更新时间' })
    update_time: Date;
}

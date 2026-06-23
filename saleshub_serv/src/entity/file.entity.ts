import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'public', name: 'minio_file' })
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

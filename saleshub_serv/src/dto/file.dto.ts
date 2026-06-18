import { IsNotEmpty, MaxLength } from 'class-validator';

export class DeleteFileDto {
    @IsNotEmpty({ message: 'relation_id 不能为空' })
    @MaxLength(32, { message: 'relation_id 长度不能超过 32' })
    relation_id: string;
}

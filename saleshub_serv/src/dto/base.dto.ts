import { Type } from 'class-transformer';
import { IsNotEmpty, Min } from 'class-validator';

export class PageDto {
    @IsNotEmpty({ message: '分页大小不能为空' })
    @Type(() => Number)
    @Min(1, { message: '分页大小不能小于1' })
    pageSize: number;

    @IsNotEmpty({ message: '分页索引不能为空' })
    @Type(() => Number)
    @Min(1, { message: '分页索引不能小于1' })
    pageIndex: number;
}

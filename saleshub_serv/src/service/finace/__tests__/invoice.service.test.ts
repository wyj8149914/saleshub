import dayjs from 'dayjs';
import { ListInvoiceDto, InvoiceIdDto } from '../../../dto/invoice.dto';
import { generateFileUrl } from '../../../config/minio.config';
import { InvoiceService } from '../invoice.service';

/** 被测服务实例(服务类在模块加载时通过 mocked AppDataSource 获取仓储) */
const invoiceService = new InvoiceService();

/** 链式 QueryBuilder mock:select/leftJoin/where 等返回自身,聚合方法按用例配置 */
const mockQueryBuilder = {
    select: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn(),
    getCount: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
};

// 服务模块加载时即通过 AppDataSource.getRepository 获取仓储,须在导入前完成 mock
jest.mock('../../../config/database.config', () => ({
    AppDataSource: {
        getRepository: () => ({ createQueryBuilder: () => mockQueryBuilder }),
    },
}));

describe('InvoiceService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // 链式方法默认返回自身,聚合方法给出默认空结果
        for (const chainMethod of [
            mockQueryBuilder.select,
            mockQueryBuilder.leftJoin,
            mockQueryBuilder.where,
            mockQueryBuilder.andWhere,
            mockQueryBuilder.orderBy,
            mockQueryBuilder.limit,
            mockQueryBuilder.offset,
        ]) {
            (chainMethod as jest.Mock).mockReturnValue(mockQueryBuilder);
        }
        mockQueryBuilder.getCount.mockResolvedValue(0);
        mockQueryBuilder.getRawMany.mockResolvedValue([]);
        mockQueryBuilder.getRawOne.mockResolvedValue(null);
    });

    describe('list', () => {
        test('仅分页:不追加任何筛选条件,分页与排序参数正确', async () => {
            const dto = { pageIndex: 1, pageSize: 10 } as ListInvoiceDto;
            mockQueryBuilder.getCount.mockResolvedValue(2);
            mockQueryBuilder.getRawMany.mockResolvedValue([{ invoice_id: 'a' }]);

            const result = await invoiceService.list(dto);

            expect(mockQueryBuilder.where).toHaveBeenCalledWith('invoice.status = :status', {
                status: 1,
            });
            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('invoice.create_time', 'DESC');
            expect(result).toEqual({
                result: 0,
                msg: 'success',
                datas: { total: 2, items: [{ invoice_id: 'a' }] },
            });
        });

        test('分页计算:第3页每页10条,offset 为 20', async () => {
            const dto = { pageIndex: 3, pageSize: 10 } as ListInvoiceDto;

            await invoiceService.list(dto);

            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20);
        });

        test('全部筛选条件:性质/用途/日期区间/关键字 均正确拼装', async () => {
            const dto = {
                pageIndex: 1,
                pageSize: 10,
                invoice_nature: 1,
                invoice_purpose: 2,
                start_date: '2026-01-01',
                end_date: '2026-01-31',
                keyword: '沃尔玛',
                tag: '办公用品',
            } as ListInvoiceDto;

            await invoiceService.list(dto);

            // andWhere 共追加 6 个条件,逐一断言参数
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(6);
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'invoice.invoice_nature = :invoiceNature',
                { invoiceNature: 1 }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'invoice.invoice_purpose = :invoicePurpose',
                { invoicePurpose: 2 }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'invoice.invoice_date >= :startDate',
                { startDate: '2026-01-01' }
            );
            // 结束日期含当天:与次日零点比较
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'invoice.invoice_date < :endDate',
                { endDate: dayjs('2026-01-31').add(1, 'day').format('YYYY-MM-DD') }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                '(invoice.invoice_number LIKE :keyword ' +
                    'OR invoice.seller_name LIKE :keyword ' +
                    'OR invoice.buyer_name LIKE :keyword)',
                { keyword: '%沃尔玛%' }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('invoice.tag LIKE :tag', {
                tag: '%办公用品%',
            });
        });

        test('查询异常:返回 result=1 查询失败', async () => {
            mockQueryBuilder.getCount.mockRejectedValue(new Error('db down'));

            const result = await invoiceService.list({
                pageIndex: 1,
                pageSize: 10,
            } as ListInvoiceDto);

            expect(result.result).toBe(1);
            expect(result.msg).toBe('查询失败');
            expect(result.datas).toBeUndefined();
        });
    });

    describe('detail', () => {
        test('发票存在:返回详情并生成原始文件地址,object_name 不下发', async () => {
            const row = {
                invoice_id: 'inv1',
                invoice_number: '26352000001781090461',
                items: [{ ItemName: '办公用品' }],
                file_object_name: 'invoice/2026/abc.pdf',
            };
            mockQueryBuilder.getRawOne.mockResolvedValue(row);
            const dto: InvoiceIdDto = { invoice_id: 'inv1' };

            const result = await invoiceService.detail(dto);

            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'invoice.invoice_id = :invoiceId AND invoice.status = :status',
                { invoiceId: 'inv1', status: 1 }
            );
            expect(result.result).toBe(0);
            expect(result.datas?.invoice_id).toBe('inv1');
            expect(result.datas?.items).toEqual([{ ItemName: '办公用品' }]);
            expect(result.datas?.file_url).toBe(generateFileUrl('invoice/2026/abc.pdf'));
            // 中间字段 file_object_name 不应出现在响应中
            expect(
                (result.datas as unknown as Record<string, unknown>)['file_object_name']
            ).toBeUndefined();
        });

        test('原始文件缺失:file_url 为空字符串', async () => {
            mockQueryBuilder.getRawOne.mockResolvedValue({
                invoice_id: 'inv1',
                file_object_name: null,
            });

            const result = await invoiceService.detail({ invoice_id: 'inv1' });

            expect(result.datas?.file_url).toBe('');
        });

        test('发票不存在或已作废:返回 result=1 发票不存在', async () => {
            mockQueryBuilder.getRawOne.mockResolvedValue(null);

            const result = await invoiceService.detail({ invoice_id: 'not-exist' });

            expect(result).toEqual({ result: 1, msg: '发票不存在' });
        });
    });
});

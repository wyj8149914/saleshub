import { AppDataSource } from '../src/config/database.config';
import { InventoryItem, InventoryItemSpec, ProductItem } from '../src/entity/product.entity';
import { StockInRecord, StockOutRecord, InventoryCheck } from '../src/entity/stock.entity';
import { getLogger } from '../src/utils/logger.util';
import { DataSource } from 'typeorm';

const logger = getLogger('MERGE_ITEMS');

interface ItemWithSpec {
    item_id: string;
    name: string;
    code: string;
    type_id: string;
    warn_stock: number;
    image_id: string | null;
    remark: string | null;
    is_custom: number;
    create_time: Date;
    spec_id: string;
    spec: string;
    price: number | null;
    current_stock: number;
}

interface MergeReport {
    itemName: string;
    primaryItem: {
        itemId: string;
        code: string;
        createTime: Date;
    };
    mergedItems: Array<{
        itemId: string;
        code: string;
        createTime: Date;
    }>;
    specChanges: Array<{
        action: 'migrated' | 'merged';
        spec: string;
        fromItemId?: string;
        fromSpecId?: string;
        toSpecId: string;
        stockBefore: number;
        stockAfter: number;
    }>;
    updatedRelations: {
        stockInRecords: number;
        stockOutRecords: number;
        inventoryChecks: number;
        productItems: number;
    };
}

/**
 * 查询所有只有一个规格的零件
 */
async function getItemsWithSingleSpec(dataSource: DataSource): Promise<ItemWithSpec[]> {
    const query = `
        SELECT
            i.item_id,
            i.name,
            i.code,
            i.type_id,
            i.warn_stock,
            i.image_id,
            i.remark,
            i.is_custom,
            i.create_time,
            s.spec_id,
            s.spec,
            s.price,
            s.current_stock
        FROM inventory.inventory_item i
        INNER JOIN inventory.inventory_item_spec s ON i.item_id = s.item_id
        WHERE i.status = 1 AND s.status = 1
        AND i.item_id IN (
            SELECT item_id
            FROM inventory.inventory_item_spec
            WHERE status = 1
            GROUP BY item_id
            HAVING COUNT(*) = 1
        )
        ORDER BY i.name, i.create_time
    `;

    const result = await dataSource.query(query);
    return result;
}

/**
 * 按名称分组零件
 */
function groupItemsByName(items: ItemWithSpec[]): Map<string, ItemWithSpec[]> {
    const groups = new Map<string, ItemWithSpec[]>();

    for (const item of items) {
        if (!groups.has(item.name)) {
            groups.set(item.name, []);
        }
        groups.get(item.name)!.push(item);
    }

    // 只返回有重复的组
    const duplicateGroups = new Map<string, ItemWithSpec[]>();
    for (const [name, items] of groups) {
        if (items.length >= 2) {
            duplicateGroups.set(name, items);
        }
    }

    return duplicateGroups;
}

/**
 * 合并同名零件组
 */
async function mergeItemsGroup(
    dataSource: DataSource,
    items: ItemWithSpec[],
    report: MergeReport
): Promise<void> {
    // 按创建时间排序，最早的为主零件
    items.sort((a, b) => new Date(a.create_time).getTime() - new Date(b.create_time).getTime());

    const primaryItem = items[0];
    const itemsToMerge = items.slice(1);

    // 收集主零件的所有规格
    const primarySpecsMap = new Map<string, { specId: string; stock: number }>();
    for (const item of items) {
        if (item.item_id === primaryItem.item_id) {
            primarySpecsMap.set(item.spec, {
                specId: item.spec_id,
                stock: item.current_stock,
            });
        }
    }

    const specChanges: MergeReport['specChanges'] = [];
    const specIdMapping = new Map<string, string>(); // old_spec_id -> new_spec_id

    await dataSource.transaction(async (manager) => {
        for (const itemToMerge of itemsToMerge) {
            const specValue = itemToMerge.spec;
            const existingSpec = primarySpecsMap.get(specValue);

            if (existingSpec) {
                // 规格相同：库存相加
                specIdMapping.set(itemToMerge.spec_id, existingSpec.specId);

                const newStock = existingSpec.stock + itemToMerge.current_stock;

                // 更新主零件规格的库存
                await manager.query(
                    `UPDATE inventory.inventory_item_spec
                     SET current_stock = $1, update_time = NOW()
                     WHERE spec_id = $2`,
                    [newStock, existingSpec.specId]
                );

                specChanges.push({
                    action: 'merged',
                    spec: specValue,
                    fromItemId: itemToMerge.item_id,
                    fromSpecId: itemToMerge.spec_id,
                    toSpecId: existingSpec.specId,
                    stockBefore: existingSpec.stock,
                    stockAfter: newStock,
                });

                // 更新主零件规格库存记录
                primarySpecsMap.get(specValue)!.stock = newStock;
            } else {
                // 规格不同：迁移规格到主零件
                await manager.query(
                    `UPDATE inventory.inventory_item_spec
                     SET item_id = $1, update_time = NOW()
                     WHERE spec_id = $2`,
                    [primaryItem.item_id, itemToMerge.spec_id]
                );

                specIdMapping.set(itemToMerge.spec_id, itemToMerge.spec_id);

                primarySpecsMap.set(specValue, {
                    specId: itemToMerge.spec_id,
                    stock: itemToMerge.current_stock,
                });

                specChanges.push({
                    action: 'migrated',
                    spec: specValue,
                    fromItemId: itemToMerge.item_id,
                    fromSpecId: itemToMerge.spec_id,
                    toSpecId: itemToMerge.spec_id,
                    stockBefore: itemToMerge.current_stock,
                    stockAfter: itemToMerge.current_stock,
                });
            }
        }

        // 更新关联记录
        let stockInCount = 0;
        let stockOutCount = 0;
        let checkCount = 0;
        let productItemCount = 0;

        for (const itemToMerge of itemsToMerge) {
            const newSpecId = specIdMapping.get(itemToMerge.spec_id)!;

            // 更新入库记录
            const inResult = await manager.query(
                `UPDATE inventory.stock_in_record
                 SET item_id = $1, spec_id = $2
                 WHERE item_id = $3`,
                [primaryItem.item_id, newSpecId, itemToMerge.item_id]
            );
            stockInCount += inResult.rowCount || 0;

            // 更新出库记录
            const outResult = await manager.query(
                `UPDATE inventory.stock_out_record
                 SET item_id = $1, spec_id = $2
                 WHERE item_id = $3`,
                [primaryItem.item_id, newSpecId, itemToMerge.item_id]
            );
            stockOutCount += outResult.rowCount || 0;

            // 更新盘点记录
            const checkResult = await manager.query(
                `UPDATE inventory.inventory_check
                 SET item_id = $1, spec_id = $2
                 WHERE item_id = $3`,
                [primaryItem.item_id, newSpecId, itemToMerge.item_id]
            );
            checkCount += checkResult.rowCount || 0;

            // 更新产品零件关联
            const productResult = await manager.query(
                `UPDATE inventory.product_item
                 SET item_id = $1, spec_id = $2
                 WHERE item_id = $3`,
                [primaryItem.item_id, newSpecId, itemToMerge.item_id]
            );
            productItemCount += productResult.rowCount || 0;

            // 删除被合并零件的规格记录
            await manager.query(
                `DELETE FROM inventory.inventory_item_spec
                 WHERE item_id = $1`,
                [itemToMerge.item_id]
            );

            // 删除被合并的零件记录
            await manager.query(
                `DELETE FROM inventory.inventory_item
                 WHERE item_id = $1`,
                [itemToMerge.item_id]
            );
        }

        report.specChanges = specChanges;
        report.updatedRelations = {
            stockInRecords: stockInCount,
            stockOutRecords: stockOutCount,
            inventoryChecks: checkCount,
            productItems: productItemCount,
        };
    });
}

/**
 * 主函数
 */
async function main(): Promise<void> {
    logger.info('========== 开始执行零件合并迁移脚本 ==========');

    try {
        // 初始化数据库连接
        await AppDataSource.initialize();
        logger.info('数据库连接成功');

        // 查询所有只有一个规格的零件
        const itemsWithSpec = await getItemsWithSingleSpec(AppDataSource);
        logger.info(`查询到 ${itemsWithSpec.length} 个零件（只有一个规格）`);

        // 按名称分组
        const duplicateGroups = groupItemsByName(itemsWithSpec);
        logger.info(`发现 ${duplicateGroups.size} 组同名零件需要合并`);

        if (duplicateGroups.size === 0) {
            logger.info('没有需要合并的同名零件，脚本结束');
            await AppDataSource.destroy();
            return;
        }

        // 合并每组同名零件
        const allReports: MergeReport[] = [];
        let successCount = 0;
        let failCount = 0;

        for (const [name, items] of duplicateGroups) {
            try {
                const report: MergeReport = {
                    itemName: name,
                    primaryItem: {
                        itemId: items[0].item_id,
                        code: items[0].code,
                        createTime: items[0].create_time,
                    },
                    mergedItems: [],
                    specChanges: [],
                    updatedRelations: {
                        stockInRecords: 0,
                        stockOutRecords: 0,
                        inventoryChecks: 0,
                        productItems: 0,
                    },
                };

                // 按创建时间排序
                items.sort((a, b) => new Date(a.create_time).getTime() - new Date(b.create_time).getTime());

                for (let i = 1; i < items.length; i++) {
                    report.mergedItems.push({
                        itemId: items[i].item_id,
                        code: items[i].code,
                        createTime: items[i].create_time,
                    });
                }

                logger.info(`\n处理零件组: "${name}" (${items.length} 个同名零件)`);
                logger.info(`  主零件: ${items[0].code} (创建时间: ${items[0].create_time})`);

                await mergeItemsGroup(AppDataSource, items, report);
                allReports.push(report);
                successCount++;

                logger.info(`  ✅ 合并成功`);
                logger.info(`  规格变化: ${report.specChanges.length} 个`);
                for (const change of report.specChanges) {
                    if (change.action === 'merged') {
                        logger.info(`    - 规格"${change.spec}": 库存相加 ${change.stockBefore} + ${change.stockAfter - change.stockBefore} = ${change.stockAfter}`);
                    } else {
                        logger.info(`    - 规格"${change.spec}": 迁移到主零件，库存 ${change.stockAfter}`);
                    }
                }
                logger.info(`  关联记录更新: 入库${report.updatedRelations.stockInRecords}条, 出库${report.updatedRelations.stockOutRecords}条, 盘点${report.updatedRelations.inventoryChecks}条, 产品${report.updatedRelations.productItems}条`);

            } catch (error) {
                failCount++;
                logger.error(`  ❌ 合并失败:`, error);
            }
        }

        // 输出总结报告
        logger.info('\n========== 合并完成 ==========');
        logger.info(`成功: ${successCount} 组`);
        logger.info(`失败: ${failCount} 组`);
        logger.info(`总计处理: ${duplicateGroups.size} 组同名零件`);

        // 详细报告
        logger.info('\n========== 详细合并报告 ==========');
        for (const report of allReports) {
            logger.info(`\n零件名称: "${report.itemName}"`);
            logger.info(`  主零件: ${report.primaryItem.code} (ID: ${report.primaryItem.itemId})`);
            logger.info(`  合并的零件:`);
            for (const merged of report.mergedItems) {
                logger.info(`    - ${merged.code} (ID: ${merged.itemId})`);
            }
            logger.info(`  规格变化:`);
            for (const change of report.specChanges) {
                if (change.action === 'merged') {
                    logger.info(`    - 规格"${change.spec}": 库存合并，最终库存 ${change.stockAfter}`);
                } else {
                    logger.info(`    - 规格"${change.spec}": 迁移，库存 ${change.stockAfter}`);
                }
            }
            logger.info(`  关联记录更新:`);
            logger.info(`    - 入库记录: ${report.updatedRelations.stockInRecords} 条`);
            logger.info(`    - 出库记录: ${report.updatedRelations.stockOutRecords} 条`);
            logger.info(`    - 盘点记录: ${report.updatedRelations.inventoryChecks} 条`);
            logger.info(`    - 产品关联: ${report.updatedRelations.productItems} 条`);
        }

        logger.info('\n========== 脚本执行完毕 ==========');

    } catch (error) {
        logger.error('脚本执行失败:', error);
        throw error;
    } finally {
        await AppDataSource.destroy();
        logger.info('数据库连接已关闭');
    }
}

// 执行脚本
main().catch((error) => {
    console.error('脚本执行异常:', error);
    process.exit(1);
});

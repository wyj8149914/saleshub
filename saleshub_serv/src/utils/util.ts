/*
 * @Descripttion: 公用方法
 * @version: 1.0.0
 * @Author: 王亚军
 * @Date: 2020-12-23 16:26:20
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

type ArrayItem = { [key: string]: unknown } | string | number;

/** 与 Python backend/app/core/security.py 一致 */
const BCRYPT_ROUNDS = 12;

/**
 * @description: 补\0
 * @param {*} data:待补\0数据
 * @param {*} len:数据长度
 * @return {*} data: 补\0以后的数据
 */
function paddZero(data: string, len: number): string {
    const length = Buffer.byteLength(data);
    const add = length % len;
    if (add != 0) {
        data += new Array(16 - add + 1).join('\0');
    }
    return data;
}

/**
 * @description: 数据加密
 * @param {*} data:待加密数据
 * @param {*} key:加密的密钥,必须为16字节
 * @return {*} buff:加密后的字符串
 */
export function encryption(data: string, key: string): string {
    const iv = '';
    const cipher = crypto.createCipheriv('aes-128-ecb', key, iv);
    cipher.setAutoPadding(false);
    data = paddZero(data, 16);
    let buff = cipher.update(data, 'utf8', 'base64');
    buff += cipher.final('base64');
    return buff;
}

/**
 * @description: aes-128-ecb解密 zeropadding  utf8
 * @param {*} data:为待解密数据
 * @param {*} key:解密的密钥,必须为16字节
 * @return {*} buff:解密后的数据
 */
export function decrypt(data: string, key: string): string {
    const iv = '';
    const decpher = crypto.createDecipheriv('aes-128-ecb', key, iv);
    decpher.setAutoPadding(false);
    let buff = decpher.update(data, 'base64', 'utf8');
    buff += decpher.final('utf8');
    buff = buff.replace(/((\0)+)$/gi, '');
    return buff;
}

/**
 * @description: 账户,密码加盐处理
 * @param {*} username: 账户
 * @param {*} password: 密码
 * @param {*} value:
 * @return {*}
 */
export function md5WithSalt(username: string, password: string, value = 0x00): string {
    let valueA = 0,
        valueB = 0;

    const uint8array = new TextEncoder().encode(username);
    for (let i = 0; i < uint8array.length; i++) {
        valueA += uint8array[i];
        valueB ^= uint8array[i];
    }
    valueA = valueA ^ value;
    valueB = valueB ^ value;
    valueA = valueA % password.length;
    valueB = valueB % password.length;

    const md5Password = crypto.createHash('md5').update(password).digest('hex');
    const md5Result = crypto
        .createHash('md5')
        .update(valueA + md5Password + valueB)
        .digest('hex');
    return md5Result;
}

/**
 * 使用 bcrypt 生成密码哈希（默认 12 轮，与 FastAPI 后端一致）
 */
export async function hashPassword(
    plainPassword: string,
    rounds: number = BCRYPT_ROUNDS
): Promise<string> {
    return bcrypt.hash(plainPassword, rounds);
}

/**
 * 校验明文密码与 bcrypt 哈希是否匹配
 */
export async function verifyPassword(
    plainPassword: string,
    hashedPassword: string
): Promise<boolean> {
    if (!plainPassword || !hashedPassword) {
        return false;
    }
    try {
        return await bcrypt.compare(plainPassword, hashedPassword);
    } catch {
        return false;
    }
}

const RE_UPPER = /[A-Z]/;
const RE_LOWER = /[a-z]/;
const RE_DIGIT = /[0-9]/;
/** 非字母数字视为特殊符号 */
const RE_SPECIAL = /[^A-Za-z0-9]/;

/**
 * 密码强度：大写、小写、数字、特殊符号中至少满足三种；长度至少 8
 */
export function validatePasswordStrength(
    password: string
): { ok: true } | { ok: false; msg: string } {
    if (!password || typeof password !== 'string') {
        return { ok: false, msg: '密码不能为空' };
    }
    if (password.length < 8) {
        return { ok: false, msg: '密码长度至少8位' };
    }
    let kinds = 0;
    if (RE_UPPER.test(password)) {
        kinds += 1;
    }
    if (RE_LOWER.test(password)) {
        kinds += 1;
    }
    if (RE_DIGIT.test(password)) {
        kinds += 1;
    }
    if (RE_SPECIAL.test(password)) {
        kinds += 1;
    }
    if (kinds < 3) {
        return {
            ok: false,
            msg: '密码需包含大写字母、小写字母、数字、特殊符号中的至少三种',
        };
    }
    return { ok: true };
}

/**
 * @description: 阻塞一段时间后继续执行(异步)
 * @param {*} time: 阻塞时间,单位秒
 * @return {*}
 */
export async function sleep(time: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, time * 1000);
    });
}

/**
 * @description: 打乱数组顺序
 * @param {*} array: 输入数组
 * @return {*}
 */
export function shuffle(array: ArrayItem[]): ArrayItem[] {
    let len = array.length,
        t,
        i;
    while (len > 0) {
        i = Math.floor(Math.random() * len--);
        t = array[len];
        array[len] = array[i];
        array[i] = t;
    }
    return array;
}

/**
 * 根据四舍五入模式和精度处理金额
 * @param rawAmount 原始金额
 * @param roundMode 1-四舍五入, 2-向上取整, 3-向下取整，默认1
 * @param precisionScale >0:小数点后几位, =0:取整, <0:小数点前几位(-1=十位,-2=百位)，默认2
 */
export function roundAmount(
    rawAmount: number,
    roundMode: number = 1,
    precisionScale: number = 2
): number {
    const roundFn = roundMode === 2 ? Math.ceil : roundMode === 3 ? Math.floor : Math.round;
    if (precisionScale > 0) {
        const factor = Math.pow(10, precisionScale);
        return roundFn(rawAmount * factor) / factor;
    }
    if (precisionScale === 0) {
        return roundFn(rawAmount);
    }
    const factor = Math.pow(10, -precisionScale);
    return roundFn(rawAmount / factor) * factor;
}

export function encryptPwd(account: string, password: string, salt: string): string {
    let md5Pwd = exports.md5WithSalt(account, password, 0x31);
    md5Pwd = md5Pwd + salt;
    const pwd = crypto.createHash('md5').update(md5Pwd).digest('hex');
    return pwd;
}

/**
 * @description: 数组转树形结构
 * @param {*} array: 待转换数组
 * @param {*} id: 属性ID名称
 * @param {*} parentKey: 父ID名称
 * @param {*} children: 子栏目 名称
 * @return {*}
 */
export function arrayToTree<T extends Record<string, unknown>>(
    array: T[],
    id: string,
    parentKey: string,
    children: string
): T[] {
    const obj: Record<string, T> = {}; // 临时对象
    const result: T[] = []; // 返回数组

    array.forEach((item) => {
        obj[String(item[id])] = item;
    });

    array.forEach((item) => {
        const pid = item[parentKey];
        const parent = obj[String(pid)]; // 通过临时对象查询数组每一项的父节点
        if (parent) {
            // 父节点存在,放入父节点的children中(泛型仅支持读索引,写入需转 Record)
            const record = parent as Record<string, unknown>;
            const childList = (record[children] as T[] | undefined) ?? [];
            childList.push(item);
            record[children] = childList;
        } else {
            result.push(item); // 父节点不存在,最高一级,直接放入数组中
        }
    });

    return result;
}

/**
 * @description: AES加密
 * @param {string} data 待加密的数据
 * @param {string} key 加密密钥
 * @param {string} iv 初始化向量(CBC模式需要)
 * @param {string} algorithm 加密算法和模式，默认aes-256-cbc
 * @return {string} 加密后的base64字符串
 */
export function aesEncrypt(
    data: string,
    key: string,
    algorithm = 'aes-256-cbc',
    salt = 'salt',
    iv = ''
) {
    // 为AES-256生成32字节密钥，为AES-128生成16字节密钥
    const keyBuffer = algorithm.includes('256')
        ? crypto.scryptSync(key, salt, 32)
        : crypto.scryptSync(key, salt, 16);

    // 确保IV是16字节缓冲区
    const ivBuffer = algorithm.includes('ecb')
        ? Buffer.alloc(0)
        : Buffer.from(iv || '0000000000000000', 'utf8');

    const cipher = crypto.createCipheriv(algorithm, keyBuffer, ivBuffer);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

/**
 * @description: AES解密
 * @param {string} encryptedData 已加密的base64字符串
 * @param {string} key 解密密钥
 * @param {string} iv 初始化向量(CBC模式需要)
 * @param {string} algorithm 解密算法和模式，默认aes-256-cbc
 * @return {string} 解密后的明文
 */
export function aesDecrypt(
    encryptedData: string,
    key: string,
    algorithm = 'aes-256-cbc',
    salt = 'salt',
    iv = ''
) {
    // 为AES-256生成32字节密钥，为AES-128生成16字节密钥
    const keyBuffer = algorithm.includes('256')
        ? crypto.scryptSync(key, salt, 32)
        : crypto.scryptSync(key, salt, 16);

    // 确保IV是16字节缓冲区
    const ivBuffer = algorithm.includes('ecb')
        ? Buffer.alloc(0)
        : Buffer.from(iv || '0000000000000000', 'utf8');

    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, ivBuffer);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

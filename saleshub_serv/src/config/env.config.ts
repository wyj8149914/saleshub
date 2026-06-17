import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env.development';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

function getAppConfig() {
    const requiredEnvVars = [
        'SERVER_PORT', 'DEBUG',
        'DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE',
        'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD',
        'MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_PUBLIC_BUCKET', 'MINIO_URL',
        'JWT_SECRET', 'JWT_EXPIRES_IN', 'REFRESH_TOKEN_EXPIRES_IN',
        'DB_AES_KEY', 'DB_AES_SALT', 'DB_ALGORITHM',
        'API_PREFIX'
    ];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            throw new Error(`环境变量 ${envVar} 未设置`);
        }
    }

    return {
        db: {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT!, 10),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
        },
        redis: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT!, 10),
            password: process.env.REDIS_PASSWORD,
            database: Number(process.env.REDIS_DATABASE) || 7,
        },
        minio: {
            endpoint: process.env.MINIO_ENDPOINT,
            port: parseInt(process.env.MINIO_PORT!, 10),
            accessKey: process.env.MINIO_ACCESS_KEY,
            secretKey: process.env.MINIO_SECRET_KEY,
            publicBucket: process.env.MINIO_PUBLIC_BUCKET,
            privateBucket: process.env.MINIO_PRIVATE_BUCKET,
            url: process.env.MINIO_URL,
        },
        jwt: {
            secret: process.env.JWT_SECRET!,
            expires: parseInt(process.env.JWT_EXPIRES_IN!, 10),
            refreshTokenExpires: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN!, 10),
        },
        dbEncrypt: {
            key: process.env.DB_AES_KEY,
            salt: process.env.DB_AES_SALT,
            algorithm: process.env.DB_ALGORITHM,
        },
        requestEncrypt: {
            encryptParams: ['none'], // 需要加密的参数名称
            devKey: process.env.DEV_KEY || 'kAonDprfUP9JHeFE', // 开发环境接口无需加解密key
        },
        wx: {
            // 小程序登录凭证校验URL,accessToken更新,小程序
            accesstokenXcx: 'https://api.weixin.qq.com/sns/jscode2session?appid=APPID&secret=SECRET&js_code=JSCODE&grant_type=authorization_code',
            // 公众号网页授权URL,通过code换取网页授权access_token
            accesstokenGzh: 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code',
            // 通过access_token换取用户信息URL
            userinfo: "https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID&lang=zh_CN",
            // jsapi_ticket获取URL
            ticketUrl: 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=ACCESS_TOKEN&type=jsapi',
            // 微信支付回调地址
            wxPayNotifyUrl: process.env.WX_PAY_NOTIFY_URL!,
            // 微信退款回调地址
            wxRefundNotifyUrl: process.env.WX_REFUND_NOTIFY_URL!,
            // 微信支付地址,直连,jsapi或小程序支付
            wxJsapiPayUrlZl: 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
            // 获取手机号URL
            getPhoneNumberUrl: 'https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=ACCESS_TOKEN',
        },
        logLevel: process.env.LOG_LEVEL,
        fdfsUrl: process.env.FDFS_URL,
        port: parseInt(process.env.SERVER_PORT!, 10),
        apiPrefix: process.env.API_PREFIX,
        payConfig: {
            payUrl: process.env.PAY_URL,
            payCallbackUrl: process.env.PAY_CALLBACK_URL,
            refundUrl: process.env.REFUND_URL,
            refundCallbackUrl: process.env.REFUND_CALLBACK_URL,
            defaultAppId: process.env.DEFAULT_APP_ID!,
        },
        virtualLogin: {
            loginUrl: process.env.LOGIN_URL!,
            depvalue: process.env.DEPVALUE!,
            account: process.env.LOGIN_ACCOUNT!,
            password: process.env.LOGIN_PASSWORD!,
            apikey: process.env.API_KEY!,
            systemCode: process.env.SYSTEM_CODE!,
            rsaPrefix: process.env.RSA_PRIFIX!,
            rsaTtl: process.env.RSA_TTL!,
        },
        company: {
            maxOwnedCompanies: parseInt(process.env.MAX_OWNED_COMPANIES!, 10),
            maxCompanyMembers: parseInt(process.env.MAX_COMPANY_MEMBERS!, 10),
            inviteExpireDays: parseInt(process.env.INVITE_EXPIRE_DAYS!, 10),
        },
    };
}

export const appConfig = getAppConfig();
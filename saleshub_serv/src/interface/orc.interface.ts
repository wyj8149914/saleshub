/** 坐标 */
interface Coord {
    X: number;
    Y: number;
}

/** 四点坐标 */
interface Polygon {
    LeftTop: Coord;
    RightTop: Coord;
    RightBottom: Coord;
    LeftBottom: Coord;
}

/** 通用票据识别返回的单个字段信息 */
interface ItemPolygonInfo {
    Key: string;
    Polygon: Polygon;
    Row: number;
}

/** 印章信息 */
interface InvoiceSealInfo {
    CompanySealMark: string;
    SupervisionSealMark: string;
    CompanySealMarkInfo: string;
    SupervisionSealMarkInfo: string;
}

/** 电子发票详细条目信息 */
interface VatElectronicItemInfo {
    /** 项目名称，示例值：代理服务 */
    Name: string | null;
    /** 数量，示例值：1 */
    Quantity: string | null;
    /** 规格型号，示例值：规格 */
    Specification: string | null;
    /** 单价，示例值：12 */
    Price: string | null;
    /** 金额，示例值：24 */
    Total: string | null;
    /** 税率，示例值：1% */
    TaxRate: string | null;
    /** 税额，示例值：1 */
    Tax: string | null;
    /** 单位，示例值：次 */
    Unit: string | null;
    /** 运输工具类型，示例值：轿车 */
    VehicleType: string | null;
    /** 运输工具牌号，示例值：A123456 */
    VehicleBrand: string | null;
    /** 起始地，示例值：深圳 */
    DeparturePlace: string | null;
    /** 到达地，示例值：深圳 */
    ArrivalPlace: string | null;
    /** 运输货物名称，仅货物运输服务发票返回，示例值：水果 */
    TransportItemsName: string | null;
    /** 建筑服务发生地，仅建筑发票返回，示例值：深圳 */
    PlaceOfBuildingService: string | null;
    /** 建筑项目名称，仅建筑发票返回，示例值：建筑项目 */
    BuildingName: string | null;
    /** 产权证书/不动产权证号，仅不动产经营租赁服务发票返回，示例值：440300094040109 */
    EstateNumber: string | null;
    /** 面积单位，仅不动产经营租赁服务发票返回，示例值：10 */
    AreaUnit: string | null;
    /** 出行人，仅旅客运输服务发票返回，示例值：张三 */
    Traveler: string | null;
    /** 有效身份证件号，仅旅客运输服务发票返回，示例值：350204****6010 */
    TravelerID: string | null;
    /** 出行日期，仅旅客运输服务发票返回，示例值：2024-12-18 */
    TravelDate: string | null;
    /** 等级，仅旅客运输服务发票返回，示例值：1 */
    TravelLevel: string | null;
    /** 通行日期起，示例值：2024-12-18 */
    DateStart: string | null;
    /** 通行日期止，示例值：2024-12-18 */
    DateEnd: string | null;
    /** 车架号，示例值：LXA*1234 */
    VinNo: string | null;
}

/** 电子发票(普通发票) */
interface VatElectronicInfo {
    /** 发票名称，示例值：增值税电子普通发票 */
    Title: string | null;
    /** 发票号码，示例值：48576409 */
    Number: string | null;
    /** 开票日期，示例值：2021年06月05日 */
    Date: string | null;
    /** 税前金额，示例值：20 */
    PretaxAmount: string | null;
    /** 合计税额，示例值：20 */
    Tax: string | null;
    /** 价税合计（小写），示例值：20 */
    Total: string | null;
    /** 价税合计（大写），示例值：柒佰贰拾叁圆整 */
    TotalCn: string | null;
    /** 销售方名称，示例值：深圳市腾讯计算机系统有限公司 */
    Seller: string | null;
    /** 销售方纳税人识别号，示例值：440300094040109 */
    SellerTaxID: string | null;
    /** 购买方名称，示例值：深圳市腾讯计算机系统有限公司 */
    Buyer: string | null;
    /** 购买方纳税人识别号，示例值：440300094040109 */
    BuyerTaxID: string | null;
    /** 开票人，示例值：深圳市腾讯计算机系统有限公司 */
    Issuer: string | null;
    /** 备注，示例值：备注 */
    Remark: string | null;
    /** 小计金额，示例值：12 */
    SubTotal: string | null;
    /** 小计税额，示例值：12 */
    SubTax: string | null;
    /** 电子发票详细条目信息 */
    VatElectronicItems: VatElectronicItemInfo[] | null;
    /** 业务类型标志，示例值：业务类型标志 */
    ServiceTypeLabel: string | null;
    /** 价税合计(大写)前符号 */
    TotalCnMark: string | null;
    /** 价税合计(小写)前字样 */
    TotalMark: string | null;
    /** 合计金额前字样 */
    PretaxAmountMark: string | null;
    /** 合计税额前字样 */
    TaxMark: string | null;
    /** 是否有公司印章（0：没有，1：有） */
    CompanySealMark: number | null;
    /** 全电类型的多页pdf票据中，支持输出票面页码：当前第几页，一共第几页，示例值：共1页第1页 */
    InvoicePageIndex: string | null;
}

/** 增值税发票项目信息 */
interface VatInvoiceItemInfo {
    /** 项目名称，示例值：技术服务费 */
    Name: string | null;
    /** 规格型号，示例值：规格型号 */
    Specification: string | null;
    /** 单位，示例值：件 */
    Unit: string | null;
    /** 数量，示例值：1 */
    Quantity: string | null;
    /** 单价，示例值：48 */
    Price: string | null;
    /** 金额，示例值：200 */
    Total: string | null;
    /** 税率，示例值：6% */
    TaxRate: string | null;
    /** 税额，示例值：46.8 */
    Tax: string | null;
    /** 通行日期起，示例值：2018年08月07日 */
    DateStart: string | null;
    /** 通行日期止，示例值：2018年08月07日 */
    DateEnd: string | null;
    /** 车牌号，示例值：A12356 */
    LicensePlate: string | null;
    /** 车辆类型，示例值：轿车 */
    VehicleType: string | null;
    /** 序号，示例值：11 */
    SerialNumber: string | null;
}

/** 增值税发票 */
interface VatInvoiceInfo {
    /** 校验码，示例值：0300708 */
    CheckCode: string | null;
    /** 发票联次，示例值：三 */
    FormType: string | null;
    /** 车船税，示例值：46.71 */
    TravelTax: string | null;
    /** 购买方地址电话，示例值：深圳市南山区高新南一道3号赋安科技大楼A座301室0755-86315454 */
    BuyerAddrTel: string | null;
    /** 购买方银行账号，示例值：浦发行深圳科技园支行79210154740015474 */
    BuyerBankAccount: string | null;
    /** 公司印章内容，示例值：发票专用章,深圳市游戏科技有限公司,04000,NANDN */
    CompanySealContent: string | null;
    /** 税务局章内容，示例值：全国统一发票 */
    TaxSealContent: string | null;
    /** 服务类型，示例值：增值税发票 */
    ServiceName: string | null;
    /** 市，示例值：深圳 */
    City: string | null;
    /** 是否存在二维码（0：没有，1：有），示例值：0 */
    QRCodeMark: number | null;
    /** 是否有代开标记（0：没有，1：有），示例值：0 */
    AgentMark: number | null;
    /** 是否有通行费标记（0：没有，1：有），示例值：0 */
    TransitMark: number | null;
    /** 是否有成品油标记（0：没有，1：有），示例值：0 */
    OilMark: number | null;
    /** 发票名称，示例值：深圳增值税专用发票 */
    Title: string | null;
    /** 发票消费类型，示例值：服务 */
    Kind: string | null;
    /** 发票代码，示例值：4403152130 */
    Code: string | null;
    /** 发票号码，示例值：4403152130 */
    Number: string | null;
    /** 机打发票号码，示例值：4403152130 */
    NumberConfirm: string | null;
    /** 开票日期，示例值：2016年04月11日 */
    Date: string | null;
    /** 价税合计（小写），示例值：825.15 */
    Total: string | null;
    /** 价税合计（大写），示例值：捌佰贰拾伍圆壹角伍分 */
    TotalCn: string | null;
    /** 税前金额，示例值：825.15 */
    PretaxAmount: string | null;
    /** 合计税额，示例值：825.15 */
    Tax: string | null;
    /** 机器编号，示例值：14998456 */
    MachineCode: string | null;
    /** 密码区 */
    Ciphertext: string | null;
    /** 备注，示例值：发票 */
    Remark: string | null;
    /** 销售方名称，示例值：深圳市腾讯科技有限公司 */
    Seller: string | null;
    /** 销售方纳税人识别号，示例值：440300094040109 */
    SellerTaxID: string | null;
    /** 销售方地址电话，示例值：深圳市南山区高新南一道3号赋安科技大楼A座301室0755-86315454 */
    SellerAddrTel: string | null;
    /** 销售方银行账号 */
    SellerBankAccount: string | null;
    /** 购买方名称 */
    Buyer: string | null;
    /** 购买方纳税人识别号，示例值：440300708461136 */
    BuyerTaxID: string | null;
    /** 是否有公司印章（0：没有，1：有），示例值：1 */
    CompanySealMark: number | null;
    /** 开票人，示例值：张三 */
    Issuer: string | null;
    /** 复核人，示例值：张三 */
    Reviewer: string | null;
    /** 省，示例值：广东 */
    Province: string | null;
    /** 增值税发票项目信息 */
    VatInvoiceItemInfos: VatInvoiceItemInfo[] | null;
    /** 机打发票代码，示例值：4403152130 */
    CodeConfirm: string | null;
    /** 收款人，示例值：李明 */
    Receiptor: string | null;
    /** 是否有全电纸质票（0：没有，1：有），示例值：0 */
    ElectronicFullMark: number | null;
    /** 全电号码，示例值：4403152130 */
    ElectronicFullNumber: string | null;
    /** 发票联名，示例值：发票联 */
    FormName: string | null;
    /** 是否有区块链标记（0：没有，1：有），示例值：0 */
    BlockChainMark: number | null;
    /** 是否有收购标记（0：没有，1：有），示例值：0 */
    AcquisitionMark: number | null;
    /** 小计金额，示例值：46.71 */
    SubTotal: string | null;
    /** 小计税额，示例值：46.71 */
    SubTax: string | null;
}

/** 机票条目信息 */
interface FlightItem {
    /** 出发航站楼 */
    TerminalGetOn: string | null;
    /** 到达航站楼 */
    TerminalGetOff: string | null;
    /** 承运人 */
    Carrier: string | null;
    /** 航班号 */
    FlightNumber: string | null;
    /** 座位等级 */
    Seat: string | null;
    /** 乘机日期 */
    DateGetOn: string | null;
    /** 乘机时间 */
    TimeGetOn: string | null;
    /** 出发站 */
    StationGetOn: string | null;
    /** 到达站 */
    StationGetOff: string | null;
    /** 免费行李 */
    Allow: string | null;
    /** 客票级别/客票类别 */
    FareBasis: string | null;
}

/** 机票行程单 */
interface AirTransport {
    /** 发票名称 */
    Title: string | null;
    /** 电子客票号码 */
    Number: string | null;
    /** 校验码 */
    CheckCode: string | null;
    /** 印刷序号 */
    SerialNumber: string | null;
    /** 开票日期 */
    Date: string | null;
    /** 销售单位代号 */
    AgentCode: string | null;
    /** 销售单位代号第一行 */
    AgentCodeFirst: string | null;
    /** 销售单位代号第二行 */
    AgentCodeSecond: string | null;
    /** 姓名 */
    UserName: string | null;
    /** 身份证号 */
    UserID: string | null;
    /** 填开单位 */
    Issuer: string | null;
    /** 票价 */
    Fare: string | null;
    /** 合计税额 */
    Tax: string | null;
    /** 燃油附加费 */
    FuelSurcharge: string | null;
    /** 民航发展基金 */
    AirDevelopmentFund: string | null;
    /** 保险费 */
    Insurance: string | null;
    /** 合计金额（小写） */
    Total: string | null;
    /** 发票消费类型 */
    Kind: string | null;
    /** 国内国际标签 */
    DomesticInternationalTag: string | null;
    /** 客票生效日期 */
    DateStart: string | null;
    /** 有效截止日期 */
    DateEnd: string | null;
    /** 签注 */
    Endorsement: string | null;
    /** 是否存在二维码（1：有，0：无） */
    QRCodeMark: number | null;
    /** 条目 */
    FlightItems: FlightItem[] | null;
    /** 提示信息 */
    PromptInformation: string | null;
    /** 统一社会信用代码/纳税人识别号 */
    BuyerTaxID: string | null;
    /** 购买方名称 */
    Buyer: string | null;
    /** 发票号码 */
    ReceiptNumber: string | null;
    /** 开票状态 */
    InvoiceStatus: string | null;
    /** 增值税税率 */
    TaxRate: string | null;
    /** 增值税税额 */
    TaxAmount: string | null;
}

/** 电子发票（航空运输电子客票行程单） */
interface ElectronicFlightTicketFull {
    /** 旅客姓名 */
    UserName: string | null;
    /** 有效身份证件号码 */
    UserID: string | null;
    /** 签注 */
    Endorsement: string | null;
    /** GP单号 */
    GPOrder: string | null;
    /** 发票号码 */
    Number: string | null;
    /** 票价 */
    Fare: string | null;
    /** 燃油附加费 */
    FuelSurcharge: string | null;
    /** 增值税税率 */
    TaxRate: string | null;
    /** 增值税税额 */
    Tax: string | null;
    /** 民航发展基金 */
    DevelopmentFund: string | null;
    /** 其他税费 */
    OtherTax: string | null;
    /** 合计 */
    Total: string | null;
    /** 电子客票号码 */
    ElectronicTicketNum: string | null;
    /** 验证码 */
    VerificationCode: string | null;
    /** 提示信息 */
    PromptInformation: string | null;
    /** 保险费 */
    Insurance: string | null;
    /** 填开单位 */
    Issuer: string | null;
    /** 填开时间 */
    Date: string | null;
    /** 国内国际标识 */
    DomesticInternationalTag: string | null;
    /** 购买方名称 */
    Buyer: string | null;
    /** 销售方名称 */
    Seller: string | null;
    /** 统一社会信用代码 */
    BuyerTaxID: string | null;
    /** 机票详细信息元组 */
    FlightItems: FlightItem[] | null;
    /** 机票开具状态 */
    InvoiceStatus: string | null;
}

/** 电子发票（铁路电子客票） */
interface ElectronicTrainTicketFull {
    /** 电子发票类型 */
    TypeOfVoucher: string | null;
    /** 电子客票号 */
    ElectronicTicketNum: string | null;
    /** 开票日期 */
    Date: string | null;
    /** 始发站 */
    StationGetOn: string | null;
    /** 到达站 */
    StationGetOff: string | null;
    /** 火车号 */
    TrainNumber: string | null;
    /** 乘车日期 */
    DateGetOn: string | null;
    /** 始发时间 */
    TimeGetOn: string | null;
    /** 座位类型 */
    Seat: string | null;
    /** 座位号 */
    SeatNumber: string | null;
    /** 票价 */
    Fare: string | null;
    /** 发票号码 */
    Number: string | null;
    /** 身份证号 */
    UserID: string | null;
    /** 乘车人姓名 */
    UserName: string | null;
    /** 金额 */
    Total: string | null;
    /** 税率 */
    TaxRate: string | null;
    /** 税额 */
    Tax: string | null;
    /** 购买方名称 */
    Buyer: string | null;
    /** 统一社会信用代码 */
    BuyerTaxID: string | null;
    /** 原发票号码 */
    OriginalNumber: string | null;
    /** 标识信息 */
    IDInfo: string | null;
}

export interface MixedInvoiceItem {
    // OK：表示识别成功；FailedOperation.UnsupportedInvoice：表示不支持识别；FailedOperation.UnKnowError：表示识别失败；其它错误码见各个票据接口的定义。
    Code: string;
    //识别出的图片所属的票据类型。 -1：未知类型 0：出租车发票1：定额发票 2：火车票 3：增值税发票 5：机票行程单 8：通用机打发票 9：汽车票 10：轮船票
    // 11：增值税发票（卷票） 12：购车发票 13：过路过桥费发票 15：非税发票  16：全电发票17：医疗发票 18：完税凭证 19：海关缴款书 20：银行回单
    Type: number;
    Polygon: Polygon; // 该发票在原图片中的四点坐标。
    Angle: number; // 识别出切图后各图片的旋转角度。
    SingleInvoiceInfos: Record<string, unknown>; //识别到的内容,键为SubType,值为对应票据类型的详细信息对象。
    Page: number; // 发票处于识别图片或PDF文件中的页码，默认从1开始。
    SubType: string; // 发票详细类型
    TypeDescription: string; // 发票类型描述
    CutImage: string; // 切割单图文件，Base64编码后的切图后的图片文件，开启 EnableCutImage 后进行返回
    SubTypeDescription: string; // 发票详细类型描述
    ItemPolygon: ItemPolygonInfo[]; // 该发票中所有字段坐标信息。包括字段英文名称、字段值所在位置四点坐标、字段所属行号
    QRCode: string; // 二维码数据。
    InvoiceSealInfo: InvoiceSealInfo; // 印章信息
}

/** 通用票据识别返回的单个字段信息 */
export interface OrcResponse {
    MixedInvoiceItems: MixedInvoiceItem[]; // 识别结果
    TotalPDFCount: number; // PDF文件总页码
    RequestId: string; // 请求ID
}

/** SubType和 SingleInvoiceInfos类型映射关系 */
export const InvoiceType = {
    VatSpecialInvoice: 'VatInvoiceInfo',
    VatCommonInvoice: 'VatInvoiceInfo',
    VatElectronicCommonInvoice: 'VatInvoiceInfo',
    VatElectronicSpecialInvoice: 'VatInvoiceInfo',
    VatElectronicInvoiceBlockchain: 'VatInvoiceInfo',
    VatElectronicInvoiceToll: 'VatInvoiceInfo',
    VatElectronicSpecialInvoiceFull: 'VatElectronicInfo',
    VatElectronicInvoiceFull: 'VatElectronicInfo',
    AirTransport: 'AirTransport',
    ElectronicTrainTicketFull: 'ElectronicTrainTicketFull',
    ElectronicFlightTicketFull: 'ElectronicFlightTicketFull',
};

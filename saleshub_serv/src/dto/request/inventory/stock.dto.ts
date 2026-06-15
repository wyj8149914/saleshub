import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsUUID } from 'class-validator';

export class StockInDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  photoUrl: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class StockOutDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class InventoryCheckDto {
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @IsNotEmpty()
  afterStock: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

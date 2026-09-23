import { Decimal } from 'decimal.js';

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP
});

export class FinancialAmount {
  private readonly value: Decimal;

  constructor(amount: Decimal | string | number) {
    this.value = new Decimal(amount);
  }

  public add(other: FinancialAmount): FinancialAmount {
    return new FinancialAmount(this.value.plus(other.value));
  }

  public subtract(other: FinancialAmount): FinancialAmount {
    return new FinancialAmount(this.value.minus(other.value));
  }

  public multiply(factor: Decimal | string | number): FinancialAmount {
    return new FinancialAmount(this.value.times(new Decimal(factor)));
  }

  public divide(divisor: Decimal | string | number): FinancialAmount {
    return new FinancialAmount(this.value.dividedBy(new Decimal(divisor)));
  }

  public toDatabaseString(): string {
    return this.value.toFixed(4);
  }

  public toDisplayString(): string {
    return this.value.toFixed(2);
  }

  public toDecimal(): Decimal {
    return this.value;
  }
}

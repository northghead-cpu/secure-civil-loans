import type { Database as BaseDatabase } from './types';

export type ProductType =
  | 'loan_bank'
  | 'loan_microfinance'
  | 'salary_advance_microfinance';

type BaseBankProduct = BaseDatabase['public']['Tables']['bank_products'];

type BankProducts = {
  Row: BaseBankProduct['Row'] & { product_type: ProductType };
  Insert: Omit<BaseBankProduct['Insert'], 'product_type'> & { product_type?: ProductType };
  Update: Omit<BaseBankProduct['Update'], 'product_type'> & { product_type?: ProductType };
  Relationships: BaseBankProduct['Relationships'];
};

export type Database = Omit<BaseDatabase, 'public'> & {
  public: Omit<BaseDatabase['public'], 'Tables'> & {
    Tables: Omit<BaseDatabase['public']['Tables'], 'bank_products'> & {
      bank_products: BankProducts;
    };
  };
};

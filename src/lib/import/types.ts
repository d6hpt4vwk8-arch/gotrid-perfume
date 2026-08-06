export interface ImportRawRow {
  code: string;
  pairCode: string;
  name: string;
  ean: string;
  manufacturer: string;
  purchasePrice: string;
  price: string;
  vatRate: string;
  description: string;
  image: string;
  categoryText: string;
  znacka: string; // filteringProperty:Značka
  stock: string;
}

export interface ImportRowError {
  row: number;
  code?: string;
  message: string;
}

export interface ImportReport {
  created: number;
  updated: number;
  errors: ImportRowError[];
}

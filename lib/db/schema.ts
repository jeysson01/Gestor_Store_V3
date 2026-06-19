import { pgTable, text, integer, decimal, timestamp, serial, index, foreignKey, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tabla de usuarios (Better Auth)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified'),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabla de productos
export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).unique().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    categoryId: integer('category_id').references(() => categories.id),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    currentStock: integer('current_stock').default(0).notNull(),
    minimumStock: integer('minimum_stock').default(0),
    maximumStock: integer('maximum_stock').default(999999),
    unit: varchar('unit', { length: 50 }).default('unidad'),
    supplier: varchar('supplier', { length: 255 }),
    active: integer('active').default(1),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    userId: text('user_id').references(() => users.id),
  },
  (table) => ({
    codeIdx: index('products_code_idx').on(table.code),
    categoryIdx: index('products_category_idx').on(table.categoryId),
  })
);

// Tabla de categorías
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabla de compras
export const purchases = pgTable(
  'purchases',
  {
    id: serial('id').primaryKey(),
    purchaseNumber: varchar('purchase_number', { length: 50 }).unique().notNull(),
    supplierId: integer('supplier_id'),
    purchaseDate: timestamp('purchase_date').notNull(),
    expectedDeliveryDate: timestamp('expected_delivery_date'),
    actualDeliveryDate: timestamp('actual_delivery_date'),
    status: varchar('status', { length: 50 }).default('pendiente'), // pendiente, recibida, parcial, cancelada
    totalAmount: decimal('total_amount', { precision: 14, scale: 2 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    userId: text('user_id').references(() => users.id),
  },
  (table) => ({
    purchaseNumberIdx: index('purchases_number_idx').on(table.purchaseNumber),
    statusIdx: index('purchases_status_idx').on(table.status),
    dateIdx: index('purchases_date_idx').on(table.purchaseDate),
  })
);

// Tabla de detalles de compra
export const purchaseDetails = pgTable(
  'purchase_details',
  {
    id: serial('id').primaryKey(),
    purchaseId: integer('purchase_id')
      .notNull()
      .references(() => purchases.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
    totalPrice: decimal('total_price', { precision: 14, scale: 2 }).notNull(),
    receivedQuantity: integer('received_quantity').default(0),
    notes: text('notes'),
  },
  (table) => ({
    purchaseIdx: index('purchase_details_purchase_idx').on(table.purchaseId),
    productIdx: index('purchase_details_product_idx').on(table.productId),
  })
);

// Tabla de movimientos de stock
export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    type: varchar('type', { length: 50 }).notNull(), // entrada, salida, ajuste, devolucion
    quantity: integer('quantity').notNull(),
    reference: varchar('reference', { length: 255 }),
    referenceId: integer('reference_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    userId: text('user_id').references(() => users.id),
  },
  (table) => ({
    productIdx: index('stock_movements_product_idx').on(table.productId),
    typeIdx: index('stock_movements_type_idx').on(table.type),
    dateIdx: index('stock_movements_date_idx').on(table.createdAt),
  })
);

// Relaciones
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  purchaseDetails: many(purchaseDetails),
  stockMovements: many(stockMovements),
}));

export const purchasesRelations = relations(purchases, ({ many }) => ({
  details: many(purchaseDetails),
}));

export const purchaseDetailsRelations = relations(purchaseDetails, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseDetails.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseDetails.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
}));

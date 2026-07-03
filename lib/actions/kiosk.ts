'use server';

import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createPurchase } from '@/lib/actions/purchases';
import { getKioskSession } from '@/lib/auth/session';
import { revalidateTag } from 'next/cache';

const YAPE_PHONE = process.env.YAPE_PHONE ?? '914713706';
const YAPE_WEBHOOK_URL = process.env.YAPE_WEBHOOK_URL;

async function sendWebhookNotification(data: {
  amount: string;
  purchaseNumber: string;
  purchaseId: number;
  phone: string;
}) {
  if (!YAPE_WEBHOOK_URL) return;

  try {
    await fetch(YAPE_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        source: 'gestor-store-kiosk',
        event: 'purchase_created',
      }),
    });
  } catch (error) {
    console.error('Error al enviar webhook:', error);
  }
}

export async function getKioskProducts() {
  const session = await getKioskSession();
  if (!session) return { success: false, error: 'Sesión expirada' };

  const result = await db
    .select()
    .from(products)
    .where(eq(products.active, 1))
    .orderBy(asc(products.name));

  return {
    success: true,
    data: result.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unitPrice: parseFloat(p.unitPrice as string),
    })),
  };
}

export async function getKioskProductById(productId: number) {
  const session = await getKioskSession();
  if (!session) return { success: false, error: 'Sesión expirada' };

  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.active, 1)))
    .limit(1);

  if (!result.length) return { success: false, error: 'Producto no encontrado' };

  const product = result[0];
  return {
    success: true,
    data: {
      id: product.id,
      code: product.code,
      name: product.name,
      unitPrice: parseFloat(product.unitPrice as string),
      currentStock: product.currentStock,
      unit: product.unit,
    },
  };
}

export async function scanProductByCode(code: string) {
  const session = await getKioskSession();
  if (!session) return { success: false, error: 'Sesión expirada' };

  const trimmed = code.trim();
  if (!trimmed) return { success: false, error: 'Código vacío' };

  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.code, trimmed), eq(products.active, 1)))
    .limit(1);

  if (!result.length) {
    return { success: false, error: 'Producto no encontrado' };
  }

  const product = result[0];
  return {
    success: true,
    data: {
      id: product.id,
      code: product.code,
      name: product.name,
      unitPrice: parseFloat(product.unitPrice as string),
      currentStock: product.currentStock,
      unit: product.unit,
    },
  };
}

export async function registerKioskPurchase(
  items: Array<{ productId: number; quantity: number; unitPrice: number }>
) {
  const session = await getKioskSession();
  if (!session) return { success: false, error: 'Sesión expirada' };

  if (!items.length) return { success: false, error: 'El carrito está vacío' };

  const purchaseNumber = `KIOSK-${Date.now()}`;

  const result = await createPurchase({
    purchaseNumber,
    purchaseDate: new Date(),
    status: 'pendiente_aprobacion',
    notes: 'Compra kiosko - cliente',
    items,
  });

  if (result.success) {
    revalidateTag('purchases');
    
    // Enviar notificación al webhook configurado cuando se crea la compra
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    await sendWebhookNotification({
      amount: totalAmount.toFixed(2),
      purchaseNumber,
      purchaseId: result.data?.id ?? 0,
      phone: YAPE_PHONE,
    });
  }

  return result;
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerYapeReceived } from '@/lib/actions/yape-notifications';

const bodySchema = z.object({
  amount: z.number().positive(),
  phone: z.string().optional(),
  transactionId: z.string().optional(),
  purchaseId: z.number().optional(),
});

/**
 * Webhook endpoint para recibir notificaciones de Yape
 * Puede ser configurado con Webhook.site o servicios similares
 * 
 * Ejemplo de payload:
 * {
 *   "amount": 15.50,
 *   "phone": "914713706",
 *   "transactionId": "TX123456",
 *   "purchaseId": 123
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);

    if (!json) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ 
        error: 'Datos inválidos', 
        details: parsed.error.errors 
      }, { status: 400 });
    }

    const { amount, purchaseId } = parsed.data;

    // Registrar el pago de Yape recibido
    const result = await registerYapeReceived(amount, 'webhook', purchaseId);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Pago de Yape registrado correctamente',
      data: result.data 
    });
  } catch (error) {
    console.error('Error en webhook de Yape:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// Endpoint GET para verificar que el webhook está activo
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    message: 'Webhook de Yape está funcionando',
    timestamp: new Date().toISOString()
  });
}

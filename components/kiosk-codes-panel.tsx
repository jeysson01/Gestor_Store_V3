'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { RefreshCwIcon, MonitorIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getKioskCodesForAdmin, regenerateKioskCodesForAdmin } from '@/lib/actions/auth';
import {
  getKioskAppBaseUrl,
  getKioskQrImageUrl,
  isLocalhostKioskUrl,
} from '@/lib/kiosk-utils';
import type { KioskCodeDisplay } from '@/lib/kiosk-utils';

const POLL_MS = 2000;

const KioskCodeCard = memo(function KioskCodeCard({
  item,
  index,
  appBaseUrl,
}: {
  item: KioskCodeDisplay;
  index: number;
  appBaseUrl: string;
}) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl border bg-muted/30 gap-3 relative">
      <span className="text-xs text-muted-foreground font-medium">Código {index + 1}</span>
      <span className="text-4xl font-bold tracking-[0.3em] font-mono text-primary">
        {item.code}
      </span>
      <div className="p-2 rounded-lg bg-white relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getKioskQrImageUrl(item.qrToken, appBaseUrl)}
          alt={`QR código ${item.code}`}
          width={140}
          height={140}
          loading="lazy"
        />
        {item.status === 'in_use' && (
          <div className="absolute inset-0 bg-red-500/50 rounded-lg pointer-events-none" />
        )}
      </div>
    </div>
  );
});

export function KioskCodesPanel() {
  const [codes, setCodes] = useState<KioskCodeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [appBaseUrl, setAppBaseUrl] = useState('');

  useEffect(() => {
    setAppBaseUrl(getKioskAppBaseUrl());
  }, []);

  const loadCodes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await getKioskCodesForAdmin();
      if (result.success && result.data) {
        setCodes(result.data);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const result = await regenerateKioskCodesForAdmin();
      if (result.success && result.data) {
        setCodes(result.data);
      }
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    const poll = setInterval(() => loadCodes(true), POLL_MS);
    return () => clearInterval(poll);
  }, [loadCodes]);

  const batchKey = useMemo(() => codes.map((c) => c.id).join(','), [codes]);

  useEffect(() => {
    if (!batchKey) return;
    const ms = Math.min(...codes.map((c) => c.secondsLeft)) * 1000;
    if (ms <= 0) {
      loadCodes(true);
      return;
    }
    const timer = setTimeout(() => loadCodes(true), ms);
    return () => clearTimeout(timer);
  }, [batchKey, loadCodes]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MonitorIcon className="w-5 h-5" />
              Códigos de Acceso Kiosko
            </CardTitle>
            <CardDescription>
              4 códigos de 3 dígitos que se renuevan automáticamente cada 3 minutos
            </CardDescription>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleRegenerate} 
            disabled={regenerating || loading}
          >
            Regenerar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Generando códigos...</div>
        ) : appBaseUrl ? (
          <div className="grid grid-cols-2 gap-4">
            {codes.map((item, idx) => (
              <KioskCodeCard
                key={item.id}
                item={item}
                index={idx}
                appBaseUrl={appBaseUrl}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Preparando códigos QR...</div>
        )}
        {appBaseUrl && isLocalhostKioskUrl(appBaseUrl) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-4 text-center">
            Para escanear desde el celular, abre este panel con la IP de tu PC (ej.{' '}
            <span className="font-mono">http://192.168.x.x:3002/kiosk-panel</span>) o configura{' '}
            <span className="font-mono">NEXT_PUBLIC_APP_URL</span> en .env.local
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Muestra estos códigos al cliente para que ingrese al panel kiosko
        </p>
      </CardContent>
    </Card>
  );
}

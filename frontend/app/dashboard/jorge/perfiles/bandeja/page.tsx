'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  UserCircle,
} from 'lucide-react';
import {
  fetchSiguiente,
  marcarEnviado,
  marcarOmitido,
  marcarNoAplica,
  registrarRespuesta,
  bloquearCliente,
} from './api';
import type {
  Contacto,
  PantallaAsistente,
  SiguienteResponse,
  TipoRespuesta,
} from './types';
import { TarjetaCliente } from './TarjetaCliente';
import { TarjetaRegistrarRespuesta } from './TarjetaRegistrarRespuesta';
import { TarjetaCelebracion } from './TarjetaCelebracion';

export default function BandejaPage() {
  const { data: session, status: sessionStatus } = useSession();
  const operador = session?.user?.username || '';
  const operadorNombre = session?.user?.name || '';
  const [pantalla, setPantalla] = useState<PantallaAsistente>('cargando');
  const [siguiente, setSiguiente] = useState<SiguienteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actuando, setActuando] = useState(false);
  const [transicionMsg, setTransicionMsg] = useState<string>('');

  // Fetch del próximo cliente / respuesta pendiente / celebración / fin del día.
  const cargarSiguiente = useCallback(async () => {
    try {
      const data = await fetchSiguiente();
      setSiguiente(data);
      if (data.tipo === 'fin_del_dia') {
        setPantalla('fin_del_dia');
      } else {
        setPantalla('cliente_actual');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error de red');
      setPantalla('error');
    }
  }, []);

  // Llamada inicial: pasamos por "inicio" un segundo y luego ya cargamos siguiente.
  useEffect(() => {
    setPantalla('inicio');
    const t = setTimeout(() => cargarSiguiente(), 600);
    return () => clearTimeout(t);
  }, [cargarSiguiente]);

  // Avance auto desde la pantalla de transición.
  useEffect(() => {
    if (pantalla !== 'transicion') return;
    const t = setTimeout(() => cargarSiguiente(), 1400);
    return () => clearTimeout(t);
  }, [pantalla, cargarSiguiente]);

  const irATransicion = (msg: string) => {
    setTransicionMsg(msg);
    setPantalla('transicion');
  };

  const handleEnviado = async (contacto: Contacto, mensajeEditado?: string) => {
    if (actuando) return;
    setActuando(true);
    try {
      const res = await marcarEnviado(contacto.id, {
        operador: operador,
        mensaje_enviado_editado: mensajeEditado,
      });
      if (res.conflict) {
        alert(
          `${res.conflict.mensaje}\n\nEstado anterior: ${res.conflict.eje_valor_anterior}\nEstado actual: ${res.conflict.eje_valor_actual}`
        );
        await cargarSiguiente();
        return;
      }
      // Pre-resolución: si el backend devolvió el siguiente, lo cacheamos.
      if (res.data?.siguiente_contacto) {
        setSiguiente(res.data.siguiente_contacto);
      }
      irATransicion(`Enviado a ${contacto.cliente.nombre.split(' ')[0]}`);
    } catch (e: unknown) {
      alert(`Error al marcar enviado: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActuando(false);
    }
  };

  const handleOmitir = async (contacto: Contacto) => {
    if (actuando) return;
    setActuando(true);
    try {
      await marcarOmitido(contacto.id, operador);
      irATransicion(`Saltado: ${contacto.cliente.nombre.split(' ')[0]}`);
    } catch (e: unknown) {
      alert(`Error al saltar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActuando(false);
    }
  };

  const handleNoAplica = async (contacto: Contacto) => {
    const razon = window.prompt(
      `Marcar "No aplica" para ${contacto.cliente.nombre}. Razón (opcional):`,
      ''
    );
    if (razon === null) return; // canceló
    if (actuando) return;
    setActuando(true);
    try {
      await marcarNoAplica(contacto.id, operador, razon || undefined);
      irATransicion(`No aplica: ${contacto.cliente.nombre.split(' ')[0]}`);
    } catch (e: unknown) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActuando(false);
    }
  };

  const handleBloquear = async (contacto: Contacto) => {
    const razon = window.prompt(
      `BLOQUEO PERMANENTE de ${contacto.cliente.nombre}.\n\nNo recibirá más WhatsApp nunca, salvo intervención manual en admin Django.\n\n¿Por qué bloqueas? (cliente proxy, número malo, fallecimiento, etc.)`,
      ''
    );
    if (razon === null) return; // canceló
    if (actuando) return;
    setActuando(true);
    try {
      const res = await bloquearCliente(
        contacto.id,
        operador,
        razon || undefined
      );
      const nombreCorto = contacto.cliente.nombre.split(' ')[0];
      if (res.data?.cliente_bloqueado === false) {
        irATransicion(`${nombreCorto} ya estaba bloqueado`);
      } else {
        irATransicion(`Bloqueado: ${nombreCorto}`);
      }
    } catch (e: unknown) {
      alert(`Error al bloquear: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActuando(false);
    }
  };

  const handleRegistrarRespuesta = async (
    contacto: Contacto,
    tipo: TipoRespuesta,
    nota: string
  ) => {
    if (actuando) return;
    setActuando(true);
    try {
      await registrarRespuesta(contacto.id, {
        respondio: tipo !== 'sin_respuesta',
        tipo_respuesta: tipo,
        nota_operador: nota || undefined,
        operador,
      });
      const nombreCorto = contacto.cliente.nombre.split(' ')[0];
      const etiquetaTipo: Record<TipoRespuesta, string> = {
        reservo: '¡Reservó!',
        interesado: 'Interesada/o',
        consulto_precio: 'Consultó precio',
        mas_adelante: 'Más adelante',
        rechazo: 'Rechazó',
        opt_out: 'Opt-out registrado',
        sin_respuesta: 'Sin respuesta',
      };
      irATransicion(`${nombreCorto}: ${etiquetaTipo[tipo]}`);
    } catch (e: unknown) {
      alert(
        `Error al registrar respuesta: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      setActuando(false);
    }
  };

  // ============ RENDER POR PANTALLA ============

  // Sesión aún no resuelta → loader corto.
  if (sessionStatus === 'loading') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Sin login → bloquear con mensaje claro. Toda acción debe quedar atribuida.
  if (!operador) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <UserCircle className="h-5 w-5" /> Inicia sesión para operar la bandeja
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-900">
            Cada acción debe registrar quién la hizo (Deborah, Angélica, Ernesto
            o Jorge) para medir desempeño por operador.{' '}
            <a className="font-semibold underline" href="/login">
              Iniciar sesión
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pantalla === 'cargando' || pantalla === 'inicio') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
        <div className="text-center text-slate-500">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-3 text-sm">Cargando la bandeja del día…</p>
        </div>
      </div>
    );
  }

  if (pantalla === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" /> No pude cargar la bandeja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-red-800">
            <p>{error}</p>
            <Button onClick={() => cargarSiguiente()} variant="outline">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pantalla === 'transicion') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="mt-4 text-lg font-medium text-slate-800">
            ✓ {transicionMsg}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Cargando siguiente cliente…
          </p>
        </div>
      </div>
    );
  }

  if (pantalla === 'fin_del_dia') {
    const r = siguiente?.resumen_dia;
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Sparkles className="h-5 w-5" /> ¡Listo,{' '}
              {operadorNombre?.split(' ')[0] || operador}!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <p className="text-base">
              Trabajaste con{' '}
              <strong>{(r?.enviados ?? 0) + (r?.omitidos ?? 0) + (r?.no_aplica ?? 0)}</strong>{' '}
              clientes hoy.
            </p>
            {r && (
              <ul className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <li>
                  <strong>{r.enviados}</strong> enviados ·{' '}
                  <strong>{r.omitidos}</strong> saltados ·{' '}
                  <strong>{r.no_aplica}</strong> no aplica
                </li>
                {r.tiempo_total_minutos != null && (
                  <li>Tiempo aprox.: {r.tiempo_total_minutos} min</li>
                )}
              </ul>
            )}
            {r?.semana_actual && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-2 font-medium text-emerald-900">
                  Esta semana
                </p>
                <ul className="space-y-1 text-sm text-emerald-800">
                  <li>
                    {r.semana_actual.mensajes_enviados} mensajes ·{' '}
                    {r.semana_actual.respuestas_recibidas} respuestas (
                    {Math.round(r.semana_actual.tasa_respuesta * 100)}%)
                  </li>
                  <li>
                    {r.semana_actual.reservas_atribuidas} reservas atribuidas ·{' '}
                    ${r.semana_actual.ingreso_atribuido.toLocaleString('es-CL')}
                    {' '}en ingreso
                  </li>
                </ul>
              </div>
            )}
            <div className="pt-2">
              <Button onClick={() => cargarSiguiente()} variant="outline">
                <ArrowRight className="mr-2 h-4 w-4" />
                Volver a chequear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // pantalla === 'cliente_actual'
  if (!siguiente?.contacto) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Sin contacto activo. <Button onClick={() => cargarSiguiente()}>Recargar</Button>
      </div>
    );
  }

  const esRespuestaPendiente = siguiente.tipo === 'respuesta_pendiente';
  const esCelebracion = siguiente.tipo === 'celebracion';
  const totalDelDia =
    siguiente.progreso.completados_hoy +
    siguiente.progreso.pendientes_hoy +
    1;

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* Header con progreso + operador activo */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <UserCircle className="h-3.5 w-3.5" />
          Operando como{' '}
          <strong className="text-slate-800">{operadorNombre || operador}</strong>
        </span>
        {esRespuestaPendiente ? (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800">
            Respuestas pendientes:{' '}
            {siguiente.progreso.respuestas_pendientes}
          </span>
        ) : esCelebracion ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
            ★ Celebración · {siguiente.progreso.celebraciones_pendientes}{' '}
            pendientes
          </span>
        ) : (
          <>
            <span>
              Cliente <strong>{siguiente.progreso.completados_hoy + 1}</strong>{' '}
              de {totalDelDia}
            </span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-800">
              Prioridad {siguiente.contacto.prioridad}
            </span>
          </>
        )}
      </div>

      {esRespuestaPendiente ? (
        <TarjetaRegistrarRespuesta
          contacto={siguiente.contacto}
          disabled={actuando}
          onGuardar={handleRegistrarRespuesta}
        />
      ) : esCelebracion ? (
        <TarjetaCelebracion
          contacto={siguiente.contacto}
          celebracion={siguiente.celebracion}
          disabled={actuando}
          onAgradecido={(c) => handleEnviado(c)}
          onOmitir={handleOmitir}
        />
      ) : (
        <TarjetaCliente
          contacto={siguiente.contacto}
          disabled={actuando}
          onEnviado={handleEnviado}
          onOmitir={handleOmitir}
          onNoAplica={handleNoAplica}
          onBloquear={handleBloquear}
        />
      )}
    </div>
  );
}

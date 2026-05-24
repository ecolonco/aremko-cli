'use client';

import { useCallback, useEffect, useState } from 'react';

// Persistencia de borradores de mensaje editados por el operador.
// Si edita el texto y cierra el navegador, al volver retoma el borrador.
// Una vez procesado el contacto (enviado / omitido / no aplica), se limpia.

const STORAGE_PREFIX = 'aremko_bandeja_draft_';

const storageKey = (contactoID: number) => `${STORAGE_PREFIX}${contactoID}`;

const isClient = () => typeof window !== 'undefined';

/**
 * Hook que sincroniza un borrador de mensaje editado con localStorage.
 *
 * @param contactoID  id del ContactoWhatsApp (clave del storage)
 * @param textoBase   mensaje renderizado por el backend (fallback si no hay draft)
 *
 * Devuelve [draft, setDraft, clearDraft] donde:
 * - draft: string actual (puede ser el original si nunca se editó)
 * - setDraft: setter que persiste en localStorage solo si difiere del original
 * - clearDraft: borra el draft del storage (llamar al procesar el contacto)
 */
export function useDraftStore(
  contactoID: number,
  textoBase: string
): [string, (s: string) => void, () => void] {
  const [draft, setDraftState] = useState<string>(textoBase);

  // Al cambiar de contacto, leer storage o caer al texto base.
  useEffect(() => {
    if (!isClient()) {
      setDraftState(textoBase);
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey(contactoID));
      setDraftState(stored ?? textoBase);
    } catch {
      setDraftState(textoBase);
    }
  }, [contactoID, textoBase]);

  // Setter que persiste solo si el draft difiere del original (no contaminamos
  // el storage con copias literales del mensaje renderizado).
  const setDraft = useCallback(
    (nuevo: string) => {
      setDraftState(nuevo);
      if (!isClient()) return;
      try {
        if (nuevo === textoBase) {
          window.localStorage.removeItem(storageKey(contactoID));
        } else {
          window.localStorage.setItem(storageKey(contactoID), nuevo);
        }
      } catch {
        // localStorage lleno o deshabilitado — ignorar, el estado en memoria sigue.
      }
    },
    [contactoID, textoBase]
  );

  const clearDraft = useCallback(() => {
    if (!isClient()) return;
    try {
      window.localStorage.removeItem(storageKey(contactoID));
    } catch {
      // sin-op
    }
  }, [contactoID]);

  return [draft, setDraft, clearDraft];
}

/**
 * Limpia TODOS los borradores de bandeja del localStorage.
 * Útil al hacer logout o al detectar fin del día.
 */
export function clearAllDrafts(): void {
  if (!isClient()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // sin-op
  }
}

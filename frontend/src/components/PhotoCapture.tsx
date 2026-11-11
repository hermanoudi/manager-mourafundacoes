"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { messageFor, messageForCode } from "@/lib/errors";
import { MAX_PHOTO_BYTES, downscaleToJpeg } from "@/lib/image";
import type { Extraction, PhotoUpload } from "@/lib/measurements";

const TOO_LARGE = "Foto muito grande. Tente outra foto ou digite as linhas.";
const OFFLINE = "Sem conexão — a foto não foi enviada. Tente de novo ou digite as linhas.";
const NO_LINES = "Nenhuma estaca encontrada na foto. Digite as linhas.";

/** `retryPhotoId`: foto já gravada no servidor, só a leitura falhou ("Tentar ler de novo"). */
type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "error"; message: string; retryPhotoId: string | null };

type Props = {
  jobId: number;
  onExtracted: (photoId: string, extraction: Extraction) => void;
  /** `photoId` quando a foto foi gravada mas não lida: a medição ainda pode levá-la anexada. */
  onError: (code: string, photoId: string | null) => void;
  /** Leitura em andamento: o formulário não envia antes de a foto ser anexada. */
  onReadingChange?: (reading: boolean) => void;
};

/**
 * Foto da folha de anotações → servidor → linhas para revisão. Sem `capture`: o celular oferece
 * câmera e galeria (no canteiro sem sinal, fotografa agora e envia depois). A IA só preenche o
 * formulário; quem cria a medição é o operador ao enviar.
 */
export function PhotoCapture({ jobId, onExtracted, onError, onReadingChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const reading = state.kind === "reading";

  useEffect(() => {
    onReadingChange?.(reading);
  }, [reading, onReadingChange]);

  function done(photoId: string, extraction: Extraction) {
    if (extraction.lines.length === 0) {
      setState({ kind: "error", message: NO_LINES, retryPhotoId: null });
      onError("no_lines", photoId);
      return;
    }
    setState({ kind: "idle" });
    onExtracted(photoId, extraction);
  }

  function failed(err: unknown, retryPhotoId: string | null) {
    const offline = err instanceof TypeError;
    setState({ kind: "error", message: offline ? OFFLINE : messageFor(err), retryPhotoId });
    onError(err instanceof ApiError ? err.code : offline ? "offline" : "unknown_error", retryPhotoId);
  }

  async function upload(file: File) {
    setState({ kind: "reading" });
    const blob = await downscaleToJpeg(file);
    if (blob.size > MAX_PHOTO_BYTES) {
      setState({ kind: "error", message: TOO_LARGE, retryPhotoId: null });
      onError("file_too_large", null);
      return;
    }
    const form = new FormData();
    form.append("file", blob, blob === file ? file.name : "foto.jpg");
    try {
      const res = await api<PhotoUpload>(`/api/jobs/${jobId}/photos`, { method: "POST", body: form });
      if (res.extraction) {
        done(res.photo_id, res.extraction);
      } else {
        const code = res.extraction_error ?? "extraction_failed";
        setState({ kind: "error", message: messageForCode(code), retryPhotoId: res.photo_id });
        onError(code, res.photo_id);
      }
    } catch (err) {
      failed(err, null);
    }
  }

  async function readAgain(photoId: string) {
    setState({ kind: "reading" });
    try {
      done(photoId, await api<Extraction>(`/api/photos/${photoId}/extract`, { method: "POST" }));
    } catch (err) {
      failed(err, photoId);
    }
  }

  const retryId = state.kind === "error" ? state.retryPhotoId : null;
  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Limpa para que escolher a mesma foto de novo dispare outra vez.
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        disabled={reading}
        onClick={() => input.current?.click()}
        className="min-h-11 w-full rounded-lg border border-brand bg-white px-4 font-medium text-brand disabled:opacity-60 md:w-auto"
      >
        Foto das anotações
      </button>
      {reading && <p role="status" className="text-sm text-stone-700">Lendo a foto…</p>}
      {state.kind === "error" && (
        <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p>{state.message}</p>
          {retryId && (
            <button
              type="button"
              onClick={() => void readAgain(retryId)}
              className="min-h-11 rounded-lg border border-red-700 bg-white px-4 font-medium text-red-800"
            >
              Tentar ler de novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

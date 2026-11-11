"use client";

import { useEffect, useRef, useState } from "react";

import { Notice } from "@/components/Notice";
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
  /** Ação principal da tela (sólida) enquanto não há foto lida; depois vira secundária. */
  prominent?: boolean;
};

/**
 * Foto da folha de anotações → servidor → linhas para revisão. Sem `capture`: o celular oferece
 * câmera e galeria (no canteiro sem sinal, fotografa agora e envia depois). A IA só preenche o
 * formulário; quem cria a medição é o operador ao enviar.
 */
export function PhotoCapture({ jobId, onExtracted, onError, onReadingChange, prominent = true }: Props) {
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
        className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-medium disabled:opacity-60 md:w-auto ${
          prominent
            ? "bg-brand text-white hover:bg-brand-dark"
            : "border border-brand bg-white text-brand"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
        </svg>
        Foto das anotações
      </button>
      {reading && (
        <div role="status" className="space-y-1.5">
          <p className="text-sm text-stone-700">Lendo a foto…</p>
          <div className="mg-progress h-1 overflow-hidden rounded-full bg-brand-soft" aria-hidden="true" />
        </div>
      )}
      {state.kind === "error" && (
        <Notice tone="error" role="alert">
          <p>{state.message}</p>
          {retryId && (
            <button
              type="button"
              onClick={() => void readAgain(retryId)}
              className="mt-1 min-h-11 rounded-lg border border-red-700 bg-white px-4 font-medium text-red-900"
            >
              Tentar ler de novo
            </button>
          )}
        </Notice>
      )}
    </div>
  );
}

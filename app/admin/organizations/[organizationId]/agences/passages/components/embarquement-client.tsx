"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, Keyboard, QrCode, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listBoardingDepartsAction,
  listBoardingPassengersAction,
  manualBoardPassengerAction,
  scanBoardPassengerAction,
  type BoardingDepartOption,
  type BoardingPassengerRow,
} from "../actions";

type Props = {
  organizationId: string;
  canScan: boolean;
  denyMessage?: string;
  initialDeparts: BoardingDepartOption[];
  initialDate: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector():
  | (new (opts?: { formats?: string[] }) => BarcodeDetectorLike)
  | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector ?? null
  );
}

export function EmbarquementClient({
  organizationId,
  canScan,
  denyMessage,
  initialDeparts,
  initialDate,
}: Props) {
  const [date, setDate] = useState(initialDate);
  const [departs, setDeparts] = useState(initialDeparts);
  const [departId, setDepartId] = useState(initialDeparts[0]?.id ?? "");
  const [passagers, setPassagers] = useState<BoardingPassengerRow[]>([]);
  const [payload, setPayload] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraHint, setCameraHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef("");

  const stats = useMemo(() => {
    const total = passagers.length;
    const boarded = passagers.filter((p) => p.embarqueAt).length;
    return { total, boarded, remaining: total - boarded };
  }, [passagers]);

  const refreshPassengers = useCallback(
    (id: string) => {
      if (!id || !canScan) {
        setPassagers([]);
        return;
      }
      startTransition(async () => {
        const res = await listBoardingPassengersAction(organizationId, id);
        if (!res.ok) {
          toast.error(res.message);
          setPassagers([]);
          return;
        }
        setPassagers(res.data);
      });
    },
    [canScan, organizationId],
  );

  useEffect(() => {
    if (departId) refreshPassengers(departId);
  }, [departId, refreshPassengers]);

  async function reloadDeparts(nextDate: string) {
    startTransition(async () => {
      const res = await listBoardingDepartsAction(organizationId, nextDate);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setDeparts(res.data);
      const nextId = res.data[0]?.id ?? "";
      setDepartId(nextId);
      if (!nextId) setPassagers([]);
    });
  }

  async function handleScan(raw: string) {
    const value = raw.trim();
    if (!value || !departId || !canScan) return;
    if (value === lastScanRef.current) return;
    lastScanRef.current = value;

    startTransition(async () => {
      const res = await scanBoardPassengerAction({
        organizationId,
        trajetDepartId: departId,
        payload: value,
      });
      if (!res.ok) {
        toast.error(res.message);
        setTimeout(() => {
          lastScanRef.current = "";
        }, 1500);
        return;
      }
      toast.success(res.message);
      setPayload("");
      refreshPassengers(departId);
      setTimeout(() => {
        lastScanRef.current = "";
      }, 2000);
    });
  }

  async function handleManualBoard(passagerId: string) {
    if (!departId || !canScan) return;
    startTransition(async () => {
      const res = await manualBoardPassengerAction({
        organizationId,
        trajetDepartId: departId,
        passagerId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      refreshPassengers(departId);
    });
  }

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }

    let cancelled = false;
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setCameraHint(
        "Scan caméra non supporté sur ce navigateur. Utilisez la saisie manuelle du code PASS-* ou du token QR.",
      );
      setCameraOn(false);
      return;
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraHint(null);
        const detector = new Detector({ formats: ["qr_code"] });

        const tick = async () => {
          if (cancelled || !videoRef.current || scanningRef.current) {
            if (!cancelled) requestAnimationFrame(tick);
            return;
          }
          try {
            scanningRef.current = true;
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) await handleScan(value);
          } catch {
            // ignore frame errors
          } finally {
            scanningRef.current = false;
            if (!cancelled) requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      } catch {
        setCameraHint("Impossible d’accéder à la caméra. Autorisez l’accès ou saisissez le code.");
        setCameraOn(false);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scan handler stable enough via refs
  }, [cameraOn, departId, organizationId, canScan]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
      {!canScan && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accès embarquement refusé</CardTitle>
            <CardDescription>
              {denyMessage ??
                "Permission embarquement:scan requise (guichetier ou owner)."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Départ du jour</CardTitle>
          <CardDescription>
            Sélectionnez le départ, puis scannez ou pointez les passagers.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="boarding-date">Date</Label>
            <Input
              id="boarding-date"
              type="date"
              value={date}
              disabled={!canScan || pending}
              onChange={(e) => {
                const v = e.target.value;
                setDate(v);
                void reloadDeparts(v);
              }}
            />
          </div>
          <div className="grid flex-[2] gap-2">
            <Label htmlFor="boarding-depart">Départ</Label>
            <Select
              id="boarding-depart"
              value={departId}
              disabled={!canScan || pending || departs.length === 0}
              onChange={(e) => setDepartId(e.target.value)}
            >
              <option value="">
                {departs.length ? "Choisir un départ" : "Aucun départ"}
              </option>
              {departs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!canScan || !departId || pending}
            onClick={() => refreshPassengers(departId)}
          >
            <RefreshCw className="size-4" />
            Actualiser
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Passagers" value={stats.total} />
        <StatCard label="Embarqués" value={stats.boarded} accent="success" />
        <StatCard label="Restants" value={stats.remaining} accent="warn" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="size-4 text-primary" />
            Scan / saisie
          </CardTitle>
          <CardDescription>
            QR billet (token CCNL1) ou code passager PASS-* pour pointage manuel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void handleScan(payload);
            }}
          >
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={payload}
                disabled={!canScan || !departId || pending}
                placeholder="Coller ou saisir le code…"
                className="pl-9"
                onChange={(e) => setPayload(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              disabled={!canScan || !departId || !payload.trim() || pending}
            >
              Valider
            </Button>
            <Button
              type="button"
              variant={cameraOn ? "secondary" : "outline"}
              disabled={!canScan || !departId}
              onClick={() => setCameraOn((v) => !v)}
            >
              <Camera className="size-4" />
              {cameraOn ? "Stop caméra" : "Caméra"}
            </Button>
          </form>

          {cameraHint ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">{cameraHint}</p>
          ) : null}

          {cameraOn ? (
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <video
                ref={videoRef}
                className="aspect-video w-full object-cover"
                muted
                playsInline
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Liste passagers</CardTitle>
          <CardDescription>
            Pointage manuel si le QR est perdu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {passagers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {departId
                ? "Aucun passager confirmé pour ce départ."
                : "Choisissez un départ pour afficher la liste."}
            </p>
          ) : (
            passagers.map((p) => {
              const boarded = Boolean(p.embarqueAt);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between",
                    boarded && "bg-emerald-500/5",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.prenom} {p.nom}{" "}
                      <span className="text-muted-foreground">· {p.categorie}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.codeUnique} · {p.reservationCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {boarded ? (
                      <Badge variant="secondary" className="gap-1 text-emerald-600">
                        <CheckCircle2 className="size-3.5" />
                        Embarqué
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline" className="gap-1">
                          <XCircle className="size-3.5" />
                          Confirmé
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={!canScan || pending}
                          onClick={() => handleManualBoard(p.id)}
                        >
                          Pointer
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warn";
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold tabular-nums",
            accent === "success" && "text-emerald-500",
            accent === "warn" && "text-primary",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

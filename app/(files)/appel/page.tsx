"use client";

import { useEffect, useState } from "react";

import {
    Bell,
    Clock3,
    Menu,
    User2,
    ChevronDown,
    CheckCircle2,
    XCircle,
    TimerReset,
    PhoneCall,
    Repeat,
    PauseCircle,
    ArrowRightLeft,
} from "lucide-react";

import {
    Card,
    CardContent,
} from "@/components/ui/card";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select2";

import { Button } from "@/components/ui/button";
import QueueItem from "./components/QueueItem";
import SidebarItem from "./components/SidebarItem";

type Ticket = {
    id: string;
    active: boolean;
    status: string;
    recalled: boolean;
    order: number;
    startedAt: number | null;
};
export default function QueueDashboard() {
    const [tickets, setTickets] = useState<Ticket[]>([
        { id: "DE-003", active: true, status: "WAITING", recalled: false, order: 1, startedAt: null, },
        { id: "DE-004", active: false, status: "WAITING", recalled: false, order: 2, startedAt: null, },
        { id: "DE-005", active: false, status: "WAITING", recalled: false, order: 3, startedAt: null, },
    ]);
    const visibleTickets = tickets.filter(
        (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
    );
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState<"READY" | "NOT_READY">("NOT_READY");
    const [counter, setCounter] =
        useState<string | null>(null);
    const [, forceRender] = useState(0);
    const [transferOpen, setTransferOpen] = useState(false);
    const [transferTicket, setTransferTicket] = useState<string | null>(null);
    const [transferService, setTransferService] = useState("");
    const [transferAgent, setTransferAgent] = useState("");
    const [transferReason, setTransferReason] = useState("");
    const agents = [
        {
            id: 1,
            name: "Agent John",
            service: "Depot",
            status: "READY",
        },
        {
            id: 2,
            name: "Agent Sarah",
            service: "Retrait",
            status: "NOT_READY",
        },
        {
            id: 3,
            name: "Agent Mike",
            service: "Support",
            status: "READY",
        },
        {
            id: 4,
            name: "Agent Emma",
            service: "Depot",
            status: "NOT_READY",
        },
    ];
    const selectedAgentData = agents.find(
        (a) => a.name === transferAgent
    );
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (confirmOpen) {
            interval = setInterval(() => {
                forceRender((prev) => prev + 1);
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [confirmOpen]);
    useEffect(() => {
        const savedCounter =
            localStorage.getItem("counter");

        if (savedCounter) {
            setCounter(savedCounter);
            setOpen(false);
        }
    }, []);

    const openTransferModal = (id: string) => {
        setTransferTicket(id);

        setTransferService("");
        setTransferAgent("");
        setTransferReason("");

        setTransferOpen(true);
    };

    const currentTicket = tickets.find(
        (t) => t.id === selectedTicket
    );

    const remainingTime = currentTicket?.startedAt
        ? Math.max(
            0,
            90 -
            Math.floor(
                (Date.now() - currentTicket.startedAt) / 1000
            )
        )
        : 90;

    const openCompleteModal = (id: string) => {
        setSelectedTicket(id);
        setConfirmOpen(true);
    };

    const confirmComplete = () => {
        if (!selectedTicket) return;

        handleComplete(selectedTicket);

        setConfirmOpen(false);
        setSelectedTicket(null);
    };
    const handleConfirm = () => {
        if (!counter) return;

        localStorage.setItem(
            "counter",
            counter
        );

        setOpen(false);
    };

    const handleCall = (id: string) => {
        setTickets((prev) => {
            const reset = prev.map((t) => ({
                ...t,
                active: false,
                recalled: false,
                status: "WAITING",
            }));

            return reset.map((t) =>
                t.id === id
                    ? {
                        ...t,
                        status: "START",
                        active: false,
                        recalled: true,
                        startedAt: Date.now(),
                    }
                    : t
            );
        });
    };

    const handleComplete = (id: string) => {
        setTickets((prev) => {
            // 1. remove completed
            let updated = prev.filter((t) => t.id !== id);

            // 🔥 2. SORT by order BEFORE anything
            updated = [...updated].sort((a, b) => a.order - b.order);

            // 3. recompute queue
            updated = updated.map((t, index) => ({
                ...t,
                order: index + 1,
                // premier ticket prêt à être appelé
                active: index === 0,
                // pas encore appelé
                recalled: false,

                // waiting tant que call non lancé
                status: "WAITING",
            }));

            return updated;
        });
    };

    return (
        <div className="min-h-screen bg-[#f5f7fb]">
            {/* SIDEBAR */}
            <aside className="fixed left-0 top-0 z-40 flex h-screen w-[250px] flex-col bg-[#07111d] text-white">
                {/* Logo */}
                <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
                    <div className="h-10 w-10 rounded-xl bg-red-500" />

                    <div>
                        <h2 className="font-bold">
                            QueueFlow
                        </h2>

                        <p className="text-xs text-white/60">
                            Smart Queue System
                        </p>
                    </div>
                </div>

                {/* MENU */}
                <div className="flex-1 px-3 py-6">
                    <p className="mb-3 px-3 text-xs uppercase tracking-widest text-white/40">
                        Navigation
                    </p>

                    <div className="space-y-2">
                        <SidebarItem
                            label="Tableau de bord"
                            active
                        />

                        <SidebarItem label="Gestion des tickets" />

                        <SidebarItem label="Gestion des files" />

                        <SidebarItem label="Services" />

                        <SidebarItem label="Agents" />

                        <SidebarItem label="Rapports" />
                    </div>
                </div>

                {/* FOOTER */}
                <div className="border-t border-white/10 p-4">
                    <div className="rounded-2xl bg-white/5 p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white">
                                <User2 className="size-5" />
                            </div>

                            <div>
                                <p className="font-medium">
                                    Admin
                                </p>

                                <p className="text-xs text-white/50">
                                    Superviseur
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* MAIN */}
            <main className="ml-[250px]">
                {/* TOPBAR */}
                <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-xl">
                    <div className="flex h-[72px] items-center justify-between px-8">
                        {/* LEFT */}
                        <div className="flex items-center gap-4">
                            <Button
                                size="icon"
                                className="rounded-xl border bg-background shadow-sm hover:bg-muted"
                            >
                                <Menu className="size-5" />
                            </Button>

                            <div>
                                <h1 className="text-xl font-bold">
                                    File d’attente actuelle
                                </h1>

                                <p className="text-sm text-muted-foreground">
                                    Gestion intelligente des
                                    tickets
                                </p>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="flex items-center gap-4">
                            <div className="hidden rounded-2xl border bg-background px-4 py-2 md:flex md:items-center md:gap-3">
                                <Clock3 className="size-4 text-primary" />

                                <div className="text-sm">
                                    <p className="font-medium">
                                        06:05
                                    </p>

                                    <p className="text-xs text-muted-foreground">
                                        À l’agence
                                    </p>
                                </div>
                            </div>

                            <Button
                                size="icon"
                                className="relative rounded-2xl border bg-background shadow-sm hover:bg-muted"
                            >
                                <Bell className="size-5" />

                                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                            </Button>

                            <div className="flex items-center gap-3 rounded-2xl border bg-background px-3 py-2 shadow-sm">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
                                    <User2 className="size-5" />
                                </div>

                                <div className="hidden md:block">
                                    <p className="text-sm font-semibold">
                                        Agent
                                    </p>

                                    <p className="text-xs text-muted-foreground">
                                        guichetier
                                    </p>
                                </div>

                                <ChevronDown className="size-4 text-muted-foreground" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* CONTENT */}
                <div className="p-8">
                    {/* ACTIONS */}
                    <div className="mb-6 flex flex-wrap items-center gap-3">
                        <Button
                            className="rounded-2xl shadow"
                            onClick={() => setOpen(true)}
                        >
                            Changer de compteur
                        </Button>

                        {/* 🔥 compteur affiché ici */}
                        {counter && (
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white font-bold">
                                {counter.slice(-1)}
                            </div>
                        )}

                        <Button
                            onClick={() =>
                                setStatus((prev) =>
                                    prev === "READY" ? "NOT_READY" : "READY"
                                )
                            }
                            className={`rounded-2xl border transition-all ${status === "READY"
                                ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                                : "bg-red-500 text-white border-red-500 hover:bg-red-50"
                                }`}
                        >
                            {status === "READY" ? "Ready" : "Not Ready"}
                        </Button>
                        <Button className="rounded-2xl border bg-white text-black hover:bg-gray-50">
                            Hold Tickets
                        </Button>

                        <Button className="rounded-2xl border border-green-500 bg-white text-green-600 hover:bg-green-50">
                            Transfer Tickets
                        </Button>

                        <Button className="rounded-2xl border bg-white text-blue-600 hover:bg-blue-50">
                            Refresh
                        </Button>
                    </div>

                    {/* CURRENT QUEUE */}
                    <div className="mb-6">
                        <h2 className="mb-4 text-lg font-semibold">
                            Current Queue
                        </h2>

                        <div className="space-y-3">
                            {visibleTickets.map((t) => (
                                <QueueItem
                                    key={t.id}
                                    ticket={t}
                                    onCall={handleCall}
                                    openCompleteModal={openCompleteModal}
                                    openTransferModal={openTransferModal}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* MODAL */}
            <Dialog
                open={open}
                onOpenChange={setOpen}
            >
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            Sélectionner un compteur
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div className="flex items-center gap-3">
                            <Select
                                value={counter ?? ""}
                                onValueChange={setCounter}
                            >
                                <SelectTrigger className="h-12 w-full rounded-2xl">
                                    <SelectValue placeholder="Choisir un compteur" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="Compteur A">
                                        Compteur A
                                    </SelectItem>

                                    <SelectItem value="Compteur B">
                                        Compteur B
                                    </SelectItem>

                                    <SelectItem value="Compteur C">
                                        Compteur C
                                    </SelectItem>

                                    <SelectItem value="Compteur D">
                                        Compteur D
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                        </div>

                        <Button
                            className="h-12 w-full rounded-2xl"
                            onClick={handleConfirm}
                        //disabled={!counter}
                        >
                            Confirmer
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-3xl sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Confirmation de fin de service
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-4">
                        {remainingTime > 0 ? (
                            <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-700">
                                Veuillez continuer à servir le client

                                <div className="mt-2 font-bold">
                                    {Math.floor(remainingTime / 60)}:
                                    {(remainingTime % 60)
                                        .toString()
                                        .padStart(2, "0")}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-green-50 p-4 text-sm text-green-700">
                                Vous pouvez maintenant confirmer la fin du service.
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmOpen(false)}
                            >
                                Annuler
                            </Button>
                            <Button
                                disabled={remainingTime > 0}
                                onClick={confirmComplete}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Confirmer
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogContent className="sm:max-w-lg rounded-3xl border-0 p-0 overflow-hidden">
                    {/* HEADER */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white">
                        <DialogTitle className="text-xl font-bold">
                            Transfer Ticket
                        </DialogTitle>

                        <p className="text-sm text-orange-100 mt-1">
                            Transférer le ticket vers un autre service ou agent
                        </p>
                    </div>

                    {/* BODY */}
                    <div className="p-6 space-y-5">
                        {/* TICKET */}
                        <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4">
                            <p className="text-sm text-primary">
                                Ticket sélectionné
                            </p>

                            <h2 className="text-2xl font-bold text-primary">
                                {transferTicket}
                            </h2>
                        </div>

                        {/* SERVICE */}
                        <div className="space-y-5">
                            <label className="text-sm font-medium">
                                Service
                            </label>

                            <Select
                                value={transferService}
                                onValueChange={(value) =>
                                    setTransferService(value ?? "")
                                }
                            >
                                <SelectTrigger className="h-12 rounded-md w-full">
                                    <SelectValue placeholder="Choisir un service" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="Depot">
                                        Depot
                                    </SelectItem>

                                    <SelectItem value="Retrait">
                                        Retrait
                                    </SelectItem>

                                    <SelectItem value="Support">
                                        Support
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* AGENT */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Agent
                            </label>

                            <Select
                                value={transferAgent}
                                onValueChange={(value) =>
                                    setTransferAgent(value ?? "")
                                }
                            >
                                <SelectTrigger className="h-12 rounded-md w-full">
                                    <SelectValue placeholder="Choisir un agent" />
                                </SelectTrigger>

                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem
                                            key={agent.id}
                                            value={agent.name}
                                            disabled={agent.status === "NOT_READY"}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>{agent.name}</span>

                                                <span
                                                    className={`
                                rounded-full px-2 py-0.5 text-[10px] font-medium
                                ${agent.status === "READY"
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                        }
                            `}
                                                >
                                                    {agent.status}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedAgentData && (
                                <div
                                    className={`
                rounded-2xl p-3 text-sm border
                ${selectedAgentData.status === "READY"
                                            ? "bg-green-50 border-green-200 text-green-700"
                                            : "bg-red-50 border-red-200 text-red-700"
                                        }
            `}
                                >
                                    {selectedAgentData.status === "READY"
                                        ? "Agent disponible pour le transfert"
                                        : "Agent indisponible actuellement"}
                                </div>
                            )}
                        </div>

                        {/* REASON */}

                        <div className="space-y-5">
                            <label className="text-sm font-medium">
                                Raison du transfert
                            </label>

                            <Select
                                value={transferReason}
                                onValueChange={(value) =>
                                    setTransferReason(value ?? "")
                                }
                            >
                                <SelectTrigger className="h-12 rounded-md w-full">
                                    <SelectValue placeholder="Choisir un service" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="piece">
                                        Pièce d'identité manquante
                                    </SelectItem>

                                    <SelectItem value="besoin">
                                        Besoin physiologique
                                    </SelectItem>

                                    <SelectItem value="manque">
                                        Manque de billet / fonds
                                    </SelectItem>

                                    <SelectItem value="autre">
                                        Autre
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* ACTIONS */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setTransferOpen(false)}
                                className="rounded-2xl"
                            >
                                Annuler
                            </Button>

                            <Button
                                disabled={
                                    !transferService ||
                                    !transferAgent ||
                                    !transferReason
                                }
                                className="rounded-2xl bg-blue-500 hover:bg-blue-600"
                                onClick={() => {
                                    console.log({
                                        ticket: transferTicket,
                                        service: transferService,
                                        agent: transferAgent,
                                        reason: transferReason,
                                    });

                                    setTransferOpen(false);
                                }}
                            >
                                Confirmer le transfert
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}


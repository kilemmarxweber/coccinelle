"use client";

import {
    PhoneCall,
    Repeat,
    PauseCircle,
    ArrowRightLeft,
    CheckCircle2,
    XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Ticket = {
    id: string;
    active: boolean;
    status: string;
    recalled: boolean;
    order: number;
    startedAt: number | null;
};

type QueueItemProps = {
    ticket: Ticket;
    onCall: (id: string) => void;
    openCompleteModal: (id: string) => void;
    openTransferModal: (id: string) => void;
};

export default function QueueItem({
    ticket,
    onCall,
    openCompleteModal,
    openTransferModal,
}: QueueItemProps) {
    return (
        <div
            className={`
                rounded-2xl border p-4 flex flex-col gap-3 bg-white
                ${ticket.active ? "border-green-500 shadow-md" : ""}
            `}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <p className="font-bold text-lg">{ticket.id}</p>

                    <span className="rounded-xl bg-gray-100 px-2 py-1 text-xs">
                        DEPOT
                    </span>

                    <span className="text-xs text-muted-foreground">
                        Regular
                    </span>
                </div>

                {ticket.active && (
                    <span className="text-xs font-medium text-green-600">
                        Active
                    </span>
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    onClick={() => onCall(ticket.id)}
                    disabled={!ticket.active}
                    className="border w-[80px] flex items-center gap-2"
                >
                    <PhoneCall className="size-4" />
                    Call
                </Button>

                <Button
                    size="sm"
                    disabled={!ticket.recalled}
                    className="border bg-primary/50 text-black flex items-center gap-2"
                >
                    <Repeat className="size-4" />
                    Recall
                </Button>

                <Button
                    size="sm"
                    disabled={!ticket.recalled}
                    className="rounded-xl border bg-yellow-300 text-black hover:bg-yellow-100 flex items-center gap-2"
                >
                    <PauseCircle className="size-4" />
                    Hold
                </Button>

                <Button
                    size="sm"
                    disabled={!ticket.recalled}
                    onClick={() => openTransferModal(ticket.id)}
                    className="rounded-xl border border-orange-300 bg-white text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                >
                    <ArrowRightLeft className="size-4" />
                    Transfer
                </Button>

                <Button
                    size="sm"
                    disabled={!ticket.recalled}
                    onClick={() => openCompleteModal(ticket.id)}
                    className="rounded-xl border border-green-300 bg-white text-green-600 hover:bg-green-50 flex items-center gap-2"
                >
                    <CheckCircle2 className="size-4" />
                    Complete
                </Button>

                <Button
                    size="sm"
                    disabled={!ticket.recalled}
                    className="rounded-xl border border-red-300 bg-white text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                    <XCircle className="size-4" />
                    Cancel
                </Button>
            </div>
        </div>
    );
}
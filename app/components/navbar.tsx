"use client";

import Link from "next/link";
import { useState } from "react";
import {
    ArrowRight,
    Plane,
    Bus,
    Package,
    Menu,
    X,
    ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const [servicesOpen, setServicesOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 px-4 pt-4">
            <div
                className={`
          mx-auto max-w-6xl overflow-hidden
          rounded-3xl border bg-background/80
          backdrop-blur-xl shadow-lg
          transition-all duration-500
          ${servicesOpen ? "pb-4" : "pb-0"}
        `}
                onMouseLeave={() => setServicesOpen(false)}
            >
                {/* Top Navbar */}
                <div className="flex h-16 items-center justify-between px-6">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3">
                        <div className="rounded-2xl bg-primary p-2 shadow">
                            <Plane className="size-5 text-primary-foreground" />
                        </div>

                        <div>
                            <h1 className="text-lg font-bold leading-none">Coccinelle</h1>
                            <p className="text-xs text-muted-foreground">
                                Voyage intelligent RDC
                            </p>
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link
                            href="/"
                            className="text-sm font-medium hover:text-primary transition"
                        >
                            Accueil
                        </Link>

                        <Link
                            href="/trajets"
                            className="text-sm font-medium hover:text-primary transition"
                        >
                            Trajets
                        </Link>

                        {/* Animated Expand Menu */}
                        <button
                            onMouseEnter={() => setServicesOpen(true)}
                            className="flex items-center gap-1 text-sm font-medium hover:text-primary transition"
                        >
                            Services
                            <ChevronDown
                                className={`
                  size-4 transition-transform duration-300
                  ${servicesOpen ? "rotate-180" : ""}
                `}
                            />
                        </button>

                        <Link
                            href="/agences"
                            className="text-sm font-medium hover:text-primary transition"
                        >
                            Agences
                        </Link>
                    </nav>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-2">
                        <Button variant="outline" size="sm">
                            <Link href="/auth/sign-in">Se connectez</Link>
                        </Button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setOpen(!open)}
                        className="md:hidden rounded-xl border p-2"
                    >
                        {open ? <X className="size-5" /> : <Menu className="size-5" />}
                    </button>
                </div>

                {/* EXPANDABLE SERVICES PANEL */}
                <div
                    className={`
            grid transition-all duration-500 ease-in-out
            ${servicesOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}
          `}
                >
                    <div className="overflow-hidden">
                        <div className="border-t px-6 py-5">
                            <div className="grid grid-cols-3 gap-4">
                                {/* Vols */}
                                <Link
                                    href="/vols"
                                    className="
                    group rounded-2xl border p-4
                    hover:bg-muted/60
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:shadow-lg
                  "
                                >
                                    <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10">
                                        <Plane className="size-5 text-primary" />
                                    </div>

                                    <h3 className="font-semibold">Billets d’avion</h3>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Réservez des vols nationaux rapidement.
                                    </p>
                                </Link>

                                {/* Bus */}
                                <Link
                                    href="/bus"
                                    className="
                    group rounded-2xl border p-4
                    hover:bg-muted/60
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:shadow-lg
                  "
                                >
                                    <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10">
                                        <Bus className="size-5 text-primary" />
                                    </div>

                                    <h3 className="font-semibold">Transport Bus</h3>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Voyagez partout en RDC à petit prix.
                                    </p>
                                </Link>

                                {/* Colis */}
                                <Link
                                    href="/colis"
                                    className="
                    group rounded-2xl border p-4
                    hover:bg-muted/60
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:shadow-lg
                  "
                                >
                                    <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10">
                                        <Package className="size-5 text-primary" />
                                    </div>

                                    <h3 className="font-semibold">Expédition Colis</h3>

                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Envoyez vos colis en toute sécurité.
                                    </p>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {open && (
                    <div className="border-t bg-background md:hidden">
                        <div className="space-y-1 p-4">
                            <Link
                                href="/"
                                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                            >
                                Accueil
                            </Link>

                            <Link
                                href="/trajets"
                                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                            >
                                Trajets
                            </Link>

                            <Link
                                href="/vols"
                                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                            >
                                Vols
                            </Link>

                            <Link
                                href="/bus"
                                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                            >
                                Bus
                            </Link>

                            <Link
                                href="/colis"
                                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                            >
                                Colis
                            </Link>

                            <Link
                                href="/agences"
                                className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                            >
                                Agences
                            </Link>

                            <div className="flex gap-2 pt-3">
                                <Button variant="outline" className="w-full">
                                    <Link href="/auth/sign-in">Connexion</Link>
                                </Button>

                                <Button className="w-full">
                                    <Link href="/auth/sign-up">Inscription</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
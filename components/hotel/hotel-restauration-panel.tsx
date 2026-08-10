"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChefHat,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMontantFc } from "@/lib/reservation/labels";
import type {
  FnbFormOptions,
  FoodOrderView,
  MenuCategoryView,
  RestaurantTableView,
} from "@/lib/hotel/list-fnb";
import type { TableReservationView } from "@/lib/hotel/list-table-reservations";
import { HotelTableReservationsAdmin } from "@/components/hotel/hotel-table-reservations-admin";
import {
  HOTEL_FOOD_ORDER_PRIMARY_ACTION_LABEL,
  HOTEL_FOOD_ORDER_STATUS_BADGE_CLASS,
  HOTEL_FOOD_ORDER_STATUS_LABELS,
  type HotelFoodOrderStatusValue,
} from "@/lib/hotel/food-order-status";
import {
  HOTEL_RESTAURANT_TABLE_STATUSES,
  HOTEL_RESTAURANT_TABLE_STATUS_BADGE_CLASS,
  HOTEL_RESTAURANT_TABLE_STATUS_LABELS,
  type HotelRestaurantTableStatusValue,
} from "@/lib/hotel/table-status";
import {
  advanceFoodOrderStatusAction,
  createFoodOrderAction,
  createMenuCategoryAction,
  createMenuItemAction,
  createRestaurantTableAction,
  deleteMenuCategoryAction,
  deleteMenuItemAction,
  deleteRestaurantTableAction,
  updateMenuItemAction,
  updateRestaurantTableAction,
} from "@/lib/hotel/fnb-actions";
import {
  HOTEL_PAYMENT_METHODS,
  HOTEL_PAYMENT_METHOD_LABELS,
  type HotelPaymentMethod,
} from "@/lib/hotel/payment-method";
import { recordFoodOrderPaymentAction } from "@/lib/hotel/payment-actions";

type Props = {
  organizationId: string;
  branchId: string;
  categories: MenuCategoryView[];
  orders: FoodOrderView[];
  tables: RestaurantTableView[];
  tableReservations: TableReservationView[];
  formOptions: FnbFormOptions;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
};

export function HotelRestaurationPanel({
  organizationId,
  branchId,
  categories,
  orders,
  tables,
  tableReservations,
  formOptions,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Restauration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carte, commandes sur place, file cuisine et réservations de table
        </p>
      </header>

      <Tabs defaultValue="carte">
        <TabsList>
          <TabsTrigger value="carte">Carte</TabsTrigger>
          <TabsTrigger value="commandes">
            Commandes
            {orders.length > 0 ? (
              <span className="ml-1.5 rounded-md bg-background/80 px-1.5 text-xs tabular-nums">
                {orders.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="reservations">
            Réservations
            {tableReservations.length > 0 ? (
              <span className="ml-1.5 rounded-md bg-background/80 px-1.5 text-xs tabular-nums">
                {tableReservations.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
        </TabsList>

        <TabsContent value="carte" className="mt-4">
          <CarteTab
            organizationId={organizationId}
            branchId={branchId}
            categories={categories}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </TabsContent>

        <TabsContent value="commandes" className="mt-4">
          <CommandesTab
            organizationId={organizationId}
            branchId={branchId}
            orders={orders}
            formOptions={formOptions}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <HotelTableReservationsAdmin
            organizationId={organizationId}
            branchId={branchId}
            reservations={tableReservations}
            formOptions={formOptions}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        </TabsContent>

        <TabsContent value="tables" className="mt-4">
          <TablesTab
            organizationId={organizationId}
            branchId={branchId}
            tables={tables}
            canCreate={canCreate}
            canUpdate={canUpdate}
            canDelete={canDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CarteTab({
  organizationId,
  branchId,
  categories,
  canCreate,
  canUpdate,
  canDelete,
}: {
  organizationId: string;
  branchId: string;
  categories: MenuCategoryView[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActive(itemId: string, categoryId: string, active: boolean) {
    const category = categories.find((c) => c.id === categoryId);
    const item = category?.items.find((i) => i.id === itemId);
    if (!item) return;
    startTransition(async () => {
      const result = await updateMenuItemAction({
        organizationId,
        branchId,
        itemId,
        categoryId,
        name: item.name,
        description: item.description ?? undefined,
        price: item.price,
        active: !active,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(active ? "Plat désactivé" : "Plat activé");
      router.refresh();
    });
  }

  function removeCategory(categoryId: string) {
    startTransition(async () => {
      const result = await deleteMenuCategoryAction({
        organizationId,
        branchId,
        categoryId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Catégorie supprimée");
      router.refresh();
    });
  }

  function removeItem(itemId: string) {
    startTransition(async () => {
      const result = await deleteMenuItemAction({
        organizationId,
        branchId,
        itemId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Plat supprimé");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {canCreate ? (
          <>
            <CreateCategoryDialog
              organizationId={organizationId}
              branchId={branchId}
            />
            <CreateItemDialog
              organizationId={organizationId}
              branchId={branchId}
              categories={categories}
            />
          </>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <UtensilsCrossed className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Carte vide</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Créez une catégorie puis ajoutez des plats (prix en CDF).
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map((category) => (
            <section key={category.id} className="rounded-xl border">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="font-medium">{category.name}</h2>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => removeCategory(category.id)}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                ) : null}
              </div>
              {category.items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Aucun plat dans cette catégorie.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plat</TableHead>
                      <TableHead>Prix</TableHead>
                      <TableHead>Statut</TableHead>
                      {(canUpdate || canDelete) && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {category.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.name}</p>
                          {item.description ? (
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatMontantFc(item.price)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.active
                                ? "border-transparent bg-success/20 text-emerald-800 dark:text-emerald-200"
                                : "border-transparent bg-muted text-muted-foreground"
                            }
                          >
                            {item.active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        {(canUpdate || canDelete) && (
                          <TableCell className="text-right">
                            <div className="inline-flex gap-1">
                              {canUpdate ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() =>
                                    toggleActive(
                                      item.id,
                                      category.id,
                                      item.active,
                                    )
                                  }
                                >
                                  {item.active ? "Désactiver" : "Activer"}
                                </Button>
                              ) : null}
                              {canDelete ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandesTab({
  organizationId,
  branchId,
  orders,
  formOptions,
  canCreate,
  canUpdate,
}: {
  organizationId: string;
  branchId: string;
  orders: FoodOrderView[];
  formOptions: FnbFormOptions;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function advance(orderId: string) {
    startTransition(async () => {
      const result = await advanceFoodOrderStatusAction({
        organizationId,
        branchId,
        orderId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Statut mis à jour");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          File cuisine : nouvelle → en préparation → prête → servie
        </p>
        {canCreate ? (
          <CreateOrderDialog
            organizationId={organizationId}
            branchId={branchId}
            formOptions={formOptions}
          />
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <ChefHat className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Aucune commande en cours</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Enregistrez une commande sur place pour la file cuisine.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const status = order.status as HotelFoodOrderStatusValue;
            const actionLabel =
              status === "SERVED"
                ? null
                : HOTEL_FOOD_ORDER_PRIMARY_ACTION_LABEL[status];
            return (
              <article
                key={order.id}
                className="flex flex-col gap-3 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn(HOTEL_FOOD_ORDER_STATUS_BADGE_CLASS[status])}
                  >
                    {HOTEL_FOOD_ORDER_STATUS_LABELS[status]}
                  </Badge>
                  <time className="text-xs text-muted-foreground tabular-nums">
                    {new Date(order.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <ul className="space-y-1 text-sm">
                  {order.lines.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span>
                        {line.quantity}× {line.name}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMontantFc(line.unitPrice * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-muted-foreground">
                  {order.tableNumber ? (
                    <p>Table {order.tableNumber}</p>
                  ) : null}
                  {order.stayGuestName ? (
                    <p>
                      Séjour : {order.stayGuestName}
                      {order.stayRoomNumber
                        ? ` · ch. ${order.stayRoomNumber}`
                        : ""}
                    </p>
                  ) : null}
                  {order.notes ? <p>Note : {order.notes}</p> : null}
                </div>
                <div className="mt-auto flex flex-col gap-2 border-t pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-medium tabular-nums">
                        {formatMontantFc(order.totalAmount)}
                      </span>
                      {order.billedToFolio ? (
                        <p className="text-xs text-muted-foreground">
                          Facturé au folio séjour
                        </p>
                      ) : order.balanceAmount <= 0 ? (
                        <p className="text-xs text-success">Ticket soldé</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Solde {formatMontantFc(order.balanceAmount)}
                        </p>
                      )}
                    </div>
                    {canUpdate && actionLabel ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => advance(order.id)}
                      >
                        {actionLabel}
                      </Button>
                    ) : null}
                  </div>
                  {canUpdate &&
                  !order.billedToFolio &&
                  order.balanceAmount > 0 ? (
                    <FoodOrderPayButton
                      organizationId={organizationId}
                      branchId={branchId}
                      orderId={order.id}
                      balanceAmount={order.balanceAmount}
                    />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FoodOrderPayButton({
  organizationId,
  branchId,
  orderId,
  balanceAmount,
}: {
  organizationId: string;
  branchId: string;
  orderId: string;
  balanceAmount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<HotelPaymentMethod>("CASH");

  function onPay() {
    startTransition(async () => {
      const result = await recordFoodOrderPaymentAction({
        organizationId,
        branchId,
        foodOrderId: orderId,
        amount: balanceAmount,
        method,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Paiement enregistré");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant="outline" disabled={pending} />
        }
      >
        Encaisser
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encaisser la commande</DialogTitle>
          <DialogDescription>
            Solde {formatMontantFc(balanceAmount)} — Espèces / Mobile Money /
            Carte (sans session de caisse).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fnb-pay-${orderId}`}>Mode de paiement</Label>
          <Select
            id={`fnb-pay-${orderId}`}
            value={method}
            disabled={pending}
            onChange={(e) => setMethod(e.target.value as HotelPaymentMethod)}
          >
            {HOTEL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {HOTEL_PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Annuler
          </Button>
          <Button type="button" disabled={pending} onClick={onPay}>
            {pending ? "Enregistrement…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TablesTab({
  organizationId,
  branchId,
  tables,
  canCreate,
  canUpdate,
  canDelete,
}: {
  organizationId: string;
  branchId: string;
  tables: RestaurantTableView[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function removeTable(tableId: string) {
    startTransition(async () => {
      const result = await deleteRestaurantTableAction({
        organizationId,
        branchId,
        tableId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Table supprimée");
      router.refresh();
    });
  }

  function updateStatus(
    table: RestaurantTableView,
    status: HotelRestaurantTableStatusValue,
  ) {
    startTransition(async () => {
      const result = await updateRestaurantTableAction({
        organizationId,
        branchId,
        tableId: table.id,
        number: table.number,
        capacity: table.capacity,
        status,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Table mise à jour");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Inventaire des tables (préparation réservation en ligne).
        </p>
        {canCreate ? (
          <CreateTableDialog
            organizationId={organizationId}
            branchId={branchId}
          />
        ) : null}
      </div>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <UtensilsCrossed className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Aucune table</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Ajoutez les tables de la salle (numéro et capacité).
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Statut</TableHead>
                {(canUpdate || canDelete) && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-medium">{table.number}</TableCell>
                  <TableCell>{table.capacity} places</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        HOTEL_RESTAURANT_TABLE_STATUS_BADGE_CLASS[table.status],
                      )}
                    >
                      {HOTEL_RESTAURANT_TABLE_STATUS_LABELS[table.status]}
                    </Badge>
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2">
                        {canUpdate ? (
                          <Select
                            className="w-40"
                            value={table.status}
                            disabled={pending}
                            onChange={(e) =>
                              updateStatus(
                                table,
                                e.target
                                  .value as HotelRestaurantTableStatusValue,
                              )
                            }
                          >
                            {HOTEL_RESTAURANT_TABLE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {HOTEL_RESTAURANT_TABLE_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </Select>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => removeTable(table.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateCategoryDialog({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createMenuCategoryAction({
        organizationId,
        branchId,
        name,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Catégorie créée");
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="size-4" />
        Catégorie
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouvelle catégorie</DialogTitle>
            <DialogDescription>
              Ex. Entrées, Plats, Boissons.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="cat-name">Nom</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={pending}
            />
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateItemDialog({
  organizationId,
  branchId,
  categories,
}: {
  organizationId: string;
  branchId: string;
  categories: MenuCategoryView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createMenuItemAction({
        organizationId,
        branchId,
        categoryId,
        name,
        description: description || undefined,
        price: Number(price),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Plat ajouté à la carte");
      setOpen(false);
      setName("");
      setDescription("");
      setPrice("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={categories.length === 0} />
        }
      >
        <Plus className="size-4" />
        Plat
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouveau plat</DialogTitle>
            <DialogDescription>Prix affiché en CDF.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-cat">Catégorie</Label>
              <Select
                id="item-cat"
                value={categoryId}
                disabled={pending || categories.length === 0}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-name">Nom</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-desc">Description (optionnel)</Label>
              <Textarea
                id="item-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
                rows={2}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-price">Prix (CDF)</Label>
              <Input
                id="item-price"
                type="number"
                min={0}
                step={100}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                disabled={pending}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="submit"
              disabled={pending || !categoryId || !name.trim() || price === ""}
            >
              {pending ? "Création…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateOrderDialog({
  organizationId,
  branchId,
  formOptions,
}: {
  organizationId: string;
  branchId: string;
  formOptions: FnbFormOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [stayId, setStayId] = useState("");
  const [tableId, setTableId] = useState("");
  const [notes, setNotes] = useState("");
  const [menuItemId, setMenuItemId] = useState(
    formOptions.activeItems[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<
    Array<{ menuItemId: string; quantity: number; name: string; price: number }>
  >([]);

  const itemById = useMemo(() => {
    return new Map(formOptions.activeItems.map((i) => [i.id, i]));
  }, [formOptions.activeItems]);

  function addLine() {
    const item = itemById.get(menuItemId);
    if (!item) return;
    const qty = Math.max(1, Number.parseInt(quantity, 10) || 1);
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id
            ? { ...l, quantity: l.quantity + qty }
            : l,
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          quantity: qty,
          name: item.name,
          price: item.price,
        },
      ];
    });
  }

  function resetForm() {
    setStayId("");
    setTableId("");
    setNotes("");
    setMenuItemId(formOptions.activeItems[0]?.id ?? "");
    setQuantity("1");
    setLines([]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createFoodOrderAction({
        organizationId,
        branchId,
        stayId: stayId || undefined,
        tableId: tableId || undefined,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
        })),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Commande enregistrée");
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button disabled={formOptions.activeItems.length === 0} />
        }
      >
        <Plus className="size-4" />
        Nouvelle commande
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Commande sur place</DialogTitle>
            <DialogDescription>
              Saisie serveur / enregistrement — la commande part en file cuisine.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-table">Table (optionnel)</Label>
                <Select
                  id="order-table"
                  value={tableId}
                  disabled={pending}
                  onChange={(e) => setTableId(e.target.value)}
                >
                  <option value="">Sans table</option>
                  {formOptions.tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number} ({t.capacity} pl.)
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-stay">Séjour (optionnel)</Label>
                <Select
                  id="order-stay"
                  value={stayId}
                  disabled={pending}
                  onChange={(e) => setStayId(e.target.value)}
                >
                  <option value="">Sans folio</option>
                  {formOptions.inHouseStays.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.guestName}
                      {s.roomNumber ? ` · ch. ${s.roomNumber}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_5rem_auto]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-item">Plat</Label>
                <Select
                  id="order-item"
                  value={menuItemId}
                  disabled={pending || formOptions.activeItems.length === 0}
                  onChange={(e) => setMenuItemId(e.target.value)}
                >
                  {formOptions.activeItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.categoryName} — {item.name} (
                      {formatMontantFc(item.price)})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="order-qty">Qté</Label>
                <Input
                  id="order-qty"
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || !menuItemId}
                  onClick={addLine}
                >
                  Ajouter
                </Button>
              </div>
            </div>

            {lines.length > 0 ? (
              <ul className="space-y-1 rounded-lg border px-3 py-2 text-sm">
                {lines.map((line) => (
                  <li
                    key={line.menuItemId}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {line.quantity}× {line.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">
                        {formatMontantFc(line.price * line.quantity)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.menuItemId !== line.menuItemId),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ajoutez au moins un plat.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="order-notes">Note (optionnel)</Label>
              <Textarea
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || lines.length === 0}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateTableDialog({
  organizationId,
  branchId,
}: {
  organizationId: string;
  branchId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState("2");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createRestaurantTableAction({
        organizationId,
        branchId,
        number,
        capacity: Number(capacity),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Table créée");
      setOpen(false);
      setNumber("");
      setCapacity("2");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nouvelle table
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouvelle table</DialogTitle>
            <DialogDescription>
              Numéro et capacité pour la salle.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-number">Numéro</Label>
              <Input
                id="table-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-capacity">Capacité</Label>
              <Input
                id="table-capacity"
                type="number"
                min={1}
                max={50}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                required
                disabled={pending}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !number.trim()}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

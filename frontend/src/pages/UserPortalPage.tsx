import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListUsersQueryOptions,
  getListProductsQueryOptions,
  getGetUserBalancesQueryOptions,
  getGetUserBalancesQueryKey,
  getGetUserActivationsQueryOptions,
  getGetUserActivationsQueryKey,
  useActivateVoucher,
} from "../api/generated/endpoints";
import type {
  UserDto,
  ProductDto,
  VoucherBalanceDto,
  ActivationHistoryItemDto,
  ErrorResponse,
} from "../api/generated/models";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import {
  Ticket,
  User,
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  ShieldCheck,
} from "lucide-react";

interface UserPortalPageProps {
  navigate: (to: string) => void;
  addToast: (type: "success" | "error" | "info", title: string, message: string) => void;
}

export function UserPortalPage({ navigate, addToast }: UserPortalPageProps) {
  const queryClient = useQueryClient();

  // Selected active user
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Per-button activation spinner state
  const [activatingProductId, setActivatingProductId] = useState<string | null>(null);

  // Queries
  const {
    data: usersResponse,
    isLoading: isUsersLoading,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useQuery(getListUsersQueryOptions());

  const users: UserDto[] = useMemo(() => {
    if (usersResponse && "data" in usersResponse && Array.isArray(usersResponse.data)) {
      return usersResponse.data as UserDto[];
    }
    return [];
  }, [usersResponse]);

  const {
    data: productsResponse,
    isLoading: isProductsLoading,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useQuery(getListProductsQueryOptions());

  const products: ProductDto[] = useMemo(() => {
    if (productsResponse && "data" in productsResponse && Array.isArray(productsResponse.data)) {
      return productsResponse.data as ProductDto[];
    }
    return [];
  }, [productsResponse]);

  // Set default selected user
  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  // Balances query
  const {
    data: balancesResponse,
    isLoading: isBalancesLoading,
    isError: isBalancesError,
    refetch: refetchBalances,
  } = useQuery(
    getGetUserBalancesQueryOptions(selectedUserId, {
      query: { enabled: Boolean(selectedUserId) },
    }),
  );

  const balances: VoucherBalanceDto[] = useMemo(() => {
    if (balancesResponse && "data" in balancesResponse && Array.isArray(balancesResponse.data)) {
      return balancesResponse.data as VoucherBalanceDto[];
    }
    return [];
  }, [balancesResponse]);

  // Map of balances by product_id
  const balancesByProductId = useMemo(() => {
    const map = new Map<string, VoucherBalanceDto>();
    for (const b of balances) {
      map.set(b.product_id, b);
    }
    return map;
  }, [balances]);

  // Display items: use products if available to maintain identical cards without layout shifts
  const displayItems = useMemo(() => {
    if (products.length > 0) {
      return products.map((p) => {
        const balance = balancesByProductId.get(p.id);
        return {
          productId: p.id,
          productName: p.name,
          quantity: balance?.quantity ?? null,
          hasBalance: balance !== undefined,
        };
      });
    }
    if (balances.length > 0) {
      return balances.map((b) => ({
        productId: b.product_id,
        productName: b.product_name,
        quantity: b.quantity,
        hasBalance: true,
      }));
    }
    return [];
  }, [products, balances, balancesByProductId]);

  // Activations history query
  const {
    data: activationsResponse,
    isLoading: isActivationsLoading,
    isError: isActivationsError,
    refetch: refetchActivations,
  } = useQuery(
    getGetUserActivationsQueryOptions(selectedUserId, {
      query: { enabled: Boolean(selectedUserId) },
    }),
  );

  const activations: ActivationHistoryItemDto[] = useMemo(() => {
    if (activationsResponse && "data" in activationsResponse && Array.isArray(activationsResponse.data)) {
      return activationsResponse.data as ActivationHistoryItemDto[];
    }
    return [];
  }, [activationsResponse]);

  // Mutation
  const activateVoucherMutation = useActivateVoucher();

  // Handler for activating voucher
  const handleActivate = async (productId: string, productName: string) => {
    if (!selectedUserId) return;
    setActivatingProductId(productId);

    try {
      await activateVoucherMutation.mutateAsync({
        userId: selectedUserId,
        data: { product_id: productId },
      });

      addToast(
        "success",
        "Активация успешна",
        `Ваучер на «${productName}» успешно активирован!`,
      );

      // Invalidate balances and history
      queryClient.invalidateQueries({
        queryKey: getGetUserBalancesQueryKey(selectedUserId),
      });
      queryClient.invalidateQueries({
        queryKey: getGetUserActivationsQueryKey(selectedUserId),
      });
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      if (error?.code === "NO_VOUCHERS_LEFT") {
        addToast(
          "error",
          "Нет ваучеров",
          `Ваучеры на «${productName}» закончились.`,
        );
      } else {
        addToast(
          "error",
          "Ошибка активации",
          error?.message || "Не удалось активировать ваучер.",
        );
      }
    } finally {
      setActivatingProductId(null);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const totalVouchers = balances.reduce((sum, b) => sum + (b.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 font-sans text-foreground">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Сервис ваучеров</h1>
              <p className="text-xs text-muted-foreground">Клиентский портал активации услуг</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin")}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/5 font-medium"
            >
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Панель администратора</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* User Selector Banner */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div>
              <label htmlFor="user-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Текущий пользователь
              </label>
              <div className="mt-1 flex items-center gap-2">
                {isUsersLoading ? (
                  <Skeleton className="h-9 w-48" />
                ) : (
                  <select
                    id="user-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="font-medium text-base bg-transparent border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                )}
                {selectedUser && (
                  <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                    {selectedUser.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Всего ваучеров</div>
              <div className="text-2xl font-bold tracking-tight text-primary flex items-center justify-end h-8">
                {isBalancesLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span>{totalVouchers}</span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchBalances();
                refetchActivations();
              }}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Обновить</span>
            </Button>
          </div>
        </div>

        {/* Global errors if users or products failed */}
        {(isUsersError || isProductsError) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ошибка соединения с сервером</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>Не удалось загрузить справочники пользователей или продуктов.</span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  refetchUsers();
                  refetchProducts();
                }}
              >
                Повторить
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Two Columns Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Voucher Balances */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Баланс по продуктам</h2>
              </div>
              <Badge variant="secondary">
                {displayItems.length > 0
                  ? `${displayItems.length} продуктов`
                  : products.length > 0
                    ? `${products.length} продуктов`
                    : "..."}
              </Badge>
            </div>

            {isBalancesError && displayItems.length === 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Ошибка загрузки баланса</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>Не удалось получить балансы ваучеров.</span>
                  <Button variant="outline" size="xs" onClick={() => refetchBalances()}>
                    Повторить
                  </Button>
                </AlertDescription>
              </Alert>
            ) : displayItems.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Card
                    key={i}
                    className="border-2 border-border/60 py-0 gap-0 min-h-[162px] h-full flex flex-col justify-between shadow-xs"
                  >
                    <CardHeader className="p-4 pb-2 flex flex-col gap-1">
                      <Skeleton className="h-5 w-4/5 my-1" />
                      <Skeleton className="h-3.5 w-1/3" />
                    </CardHeader>
                    <CardContent className="p-4 pt-2 flex items-center justify-between gap-2 mt-auto">
                      <div className="space-y-1">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-6 w-16 rounded-md" />
                      </div>
                      <Skeleton className="h-9 w-28 rounded-md" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayItems.map((item) => {
                  const isCardLoading = isBalancesLoading || !item.hasBalance;
                  const quantity = item.quantity ?? 0;
                  const isZero = !isCardLoading && quantity === 0;
                  const isActivating =
                    activatingProductId === item.productId && activateVoucherMutation.isPending;

                  return (
                    <Card
                      key={item.productId}
                      className={`transition-all duration-200 border-2 py-0 gap-0 min-h-[162px] h-full flex flex-col justify-between ${
                        isCardLoading
                          ? "border-border shadow-xs opacity-90"
                          : isZero
                            ? "border-dashed opacity-80 hover:opacity-100"
                            : "border-border shadow-xs hover:shadow-md hover:border-primary/40"
                      }`}
                    >
                      <CardHeader className="p-4 pb-2 flex flex-col gap-1">
                        <CardTitle className="text-base font-semibold leading-snug min-h-[2.75rem] line-clamp-2">
                          {item.productName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          ID: {item.productId.substring(0, 8)}...
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 flex items-center justify-between gap-2 mt-auto">
                        <div>
                          <span className="text-xs text-muted-foreground block mb-0.5">
                            Остаток:
                          </span>
                          {isCardLoading ? (
                            <Skeleton className="h-6 w-16 rounded-md" />
                          ) : (
                            <Badge
                              variant={isZero ? "secondary" : "success"}
                              className="text-sm font-bold px-2.5 py-0.5 inline-flex items-center justify-center min-w-[54px]"
                            >
                              {quantity} шт.
                            </Badge>
                          )}
                        </div>

                        {isCardLoading ? (
                          <Skeleton className="h-9 w-28 rounded-md" />
                        ) : (
                          <Button
                            size="sm"
                            disabled={isZero || isActivating}
                            onClick={() => handleActivate(item.productId, item.productName)}
                            className="font-medium min-w-[124px]"
                          >
                            {isActivating ? (
                              <RotateCcw className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                            )}
                            {isActivating ? "Списание..." : "Активировать"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Activation History */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">История активаций</h2>
              </div>
              <Badge variant="outline">{activations.length} записей</Badge>
            </div>

            <Card className="shadow-xs overflow-hidden">
              <CardHeader className="p-4 border-b bg-muted/20">
                <CardDescription className="text-xs">
                  Хронология списания ваучеров (новые сверху)
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {isActivationsLoading ? (
                  <div className="divide-y">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isActivationsError ? (
                  <div className="p-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Ошибка загрузки истории</AlertTitle>
                      <AlertDescription className="flex items-center justify-between">
                        <span>Не удалось загрузить историю.</span>
                        <Button variant="outline" size="xs" onClick={() => refetchActivations()}>
                          Повторить
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : activations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground space-y-2">
                    <Layers className="w-8 h-8 mx-auto opacity-40" />
                    <p className="text-sm font-medium">История пуста</p>
                    <p className="text-xs opacity-75">
                      У выбранного пользователя пока нет выполненных активаций.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y max-h-[560px] overflow-y-auto">
                    {activations.map((item) => {
                      const dateObj = new Date(item.activated_at);
                      const formattedDate = dateObj.toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      });
                      const formattedTime = dateObj.toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      return (
                        <li
                          key={item.id}
                          className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formattedDate} в {formattedTime}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">
                              ID: {item.id}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default UserPortalPage;

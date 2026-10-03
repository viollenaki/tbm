import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getListUsersQueryOptions,
  getListProductsQueryOptions,
  getGetUserBalancesQueryOptions,
  getGetUserBalancesQueryKey,
  getGetUserActivationsQueryOptions,
  useSetVoucherBalance,
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
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "../components/ui/alert";
import {
  ShieldCheck,
  User,
  RotateCcw,
  Search,
  ArrowLeft,
  Plus,
  History,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  Trash2,
} from "lucide-react";

interface AdminPageProps {
  navigate: (to: string) => void;
  addToast: (type: "success" | "error" | "info", title: string, message: string) => void;
}

export function AdminPage({ navigate, addToast }: AdminPageProps) {
  const queryClient = useQueryClient();

  // Selected User
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");

  // Product Filter
  const [productSearch, setProductSearch] = useState<string>("");

  // Dedicated direct set balance form state
  const [formUserId, setFormUserId] = useState<string>("");
  const [formProductId, setFormProductId] = useState<string>("");
  const [formQuantity, setFormQuantity] = useState<number | string>(5);
  const [formError, setFormError] = useState<string | null>(null);

  // Per-product custom quantity input state map: { [productId]: number }
  const [customQuantities, setCustomQuantities] = useState<Record<string, number | string>>({});

  // Loading state for specific product updates: productId -> boolean
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState<boolean>(false);

  // Fetch Users
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

  // Fetch Products
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

  // Set default user
  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].id);
      setFormUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  // Set default product for direct form
  useEffect(() => {
    if (products.length > 0 && !formProductId) {
      setFormProductId(products[0].id);
    }
  }, [products, formProductId]);

  // Fetch balances for selected user
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

  // Fetch activations for selected user (for audit)
  const {
    data: activationsResponse,
    isLoading: isActivationsLoading,
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

  const setBalanceMutation = useSetVoucherBalance();

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const totalUserVouchers = balances.reduce((sum, b) => sum + (b.quantity || 0), 0);

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
  }, [users, userSearch]);

  // Filtered balances
  const filteredBalances = useMemo(() => {
    if (!productSearch.trim()) return balances;
    const q = productSearch.toLowerCase();
    return balances.filter(
      (b) => b.product_name.toLowerCase().includes(q) || b.product_id.toLowerCase().includes(q),
    );
  }, [balances, productSearch]);

  // Helper to update a balance
  const handleUpdateBalance = async (
    userId: string,
    productId: string,
    productName: string,
    targetQuantity: number,
  ) => {
    if (targetQuantity < 0) {
      addToast("error", "Неверное количество", "Баланс не может быть меньше 0.");
      return;
    }

    setUpdatingProductId(productId);
    try {
      await setBalanceMutation.mutateAsync({
        userId,
        productId,
        data: { quantity: targetQuantity },
      });

      addToast(
        "success",
        "Баланс обновлен",
        `«${productName}»: установлен баланс ${targetQuantity} шт.`,
      );

      // Invalidate balances
      queryClient.invalidateQueries({
        queryKey: getGetUserBalancesQueryKey(userId),
      });
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      addToast("error", "Ошибка обновления", error?.message || "Не удалось обновить баланс.");
    } finally {
      setUpdatingProductId(null);
    }
  };

  // Quick increment handler
  const handleQuickAdd = async (productId: string, productName: string, delta: number) => {
    if (!selectedUserId) return;
    const currentItem = balances.find((b) => b.product_id === productId);
    const currentQty = currentItem ? currentItem.quantity : 0;
    const newQty = Math.max(0, currentQty + delta);
    await handleUpdateBalance(selectedUserId, productId, productName, newQty);
  };

  // Quick reset to 0
  const handleResetZero = async (productId: string, productName: string) => {
    if (!selectedUserId) return;
    await handleUpdateBalance(selectedUserId, productId, productName, 0);
  };

  // Direct set handler from per-row input
  const handleCustomSet = async (productId: string, productName: string) => {
    if (!selectedUserId) return;
    const val = customQuantities[productId];
    if (val === undefined || val === "") return;
    const qty = Number(val);
    if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      addToast("error", "Ошибка", "Введите целое неотрицательное число.");
      return;
    }
    await handleUpdateBalance(selectedUserId, productId, productName, qty);
    setCustomQuantities((prev) => ({ ...prev, [productId]: "" }));
  };

  // Bulk add to all products for the selected user
  const handleBulkAdd = async (delta: number) => {
    if (!selectedUserId || balances.length === 0) return;
    setIsBulkUpdating(true);

    try {
      for (const item of balances) {
        const nextQty = Math.max(0, item.quantity + delta);
        await setBalanceMutation.mutateAsync({
          userId: selectedUserId,
          productId: item.product_id,
          data: { quantity: nextQty },
        });
      }

      addToast(
        "success",
        "Массовое начисление",
        `Начислено +${delta} ваучеров на все ${balances.length} продуктов для ${selectedUser?.name}.`,
      );

      queryClient.invalidateQueries({
        queryKey: getGetUserBalancesQueryKey(selectedUserId),
      });
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      addToast("error", "Ошибка массового начисления", error?.message || "Не удалось обновить балансы.");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Submit explicit balance form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const qty = Number(formQuantity);
    if (isNaN(qty) || qty < 0 || !Number.isInteger(qty)) {
      setFormError("Количество должно быть целым неотрицательным числом (≥ 0).");
      return;
    }

    if (!formUserId || !formProductId) {
      setFormError("Выберите пользователя и продукт.");
      return;
    }

    try {
      await setBalanceMutation.mutateAsync({
        userId: formUserId,
        productId: formProductId,
        data: { quantity: qty },
      });

      const targetProduct = products.find((p) => p.id === formProductId)?.name || "продукта";
      const targetUser = users.find((u) => u.id === formUserId)?.name || "пользователя";

      addToast(
        "success",
        "Запас обновлен",
        `Установлен баланс ${qty} шт. для ${targetUser} (${targetProduct}).`,
      );

      queryClient.invalidateQueries({
        queryKey: getGetUserBalancesQueryKey(formUserId),
      });
    } catch (err: unknown) {
      const error = err as ErrorResponse;
      setFormError(error?.message || "Ошибка при сохранении баланса.");
      addToast("error", "Ошибка сохранения", error?.message || "Не удалось сохранить баланс.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 font-sans text-foreground">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">В портал</span>
            </Button>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-base sm:text-lg leading-tight">Панель администратора</h1>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 text-[10px] py-0 px-2">
                    ADMIN
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Начисление и управление балансами ваучеров</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchUsers();
                refetchProducts();
                refetchBalances();
                refetchActivations();
              }}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Синхронизировать</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Global errors */}
        {(isUsersError || isProductsError) && (
          <Alert variant="destructive">
            <AlertTitle>Ошибка загрузки данных</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>Не удалось получить список пользователей или продуктов с сервера.</span>
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

        {/* Top Control Bar: Active User Selector & Bulk Operations */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* User selector block */}
          <Card className="lg:col-span-8 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Выбранный клиент для управления
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {isUsersLoading ? (
                      <Skeleton className="h-9 w-48" />
                    ) : (
                      <select
                        value={selectedUserId}
                        onChange={(e) => {
                          setSelectedUserId(e.target.value);
                          setFormUserId(e.target.value);
                        }}
                        className="font-semibold text-base bg-background border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                      >
                        {filteredUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {selectedUser && (
                      <Badge variant="secondary" className="font-mono text-[11px]">
                        ID: {selectedUser.id}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* User stats */}
              <div className="flex items-center gap-4 bg-muted/30 px-4 py-2.5 rounded-xl border">
                <div>
                  <span className="text-xs text-muted-foreground block">Суммарно ваучеров:</span>
                  <div className="h-8 flex items-center">
                    {isBalancesLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <span className="text-2xl font-bold text-primary">
                        {totalUserVouchers} шт.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Bulk Actions for this user */}
            <div className="mt-5 pt-4 border-t flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Быстрые действия для всех продуктов:</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={isBulkUpdating || balances.length === 0}
                  onClick={() => handleBulkAdd(1)}
                  className="gap-1 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  +1 на все
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={isBulkUpdating || balances.length === 0}
                  onClick={() => handleBulkAdd(5)}
                  className="gap-1 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  +5 на все
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={isBulkUpdating || balances.length === 0}
                  onClick={() => handleBulkAdd(10)}
                  className="gap-1 font-semibold"
                >
                  <Plus className="w-3 h-3" />
                  +10 на все
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick Filter Users */}
          <Card className="lg:col-span-4 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Поиск клиента
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Имя или ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-3 flex items-center justify-between">
              <span>Найдено клиентов:</span>
              <span className="font-semibold text-foreground">{filteredUsers.length}</span>
            </div>
          </Card>
        </div>

        {/* Two Column Layout: Balances Table vs Direct Set Form & History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Product Balances Management Table */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" />
                  <span>Управление остатками по продуктам</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Добавление и сброс ваучеров для клиента «{selectedUser?.name || "..."}»
                </p>
              </div>

              {/* Product Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Фильтр продуктов..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {isBalancesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Card key={i} className="p-4 border border-border shadow-xs">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-5 w-14 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-64" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-28 rounded-lg" />
                        <Skeleton className="h-8 w-16 rounded-md" />
                        <Skeleton className="h-8 w-28 rounded-md" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : isBalancesError ? (
              <Alert variant="destructive">
                <AlertTitle>Ошибка загрузки балансов</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>Не удалось загрузить текущие балансы.</span>
                  <Button variant="outline" size="xs" onClick={() => refetchBalances()}>
                    Повторить
                  </Button>
                </AlertDescription>
              </Alert>
            ) : filteredBalances.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Layers className="w-8 h-8 mx-auto opacity-40 mb-2" />
                <p className="text-sm font-medium">Продукты не найдены</p>
                <p className="text-xs opacity-75">Попробуйте изменить поисковый запрос.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredBalances.map((item) => {
                  const isUpdating = updatingProductId === item.product_id;
                  const isZero = item.quantity === 0;
                  const customVal = customQuantities[item.product_id] ?? "";

                  return (
                    <Card
                      key={item.product_id}
                      className={`p-4 transition-all duration-200 border ${
                        isZero
                          ? "border-muted/60 bg-muted/5 opacity-85 hover:opacity-100"
                          : "border-border shadow-xs hover:shadow-md"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Product Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm leading-snug truncate">
                              {item.product_name}
                            </h3>
                            <Badge
                              variant={isZero ? "secondary" : "success"}
                              className="text-xs font-bold px-2 py-0.5 shrink-0"
                            >
                              {item.quantity} шт.
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                            ID: {item.product_id}
                          </p>
                        </div>

                        {/* Actions Toolbar */}
                        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
                          {/* Quick Addition buttons */}
                          <div className="flex items-center rounded-lg border bg-background p-0.5 shadow-xs">
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={isUpdating}
                              onClick={() => handleQuickAdd(item.product_id, item.product_name, 1)}
                              className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
                              title="Добавить 1 ваучер"
                            >
                              +1
                            </Button>
                            <div className="w-px h-4 bg-border" />
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={isUpdating}
                              onClick={() => handleQuickAdd(item.product_id, item.product_name, 5)}
                              className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
                              title="Добавить 5 ваучеров"
                            >
                              +5
                            </Button>
                            <div className="w-px h-4 bg-border" />
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={isUpdating}
                              onClick={() => handleQuickAdd(item.product_id, item.product_name, 10)}
                              className="h-7 px-2 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
                              title="Добавить 10 ваучеров"
                            >
                              +10
                            </Button>
                          </div>

                          {/* Quick Reset to 0 */}
                          <Button
                            variant="outline"
                            size="xs"
                            disabled={isUpdating || isZero}
                            onClick={() => handleResetZero(item.product_id, item.product_name)}
                            className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Сбросить остаток до 0"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            0
                          </Button>

                          {/* Direct Set Input */}
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Задать..."
                              value={customVal}
                              onChange={(e) =>
                                setCustomQuantities((prev) => ({
                                  ...prev,
                                  [item.product_id]: e.target.value,
                                }))
                              }
                              className="h-7 w-20 text-xs px-2"
                            />
                            <Button
                              size="xs"
                              disabled={isUpdating || customVal === ""}
                              onClick={() => handleCustomSet(item.product_id, item.product_name)}
                              className="h-7 px-2 text-xs"
                            >
                              {isUpdating ? (
                                <RotateCcw className="w-3 h-3 animate-spin" />
                              ) : (
                                "ОК"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Precision Form & User Audit Trail */}
          <div className="lg:col-span-4 space-y-6">
            {/* Direct Balance Setter Form */}
            <Card className="border-primary/20 shadow-md">
              <CardHeader className="bg-primary/5 border-b rounded-t-xl p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span>Точная установка баланса</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Установка абсолютного значения для любой пары клиент-продукт
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <form onSubmit={handleFormSubmit} className="space-y-3.5">
                  {formError && (
                    <Alert variant="destructive">
                      <AlertDescription className="text-xs">{formError}</AlertDescription>
                    </Alert>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Клиент
                    </label>
                    <select
                      value={formUserId}
                      onChange={(e) => setFormUserId(e.target.value)}
                      className="w-full bg-background border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Продукт (русификация/услуга)
                    </label>
                    <select
                      value={formProductId}
                      onChange={(e) => setFormProductId(e.target.value)}
                      className="w-full bg-background border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Абсолютное количество (≥ 0)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={setBalanceMutation.isPending}
                    className="w-full h-8 text-xs font-semibold gap-1.5 mt-2"
                  >
                    {setBalanceMutation.isPending ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Сохранить в БД</span>
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Audit Log for Selected User */}
            <Card className="shadow-xs overflow-hidden">
              <CardHeader className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm">Журнал списаний</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {activations.length} записей
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Списания ваучеров клиента «{selectedUser?.name || "..."}»
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                {isActivationsLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-3/4" />
                  </div>
                ) : activations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Списаний пока не производилось.
                  </div>
                ) : (
                  <ul className="divide-y max-h-[380px] overflow-y-auto">
                    {activations.map((item) => {
                      const dateObj = new Date(item.activated_at);
                      const formatted = dateObj.toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <li key={item.id} className="p-3 text-xs flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{item.product_name}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatted}</span>
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

export default AdminPage;

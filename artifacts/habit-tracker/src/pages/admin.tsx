import { Link } from "wouter";
import { format } from "date-fns";
import { ShieldCheck, ArrowLeft, Loader2, Check, X, Trash2, RefreshCw, Save } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { useListUsers, useApproveUser, useRejectUser, useDeleteUser } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey } from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/api${path}`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: users, isLoading, isFetching, refetch } = useListUsers({
    query: { refetchInterval: 30000, refetchOnWindowFocus: true, staleTime: 0 } as any
  });
  const approveMut = useApproveUser();
  const rejectMut = useRejectUser();
  const deleteMut = useDeleteUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [slotsInput, setSlotsInput] = useState<string>("0");
  const [savingSlots, setSavingSlots] = useState(false);
  const inputSyncedRef = useRef(false);

  const { data: settingsData } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/settings/public?_=${Date.now()}`));
      if (!res.ok) return { freeSlotsUsed: 0 };
      return res.json() as Promise<{ freeSlotsUsed: number }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const slotsUsed = settingsData?.freeSlotsUsed ?? 0;

  useEffect(() => {
    if (settingsData && !inputSyncedRef.current) {
      setSlotsInput(String(settingsData.freeSlotsUsed ?? 0));
      inputSyncedRef.current = true;
    }
  }, [settingsData]);

  const handleSaveSlots = async () => {
    const val = parseInt(slotsInput, 10);
    if (isNaN(val) || val < 0 || val > 100) {
      toast({ title: "Valor inválido", description: "Ingresa un número entre 0 y 100", variant: "destructive" });
      return;
    }
    setSavingSlots(true);
    try {
      const res = await fetch(getApiUrl("/admin/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "free_slots_used", value: String(val) }),
      });
      const data = await res.json();
      if (data.ok) {
        queryClient.invalidateQueries({ queryKey: ["public-settings"] });
        toast({ title: "✅ Contador actualizado", description: `Ahora muestra ${val} de 100 accesos tomados.`, duration: 2000 });
      } else {
        toast({ title: "Error", description: data.error || "No se pudo guardar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    } finally {
      setSavingSlots(false);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-red-500 font-bold">Acceso Denegado</p>
      </div>
    );
  }

  const handleApprove = (id: string) => {
    approveMut.mutate(
      { userId: id },
      {
        onSuccess: () => {
          toast({ title: "Usuario aprobado", duration: 2000 });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  const handleReject = (id: string) => {
    rejectMut.mutate(
      { userId: id },
      {
        onSuccess: () => {
          toast({ title: "Usuario rechazado", description: "Se envió email de notificación al usuario.", duration: 2000 });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDelete({ id, name });
  };

  const confirmDeleteUser = () => {
    if (!confirmDelete) return;
    deleteMut.mutate(
      { userId: confirmDelete.id },
      {
        onSuccess: () => {
          toast({ title: "Usuario eliminado", description: "El usuario fue eliminado permanentemente.", duration: 2000 });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setConfirmDelete(null);
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo eliminar el usuario.", variant: "destructive" });
          setConfirmDelete(null);
        }
      }
    );
  };

  const filteredUsers = users?.filter(u => filter === "all" || u.status === filter) || [];

  return (
    <div className="min-h-screen bg-background pb-20">

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Eliminar usuario</h3>
                <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              ¿Eliminar permanentemente a <strong>{confirmDelete.name}</strong>? El usuario tendrá que registrarse nuevamente desde cero.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMut.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={confirmDeleteUser}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Eliminar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white sticky top-0 z-20 border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl">Panel de Administración</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── FOMO counter card ── */}
        <div className="bg-white border border-border rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-xl">🔥</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground mb-1">Contador de accesos gratuitos (Landing)</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Este número se muestra en la landing page como "X de 100 accesos tomados". Actualízalo manualmente cuando aprueben nuevos usuarios.
              </p>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={slotsInput}
                    onChange={e => setSlotsInput(e.target.value)}
                    className="w-24 h-10 border border-border rounded-xl px-3 text-center font-bold text-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <span className="text-muted-foreground text-sm font-medium">de 100</span>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={handleSaveSlots}
                  disabled={savingSlots}
                >
                  {savingSlots ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar
                </Button>
              </div>

              {/* Mini progress bar */}
              <div className="mt-3">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full max-w-xs">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((slotsUsed / 100) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{100 - slotsUsed} accesos disponibles</p>
              </div>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full">
          <TabsList className="mb-6 bg-white border border-border h-12 rounded-xl p-1 shadow-sm">
            <TabsTrigger value="all" className="rounded-lg h-full px-6">
              Todos {users && users.length > 0 && <span className="ml-1.5 bg-gray-200 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{users.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg h-full px-6">
              Pendientes {users && users.filter(u => u.status === 'pending').length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {users.filter(u => u.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="rounded-lg h-full px-6">Activos</TabsTrigger>
            <TabsTrigger value="rejected" className="rounded-lg h-full px-6">Rechazados</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Registro</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                          No hay usuarios en esta categoría
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-foreground">{u.name}</td>
                          <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              u.status === 'active' ? 'bg-green-100 text-green-700' : 
                              u.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {format(new Date(u.createdAt), "dd/MM/yyyy")}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {u.status !== 'active' && u.status !== 'rejected' && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 border-green-200 text-green-600 hover:bg-green-50"
                                  onClick={() => handleApprove(u.id)}
                                  disabled={approveMut.isPending || u.role === 'admin'}
                                >
                                  <Check className="w-4 h-4 mr-1" /> Aprobar
                                </Button>
                              )}
                              {u.status !== 'rejected' && u.role !== 'admin' && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => handleReject(u.id)}
                                  disabled={rejectMut.isPending}
                                >
                                  <X className="w-4 h-4 mr-1" /> Rechazar
                                </Button>
                              )}
                              {u.status === 'rejected' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(String(u.id), u.name)}
                                  disabled={deleteMut.isPending}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Tabs>
        
      </main>
    </div>
  );
}

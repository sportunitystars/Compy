import { Link } from "wouter";
import { format } from "date-fns";
import { ShieldCheck, ArrowLeft, Loader2, Check, X } from "lucide-react";
import { useState } from "react";

import { useListUsers, useApproveUser, useRejectUser } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListUsersQueryKey } from "@workspace/api-client-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: users, isLoading } = useListUsers();
  const approveMut = useApproveUser();
  const rejectMut = useRejectUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-500 font-bold">Acceso Denegado</p>
      </div>
    );
  }

  const handleApprove = (id: number) => {
    approveMut.mutate(
      { userId: id },
      {
        onSuccess: () => {
          toast({ title: "Usuario aprobado" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  const handleReject = (id: number) => {
    rejectMut.mutate(
      { userId: id },
      {
        onSuccess: () => {
          toast({ title: "Usuario rechazado" });
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      }
    );
  };

  const filteredUsers = users?.filter(u => filter === "all" || u.status === filter) || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white sticky top-0 z-20 border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <span className="font-display font-bold text-xl">Panel de Administración</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <Tabs defaultValue="all" onValueChange={setFilter} className="w-full">
          <TabsList className="mb-6 bg-white border border-border h-12 rounded-xl p-1 shadow-sm">
            <TabsTrigger value="all" className="rounded-lg h-full px-6">Todos</TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg h-full px-6">Pendientes</TabsTrigger>
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
                              {u.status !== 'active' && (
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

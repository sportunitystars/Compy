import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function PendingScreen() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-xl shadow-black/5"
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/pending-illustration.png`} 
          alt="Cuenta pendiente" 
          className="w-48 h-48 mx-auto mb-6 object-contain"
        />
        <h1 className="text-3xl font-display font-bold text-gray-900 mb-4">Cuenta en Revisión</h1>
        <p className="text-gray-600 mb-8 text-lg">
          ¡Gracias por registrarte! El administrador debe aprobar tu cuenta para que puedas acceder al sistema. Te daremos acceso muy pronto.
        </p>
        <Button onClick={logout} variant="outline" className="rounded-xl h-12 px-6">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
        </Button>
      </motion.div>
    </div>
  );
}

export function RejectedScreen() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-xl shadow-black/5"
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/rejected-illustration.png`} 
          alt="Acceso denegado" 
          className="w-48 h-48 mx-auto mb-6 object-contain"
        />
        <h1 className="text-3xl font-display font-bold text-red-600 mb-4">Acceso Denegado</h1>
        <p className="text-gray-600 mb-8 text-lg">
          Tu cuenta no ha sido aprobada para utilizar el sistema. Por favor contacta al administrador para más información.
        </p>
        <Button onClick={logout} variant="outline" className="rounded-xl h-12 px-6 border-red-200 text-red-600 hover:bg-red-50">
          <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
        </Button>
      </motion.div>
    </div>
  );
}

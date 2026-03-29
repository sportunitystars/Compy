import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useToast } from "@/hooks/use-toast";

export function PushToggle() {
  const { state, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

  if (state === "unsupported") return null;

  const handleClick = async () => {
    if (state === "granted") {
      await unsubscribe();
      toast({ title: "Notificaciones desactivadas", duration: 2000 });
    } else if (state === "denied") {
      toast({
        title: "Notificaciones bloqueadas",
        description: "Actívalas en la configuración de tu navegador.",
        variant: "destructive",
      });
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "¡Notificaciones activadas!", description: "Te avisaremos cuando tengas una racha negativa activa.", duration: 2000 });
      } else if (Notification.permission === "denied") {
        toast({
          title: "Permiso denegado",
          description: "Para activarlas, permite notificaciones en tu navegador.",
          variant: "destructive",
        });
      }
    }
  };

  const icon =
    state === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> :
    state === "granted" ? <BellRing className="w-4 h-4 text-primary" /> :
    state === "denied" ? <BellOff className="w-4 h-4 text-muted-foreground" /> :
    <Bell className="w-4 h-4 text-muted-foreground" />;

  const title =
    state === "granted" ? "Notificaciones activas" :
    state === "denied" ? "Notificaciones bloqueadas" :
    "Activar notificaciones";

  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      onClick={handleClick}
      disabled={state === "loading"}
      className="rounded-full"
    >
      {icon}
    </Button>
  );
}

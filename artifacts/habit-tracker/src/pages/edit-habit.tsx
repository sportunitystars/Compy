import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Check, Plus, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useGetHabit, useUpdateHabit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const PALETTE = [
  "#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6b7280", "#1e293b"
];

const EMOJI_CATEGORIES = [
  { label: "Salud", icon: "💪", emojis: ["💧", "🏃‍♂️", "🏋️‍♂️", "🧘‍♀️", "🚴‍♂️", "🤸‍♀️", "🏊‍♂️", "🚶‍♂️", "💊", "🩺", "🦷", "😴", "💤", "🛌", "❤️", "🫁"] },
  { label: "Comida", icon: "🍽️", emojis: ["🍎", "🥗", "🥦", "🍳", "🥤", "☕", "🍵", "🫖", "🚭", "🍺", "🍬", "🥩", "🫐", "🥑", "🍋", "🫚"] },
  { label: "Mente", icon: "🧠", emojis: ["🧠", "📓", "📖", "✍️", "🎯", "🙏", "🌅", "🌞", "🌙", "⭐", "🔥", "✅", "🎉", "💡", "🧩", "🪷"] },
  { label: "Trabajo", icon: "💼", emojis: ["💸", "💰", "📊", "💻", "📱", "⏰", "📅", "📋", "🗒️", "📧", "🔑", "🏆", "🎓", "📚", "🖊️", "🗂️"] },
  { label: "Arte", icon: "🎨", emojis: ["🎨", "🎸", "🎹", "🎵", "🎬", "📷", "✂️", "🧶", "🪡", "🎭", "🖼️", "🎲", "🃏", "🎮", "🧸", "🌿"] },
  { label: "Hogar", icon: "🏠", emojis: ["🏠", "🌱", "🐕", "🐈", "👨‍👩‍👧", "💬", "🤝", "📞", "💌", "🧹", "🛁", "🌳", "🌻", "🫂", "❄️", "☀️"] },
];

const editHabitSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  emoji: z.string().min(1, "Selecciona un emoji"),
  options: z.array(z.object({
    label: z.string().min(1, "La etiqueta es requerida"),
    color: z.string(),
    isPositive: z.boolean(),
    isNegative: z.boolean(),
    isExempt: z.boolean()
  })).min(2, "Mínimo 2 opciones").max(6, "Máximo 6 opciones")
});

type FormValues = z.infer<typeof editHabitSchema>;

export default function EditHabit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: habit, isLoading } = useGetHabit(id);
  const updateMutation = useUpdateHabit();

  const form = useForm<FormValues>({
    resolver: zodResolver(editHabitSchema),
    defaultValues: {
      name: "",
      emoji: "💧",
      options: [
        { label: "Sí", color: "#22c55e", isPositive: true, isNegative: false, isExempt: false },
        { label: "No", color: "#ef4444", isPositive: false, isNegative: true, isExempt: false }
      ]
    },
  });

  useEffect(() => {
    if (habit) {
      form.reset({
        name: habit.name,
        emoji: (habit as any).emoji ?? "✨",
        options: ((habit.options as any[]) ?? []).map((o: any) => ({
          label: o.label,
          color: o.color,
          isPositive: o.isPositive ?? false,
          isNegative: o.isNegative ?? false,
          isExempt: o.isExempt ?? false,
        })),
      });
    }
  }, [habit]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options"
  });


  const onSubmit = (values: FormValues) => {
    const posCount = values.options.filter(o => o.isPositive).length;
    const negCount = values.options.filter(o => o.isNegative).length;

    if (posCount > 1 || negCount > 1) {
      toast({
        title: "Revisa las opciones",
        description: "Solo puede haber una opción positiva (🔥) y una negativa (⚡)",
        variant: "destructive"
      });
      return;
    }

    updateMutation.mutate(
      { habitId: id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Hábito actualizado" });
          queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
          queryClient.invalidateQueries({ queryKey: [`/api/habits/${id}`] });
          setLocation(`/habits/${id}`);
        },
        onError: () => {
          toast({
            title: "Error al actualizar",
            description: "No pudimos guardar los cambios. Intenta de nuevo.",
            variant: "destructive"
          });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white sticky top-0 z-10 border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href={`/habits/${id}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-display font-bold text-xl">Editar Hábito</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-border">
              <h2 className="text-lg font-bold mb-6">Información Básica</h2>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8">
                <FormField
                  control={form.control}
                  name="emoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icono</FormLabel>
                      <FormControl>
                        <div className="border border-border rounded-2xl overflow-hidden">
                          <div className="h-48 overflow-y-auto p-2 bg-gray-50">
                            <div className="grid grid-cols-10 gap-1">
                              {EMOJI_CATEGORIES.flatMap(cat => cat.emojis).map((em, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => field.onChange(em)}
                                  className={`text-xl h-9 rounded-lg flex items-center justify-center transition-all ${
                                    field.value === em
                                      ? 'bg-white border-2 border-primary shadow-sm scale-110'
                                      : 'hover:bg-white/70 border-2 border-transparent'
                                  }`}
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="px-3 py-2 bg-white border-t border-border flex items-center gap-2 min-h-[40px]">
                            {field.value
                              ? <><span className="text-xl">{field.value}</span><span className="text-xs text-muted-foreground">Seleccionado</span></>
                              : <span className="text-xs text-muted-foreground">Toca un ícono para seleccionar</span>
                            }
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del hábito</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Beber agua, Leer, Meditar..."
                          className="h-14 text-lg rounded-xl bg-gray-50/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold">Opciones de Registro</h2>
                  <p className="text-sm text-muted-foreground mt-1">Define qué opciones usarás cada día para este hábito. Máximo 6.</p>
                </div>
                {fields.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ label: "Nueva opción", color: "#6b7280", isPositive: false, isNegative: false, isExempt: false })}
                    className="rounded-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Agregar
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 rounded-2xl border border-border bg-gray-50/30 flex flex-col sm:flex-row gap-4 sm:items-start relative group">

                    <FormField
                      control={form.control}
                      name={`options.${index}.label`}
                      render={({ field: inputField }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Etiqueta</FormLabel>
                          <FormControl>
                            <Input className="h-11 bg-white" {...inputField} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`options.${index}.color`}
                      render={({ field: colorField }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Color</FormLabel>
                          <FormControl>
                            <div className="flex flex-wrap gap-2 w-full">
                              {PALETTE.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => colorField.onChange(c)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
                                  style={{ backgroundColor: c }}
                                >
                                  {colorField.value === c && <Check className="w-4 h-4 text-white" />}
                                </button>
                              ))}
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-row sm:flex-col gap-2 pt-1 sm:pt-6">
                      <Button
                        type="button"
                        variant={form.watch(`options.${index}.isPositive`) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const isPos = form.watch(`options.${index}.isPositive`);
                          if (!isPos) {
                            fields.forEach((_, i) => form.setValue(`options.${i}.isPositive`, false));
                          }
                          form.setValue(`options.${index}.isPositive`, !isPos);
                          if (!isPos) { form.setValue(`options.${index}.isNegative`, false); form.setValue(`options.${index}.isExempt`, false); }
                        }}
                        className={`text-xs h-8 ${form.watch(`options.${index}.isPositive`) ? 'bg-green-500 hover:bg-green-600' : ''}`}
                      >
                        🔥 Positivo
                      </Button>
                      <Button
                        type="button"
                        variant={form.watch(`options.${index}.isNegative`) ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => {
                          const isNeg = form.watch(`options.${index}.isNegative`);
                          if (!isNeg) {
                            fields.forEach((_, i) => form.setValue(`options.${i}.isNegative`, false));
                          }
                          form.setValue(`options.${index}.isNegative`, !isNeg);
                          if (!isNeg) { form.setValue(`options.${index}.isPositive`, false); form.setValue(`options.${index}.isExempt`, false); }
                        }}
                        className="text-xs h-8"
                      >
                        ⚡ Negativo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const isEx = form.watch(`options.${index}.isExempt`);
                          if (!isEx) {
                            fields.forEach((_, i) => form.setValue(`options.${i}.isExempt`, false));
                          }
                          form.setValue(`options.${index}.isExempt`, !isEx);
                          if (!isEx) { form.setValue(`options.${index}.isPositive`, false); form.setValue(`options.${index}.isNegative`, false); }
                        }}
                        className={`text-xs h-8 transition-all ${form.watch(`options.${index}.isExempt`) ? 'bg-slate-500 text-white border-slate-500 hover:bg-slate-600' : 'border-dashed'}`}
                      >
                        ⊘ Exceptuado
                      </Button>
                    </div>

                    {fields.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white border border-border text-red-500 hover:bg-red-50 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                disabled={updateMutation.isPending}
                className="w-full sm:w-auto px-10 h-14 rounded-xl text-lg shadow-lg shadow-primary/25"
              >
                {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}

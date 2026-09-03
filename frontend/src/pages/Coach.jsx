import AIChat from "../components/AIChat";

// Coach ocupa todo el espacio disponible — AppShell le da flex-1 + overflow-hidden
// cuando la ruta es /coach, así el chat llena la pantalla sin scroll de página.
export default function Coach() {
  return <AIChat />;
}

import { AppShell } from "@/components/shell/app-shell";
import { ChatView } from "@/components/chat/chat-view";

export default function Home() {
  return (
    <AppShell view="chat">
      <ChatView />
    </AppShell>
  );
}

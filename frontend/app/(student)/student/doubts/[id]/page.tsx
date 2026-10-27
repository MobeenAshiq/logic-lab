import { ChatRoom } from "@/components/chat/chat-room";

export default async function StudentDoubtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatRoom conversationId={id} backHref="/student/doubts" />;
}

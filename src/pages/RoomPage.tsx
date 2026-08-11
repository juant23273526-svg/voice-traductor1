import { useParams, useSearchParams } from 'react-router-dom';
import { RoomView } from '@/components/liveroom/RoomView';
import type { RoomParticipantRole } from '@/types';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const role: RoomParticipantRole = searchParams.get('role') === 'host' ? 'host' : 'guest';
  const hostLanguage = searchParams.get('hostLang') ?? 'es';
  const guestLanguage = searchParams.get('guestLang') ?? 'en';

  if (!roomId) {
    return <p className="p-6 text-center text-sm text-rose-400">Sala invalida</p>;
  }

  return (
    <RoomView roomId={roomId} role={role} hostLanguage={hostLanguage} guestLanguage={guestLanguage} />
  );
}

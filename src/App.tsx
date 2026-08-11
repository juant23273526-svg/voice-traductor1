import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SlangPage } from '@/pages/SlangPage';
import { LiveRoomHomePage } from '@/pages/LiveRoomHomePage';
import { RoomPage } from '@/pages/RoomPage';
import { ClipStudioPage } from '@/pages/ClipStudioPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SlangPage />} />
        <Route path="/live" element={<LiveRoomHomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/clips" element={<ClipStudioPage />} />
      </Routes>
    </Layout>
  );
}

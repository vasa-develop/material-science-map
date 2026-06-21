import { Routes, Route } from "react-router-dom";
import PixiStage from "./components/PixiStage";
import ProtoGallery from "./proto/ProtoGallery";
import LivingMap from "./map/LivingMap";
import LivingMapLab from "./map/LivingMapLab";
import NodeDetail from "./map/NodeDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LivingMap />} />
      <Route path="/lab" element={<LivingMapLab />} />
      <Route path="/n/:id" element={<NodeDetail />} />
      <Route path="/pixi" element={<PixiStage />} />
      <Route path="/proto" element={<ProtoGallery />} />
    </Routes>
  );
}
